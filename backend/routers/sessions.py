import calendar
import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from auth import get_current_user, get_supabase
from stats import is_missing_view_error

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# NOTE: 型は `datetime.date` / `datetime.time` をモジュール経由で参照する。
# `from datetime import date` でインポートするとフィールド名 `date` が型名を
# シャドーし、Python 3.14 の PEP 649 遅延アノテーション下で `Optional[date] = None`
# の annotation が `NoneType` に解決されてしまう。詳細は docs/known-issues.md。
class SessionCreate(BaseModel):
    spot_id: str | None = None
    date: dt.date
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    water_level: str | None = None
    water_clarity: str | None = None
    weather: str | None = None
    notes: str | None = None


class SessionUpdate(BaseModel):
    spot_id: str | None = None
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    water_level: str | None = None
    water_clarity: str | None = None
    weather: str | None = None
    notes: str | None = None


@router.get("/")
def list_sessions(
    db: Client = Depends(get_supabase),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    result = (
        db.table("sessions")
        .select("*, spots(name, river_name)")
        .order("date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.post("/")
def create_session(
    session: SessionCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user),
):
    data = session.model_dump(mode="json", exclude_none=True)
    data["user_id"] = user_id
    result = db.table("sessions").insert(data).execute()
    return result.data[0]


@router.get("/stats/monthly")
def monthly_stats(
    db: Client = Depends(get_supabase),
    from_month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    to_month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
):
    from_month = _validate_month(from_month)
    to_month = _validate_month(to_month)
    if from_month and to_month and from_month > to_month:
        raise HTTPException(status_code=422, detail="from_month must be before to_month")

    try:
        query = db.table("user_monthly_session_stats").select(
            "month, session_count, catch_count"
        )
        if from_month:
            query = query.gte("month", from_month)
        if to_month:
            query = query.lte("month", to_month)
        result = query.execute()
        return _format_monthly_stats_rows(result.data)
    except Exception as e:
        if not is_missing_view_error(e, "user_monthly_session_stats"):
            raise

    query = db.table("sessions").select("date, catches(id, length_cm, fish_species)")
    if from_month:
        query = query.gte("date", f"{from_month}-01")
    if to_month:
        query = query.lte("date", _month_end_iso(to_month))
    result = query.execute()
    stats = {}
    for session in result.data:
        month = session["date"][:7]
        catches = session.get("catches", [])
        if month not in stats:
            stats[month] = {"session_count": 0, "catch_count": 0}
        stats[month]["session_count"] += 1
        stats[month]["catch_count"] += len(catches)
    return stats


def _format_monthly_stats_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    return {
        row["month"]: {
            "session_count": int(row.get("session_count") or 0),
            "catch_count": int(row.get("catch_count") or 0),
        }
        for row in rows
    }


def _validate_month(month: str | None) -> str | None:
    if month is None:
        return None
    _month_parts(month)
    return month


def _month_parts(month: str) -> tuple[int, int]:
    try:
        year, month_number = (int(part) for part in month.split("-"))
        dt.date(year, month_number, 1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="month must be a valid YYYY-MM") from exc
    return year, month_number


def _month_end_iso(month: str) -> str:
    year, month_number = _month_parts(month)
    last_day = calendar.monthrange(year, month_number)[1]
    return f"{month}-{last_day:02d}"


@router.get("/{session_id}")
def get_session(session_id: str, db: Client = Depends(get_supabase)):
    result = (
        db.table("sessions")
        .select("*, spots(name, river_name), catches(*)")
        .eq("id", session_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return result.data[0]


@router.put("/{session_id}")
def update_session(
    session_id: str,
    session: SessionUpdate,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    data = session.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="更新するフィールドがありません")
    result = db.table("sessions").update(data).eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return result.data[0]


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    result = db.table("sessions").delete().eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return {"message": "削除しました"}
