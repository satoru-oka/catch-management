import os

from dotenv import load_dotenv
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
