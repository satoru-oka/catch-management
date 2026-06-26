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
    # caught_at は UTC で保存される。naive 入力 (07:30 JST) は -9h されて UTC に (#68)。
    assert isinstance(inserted["caught_at"], str)
    assert inserted["caught_at"] == "2026-05-05T22:30:00+00:00"


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
    # id タイブレーカーでページ間の重複・欠落を防ぐ (#71)
    assert any(op[0] == "order" and op[1] == ("id",) for op in ops)
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
    # JST の暦日を UTC 範囲に変換して比較する (#68)。
    # 2026-05-01 JST 00:00 = 2026-04-30T15:00Z / 2026-05-31 JST 終端 = 同日 14:59:59.999999Z
    assert ("gte", ("caught_at", "2026-04-30T15:00:00+00:00"), {}) in ops
    assert ("lte", ("caught_at", "2026-05-31T14:59:59.999999+00:00"), {}) in ops
    assert ("gte", ("length_cm", 20.0), {}) in ops
    assert ("lte", ("length_cm", 40.0), {}) in ops
    assert ("gte", ("weight_g", 100.0), {}) in ops
    assert ("lte", ("weight_g", 500.0), {}) in ops


def test_catch_summary_aggregates_with_bounded_queries(client, fake_db):
    """ホーム集計は全件ページングではなく count / 当月 / limit クエリで返す (#72)。"""
    from jst import jst_today

    today_iso = jst_today().isoformat()

    # 1. lifetime count (head)
    fake_db.queue_result([], count=12)
    # 2. 当月 sessions + catches
    fake_db.queue_result(
        [
            {
                "date": today_iso,
                "catches": [
                    {"weight_g": 500, "length_cm": 30},
                    {"weight_g": 200, "length_cm": 25},
                ],
            },
            {"date": "2000-01-15", "catches": [{"weight_g": 100, "length_cm": 20}]},
        ]
    )
    # 3. 最大サイズ
    fake_db.queue_result([{"fish_species": "ヤマメ", "length_cm": 30}])
    # 4. 最近 3 件
    fake_db.queue_result([{"id": "c1", "fish_species": "ヤマメ"}])

    res = client.get("/api/catches/stats/summary")

    assert res.status_code == 200
    body = res.json()
    assert body["lifetime_count"] == 12
    assert body["month_count"] == 3
    assert body["today"]["count"] == 2
    assert body["today"]["total_weight_g"] == 700
    assert body["today"]["max_length_cm"] == 30
    assert body["max_catch"] == {"fish_species": "ヤマメ", "length_cm": 30}
    assert body["recent"][0]["id"] == "c1"

    tables = [c["table"] for c in fake_db.calls]
    assert tables == ["catches", "sessions", "catches", "catches"]
    # 総数は count head で取得 (行を全件転送しない)
    lifetime_ops = fake_db.calls[0]["ops"]
    assert any(op[0] == "select" and op[2].get("count") == "exact" for op in lifetime_ops)
    assert not any(op[0] == "range" for op in lifetime_ops)
    # 最近の釣果は limit 3 (全件ページングではない)
    assert ("limit", (3,), {}) in fake_db.calls[3]["ops"]


def test_catch_summary_handles_empty(client, fake_db):
    """釣果ゼロでも 200 で安全な空サマリを返す (#72)。"""
    fake_db.queue_result([], count=0)  # lifetime
    fake_db.queue_result([])  # month
    fake_db.queue_result([])  # max
    fake_db.queue_result([])  # recent

    res = client.get("/api/catches/stats/summary")

    assert res.status_code == 200
    body = res.json()
    assert body["lifetime_count"] == 0
    assert body["month_count"] == 0
    assert body["today"] == {"count": 0, "total_weight_g": 0, "max_length_cm": None}
    assert body["max_catch"] is None
    assert body["recent"] == []


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
    # naive 入力 (08:00 JST) は UTC に変換される (#68)。
    assert update_op[1][0]["caught_at"] == "2026-05-05T23:00:00+00:00"


def test_create_catch_honors_tz_aware_caught_at(client, fake_db):
    """TZ 付きで送られた caught_at はそのまま UTC へ変換される (#68)。"""
    fake_db.queue_result([{"id": "ses1"}])  # session 存在チェック
    fake_db.queue_result([{"id": "c1", "session_id": "ses1"}])

    res = client.post(
        "/api/sessions/ses1/catches",
        json={"fish_species": "ヤマメ", "caught_at": "2026-05-06T07:30:00+09:00"},
    )

    assert res.status_code == 200
    insert_op = next(op for op in fake_db.calls[1]["ops"] if op[0] == "insert")
    assert insert_op[1][0]["caught_at"] == "2026-05-05T22:30:00+00:00"


def test_update_catch_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.put("/api/catches/missing", json={"fish_species": "ヤマメ"})

    assert res.status_code == 404


def test_update_catch_empty_body_returns_422(client, fake_db):
    res = client.put("/api/catches/c1", json={})

    assert res.status_code == 422
    assert res.json()["detail"] == "更新するフィールドがありません"
    assert fake_db.calls == []


def test_delete_catch_success(client, fake_db):
    fake_db.queue_result([{"id": "c1"}])

    res = client.delete("/api/catches/c1")

    assert res.status_code == 200
    assert res.json() == {"message": "削除しました"}


def test_delete_catch_not_found(client, fake_db):
    fake_db.queue_result([])

    res = client.delete("/api/catches/missing")

    assert res.status_code == 404
