from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from supabase import Client

from api_helpers import assert_found, first_or_404
from auth import get_current_user, get_supabase

router = APIRouter(prefix="/api/spots", tags=["spots"])


class SpotCreate(BaseModel):
    name: str
    river_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class SpotUpdate(BaseModel):
    name: str | None = None
    river_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


@router.get("/")
def list_spots(
    db: Client = Depends(get_supabase),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    result = (
        db.table("spots")
        .select("*")
        .order("name")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.post("/")
def create_spot(
    spot: SpotCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user),
):
    data = {k: v for k, v in spot.model_dump().items() if v is not None}
    data["user_id"] = user_id
    result = db.table("spots").insert(data).execute()
    return result.data[0]


@router.get("/{spot_id}")
def get_spot(spot_id: str, db: Client = Depends(get_supabase)):
    result = db.table("spots").select("*").eq("id", spot_id).execute()
    return first_or_404(result.data, "ポイントが見つかりません")


@router.put("/{spot_id}")
def update_spot(
    spot_id: str,
    spot: SpotUpdate,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    data = spot.model_dump(exclude_unset=True)
    result = db.table("spots").update(data).eq("id", spot_id).execute()
    return first_or_404(result.data, "ポイントが見つかりません")


@router.delete("/{spot_id}")
def delete_spot(
    spot_id: str,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    result = db.table("spots").delete().eq("id", spot_id).execute()
    assert_found(result.data, "ポイントが見つかりません")
    return {"message": "削除しました"}


@router.get("/{spot_id}/sessions")
def list_spot_sessions(
    spot_id: str,
    db: Client = Depends(get_supabase),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    result = (
        db.table("sessions")
        .select("*")
        .eq("spot_id", spot_id)
        .order("date", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data
