"""auth モジュールおよびルート (`/`) のテスト。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

import auth
from main import app


def _creds(token: str = "abc") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_get_current_user_returns_user_id(monkeypatch):
    user_id = "11111111-2222-3333-4444-555555555555"
    fake_response = SimpleNamespace(user=SimpleNamespace(id=user_id))

    fake_auth = SimpleNamespace(get_user=lambda token: fake_response)
    monkeypatch.setattr(auth, "supabase", SimpleNamespace(auth=fake_auth))

    assert auth.get_current_user(_creds("good-token")) == user_id


def test_get_current_user_passes_token_to_supabase(monkeypatch):
    seen = {}

    def fake_get_user(token):
        seen["token"] = token
        return SimpleNamespace(user=SimpleNamespace(id="u"))

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=fake_get_user))
    )
    auth.get_current_user(_creds("the-token"))

    assert seen["token"] == "the-token"


def test_get_current_user_no_user_raises_401(monkeypatch):
    fake_response = SimpleNamespace(user=None)
    monkeypatch.setattr(
        auth,
        "supabase",
        SimpleNamespace(auth=SimpleNamespace(get_user=lambda t: fake_response)),
    )

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_get_current_user_supabase_error_raises_401(monkeypatch):
    def boom(_token):
        raise RuntimeError("network down")

    monkeypatch.setattr(
        auth, "supabase", SimpleNamespace(auth=SimpleNamespace(get_user=boom))
    )

    with pytest.raises(HTTPException) as exc:
        auth.get_current_user(_creds())

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


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


def test_root_endpoint_returns_status_message():
    """`/` は認証不要なので素の TestClient で叩く。"""
    with TestClient(app) as c:
        res = c.get("/")
    assert res.status_code == 200
    assert res.json() == {"message": "釣果管理アプリ API 起動中"}


def test_protected_endpoint_without_token_is_rejected():
    """Authorization ヘッダ無しは HTTPBearer によりリクエストが拒否される。"""
    with TestClient(app) as c:
        res = c.get("/api/spots/")
    # FastAPI のバージョンによって 401/403 のどちらかが返る
    assert res.status_code in (401, 403)
