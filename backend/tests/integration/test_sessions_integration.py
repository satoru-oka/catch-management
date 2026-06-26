"""/api/sessions の結合テスト。"""

from __future__ import annotations

import pytest


@pytest.mark.integration
def test_session_full_lifecycle(auth_client, integration_user):
    # まず spot を 1 つ作る (sessions.spot_id 用)
    spot = auth_client.post("/api/spots/", json={"name": "本流"}).json()

    # CREATE session (date と spot_id を指定)
    res = auth_client.post(
        "/api/sessions/",
        json={
            "spot_id": spot["id"],
            "date": "2026-05-01",
            "start_time": "06:30:00",
            "end_time": "10:00:00",
            "weather": "晴れ",
            "water_level": "平水",
        },
    )
    assert res.status_code == 200, res.text
    session = res.json()
    assert session["user_id"] == integration_user["user_id"]
    assert session["date"] == "2026-05-01"
    session_id = session["id"]

    # LIST
    res = auth_client.get("/api/sessions/")
    assert res.status_code == 200
    assert any(s["id"] == session_id for s in res.json())

    # GET single (catches もネストされる)
    res = auth_client.get(f"/api/sessions/{session_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == session_id
    assert "catches" in body  # SessionDetail は catches を含む

    # UPDATE: weather だけ変えてみる (date は ISSUE-001 で復活した経路)
    res = auth_client.put(
        f"/api/sessions/{session_id}",
        json={"weather": "曇り", "date": "2026-05-02"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["weather"] == "曇り"
    assert res.json()["date"] == "2026-05-02"

    # DELETE
    res = auth_client.delete(f"/api/sessions/{session_id}")
    assert res.status_code == 200


@pytest.mark.integration
def test_monthly_stats_aggregates_real_data(auth_client):
    """seed として 2 ヶ月にまたがる釣行を作り、`/stats/monthly` の集計を確認。"""
    auth_client.post("/api/sessions/", json={"date": "2026-03-15"})
    auth_client.post("/api/sessions/", json={"date": "2026-04-01"})
    auth_client.post("/api/sessions/", json={"date": "2026-04-20"})

    res = auth_client.get("/api/sessions/stats/monthly")
    assert res.status_code == 200
    stats = res.json()
    # 自分のデータだけが集計されているはず (RLS により他ユーザー混入しない)
    assert stats.get("2026-03", {}).get("session_count") == 1
    assert stats.get("2026-04", {}).get("session_count") == 2


@pytest.mark.integration
def test_create_session_without_spot_keeps_water_type_not_null(auth_client):
    """spot_id なしで session を作成でき、water_type が NOT NULL を維持する (#77)。"""
    res = auth_client.post("/api/sessions/", json={"date": "2026-08-01"})
    assert res.status_code == 200, res.text
    session = res.json()
    assert session.get("spot_id") is None
    # migration 001/003 適用環境では water_type が既定値で埋まる。
    assert session.get("water_type") is not None


@pytest.mark.integration
def test_delete_spot_nulls_session_spot_and_keeps_water_type(auth_client):
    """session が紐づく spot を削除でき、spot_id は NULL・water_type は NOT NULL (#77)。"""
    spot = auth_client.post("/api/spots/", json={"name": "削除予定ポイント"}).json()
    session = auth_client.post(
        "/api/sessions/", json={"spot_id": spot["id"], "date": "2026-08-02"}
    ).json()

    # ON DELETE SET NULL が走る。トリガーが water_type を NULL にすると NOT NULL 違反で
    # ここが失敗する。
    res = auth_client.delete(f"/api/spots/{spot['id']}")
    assert res.status_code == 200, res.text

    body = auth_client.get(f"/api/sessions/{session['id']}").json()
    assert body["spot_id"] is None
    assert body.get("water_type") is not None


@pytest.mark.integration
def test_spot_water_type_change_syncs_existing_sessions(auth_client, admin_supabase):
    """spot の water_type 変更が既存 sessions に同期され、不整合メトリクスはクリアされる (#77)。

    spots.water_type は API 非公開のため admin (service_role) で直接更新する。
    """
    spot = auth_client.post("/api/spots/", json={"name": "再分類ポイント"}).json()
    # freshwater 既定。淡水で許可される water_level を入れておく。
    session = auth_client.post(
        "/api/sessions/",
        json={"spot_id": spot["id"], "date": "2026-08-03", "water_level": "平水"},
    ).json()

    before = auth_client.get(f"/api/sessions/{session['id']}").json()
    assert before["water_type"] == "freshwater"
    assert before["water_level"] == "平水"

    # spot を海に再分類 -> 既存 session へ同期 + 海で禁止の water_level がクリアされる。
    admin_supabase.table("spots").update({"water_type": "sea"}).eq(
        "id", spot["id"]
    ).execute()

    after = auth_client.get(f"/api/sessions/{session['id']}").json()
    assert after["water_type"] == "sea"
    assert after["water_level"] is None


@pytest.mark.integration
def test_rls_blocks_other_users_session(
    auth_client, second_user, admin_supabase
):
    inserted = (
        admin_supabase.table("sessions")
        .insert({"user_id": second_user["user_id"], "date": "2026-05-01"})
        .execute()
    )
    other_id = inserted.data[0]["id"]

    # 一覧に出ない
    res = auth_client.get("/api/sessions/")
    assert res.status_code == 200
    assert other_id not in [s["id"] for s in res.json()]

    # 単体取得は 404
    res = auth_client.get(f"/api/sessions/{other_id}")
    assert res.status_code == 404
