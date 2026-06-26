import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from api_helpers import assert_found, first_or_404
from auth import get_current_user, get_supabase

router = APIRouter(prefix="/api", tags=["catches"])


class CatchCreate(BaseModel):
    fish_species: str
    length_cm: float | None = None
    weight_g: float | None = None
    lure_id: str | None = None
    lure_name: str | None = None
    lure_color: str | None = None
    caught_at: dt.datetime | None = None
    is_released: bool | None = True
    notes: str | None = None


class CatchUpdate(BaseModel):
    fish_species: str | None = None
    length_cm: float | None = None
    weight_g: float | None = None
    lure_id: str | None = None
    lure_name: str | None = None
    lure_color: str | None = None
    caught_at: dt.datetime | None = None
    is_released: bool | None = None
    notes: str | None = None


def validate_lure_id(lure_id: str | None, db: Client) -> None:
    if not lure_id:
        return
    result = db.table("lures").select("id").eq("id", lure_id).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="無効な lure_id です")


def _escape_ilike(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


def _date_start_iso(value: dt.date) -> str:
    return dt.datetime.combine(value, dt.time.min).isoformat()


def _date_end_iso(value: dt.date) -> str:
    return dt.datetime.combine(value, dt.time.max).isoformat()


@router.post("/sessions/{session_id}/catches")
def create_catch(
    session_id: str,
    catch: CatchCreate,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    # RLSにより自分が所有しないsessionは取得できない
    session = db.table("sessions").select("id").eq("id", session_id).execute()
    assert_found(session.data, "釣行が見つかりません")
    validate_lure_id(catch.lure_id, db)
    data = catch.model_dump(mode="json", exclude_none=True)
    data["session_id"] = session_id
    result = db.table("catches").insert(data).execute()
    return result.data[0]


@router.get("/catches")
def list_catches(
    db: Client = Depends(get_supabase),
    fish_species: str | None = None,
    lure_name: str | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    length_min: float | None = None,
    length_max: float | None = None,
    weight_min: float | None = None,
    weight_max: float | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = db.table("catches").select("*, sessions(date, spot_id)")
    if fish_species:
        query = query.eq("fish_species", fish_species)
    if lure_name:
        query = query.ilike("lure_name", f"%{_escape_ilike(lure_name)}%")
    if date_from:
        query = query.gte("caught_at", _date_start_iso(date_from))
    if date_to:
        query = query.lte("caught_at", _date_end_iso(date_to))
    if length_min is not None:
        query = query.gte("length_cm", length_min)
    if length_max is not None:
        query = query.lte("length_cm", length_max)
    if weight_min is not None:
        query = query.gte("weight_g", weight_min)
    if weight_max is not None:
        query = query.lte("weight_g", weight_max)
    # 同一 created_at でもページ間で安定するよう id をタイブレーカーに付ける (#71)
    result = (
        query.order("created_at", desc=True)
        .order("id")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.get("/catches/{catch_id}")
def get_catch(catch_id: str, db: Client = Depends(get_supabase)):
    result = (
        db.table("catches")
        .select("*, sessions(date)")
        .eq("id", catch_id)
        .execute()
    )
    return first_or_404(result.data, "釣果が見つかりません")


@router.put("/catches/{catch_id}")
def update_catch(
    catch_id: str,
    catch: CatchUpdate,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    data = catch.model_dump(mode="json", exclude_unset=True)
    if not data:
        raise HTTPException(status_code=422, detail="更新するフィールドがありません")
    if data.get("lure_id") is not None:
        validate_lure_id(data["lure_id"], db)
    result = db.table("catches").update(data).eq("id", catch_id).execute()
    return first_or_404(result.data, "釣果が見つかりません")


@router.delete("/catches/{catch_id}")
def delete_catch(
    catch_id: str,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    result = db.table("catches").delete().eq("id", catch_id).execute()
    assert_found(result.data, "釣果が見つかりません")
    return {"message": "削除しました"}
