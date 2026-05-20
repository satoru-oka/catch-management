"""/api/lures ルーターのテスト。"""

from __future__ import annotations

from .conftest import TEST_USER_ID


def test_list_lures(client, fake_db):
    fake_db.queue_result([{"id": "l1", "name": "ミノー"}])

    res = client.get("/api/lures/")

    assert res.status_code == 200
    assert res.json()[0]["name"] == "ミノー"
    ops = fake_db.calls[0]["ops"]
    assert any(op[0] == "order" and op[1] == ("name",) for op in ops)


def test_create_lure_assigns_user_id(client, fake_db):
    fake_db.queue_result([{"id": "l1", "name": "新ルアー", "user_id": TEST_USER_ID}])

    res = client.post(
        "/api/lures/",
        json={"name": "新ルアー", "type": "スプーン", "weight_g": 3.5},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == TEST_USER_ID

    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert inserted["name"] == "新ルアー"
    assert inserted["type"] == "スプーン"
    assert inserted["weight_g"] == 3.5
    assert inserted["user_id"] == TEST_USER_ID


def test_create_lure_drops_none_fields(client, fake_db):
    fake_db.queue_result([{"id": "l1", "name": "ルアーX"}])

    client.post("/api/lures/", json={"name": "ルアーX"})

    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert "type" not in inserted
    assert "color" not in inserted
    assert "notes" not in inserted


def test_create_lure_validation_requires_name(client):
    res = client.post("/api/lures/", json={})
    assert res.status_code == 422


def test_update_lure_preserves_explicit_none(client, fake_db):
    fake_db.queue_result([{"id": "l1", "color": "赤金"}])

    res = client.put(
        "/api/lures/l1",
        json={"color": "赤金", "notes": None},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"color": "赤金", "notes": None}


def test_update_lure_leaves_unset_fields_out(client, fake_db):
    fake_db.queue_result([{"id": "l1", "color": "赤金"}])

    res = client.put("/api/lures/l1", json={"color": "赤金"})

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"color": "赤金"}


def test_update_lure_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.put("/api/lures/missing", json={"name": "x"})

    assert res.status_code == 404
    assert res.json()["detail"] == "ルアーが見つかりません"


def test_delete_lure_success(client, fake_db):
    fake_db.queue_result([{"id": "l1"}])

    res = client.delete("/api/lures/l1")

    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}


def test_delete_lure_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.delete("/api/lures/missing")

    assert res.status_code == 404


def test_lure_stats_aggregates_by_lure_name(client, fake_db):
    fake_db.queue_result(
        [
            {"lure_name": "ミノー", "count": 2, "avg_length": 22.5},
            {"lure_name": "スプーン", "count": 2, "avg_length": 30.0},
        ]
    )

    res = client.get("/api/lures/stats")

    assert res.status_code == 200
    assert fake_db.calls[0]["table"] == "user_lure_stats"
    body = res.json()
    assert body["ミノー"]["count"] == 2
    assert body["ミノー"]["avg_length"] == 22.5
    assert body["スプーン"]["count"] == 2
    assert body["スプーン"]["avg_length"] == 30.0  # None は無視


def test_lure_stats_groups_unknown_under_unknown_label(client, fake_db):
    fake_db.queue_result(
        [
            {"lure_name": None, "count": 2, "avg_length": 20.0},
        ]
    )

    res = client.get("/api/lures/stats")

    assert res.status_code == 200
    body = res.json()
    assert "不明" in body
    assert body["不明"]["count"] == 2
    assert body["不明"]["avg_length"] == 20.0


def test_lure_stats_avg_length_zero_when_no_lengths(client, fake_db):
    fake_db.queue_result([{"lure_name": "ジグ", "count": 1, "avg_length": None}])

    res = client.get("/api/lures/stats")

    assert res.status_code == 200
    assert res.json()["ジグ"] == {"count": 1, "avg_length": 0}


def test_lure_stats_empty(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/lures/stats")

    assert res.status_code == 200
    assert res.json() == {}
