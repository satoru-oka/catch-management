from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import supabase_admin
from auth import get_current_user

router = APIRouter(tags=["catches"])


class CatchCreate(BaseModel):
    fish_species: str
    length_cm: Optional[float] = None
    weight_g: Optional[float] = None
    lure_id: Optional[str] = None
    lure_name: Optional[str] = None
    lure_color: Optional[str] = None
    caught_at: Optional[datetime] = None
    is_released: Optional[bool] = True
    notes: Optional[str] = None


class CatchUpdate(BaseModel):
    fish_species: Optional[str] = None
    length_cm: Optional[float] = None
    weight_g: Optional[float] = None
    lure_id: Optional[str] = None
    lure_name: Optional[str] = None
    lure_color: Optional[str] = None
    caught_at: Optional[datetime] = None
    is_released: Optional[bool] = None
    notes: Optional[str] = None


@router.post("/api/sessions/{session_id}/catches")
def create_catch(
    session_id: str, catch: CatchCreate, user_id: str = Depends(get_current_user)
):
    session = (
        supabase_admin.table("sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    data = {k: v for k, v in catch.model_dump().items() if v is not None}
    data["session_id"] = session_id
    if "caught_at" in data:
        data["caught_at"] = str(data["caught_at"])
    result = supabase_admin.table("catches").insert(data).execute()
    return result.data[0]


@router.get("/api/catches")
def list_catches(
    user_id: str = Depends(get_current_user),
    fish_species: Optional[str] = None,
    lure_name: Optional[str] = None,
):
    query = supabase_admin.table("catches").select(
        "*, sessions!inner(user_id, date, spot_id)"
    )
    query = query.eq("sessions.user_id", user_id)
    if fish_species:
        query = query.eq("fish_species", fish_species)
    if lure_name:
        query = query.ilike("lure_name", f"%{lure_name}%")
    result = query.order("created_at", desc=True).execute()
    return result.data


@router.get("/api/catches/{catch_id}")
def get_catch(catch_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("catches")
        .select("*, sessions!inner(user_id, date)")
        .eq("id", catch_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    catch = result.data[0]
    if catch["sessions"]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="アクセス権がありません")
    return catch


@router.put("/api/catches/{catch_id}")
def update_catch(
    catch_id: str, catch: CatchUpdate, user_id: str = Depends(get_current_user)
):
    existing = (
        supabase_admin.table("catches")
        .select("*, sessions!inner(user_id)")
        .eq("id", catch_id)
        .execute()
    )
    if not existing.data or existing.data[0]["sessions"]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    data = {k: v for k, v in catch.model_dump().items() if v is not None}
    if "caught_at" in data:
        data["caught_at"] = str(data["caught_at"])
    result = supabase_admin.table("catches").update(data).eq("id", catch_id).execute()
    return result.data[0]


@router.delete("/api/catches/{catch_id}")
def delete_catch(catch_id: str, user_id: str = Depends(get_current_user)):
    existing = (
        supabase_admin.table("catches")
        .select("*, sessions!inner(user_id)")
        .eq("id", catch_id)
        .execute()
    )
    if not existing.data or existing.data[0]["sessions"]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    supabase_admin.table("catches").delete().eq("id", catch_id).execute()
    return {"message": "削除しました"}
