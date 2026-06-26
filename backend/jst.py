"""JST (Asia/Tokyo) と UTC の境界変換ヘルパー。

caught_at は DB で timestamptz、保存値は常に UTC とする (#68)。
ユーザー入力 (JST) と保存値 (UTC) の変換、および JST の「1 日」を
UTC 範囲に変換する日付フィルタ用ヘルパーを提供する。
"""

from __future__ import annotations

import datetime as dt

# 日本は DST が無いので固定オフセットで十分。
JST = dt.timezone(dt.timedelta(hours=9))


def jst_today() -> dt.date:
    """JST における「今日」の日付。"""
    return dt.datetime.now(JST).date()


def to_utc_iso(value: dt.datetime) -> str:
    """datetime を UTC の ISO 文字列にする。

    naive な値は JST とみなす (フロントが TZ 付きで送れない場合の保険)。
    tz-aware な値はそのまま UTC へ変換する。
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=JST)
    return value.astimezone(dt.timezone.utc).isoformat()


def jst_day_start_utc_iso(day: dt.date) -> str:
    """JST のその日の 00:00:00 を UTC の ISO 文字列で返す。

    例: 2026-05-01 -> 2026-04-30T15:00:00+00:00
    """
    start = dt.datetime.combine(day, dt.time.min, tzinfo=JST)
    return start.astimezone(dt.timezone.utc).isoformat()


def jst_day_end_utc_iso(day: dt.date) -> str:
    """JST のその日の 23:59:59.999999 を UTC の ISO 文字列で返す。

    例: 2026-05-31 -> 2026-05-31T14:59:59.999999+00:00
    """
    end = dt.datetime.combine(day, dt.time.max, tzinfo=JST)
    return end.astimezone(dt.timezone.utc).isoformat()
