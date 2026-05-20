from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from database import SUPABASE_ANON_KEY, SUPABASE_URL, supabase

security = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    token = credentials.credentials
    try:
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return str(response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        # 元の例外はサーバ側ログにチェーン保持しつつ、レスポンスは「Invalid token」固定
        raise HTTPException(status_code=401, detail="Invalid token") from e


def get_supabase(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> Client:
    # PostgRESTにユーザーJWTを渡すことで auth.uid() が解決され RLS が効く
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(credentials.credentials)
    return client
