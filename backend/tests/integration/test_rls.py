"""RLS 境界をテーブル横断で確認する smoke test。"""

from __future__ import annotations

import uuid

import pytest


def _create_user_scoped_records(auth_client):
    suffix = uuid.uuid4().hex[:8]
    lure_name = f"RLS専用ミノー-{suffix}"

    spot = auth_client.post(
        "/api/spots/",
        json={"name": f"RLS専用ポイント-{suffix}", "river_name": "境界川"},
    ).json()
    session = auth_client.post(
        "/api/sessions/",
        json={"spot_id": spot["id"], "date": "2026-07-10", "notes": "A user only"},
    ).json()
    lure = auth_client.post(
        "/api/lures/",
        json={"name": lure_name, "type": "ミノー", "notes": "A user only"},
    ).json()
    catch = auth_client.post(
        f"/api/sessions/{session['id']}/catches",
        json={
            "fish_species": "ヤマメ",
            "length_cm": 27.5,
            "lure_id": lure["id"],
            "lure_name": lure_name,
        },
    ).json()

    return {"spot": spot, "session": session, "lure": lure, "catch": catch}


def _ids(rows):
    return {row["id"] for row in rows}


@pytest.mark.integration
def test_cross_tenant_rls_smoke_for_user_scoped_tables(auth_client, second_auth_client):
    records = _create_user_scoped_records(auth_client)
    spot_id = records["spot"]["id"]
    session_id = records["session"]["id"]
    lure_id = records["lure"]["id"]
    catch_id = records["catch"]["id"]
    lure_name = records["lure"]["name"]

    res = second_auth_client.get("/api/spots/")
    assert res.status_code == 200
    assert spot_id not in _ids(res.json())

    assert second_auth_client.get(f"/api/spots/{spot_id}").status_code == 404
    assert second_auth_client.put(f"/api/spots/{spot_id}", json={"name": "奪取"}).status_code == 404
    assert second_auth_client.delete(f"/api/spots/{spot_id}").status_code == 404

    res = second_auth_client.get("/api/sessions/")
    assert res.status_code == 200
    assert session_id not in _ids(res.json())

    assert second_auth_client.get(f"/api/sessions/{session_id}").status_code == 404
    assert (
        second_auth_client.put(f"/api/sessions/{session_id}", json={"notes": "奪取"}).status_code
        == 404
    )
    assert second_auth_client.delete(f"/api/sessions/{session_id}").status_code == 404

    res = second_auth_client.get("/api/catches")
    assert res.status_code == 200
    assert catch_id not in _ids(res.json())

    assert second_auth_client.get(f"/api/catches/{catch_id}").status_code == 404
    assert (
        second_auth_client.put(f"/api/catches/{catch_id}", json={"length_cm": 99}).status_code
        == 404
    )
    assert second_auth_client.delete(f"/api/catches/{catch_id}").status_code == 404

    res = second_auth_client.get("/api/lures/")
    assert res.status_code == 200
    assert lure_id not in _ids(res.json())

    assert (
        second_auth_client.put(f"/api/lures/{lure_id}", json={"color": "奪取"}).status_code
        == 404
    )
    assert second_auth_client.delete(f"/api/lures/{lure_id}").status_code == 404

    monthly = second_auth_client.get("/api/sessions/stats/monthly")
    assert monthly.status_code == 200
    assert "2026-07" not in monthly.json()

    lure_stats = second_auth_client.get("/api/lures/stats")
    assert lure_stats.status_code == 200
    assert lure_name not in lure_stats.json()
