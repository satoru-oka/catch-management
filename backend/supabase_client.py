import os

import httpx
from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from supabase import Client, create_client

load_dotenv()

_supabase_url = os.getenv("SUPABASE_URL")
_supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

if not _supabase_url or not _supabase_anon_key:
    raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY が設定されていません")

SUPABASE_URL: str = _supabase_url
SUPABASE_ANON_KEY: str = _supabase_anon_key
SUPABASE_JWT_SECRET: str | None = os.getenv("SUPABASE_JWT_SECRET")

# 認証 (JWT検証) 専用の共有クライアント。DBアクセスはRLSが効くユーザースコープ版を使う。
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# ---------------------------------------------------------------------------
# リクエストスコープの PostgREST クライアント (#70)
#
# 旧実装は get_supabase でリクエスト毎に create_client() を呼んでいた。これは
# auth / storage / functions / realtime まで含む HTTP セッション群を毎回生成し、
# 明示 close されないため負荷時にソケットを食い潰す。runtime で使うのは
# db.table(...) (= PostgREST) だけなので、PostgREST クライアントのみを
# リクエスト毎に組み立て、TCP 接続プールはプロセス内で共有する。
#
# JWT 混線について: SyncPostgrestClient.auth(token) は共有 httpx クライアント
# ではなく「そのクライアントインスタンスの self.headers」に Authorization を
# 載せる。table() はリクエスト毎にその headers を使うため、共有プールを
# 使い回してもリクエスト間で JWT が混ざらない。
# ---------------------------------------------------------------------------

# プロセス内で共有する HTTP 接続プール (リクエスト毎に新規生成しない)。
# base_url は持たせず純粋な接続プールとして使う。宛先 URL は SyncPostgrestClient
# 側が絶対 URL で渡すため、これ 1 つで任意のホストに使い回せる
# (integration テストがテスト用 Supabase を向けるよう URL を差し替えても動く)。
_shared_rest_http_client: httpx.Client = httpx.Client(
    timeout=httpx.Timeout(120.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    follow_redirects=True,
    http2=True,
)


def create_user_postgrest(token: str) -> SyncPostgrestClient:
    """ユーザー JWT をスコープに持つ PostgREST クライアントを返す。

    共有の httpx 接続プールを使い回しつつ、認証ヘッダはクライアント単位の
    self.headers に載せる。これにより RLS が効き (auth.uid() が解決される)、
    かつリクエスト間で JWT が混線しない。

    URL / anon key はモジュールグローバルを呼び出し時に参照する。integration
    テストが `supabase_client.SUPABASE_URL` 等を差し替えると、ここも自動的に
    テスト用 Supabase を向く。
    """
    client = SyncPostgrestClient(
        f"{SUPABASE_URL.rstrip('/')}/rest/v1",
        schema="public",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        },
        http_client=_shared_rest_http_client,
    )
    client.auth(token)
    return client
