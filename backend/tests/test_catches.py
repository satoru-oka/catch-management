"""catches ルーターのテスト。"""

from __future__ import annotations


def test_create_catch_attaches_session_id(client, fake_db):
    fake_db.queue_result([{"id": "ses1"}])  # session 存在チェック
    fake_db.queue_result(
        [
            {
                "id": "c1",
                "session_id": "ses1",
                "fish_species": "ヤマメ",
            }
        ]
    )

    res = client.post(
        "/api/sessions/ses1/catches",
        json={
            "fish_species": "ヤマメ",
            "length_cm": 22.5,
            "lure_name": "スプーン",
            "caught_at": "2026-05-06T07:30:00",
        },
    )

    assert res.status_code == 200
    body = res.json()
    assert body["session_id"] == "ses1"

    # 1 回目は session のチェック
    assert fake_db.calls[0]["table"] == "sessions"
    # 2 回目は catches insert
    assert fake_db.calls[1]["table"] == "catches"
    insert_op = next(op for op in fake_db.calls[1]["ops"] if op[0] == "insert")
    inserted = insert_op[1][0]
    assert inserted["session_id"] == "ses1"
    assert inserted["fish_species"] == "ヤマメ"
    assert inserted["length_cm"] == 22.5
    # caught_at は文字列化される
    assert isinstance(inserted["caught_at"], str)


def test_create_catch_session_not_found(client, fake_db):
    fake_db.queue_result([])  # session が存在しない

    res = client.post(
        "/api/sessions/missing/catches",
        json={"fish_species": "ヤマメ"},
    )

    assert res.status_code == 404
    assert res.json()["detail"] == "釣行が見つかりません"
    # insert は呼ばれないはず (session チェックのみ)
    assert len(fake_db.calls) == 1


def test_create_catch_validation_requires_fish_species(client):
    res = client.post("/api/sessions/ses1/catches", json={})
    assert res.status_code == 422


def test_list_catches_no_filters(client, fake_db):
    fake_db.queue_result([{"id": "c1", "fish_species": "ヤマメ"}])

    res = client.get("/api/catches")

    assert res.status_code == 200
    assert res.json()[0]["id"] == "c1"
    ops = fake_db.calls[0]["ops"]
    # フィルタ未指定なら eq/ilike は呼ばれない
    assert not any(op[0] in ("eq", "ilike") for op in ops)
    assert any(op[0] == "order" and op[1] == ("created_at",) for op in ops)


def test_list_catches_with_fish_species_filter(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/catches?fish_species=イワナ")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    assert ("eq", ("fish_species", "イワナ"), {}) in ops


def test_list_catches_with_lure_name_filter_uses_ilike(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/catches?lure_name=スプーン")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    ilike_op = next(op for op in ops if op[0] == "ilike")
    assert ilike_op[1] == ("lure_name", "%スプーン%")


def test_get_catch_found(client, fake_db):
    fake_db.queue_result([{"id": "c1", "fish_species": "ヤマメ"}])

    res = client.get("/api/catches/c1")

    assert res.status_code == 200
    assert res.json()["id"] == "c1"


def test_get_catch_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/catches/missing")

    assert res.status_code == 404
    assert res.json()["detail"] == "釣果が見つかりません"


def test_update_catch_strips_none(client, fake_db):
    fake_db.queue_result([{"id": "c1", "length_cm": 30.0}])

    res = client.put(
        "/api/catches/c1",
        json={"length_cm": 30.0, "weight_g": None},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"length_cm": 30.0}


def test_update_catch_stringifies_caught_at(client, fake_db):
    fake_db.queue_result([{"id": "c1"}])

    res = client.put(
        "/api/catches/c1",
        json={"caught_at": "2026-05-06T08:00:00"},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert isinstance(update_op[1][0]["caught_at"], str)


def test_update_catch_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.put("/api/catches/missing", json={"fish_species": "ヤマメ"})

    assert res.status_code == 404


def test_delete_catch_success(client, fake_db):
    fake_db.queue_result([{"id": "c1"}])

    res = client.delete("/api/catches/c1")

    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}


def test_delete_catch_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.delete("/api/catches/missing")

    assert res.status_code == 404
