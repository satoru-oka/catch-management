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


def test_create_catch_rejects_unknown_lure_id(client, fake_db):
    fake_db.queue_result([{"id": "ses1"}])  # session 存在チェック
    fake_db.queue_result([])  # RLS により自分の lure として見つからない

    res = client.post(
        "/api/sessions/ses1/catches",
        json={"fish_species": "ヤマメ", "lure_id": "other-user-lure"},
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "無効な lure_id です"
    assert [call["table"] for call in fake_db.calls] == ["sessions", "lures"]


def test_create_catch_accepts_owned_lure_id(client, fake_db):
    fake_db.queue_result([{"id": "ses1"}])  # session 存在チェック
    fake_db.queue_result([{"id": "l1"}])  # lure 所有確認
    fake_db.queue_result([{"id": "c1", "session_id": "ses1", "lure_id": "l1"}])

    res = client.post(
        "/api/sessions/ses1/catches",
        json={"fish_species": "ヤマメ", "lure_id": "l1"},
    )

    assert res.status_code == 200
    assert [call["table"] for call in fake_db.calls] == ["sessions", "lures", "catches"]
    insert_op = next(op for op in fake_db.calls[2]["ops"] if op[0] == "insert")
    assert insert_op[1][0]["lure_id"] == "l1"


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
    assert ("range", (0, 49), {}) in ops


def test_list_catches_applies_limit_offset(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/catches?limit=15&offset=30")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    assert ("range", (30, 44), {}) in ops


def test_list_catches_rejects_limit_over_max(client):
    res = client.get("/api/catches?limit=201")

    assert res.status_code == 422


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


def test_list_catches_escapes_lure_name_wildcards(client, fake_db):
    fake_db.queue_result([])

    res = client.get("/api/catches?lure_name=100%_ミノー")

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    ilike_op = next(op for op in ops if op[0] == "ilike")
    assert ilike_op[1] == ("lure_name", r"%100\%\_ミノー%")


def test_list_catches_with_range_filters(client, fake_db):
    fake_db.queue_result([])

    res = client.get(
        "/api/catches"
        "?date_from=2026-05-01"
        "&date_to=2026-05-31"
        "&length_min=20"
        "&length_max=40"
        "&weight_min=100"
        "&weight_max=500"
    )

    assert res.status_code == 200
    ops = fake_db.calls[0]["ops"]
    assert ("gte", ("caught_at", "2026-05-01T00:00:00"), {}) in ops
    assert ("lte", ("caught_at", "2026-05-31T23:59:59.999999"), {}) in ops
    assert ("gte", ("length_cm", 20.0), {}) in ops
    assert ("lte", ("length_cm", 40.0), {}) in ops
    assert ("gte", ("weight_g", 100.0), {}) in ops
    assert ("lte", ("weight_g", 500.0), {}) in ops


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


def test_update_catch_preserves_explicit_none(client, fake_db):
    fake_db.queue_result([{"id": "c1", "length_cm": 30.0}])

    res = client.put(
        "/api/catches/c1",
        json={"length_cm": 30.0, "weight_g": None},
    )

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"length_cm": 30.0, "weight_g": None}


def test_update_catch_leaves_unset_fields_out(client, fake_db):
    fake_db.queue_result([{"id": "c1", "length_cm": 30.0}])

    res = client.put("/api/catches/c1", json={"length_cm": 30.0})

    assert res.status_code == 200
    update_op = next(op for op in fake_db.calls[0]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"length_cm": 30.0}


def test_update_catch_rejects_unknown_lure_id(client, fake_db):
    fake_db.queue_result([])  # RLS により自分の lure として見つからない

    res = client.put("/api/catches/c1", json={"lure_id": "other-user-lure"})

    assert res.status_code == 400
    assert res.json()["detail"] == "無効な lure_id です"
    assert [call["table"] for call in fake_db.calls] == ["lures"]


def test_update_catch_accepts_owned_lure_id(client, fake_db):
    fake_db.queue_result([{"id": "l1"}])  # lure 所有確認
    fake_db.queue_result([{"id": "c1", "lure_id": "l1"}])

    res = client.put("/api/catches/c1", json={"lure_id": "l1"})

    assert res.status_code == 200
    assert [call["table"] for call in fake_db.calls] == ["lures", "catches"]
    update_op = next(op for op in fake_db.calls[1]["ops"] if op[0] == "update")
    assert update_op[1][0] == {"lure_id": "l1"}


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
