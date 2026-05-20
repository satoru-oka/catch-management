from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from auth import get_supabase

router = APIRouter(prefix="/api", tags=["catches"])


class CatchCreate(BaseModel):
    fish_species: str
    length_cm: float | None = None
    weight_g: float | None = None
    lure_id: str | None = None
    lure_name: str | None = None
    lure_color: str | None = None
    caught_at: datetime | None = None
    is_released: bool | None = True
    notes: str | None = None


class CatchUpdate(BaseModel):
    fish_species: str | None = None
    length_cm: float | None = None
    weight_g: float | None = None
    lure_id: str | None = None
    lure_name: str | None = None
    lure_color: str | None = None
    caught_at: datetime | None = None
    is_released: bool | None = None
    notes: str | None = None


def validate_lure_id(lure_id: str | None, db: Client) -> None:
    if not lure_id:
        return
    result = db.table("lures").select("id").eq("id", lure_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="無効な lure_id です")


@router.post("/sessions/{session_id}/catches")
def create_catch(
    session_id: str, catch: CatchCreate, db: Client = Depends(get_supabase)
):
    # RLSにより自分が所有しないsessionは取得できない
    session = db.table("sessions").select("id").eq("id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="釣行が見つかりません")
    validate_lure_id(catch.lure_id, db)
    data = {k: v for k, v in catch.model_dump(mode="json").items() if v is not None}
    data["session_id"] = session_id
    result = db.table("catches").insert(data).execute()
    return result.data[0]


@router.get("/catches")
def list_catches(
    db: Client = Depends(get_supabase),
    fish_species: str | None = None,
    lure_name: str | None = None,
):
    query = db.table("catches").select("*, sessions(date, spot_id)")
    if fish_species:
        query = query.eq("fish_species", fish_species)
    if lure_name:
        query = query.ilike("lure_name", f"%{lure_name}%")
    result = query.order("created_at", desc=True).execute()
    return result.data


@router.get("/catches/{catch_id}")
def get_catch(catch_id: str, db: Client = Depends(get_supabase)):
    result = (
        db.table("catches")
        .select("*, sessions(date)")
        .eq("id", catch_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    return result.data[0]


@router.put("/catches/{catch_id}")
def update_catch(
    catch_id: str, catch: CatchUpdate, db: Client = Depends(get_supabase)
):
    data = catch.model_dump(mode="json", exclude_unset=True)
    if data.get("lure_id") is not None:
        validate_lure_id(data["lure_id"], db)
    result = db.table("catches").update(data).eq("id", catch_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    return result.data[0]


@router.delete("/catches/{catch_id}")
def delete_catch(catch_id: str, db: Client = Depends(get_supabase)):
    result = db.table("catches").delete().eq("id", catch_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="釣果が見つかりません")
    return {"message": "削除しました"}
