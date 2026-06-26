"""supabase_client.create_user_postgrest の単体テスト (#70)。

リクエスト毎に新しい TCP 接続プールを作らず共有プールを使い回すこと、
かつリクエスト間で JWT が混線しないことを検証する。
"""

from __future__ import annotations

import supabase_client


def test_create_user_postgrest_reuses_shared_http_client():
    a = supabase_client.create_user_postgrest("token-a")
    b = supabase_client.create_user_postgrest("token-b")

    # どちらも共有の httpx クライアント (接続プール) を使う = 毎回 new pool を作らない。
    assert a.session is supabase_client._shared_rest_http_client
    assert b.session is supabase_client._shared_rest_http_client


def test_create_user_postgrest_isolates_jwt_per_client():
    a = supabase_client.create_user_postgrest("token-a")
    b = supabase_client.create_user_postgrest("token-b")

    # Authorization はクライアントインスタンスの headers に載る。
    assert a.headers["Authorization"] == "Bearer token-a"
    assert b.headers["Authorization"] == "Bearer token-b"

    # 共有 httpx クライアントにはユーザー JWT が載らない (混線しない)。
    shared_auth = supabase_client._shared_rest_http_client.headers.get("Authorization")
    assert shared_auth != "Bearer token-a"
    assert shared_auth != "Bearer token-b"


def test_create_user_postgrest_keeps_anon_apikey():
    client = supabase_client.create_user_postgrest("user-jwt")
    assert client.headers["apikey"] == supabase_client.SUPABASE_ANON_KEY
