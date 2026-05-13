"""/api/sessions ルーターのテスト。"""

from __future__ import annotations

from .conftest import TEST_USER_ID


def test_list_sessions(client, fake_db):
    fake_db.queue_result([{"id": "ses1", "date": "2026-05-01"}])

    res = client.get("/api/sessions/")

    assert res.status_code == 200
    assert res.json()[0]["id"] == "ses1"
    ops = fake_db.calls[0]["ops"]
    assert any(op[0] == "order" and op[1] == ("date",) and op[2] == {"desc": True} for op in ops)


def test_create_session_normalizes_date_and_time(client, fake_db):
    fake_db.queue_result([{"id": "ses1", "date": "2026-05-06"}])

    res = client.post(
        "/api/sessions/",
        json={
            "date": "2026-05-06",
            "start_time": "06:30:00",
            "end_time": "10:00:00",
            "spot_id": "spot-1",
        },
    )

    assert res.status_code == 200
    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["date"] == "2026-05-06"
    assert inserted["start_time"] == "06:30:00"
    assert inserted["end_time"] == "10:00:00"
    assert inserted["spot_id"] == "spot-1"


def test_create_session_drops_optional_none(client, fake_db):
    """None フィールドは insert ペイロードから除外される。"""
    fake_db.queue_result([{"id": "ses1"}])

    client.post(
        "/api/sessions/",
        json={"date": "2026-05-06"},  # spot_id, time 等は未指定
    )

    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert "spot_id" not in inserted
    assert "start_time" not in inserted
    assert "weather" not in inserted


def test_create_session_validation_error_on_missing_date(client):
    res = client.post("/api/sessions/", json={})
    assert res.status_code == 422


def test_get_session_found(client, fake_db):
    fake_db.queue_result([{"id": "ses1", "date": "2026-05-01"}])

    res = client.get("/api/sessions/ses1")

    assert res.status_code == 200
    assert res.json()["id"] == "ses1"


def test_get_session_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/sessions/missing")

    assert res.status_code == 404
    assert res.json()["detail"] == "釣行が見つかりません"


def test_update_session_strips_none(client, fake_db):
    fake_db.queue_result([{"id": "ses1", "weather": "晴れ"}])

    res = client.put(
        "/api/sessions/ses1",
        json={"weather": "晴れ", "notes": None},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    data = update_op[1][0]
    assert data == {"weather": "晴れ"}


def test_update_session_with_date_field(client, fake_db):
    """`date` シャドーイング修正のリグレッションテスト (docs/known-issues.md ISSUE-001)。"""
    fake_db.queue_result([{"id": "ses1", "date": "2026-05-07"}])

    res = client.put("/api/sessions/ses1", json={"date": "2026-05-07"})

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    # date は ISO 文字列として送られる
    assert update_op[1][0]["date"] == "2026-05-07"


def test_update_session_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.put("/api/sessions/missing", json={"weather": "晴れ"})

    assert res.status_code == 404


def test_delete_session_success(client, fake_db):
    fake_db.queue_result([{"id": "ses1"}])

    res = client.delete("/api/sessions/ses1")

    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}


def test_delete_session_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.delete("/api/sessions/missing")

    assert res.status_code == 404


def test_monthly_stats_aggregates_by_month(client, fake_db):
    fake_db.queue_result(
        [
            {"date": "2026-05-01", "catches": [{"id": "c1"}, {"id": "c2"}]},
            {"date": "2026-05-15", "catches": [{"id": "c3"}]},
            {"date": "2026-04-20", "catches": []},
            {"date": "2026-04-10", "catches": [{"id": "c4"}]},
        ]
    )

    res = client.get("/api/sessions/stats/monthly")

    assert res.status_code == 200
    body = res.json()
    assert body["2026-05"] == {"session_count": 2, "catch_count": 3}
    assert body["2026-04"] == {"session_count": 2, "catch_count": 1}


def test_monthly_stats_empty(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/sessions/stats/monthly")

    assert res.status_code == 200
    assert res.json() == {}


def test_monthly_stats_handles_missing_catches_key(client, fake_db):
    """`catches` キーが無くても KeyError にならない。"""
    fake_db.queue_result([{"date": "2026-05-01"}])

    res = client.get("/api/sessions/stats/monthly")

    assert res.status_code == 200
    assert res.json()["2026-05"] == {"session_count": 1, "catch_count": 0}
