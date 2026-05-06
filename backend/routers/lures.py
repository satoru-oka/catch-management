from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from supabase import Client
from auth import get_current_user, get_supabase

router = APIRouter(prefix="/api/lures", tags=["lures"])


class LureCreate(BaseModel):
    name: str
    type: Optional[str] = None
    color: Optional[str] = None
    length_mm: Optional[float] = None
    weight_g: Optional[float] = None
    notes: Optional[str] = None


class LureUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    length_mm: Optional[float] = None
    weight_g: Optional[float] = None
    notes: Optional[str] = None


@router.get("/")
def list_lures(db: Client = Depends(get_supabase)):
    result = db.table("lures").select("*").order("name").execute()
    return result.data


@router.post("/")
def create_lure(
    lure: LureCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user),
):
    data = {k: v for k, v in lure.model_dump().items() if v is not None}
    data["user_id"] = user_id
    result = db.table("lures").insert(data).execute()
    return result.data[0]


@router.put("/{lure_id}")
def update_lure(lure_id: str, lure: LureUpdate, db: Client = Depends(get_supabase)):
    data = {k: v for k, v in lure.model_dump().items() if v is not None}
    result = db.table("lures").update(data).eq("id", lure_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="ルアーが見つかりません")
    return result.data[0]


@router.delete("/{lure_id}")
def delete_lure(lure_id: str, db: Client = Depends(get_supabase)):
    result = db.table("lures").delete().eq("id", lure_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="ルアーが見つかりません")
    return {"message": "削除しました"}


@router.get("/stats")
def lure_stats(db: Client = Depends(get_supabase)):
    # RLSによりログインユーザーのcatchesのみ取得される
    result = db.table("catches").select("lure_name, lure_color, length_cm").execute()
    stats = {}
    for catch in result.data:
        key = catch.get("lure_name") or "不明"
        if key not in stats:
            stats[key] = {"count": 0, "avg_length": 0, "lengths": []}
        stats[key]["count"] += 1
        if catch.get("length_cm"):
            stats[key]["lengths"].append(catch["length_cm"])
    for key in stats:
        lengths = stats[key].pop("lengths")
        if lengths:
            stats[key]["avg_length"] = round(sum(lengths) / len(lengths), 1)
    return stats
