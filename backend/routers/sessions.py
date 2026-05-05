from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date, time
from database import supabase_admin
from auth import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    spot_id: Optional[str] = None
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    water_level: Optional[str] = None
    water_clarity: Optional[str] = None
    weather: Optional[str] = None
    notes: Optional[str] = None


class SessionUpdate(BaseModel):
    spot_id: Optional[str] = None
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    water_level: Optional[str] = None
    water_clarity: Optional[str] = None
    weather: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_sessions(user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("sessions")
        .select("*, spots(name, river_name)")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .execute()
    )
    return result.data


@router.post("/")
def create_session(session: SessionCreate, user_id: str = Depends(get_current_user)):
    data = {k: v for k, v in session.model_dump().items() if v is not None}
    data["user_id"] = user_id
    if "date" in data:
        data["date"] = str(data["date"])
    if "start_time" in data:
        data["start_time"] = str(data["start_time"])
    if "end_time" in data:
        data["end_time"] = str(data["end_time"])
    result = supabase_admin.table("sessions").insert(data).execute()
    return result.data[0]


@router.get("/stats/monthly")
def monthly_stats(user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("sessions")
        .select("date, catches(id, length_cm, fish_species)")
        .eq("user_id", user_id)
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
def get_session(session_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("sessions")
        .select("*, spots(name, river_name), catches(*)")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return result.data[0]


@router.put("/{session_id}")
def update_session(
    session_id: str, session: SessionUpdate, user_id: str = Depends(get_current_user)
):
    data = {k: v for k, v in session.model_dump().items() if v is not None}
    if "date" in data:
        data["date"] = str(data["date"])
    if "start_time" in data:
        data["start_time"] = str(data["start_time"])
    if "end_time" in data:
        data["end_time"] = str(data["end_time"])
    result = (
        supabase_admin.table("sessions")
        .update(data)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return result.data[0]


@router.delete("/{session_id}")
def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    return {"message": "削除しました"}
