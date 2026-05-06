"""/api/lures の結合テスト。"""

from __future__ import annotations

import pytest


@pytest.mark.integration
def test_lure_full_lifecycle(auth_client, integration_user):
    # CREATE
    res = auth_client.post(
        "/api/lures/",
        json={"name": "Dコンタクト63", "type": "ミノー", "color": "チャート", "weight_g": 4.5},
    )
    assert res.status_code == 200, res.text
    lure = res.json()
    assert lure["user_id"] == integration_user["user_id"]
    lure_id = lure["id"]

    # LIST
    res = auth_client.get("/api/lures/")
    assert res.status_code == 200
    assert any(item["id"] == lure_id for item in res.json())

    # UPDATE
    res = auth_client.put(f"/api/lures/{lure_id}", json={"color": "ピンク"})
    assert res.status_code == 200
    assert res.json()["color"] == "ピンク"

    # DELETE
    res = auth_client.delete(f"/api/lures/{lure_id}")
    assert res.status_code == 200


@pytest.mark.integration
def test_lure_stats_aggregates_self_only(
    auth_client, second_user, admin_supabase
):
    """`/api/lures/stats` は RLS で絞られた自分の catches だけを集計するはず。"""
    # 自分の catches を 2 件 (ルアー名: 'A')
    s1 = auth_client.post("/api/sessions/", json={"date": "2026-05-01"}).json()
    auth_client.post(
        f"/api/sessions/{s1['id']}/catches",
        json={"fish_species": "ヤマメ", "lure_name": "A", "length_cm": 20.0},
    )
    auth_client.post(
        f"/api/sessions/{s1['id']}/catches",
        json={"fish_species": "ヤマメ", "lure_name": "A", "length_cm": 24.0},
    )

    # 他ユーザーの catches を admin で挿入 (ルアー名: 'B'、混入しない想定)
    other_session = (
        admin_supabase.table("sessions")
        .insert({"user_id": second_user["user_id"], "date": "2026-05-01"})
        .execute()
        .data[0]
    )
    admin_supabase.table("catches").insert(
        {"session_id": other_session["id"], "fish_species": "ヤマメ", "lure_name": "B"}
    ).execute()

    res = auth_client.get("/api/lures/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "A" in stats
    assert stats["A"]["count"] == 2
    assert stats["A"]["avg_length"] == 22.0
    # 他ユーザーのルアーは入らない
    assert "B" not in stats
