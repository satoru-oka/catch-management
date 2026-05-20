import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from auth import get_current_user, get_supabase

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
def list_sessions(db: Client = Depends(get_supabase)):
    result = (
        db.table("sessions")
        .select("*, spots(name, river_name)")
        .order("date", desc=True)
        .execute()
    )
    return result.data


@router.post("/")
def create_session(
    session: SessionCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user),
):
    data = {k: v for k, v in session.model_dump(mode="json").items() if v is not None}
    data["user_id"] = user_id
    result = db.table("sessions").insert(data).execute()
    return result.data[0]


@router.get("/stats/monthly")
def monthly_stats(db: Client = Depends(get_supabase)):
    result = (
        db.table("sessions")
        .select("date, catches(id, length_cm, fish_species)")
        .execute()
    )
    stats = {}
    for session in result.data:
        month = session["date"][:7]
        catches = session.get("catches", [])
        if month not in stats:
            stats[month] = {"session_count": 0, "catch_count": 0}
        stats[month]["session_count"] += 1
        stats[month]["catch_count"] += len(catches)
    return stats


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
    session_id: str, session: SessionUpdate, db: Client = Depends(get_supabase)
):
    data = session.model_dump(mode="json", exclude_unset=True)
    result = db.table("sessions").update(data).eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return result.data[0]


@router.delete("/{session_id}")
def delete_session(session_id: str, db: Client = Depends(get_supabase)):
    result = db.table("sessions").delete().eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return {"message": "削除しました"}
