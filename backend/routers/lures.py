from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from supabase import Client

from api_helpers import assert_found, first_or_404
from auth import get_current_user, get_supabase
from stats import is_missing_view_error

router = APIRouter(prefix="/api/lures", tags=["lures"])


class LureCreate(BaseModel):
    name: str
    type: str | None = None
    color: str | None = None
    length_mm: float | None = None
    weight_g: float | None = None
    notes: str | None = None


class LureUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    color: str | None = None
    length_mm: float | None = None
    weight_g: float | None = None
    notes: str | None = None


@router.get("/")
def list_lures(
    db: Client = Depends(get_supabase),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    result = (
        db.table("lures")
        .select("*")
        .order("name")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.post("/")
def create_lure(
    lure: LureCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_current_user),
):
    data = lure.model_dump(mode="json", exclude_none=True)
    data["user_id"] = user_id
    result = db.table("lures").insert(data).execute()
    return result.data[0]


@router.put("/{lure_id}")
def update_lure(
    lure_id: str,
    lure: LureUpdate,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    data = lure.model_dump(mode="json", exclude_unset=True)
    result = db.table("lures").update(data).eq("id", lure_id).execute()
    return first_or_404(result.data, "ルアーが見つかりません")


@router.delete("/{lure_id}")
def delete_lure(
    lure_id: str,
    db: Client = Depends(get_supabase),
    _user_id: str = Depends(get_current_user),
):
    result = db.table("lures").delete().eq("id", lure_id).execute()
    assert_found(result.data, "ルアーが見つかりません")
    return {"message": "削除しました"}


@router.get("/stats")
def lure_stats(db: Client = Depends(get_supabase)):
    try:
        result = (
            db.table("user_lure_stats")
            .select("lure_name, count, avg_length")
            .execute()
        )
        return _format_lure_stats_rows(result.data)
    except Exception as e:
        if not is_missing_view_error(e, "user_lure_stats"):
            raise

    # RLSによりログインユーザーのcatchesのみ取得される
    result = db.table("catches").select("lure_name, length_cm").execute()
    stats = {}
    for catch in result.data:
        key = catch.get("lure_name") or "不明"
        if key not in stats:
            stats[key] = {"count": 0, "avg_length": 0, "lengths": []}
        stats[key]["count"] += 1
        if catch.get("length_cm") is not None:
            stats[key]["lengths"].append(catch["length_cm"])
    for key in stats:
        lengths = stats[key].pop("lengths")
        if lengths:
            stats[key]["avg_length"] = round(sum(lengths) / len(lengths), 1)
    return stats


def _format_lure_stats_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, float | int]]:
    return {
        row.get("lure_name") or "不明": {
            "count": int(row.get("count") or 0),
            "avg_length": float(row["avg_length"]) if row.get("avg_length") is not None else 0,
        }
        for row in rows
    }
