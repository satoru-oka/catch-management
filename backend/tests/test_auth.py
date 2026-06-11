"""auth モジュールおよび liveness ルートのテスト。"""

from __future__ import annotations

import datetime as dt
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from jose import jwt
from supabase import AuthApiError, AuthRetryableError

import auth
from main import app


def _creds(token: str = "abc") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_get_current_user_returns_user_id(monkeypatch):
    user_id = "11111111-2222-3333-4444-555555555555"
    fake_response = SimpleNamespace(user=SimpleNamespace(id=user_id))

    fake_auth = SimpleNamespace(get_user=lambda token: fake_response)
    monkeypatch.setattr(auth, "supabase", SimpleNamespace(auth=fake_auth))
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    assert auth.get_current_user(_creds("good-token")) == user_id


def test_get_current_user_passes_token_to_supabase(monkeypatch):
    seen = {}

    def fake_get_user(token):
        seen["token"] = token
        return SimpleNamespace(user=SimpleNamespace(id="u"))

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=fake_get_user))
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)
    auth.get_current_user(_creds("the-token"))

    assert seen["token"] == "the-token"


def test_get_current_user_no_user_raises_401(monkeypatch):
    fake_response = SimpleNamespace(user=None)
    monkeypatch.setattr(
        auth,
        "supabase",
        SimpleNamespace(auth=SimpleNamespace(get_user=lambda t: fake_response)),
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_get_current_user_auth_service_http_error_raises_503(monkeypatch):
    def boom(_token):
        raise httpx.ConnectError("network down")

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=boom))
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 503
    assert exc.value.detail == "Auth service unavailable"


def test_get_current_user_auth_retryable_error_raises_503(monkeypatch):
    def boom(_token):
        raise AuthRetryableError("auth retryable", 503)

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=boom))
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 503
    assert exc.value.detail == "Auth service unavailable"


def test_get_current_user_auth_api_error_raises_401(monkeypatch):
    def boom(_token):
        raise AuthApiError("invalid jwt", 401, None)

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=boom))
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_get_current_user_unexpected_error_raises_500(monkeypatch):
    def boom(_token):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=boom))
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", None)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 500
    assert exc.value.detail == "Internal error"


def test_get_current_user_verifies_jwt_locally(monkeypatch):
    secret = "local-secret"
    user_id = "11111111-2222-3333-4444-555555555555"
    token = jwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5),
        },
        secret,
        algorithm="HS256",
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", secret)

    assert auth.get_current_user(_creds(token)) == user_id


def test_get_current_user_invalid_signature_raises_401(monkeypatch):
    token = jwt.encode(
        {
            "sub": "11111111-2222-3333-4444-555555555555",
            "aud": "authenticated",
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5),
        },
        "right-secret",
        algorithm="HS256",
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", "wrong-secret")

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds(token))

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_get_current_user_expired_token_raises_401(monkeypatch):
    secret = "local-secret"
    token = jwt.encode(
        {
            "sub": "11111111-2222-3333-4444-555555555555",
            "aud": "authenticated",
            "exp": dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1),
        },
        secret,
        algorithm="HS256",
    )
    monkeypatch.setattr(auth, "SUPABASE_JWT_SECRET", secret)

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds(token))

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_get_current_user_without_credentials_raises_401():
    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(None)

    assert exc.value.status_code == 401
    assert exc.value.detail == "Not authenticated"


def test_get_supabase_attaches_user_token(monkeypatch):
    captured = {}

    class FakePostgrest:
        def auth(self, token):
            captured["token"] = token

    class FakeClient:
        def __init__(self):
            self.postgrest = FakePostgrest()

    def fake_create_client(url, key):
        captured["url"] = url
        captured["key"] = key
        return FakeClient()

    monkeypatch.setattr(auth, "create_client", fake_create_client)

    client = auth.get_supabase(_creds("user-jwt"))

    assert captured["token"] == "user-jwt"
    assert captured["url"] == auth.SUPABASE_URL
    assert captured["key"] == auth.SUPABASE_ANON_KEY
    assert isinstance(client, FakeClient)


def test_get_supabase_without_credentials_raises_401():
    with pytest.raises(HTTPException) as exc:
        auth.get_supabase(None)

    assert exc.value.status_code == 401
    assert exc.value.detail == "Not authenticated"


def test_root_endpoint_returns_status_message():
    """`/` は認証不要なので素の TestClient で叩く。"""
    with TestClient(app) as c:
        res = c.get("/")
    assert res.status_code == 200
    assert res.json() == {"message": "釣果管理アプリ API 起動中"}


def test_healthz_endpoint_returns_ok():
    """`/healthz` は liveness check として認証不要で叩ける。"""
    with TestClient(app) as c:
        res = c.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_protected_endpoint_without_token_is_rejected():
    """Authorization ヘッダ無しは 401 に統一する。"""
    with TestClient(app) as c:
        res = c.get("/api/spots/")
    assert res.status_code == 401
    assert res.json() == {"detail": "Not authenticated"}


