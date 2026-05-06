"""/api/spots の結合テスト。実 Supabase に接続して RLS 込みで検証する。"""

from __future__ import annotations

import pytest


@pytest.mark.integration
def test_spot_full_lifecycle(auth_client, integration_user):
    """作成 → 一覧 → 単体取得 → 更新 → 削除の一連の流れ。"""
    # CREATE
    res = auth_client.post(
        "/api/spots/",
        json={"name": "テスト本流", "river_name": "球磨川", "latitude": 32.5},
    )
    assert res.status_code == 200, res.text
    spot = res.json()
    assert spot["name"] == "テスト本流"
    assert spot["river_name"] == "球磨川"
    assert spot["user_id"] == integration_user["user_id"]
    spot_id = spot["id"]

    # LIST: 自分のスポットが含まれる
    res = auth_client.get("/api/spots/")
    assert res.status_code == 200
    ids = [s["id"] for s in res.json()]
    assert spot_id in ids

    # GET single
    res = auth_client.get(f"/api/spots/{spot_id}")
    assert res.status_code == 200
    assert res.json()["id"] == spot_id

    # UPDATE
    res = auth_client.put(f"/api/spots/{spot_id}", json={"name": "更新名"})
    assert res.status_code == 200
    assert res.json()["name"] == "更新名"

    # DELETE
    res = auth_client.delete(f"/api/spots/{spot_id}")
    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}

    # 削除後の GET は 404
    res = auth_client.get(f"/api/spots/{spot_id}")
    assert res.status_code == 404


@pytest.mark.integration
def test_spot_404_for_unknown_id(auth_client):
    res = auth_client.get("/api/spots/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


@pytest.mark.integration
def test_unauthenticated_request_is_rejected():
    """Authorization ヘッダ無しのリクエストはアプリ層で 401/403 になる。"""
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as c:
        res = c.get("/api/spots/")
    assert res.status_code in (401, 403)


@pytest.mark.integration
def test_invalid_token_is_rejected():
    """壊れたトークンでも 401 になる (Supabase 側の検証)。"""
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app, headers={"Authorization": "Bearer not-a-valid-jwt"}) as c:
        res = c.get("/api/spots/")
    assert res.status_code == 401


@pytest.mark.integration
def test_rls_blocks_other_users_spots(auth_client, integration_user, second_user, admin_supabase):
    """別ユーザーが作成したスポットは GET 一覧にも単体取得にも出てこない。"""
    # second_user として spot を作成 (admin で RLS をバイパス)
    inserted = (
        admin_supabase.table("spots")
        .insert({"user_id": second_user["user_id"], "name": "他人の秘密ポイント"})
        .execute()
    )
    other_spot_id = inserted.data[0]["id"]

    # integration_user (auth_client) からは見えない
    res = auth_client.get("/api/spots/")
    assert res.status_code == 200
    names = [s["name"] for s in res.json()]
    assert "他人の秘密ポイント" not in names

    # 単体取得しても 404
    res = auth_client.get(f"/api/spots/{other_spot_id}")
    assert res.status_code == 404


@pytest.mark.integration
def test_rls_blocks_updating_other_users_spots(
    auth_client, second_user, admin_supabase
):
    """他人の spot に対する PUT は 404 (RLS により対象行が見えない)。"""
    inserted = (
        admin_supabase.table("spots")
        .insert({"user_id": second_user["user_id"], "name": "他人ポイント"})
        .execute()
    )
    other_spot_id = inserted.data[0]["id"]

    res = auth_client.put(f"/api/spots/{other_spot_id}", json={"name": "乗っ取り"})
    assert res.status_code == 404
