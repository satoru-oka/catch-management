import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError

from routers import catches, lures, sessions, spots

# 実行環境によっては root logger にハンドラが無く、logger.exception の出力が
# どこにも出ない可能性がある。uvicorn のログと整合する形で ERROR 以上を確実に
# stderr へ出す。LOG_LEVEL env で上書き可能 (既定 INFO)。既にハンドラがある
# 場合 (uvicorn 配下等) は basicConfig が no-op になるので安全。
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(title="釣果管理アプリ API")

# 環境ごとに ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com で上書き。
# 未設定時はローカル開発の Next.js 既定ポートのみ許可。
_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# JWT 検証エラー (PostgREST が出す PGRST301/302) は HTTP 401 にマップする。
# GET/PUT/DELETE 系は `get_current_user` 依存を持たず JWT をそのまま PostgREST に
# 転送する設計のため、ハンドラ無しでは postgrest.APIError が 500 で漏れてしまう。
# 詳細: docs/known-issues.md ISSUE-003。
@app.exception_handler(PostgrestAPIError)
async def _postgrest_api_error_handler(_request: Request, exc: PostgrestAPIError):
    code = getattr(exc, "code", None)
    if code in {"PGRST301", "PGRST302"}:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})
    # それ以外の DB / クエリエラーはサーバ側障害として 500 のまま (詳細は隠す)。
    # ただし、原因調査ができるようサーバログにはトレースバック付きで残す。
    logger.exception("Unhandled PostgREST error: code=%s", code)
    return JSONResponse(status_code=500, content={"detail": "Database error"})


# 上記で捕捉できない想定外の例外もすべて JSON で返す。
# FastAPI のデフォルトは HTML レスポンスのため、フロントの apiFetch が
# res.json() で SyntaxError になり「読み込み中...」のまま固まるのを防ぐ。
@app.exception_handler(Exception)
async def _unhandled_exception_handler(_request: Request, _exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(catches.router)
app.include_router(lures.router)
app.include_router(sessions.router)
app.include_router(spots.router)


@app.get("/")
def root():
    return {"message": "釣果管理アプリ API 起動中"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