def test_postgrest_jwt_error_is_mapped_to_401(monkeypatch):
    """PostgREST が PGRST301 を返したら 500 ではなく 401 にする (ISSUE-003)。"""
    from postgrest.exceptions import APIError as PostgrestAPIError

    from auth import get_supabase

    class _RaisingTable:
        def select(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def range(self, *_a, **_k):
            return self

        def execute(self):
            raise PostgrestAPIError(
                {
                    "message": "Expected 3 parts in JWT; got 1",
                    "code": "PGRST301",
                    "hint": None,
                    "details": None,
                }
            )

    class _RaisingClient:
        def table(self, _name):
            return _RaisingTable()

    app.dependency_overrides[get_supabase] = lambda: _RaisingClient()
    try:
        with TestClient(app, headers={"Authorization": "Bearer broken"}) as c:
            res = c.get("/api/spots/")
        assert res.status_code == 401
        assert res.json() == {"detail": "Invalid token"}
    finally:
        app.dependency_overrides.clear()


def test_postgrest_other_error_is_mapped_to_500():
    """JWT 系以外の PostgREST エラーは 500 (詳細はクライアントに漏らさない)。"""
    from postgrest.exceptions import APIError as PostgrestAPIError

    from auth import get_supabase

    class _RaisingTable:
        def select(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def range(self, *_a, **_k):
            return self

        def execute(self):
            raise PostgrestAPIError(
                {
                    "message": "permission denied",
                    "code": "42501",
                    "hint": None,
                    "details": None,
                }
            )

    class _RaisingClient:
        def table(self, _name):
            return _RaisingTable()

    app.dependency_overrides[get_supabase] = lambda: _RaisingClient()
    try:
        with TestClient(app, headers={"Authorization": "Bearer x"}) as c:
            res = c.get("/api/spots/")
        assert res.status_code == 500
        assert res.json() == {"detail": "Database error"}
    finally:
        app.dependency_overrides.clear()


def test_postgrest_other_error_is_logged(caplog):
    """500 にマップされるエラーはサーバログにトレースバック付きで残ること。"""
    import logging

    from postgrest.exceptions import APIError as PostgrestAPIError

    from auth import get_supabase

    class _RaisingClient:
        def table(self, _name):
            raise PostgrestAPIError(
                {"message": "permission denied", "code": "42501", "hint": None, "details": None}
            )

    app.dependency_overrides[get_supabase] = lambda: _RaisingClient()
    try:
        with caplog.at_level(logging.ERROR, logger="main"):
            with TestClient(app, headers={"Authorization": "Bearer x"}) as c:
                c.get("/api/spots/")
        assert any(
            "Unhandled PostgREST error" in r.getMessage() for r in caplog.records
        ), "logger.exception が呼ばれていない"
    finally:
        app.dependency_overrides.clear()


def test_unhandled_exception_returns_500_json():
    """ハンドラに無い例外もデフォルト HTML ではなく 500 JSON で返ること。"""
    from auth import get_supabase

    class _BoomClient:
        def table(self, _name):
            raise RuntimeError("unexpected boom")

    app.dependency_overrides[get_supabase] = lambda: _BoomClient()
    try:
        with TestClient(
            app,
            raise_server_exceptions=False,
            headers={"Authorization": "Bearer x"},
        ) as c:
            res = c.get("/api/spots/")
        assert res.status_code == 500
        assert res.json() == {"detail": "Internal server error"}
    finally:
        app.dependency_overrides.clear()


def test_unhandled_exception_is_logged(caplog):
    """ハンドラに無い例外もサーバログに残ること。"""
    import logging

    from auth import get_supabase

    class _BoomClient:
        def table(self, _name):
            raise RuntimeError("unexpected boom")

    app.dependency_overrides[get_supabase] = lambda: _BoomClient()
    try:
        with caplog.at_level(logging.ERROR, logger="main"):
            with TestClient(
                app,
                raise_server_exceptions=False,
                headers={"Authorization": "Bearer x"},
            ) as c:
                c.get("/api/spots/")
        assert any(
            "Unhandled exception" in r.getMessage() for r in caplog.records
        ), "logger.exception が呼ばれていない"
    finally:
        app.dependency_overrides.clear()


def test_allowed_origins_env_overrides_default(monkeypatch):
    """ALLOWED_ORIGINS env が main をリロード後に反映されること。"""
    import importlib
    import sys

    monkeypatch.setenv("ALLOWED_ORIGINS", "https://prod.example.com,https://staging.example.com")
    # 既存の main モジュールを破棄して再ロード
    sys.modules.pop("main", None)
    reloaded = importlib.import_module("main")
    try:
        assert reloaded.allowed_origins == [
            "https://prod.example.com",
            "https://staging.example.com",
        ]
    finally:
        # 他のテストへの副作用を避けるため元に戻す
        sys.modules.pop("main", None)
        importlib.import_module("main")
