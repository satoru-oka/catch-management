from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from supabase import Client, create_client

from supabase_client import (
    SUPABASE_ANON_KEY,
    SUPABASE_JWT_SECRET,
    SUPABASE_URL,
    supabase,
)

security = HTTPBearer(auto_error=True)


def _verify_jwt_locally(token: str) -> str:
    if not SUPABASE_JWT_SECRET:
        raise RuntimeError("SUPABASE_JWT_SECRET is not configured")
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    token = credentials.credentials
    if SUPABASE_JWT_SECRET:
        return _verify_jwt_locally(token)

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
