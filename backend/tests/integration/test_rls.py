"""RLS 境界をテーブル横断で確認する smoke test。"""

from __future__ import annotations

import os
import uuid

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError


def _direct_postgrest_client(access_token: str):
    """FastAPI を経由せず PostgREST を直接叩くユーザー認証済みクライアント。

    anon key + ユーザー JWT という、ブラウザから到達可能な経路を再現する。
    アプリ層 (FastAPI) のバリデーションを回避するので、純粋に RLS だけが
    境界になることを検証できる。
    """
    from supabase import create_client

    client = create_client(
        os.environ["TEST_SUPABASE_URL"], os.environ["TEST_SUPABASE_ANON_KEY"]
    )
    client.postgrest.auth(access_token)
    return client


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


@pytest.mark.integration
def test_postgrest_direct_insert_with_foreign_lure_blocked_by_rls(
    auth_client, integration_user, second_auth_client, second_user
):
    """PostgREST 直叩きで「自分の session に他人の lure_id」を insert できないこと (#66)。

    FastAPI を経由しないので validate_lure_id は効かない。catches の WITH CHECK が
    lure 所有権を担保しているかを純粋に検証する。
    """
    suffix = uuid.uuid4().hex[:8]

    # user A (integration_user) が所有する lure
    a_lure = auth_client.post(
        "/api/lures/",
        json={"name": f"A所有ミノー-{suffix}", "type": "ミノー"},
    ).json()

    # user B (second_user) が所有する session
    b_spot = second_auth_client.post(
        "/api/spots/", json={"name": f"B所有ポイント-{suffix}"}
    ).json()
    b_session = second_auth_client.post(
        "/api/sessions/",
        json={"spot_id": b_spot["id"], "date": "2026-07-11"},
    ).json()

    # user B が PostgREST を直叩きして、自分の session に A の lure_id を付けた
    # catch を insert しようとする -> RLS の WITH CHECK で拒否される。
    db_b = _direct_postgrest_client(second_user["access_token"])

    with pytest.raises(PostgrestAPIError):  # row-level security violation
        db_b.table("catches").insert(
            {
                "session_id": b_session["id"],
                "fish_species": "ニジマス",
                "lure_id": a_lure["id"],
            }
        ).execute()

    # 念のため: 自分の lure (lure_id なし) なら直叩きでも insert できる = 正常系
    ok = (
        db_b.table("catches")
        .insert(
            {
                "session_id": b_session["id"],
                "fish_species": "ニジマス",
                "lure_id": None,
            }
        )
        .execute()
    )
    assert ok.data and ok.data[0]["session_id"] == b_session["id"]


@pytest.mark.integration
def test_postgrest_direct_insert_into_foreign_session_blocked_by_rls(
    auth_client, integration_user, second_user
):
    """PostgREST 直叩きで「他人の session」に catch を insert できないこと (#66)。"""
    suffix = uuid.uuid4().hex[:8]

    a_spot = auth_client.post(
        "/api/spots/", json={"name": f"A所有ポイント-{suffix}"}
    ).json()
    a_session = auth_client.post(
        "/api/sessions/",
        json={"spot_id": a_spot["id"], "date": "2026-07-12"},
    ).json()

    db_b = _direct_postgrest_client(second_user["access_token"])

    with pytest.raises(PostgrestAPIError):  # row-level security violation
        db_b.table("catches").insert(
            {"session_id": a_session["id"], "fish_species": "横取り"}
        ).execute()
