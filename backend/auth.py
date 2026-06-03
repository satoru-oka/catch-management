import logging

import httpx
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

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


def _require_credentials(
    credentials: HTTPAuthorizationCredentials | None,
) -> HTTPAuthorizationCredentials:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return credentials


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


def _is_named_error(exc: Exception, name: str) -> bool:
    return exc.__class__.__name__ == name


def _is_auth_service_unavailable_error(exc: Exception) -> bool:
    return isinstance(exc, httpx.HTTPError) or _is_named_error(exc, "AuthRetryableError")


def _is_invalid_token_error(exc: Exception) -> bool:
    return _is_named_error(exc, "AuthApiError")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> str:
    credentials = _require_credentials(credentials)
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
        if _is_auth_service_unavailable_error(e):
            raise HTTPException(status_code=503, detail="Auth service unavailable") from e
        if _is_invalid_token_error(e):
            raise HTTPException(status_code=401, detail="Invalid token") from e
        logger.exception("Unexpected error during JWT verification")
        raise HTTPException(status_code=500, detail="Internal error") from e


def get_supabase(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> Client:
    credentials = _require_credentials(credentials)
    # PostgRESTにユーザーJWTを渡すことで auth.uid() が解決され RLS が効く
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(credentials.credentials)
    return client
