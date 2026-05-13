"""/api/catches の結合テスト。"""

from __future__ import annotations

import pytest


@pytest.mark.integration
def test_catch_full_lifecycle(auth_client):
    # 釣行を作ってからその下に catch を作る
    session = auth_client.post("/api/sessions/", json={"date": "2026-05-01"}).json()
    sid = session["id"]

    # CREATE
    res = auth_client.post(
        f"/api/sessions/{sid}/catches",
        json={
            "fish_species": "ヤマメ",
            "length_cm": 22.5,
            "lure_name": "Dコンタクト",
            "is_released": True,
        },
    )
    assert res.status_code == 200, res.text
    catch = res.json()
    cid = catch["id"]
    assert catch["session_id"] == sid
    assert catch["fish_species"] == "ヤマメ"

    # LIST (フィルタなし)
    res = auth_client.get("/api/catches")
    assert res.status_code == 200
    assert any(c["id"] == cid for c in res.json())

    # LIST (fish_species フィルタ)
    res = auth_client.get("/api/catches?fish_species=ヤマメ")
    assert res.status_code == 200
    assert all(c["fish_species"] == "ヤマメ" for c in res.json())

    # LIST (lure_name フィルタ: ilike)
    res = auth_client.get("/api/catches?lure_name=コンタクト")
    assert res.status_code == 200
    assert any(c["id"] == cid for c in res.json())

    # GET single
    res = auth_client.get(f"/api/catches/{cid}")
    assert res.status_code == 200
    assert res.json()["id"] == cid

    # UPDATE
    res = auth_client.put(f"/api/catches/{cid}", json={"length_cm": 25.0})
    assert res.status_code == 200
    assert res.json()["length_cm"] == 25.0

    # DELETE
    res = auth_client.delete(f"/api/catches/{cid}")
    assert res.status_code == 200


@pytest.mark.integration
def test_create_catch_for_unknown_session_returns_404(auth_client):
    res = auth_client.post(
        "/api/sessions/00000000-0000-0000-0000-000000000000/catches",
        json={"fish_species": "ヤマメ"},
    )
    assert res.status_code == 404


@pytest.mark.integration
def test_create_catch_for_other_users_session_blocked_by_rls(
    auth_client, second_user, admin_supabase
):
    """RLS により他ユーザーの session には catches を追加できない。"""
    other_session = (
        admin_supabase.table("sessions")
        .insert({"user_id": second_user["user_id"], "date": "2026-05-01"})
        .execute()
        .data[0]
    )

    # 自分の権限 (auth_client) では他人の session が 'select' で見えないので 404
    res = auth_client.post(
        f"/api/sessions/{other_session['id']}/catches",
        json={"fish_species": "ヤマメ"},
    )
    assert res.status_code == 404


@pytest.mark.integration
def test_session_delete_cascades_to_catches(auth_client):
    """sessions の ON DELETE CASCADE で配下の catches も消えること。"""
    session = auth_client.post("/api/sessions/", json={"date": "2026-05-01"}).json()
    sid = session["id"]
    catch = auth_client.post(
        f"/api/sessions/{sid}/catches", json={"fish_species": "イワナ"}
    ).json()
    cid = catch["id"]

    # session を消す
    res = auth_client.delete(f"/api/sessions/{sid}")
    assert res.status_code == 200

    # catch も消えている
    res = auth_client.get(f"/api/catches/{cid}")
    assert res.status_code == 404
