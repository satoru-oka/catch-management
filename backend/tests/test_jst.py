"""JST <-> UTC 境界変換ヘルパーのテスト (#68)。"""

from __future__ import annotations

import datetime as dt

from jst import JST, jst_day_end_utc_iso, jst_day_start_utc_iso, to_utc_iso


def test_to_utc_iso_treats_naive_as_jst():
    naive = dt.datetime(2026, 5, 6, 7, 30, 0)
    assert to_utc_iso(naive) == "2026-05-05T22:30:00+00:00"


def test_to_utc_iso_converts_aware_value():
    aware = dt.datetime(2026, 5, 6, 7, 30, 0, tzinfo=JST)
    assert to_utc_iso(aware) == "2026-05-05T22:30:00+00:00"


def test_to_utc_iso_passes_through_utc():
    aware = dt.datetime(2026, 5, 6, 7, 30, 0, tzinfo=dt.timezone.utc)
    assert to_utc_iso(aware) == "2026-05-06T07:30:00+00:00"


def test_jst_day_start_crosses_utc_15_boundary():
    # JST 00:00 は前日の UTC 15:00。
    assert jst_day_start_utc_iso(dt.date(2026, 5, 1)) == "2026-04-30T15:00:00+00:00"


def test_jst_day_end_is_same_day_utc_1459():
    assert (
        jst_day_end_utc_iso(dt.date(2026, 5, 31))
        == "2026-05-31T14:59:59.999999+00:00"
    )


def test_jst_day_range_brackets_a_midnight_jst_catch():
    """JST 深夜 0:20 (= UTC 前日 15:20) の釣果が、その JST 日付の範囲に入る。"""
    day = dt.date(2026, 6, 1)
    start = jst_day_start_utc_iso(day)
    end = jst_day_end_utc_iso(day)
    # 2026-06-01 00:20 JST = 2026-05-31T15:20:00Z
    catch_utc = "2026-05-31T15:20:00+00:00"
    assert start <= catch_utc <= end
