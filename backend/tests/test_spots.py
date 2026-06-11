"""/api/spots ルーターのテスト。"""

from __future__ import annotations

from .conftest import TEST_USER_ID


def test_list_spots_returns_data(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "本流ポイント"}])

    res = client.get("/api/spots/")

    assert res.status_code == 200
    assert res.json() == [{"id": "s1", "name": "本流ポイント"}]
    assert fake_db.calls[0]["table"] == "spots"
    ops = fake_db.calls[0]["ops"]
    assert any(op[0] == "order" and op[1] == ("name",) for op in ops)
    assert ("range", (0, 49), {}) in ops


def test_list_spots_applies_limit_offset(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/spots/?limit=25&offset=50")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    assert ("range", (50, 74), {}) in ops


def test_list_spots_rejects_limit_over_max(client):
    res = client.get("/api/spots/?limit=201")

    assert res.status_code == 422


def test_list_spots_empty(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/spots/")

    assert res.status_code == 200
    assert res.json() == []


def test_create_spot_assigns_user_id(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "新ポイント", "user_id": TEST_USER_ID}])

    res = client.post(
        "/api/spots/",
        json={"name": "新ポイント", "river_name": "球磨川"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "s1"
    assert body["user_id"] == TEST_USER_ID

    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert inserted["name"] == "新ポイント"
    assert inserted["river_name"] == "球磨川"
    assert inserted["user_id"] == TEST_USER_ID


def test_create_spot_drops_optional_none(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "新ポイント", "user_id": TEST_USER_ID}])

    res = client.post(
        "/api/spots/",
        json={"name": "新ポイント", "river_name": None, "notes": None},
    )

    assert res.status_code == 200
    insert_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert inserted == {"name": "新ポイント", "user_id": TEST_USER_ID}


def test_get_spot_found(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "本流"}])

    res = client.get("/api/spots/s1")

    assert res.status_code == 200
    assert res.json()["id"] == "s1"
    eq_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "eq")
    assert eq_op[1] == ("id", "s1")


def test_get_spot_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/spots/missing")

    assert res.status_code == 404
    assert res.json()["detail"] == "ポイントが見つかりません"


def test_update_spot_preserves_explicit_none(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "改名"}])

    res = client.put(
        "/api/spots/s1",
        json={"name": "改名", "river_name": None},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    update_data = update_op[1][0]
    assert update_data == {"name": "改名", "river_name": None}


def test_update_spot_leaves_unset_fields_out(client, fake_db):
    fake_db.queue_result([{"id": "s1", "name": "改名"}])

    res = client.put("/api/spots/s1", json={"name": "改名"})

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"name": "改名"}


def test_update_spot_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.put("/api/spots/missing", json={"name": "x"})

    assert res.status_code == 404


def test_update_spot_empty_body_returns_422(client, fake_db):
    res = client.put("/api/spots/s1", json={})

    assert res.status_code == 422
    assert res.json()["detail"] == "更新するフィールドがありません"
    assert fake_db.calls == []


def test_delete_spot_success(client, fake_db):
    fake_db.queue_result([{"id": "s1"}])

    res = client.delete("/api/spots/s1")

    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}


def test_delete_spot_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.delete("/api/spots/missing")

    assert res.status_code == 404


def test_list_spot_sessions(client, fake_db):
    fake_db.queue_result([{"id": "ses1", "spot_id": "s1", "date": "2026-05-01"}])

    res = client.get("/api/spots/s1/sessions")

    assert res.status_code == 200
    assert res.json()[0]["spot_id"] == "s1"
    ops = fake_db.calls[0]["ops"]
    assert ("eq", ("spot_id", "s1"), {}) in ops
    assert any(op[0] == "order" and op[1] == ("date",) for op in ops)
    assert ("range", (0, 49), {}) in ops


def test_list_spot_sessions_applies_limit_offset(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/spots/s1/sessions?limit=10&offset=20")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    assert ("range", (20, 29), {}) in ops


def test_list_spot_sessions_rejects_negative_offset(client):
    res = client.get("/api/spots/s1/sessions?offset=-1")

    assert res.status_code == 422
