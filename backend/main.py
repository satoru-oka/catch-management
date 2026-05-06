from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError

from routers import catches, lures, sessions, spots

app = FastAPI(title="釣果管理アプリ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    return JSONResponse(status_code=500, content={"detail": "Database error"})


app.include_router(spots.router)
app.include_router(sessions.router)
app.include_router(catches.router)
app.include_router(lures.router)


@app.get("/")
def root():
    return {"message": "釣果管理アプリ API 起動中"}
