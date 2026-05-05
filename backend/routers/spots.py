from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import supabase_admin
from auth import get_current_user

router = APIRouter(prefix="/api/spots", tags=["spots"])


class SpotCreate(BaseModel):
    name: str
    river_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class SpotUpdate(BaseModel):
    name: Optional[str] = None
    river_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


@router.get("/")
def list_spots(user_id: str = Depends(get_current_user)):
    result = supabase_admin.table("spots").select("*").eq("user_id", user_id).execute()
    return result.data


@router.post("/")
def create_spot(spot: SpotCreate, user_id: str = Depends(get_current_user)):
    data = spot.model_dump()
    data["user_id"] = user_id
    result = supabase_admin.table("spots").insert(data).execute()
    return result.data[0]


@router.get("/{spot_id}")
def get_spot(spot_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("spots")
        .select("*")
        .eq("id", spot_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="ポイントが見つかりません")
    return result.data[0]


@router.put("/{spot_id}")
def update_spot(
    spot_id: str, spot: SpotUpdate, user_id: str = Depends(get_current_user)
):
    data = {k: v for k, v in spot.model_dump().items() if v is not None}
    result = (
        supabase_admin.table("spots")
        .update(data)
        .eq("id", spot_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="ポイントが見つかりません")
    return result.data[0]


@router.delete("/{spot_id}")
def delete_spot(spot_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("spots")
        .delete()
        .eq("id", spot_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="ポイントが見つかりません")
    return {"message": "削除しました"}


@router.get("/{spot_id}/sessions")
def list_spot_sessions(spot_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase_admin.table("sessions")
        .select("*")
        .eq("spot_id", spot_id)
        .eq("user_id", user_id)
        .order("date", desc=True)
        .execute()
    )
    return result.data
