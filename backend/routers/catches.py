import calendar
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from api_helpers import assert_found, first_or_404
from auth import get_current_user, get_supabase
from jst import jst_day_end_utc_iso, jst_day_start_utc_iso, jst_today, to_utc_iso

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
    # caught_at は常に UTC で保存する。naive 入力は JST とみなす (#68)。
    if catch.caught_at is not None:
        data["caught_at"] = to_utc_iso(catch.caught_at)
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
    # date_from/date_to は JST の暦日。caught_at は UTC 保存なので JST の 1 日を
    # UTC 範囲に変換して比較する (#68)。
    if date_from:
        query = query.gte("caught_at", jst_day_start_utc_iso(date_from))
    if date_to:
        query = query.lte("caught_at", jst_day_end_utc_iso(date_to))
    if length_min is not None:
        query = query.gte("length_cm", length_min)
    if length_max is not None:
        query = query.lte("length_cm", length_max)
    if weight_min is not None:
        query = query.gte("weight_g", weight_min)
    if weight_max is not None:
        query = query.lte("weight_g", weight_max)
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/catches/stats/summary")
def catch_summary(db: Client = Depends(get_supabase)):
    """ホーム画面向けのサーバー集計 (#72)。

    全件ページング取得 (fetchAllPages) の代わりに、count / 当月分 / 上位 1 件 /
    最近 3 件という小さなクエリ群で必要な数値だけを返す。RLS によりログイン
    ユーザーの行のみ集計される。

    日付の区分 (今日 / 今月) は session.date を基準にする。caught_at は #68 方針で
    UTC 保存だが、現状フォームからは設定されず実質常に NULL のため、釣行日
    (session.date) が事実上の釣果日であり、これで既存ホーム表示と一致する。
    """
    today = jst_today()
    today_iso = today.isoformat()
    month_start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    month_end = today.replace(day=last_day)

    # 1. 総釣果数: 行を転送せず count だけ取得する。
    lifetime = (
        db.table("catches").select("id", count="exact", head=True).execute().count or 0
    )

    # 2. 当月の sessions + catches だけ取得し、今日 / 今月を集計する (全件取得しない)。
    month_rows = (
        db.table("sessions")
        .select("date, catches(weight_g, length_cm)")
        .gte("date", month_start.isoformat())
        .lte("date", month_end.isoformat())
        .execute()
        .data
    )
    month_count = 0
    today_count = 0
    today_weight_g = 0.0
    today_max_cm = 0.0
    for session in month_rows:
        catches = session.get("catches") or []
        month_count += len(catches)
        if session.get("date") == today_iso:
            today_count += len(catches)
            for catch in catches:
                today_weight_g += catch.get("weight_g") or 0
                today_max_cm = max(today_max_cm, catch.get("length_cm") or 0)

    # 3. 最大サイズの釣果 (魚種つき)。NULL を除外して length 降順 1 件。
    max_rows = (
        db.table("catches")
        .select("fish_species, length_cm")
        .gte("length_cm", 0)
        .order("length_cm", desc=True)
        .limit(1)
        .execute()
        .data
    )
    max_catch = max_rows[0] if max_rows else None

    # 4. 最近の釣果 3 件 (スポット情報込み)。
    recent = (
        db.table("catches")
        .select("*, sessions(date, spots(name, river_name))")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
        .data
    )

    return {
        "today": {
            "count": today_count,
            "total_weight_g": today_weight_g,
            "max_length_cm": today_max_cm or None,
        },
        "lifetime_count": lifetime,
        "month_count": month_count,
        "max_catch": max_catch,
        "recent": recent,
    }


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
    # caught_at は常に UTC で保存する。naive 入力は JST とみなす (#68)。
    if catch.caught_at is not None:
        data["caught_at"] = to_utc_iso(catch.caught_at)
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
