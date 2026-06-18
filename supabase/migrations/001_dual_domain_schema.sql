-- ============================================================
-- catch-management 統合スキーマ拡張（海/汽水/淡水の3軸対応）
-- 既存スキーマ（docs/database-setup.md）への追加マイグレーション。
-- Supabase SQL Editor で実行する想定。
--
-- 3 軸モデル:
--   water_type  … 水質（塩分）。CHECK と環境メトリクスを駆動する唯一の整合性軸
--   spot_type   … 場所の形。フィルタ・地図表現用のメタデータ
--   river_zone  … 河川の縦断位置。フィルタ・魚種予測用のメタデータ
--
-- 既存スキーマとの整合メモ:
--   * 既存データは淡水（河川・トラウト/バス）前提のため、water_type/spot_type の
--     既定値は 'freshwater' / 'river'。海前提にすると既存行が CHECK 違反になる。
--   * 釣行の日時は既存 sessions.date（NOT NULL）を利用。started_at は新設不要。
--   * catches.length_cm / caught_at / fish_species, spots.latitude/longitude は既存。
--   * 公開ビューは anon 公開のためのセキュリティ設計が別途必要（末尾の注記参照）。
-- ============================================================

-- ---------- 1. ENUM 型 ----------
do $$ begin
  create type water_type as enum ('sea', 'brackish', 'freshwater');
exception when duplicate_object then null; end $$;

do $$ begin
  create type spot_type as enum
    ('open_sea','bay','pier','harbor','canal','reef','river_mouth','river','lake','reservoir','pond');
exception when duplicate_object then null; end $$;

do $$ begin
  create type river_zone as enum ('upper', 'middle', 'lower');
exception when duplicate_object then null; end $$;

-- 集計可能な潮回り（自由記述の sessions.tide とは別軸）。潮×ヒット率の集計キー
do $$ begin
  create type tide_phase as enum ('大潮', '中潮', '小潮', '長潮', '若潮');
exception when duplicate_object then null; end $$;

-- ---------- 2. spots（場所固有の属性） ----------
alter table spots
  add column if not exists water_type water_type not null default 'freshwater',  -- 真実はここ（場所固有）
  add column if not exists spot_type  spot_type  not null default 'river',
  add column if not exists river_zone river_zone,                -- 流水系のみ。それ以外は NULL
  add column if not exists elevation_m           numeric,        -- GPS/標高API から自動補完可
  add column if not exists distance_from_mouth_m numeric;        -- 河川網スナップで自動補完可（縦断位置の連続値）

alter table spots drop constraint if exists chk_spot_river_zone;
alter table spots add constraint chk_spot_river_zone check (
  river_zone is null
  or spot_type in ('river', 'river_mouth')
);

-- ---------- 3. sessions（釣行ごとの環境スナップショット） ----------
-- water_type は spots を真実とするが、CHECK は同一行しか参照できないため複製して行内で完結させる
alter table sessions
  add column if not exists water_type   water_type not null default 'freshwater',  -- spots から同期（下のトリガ）
  add column if not exists tide         text,        -- 潮（自由記述。例: 上を3分）
  add column if not exists tide_phase   tide_phase,  -- 潮回り。潮×ヒット率の集計キー（潮汐系）
  add column if not exists salinity_ppt numeric,     -- 塩分濃度（潮汐系・汽水で最も有効）
  add column if not exists water_temp_c numeric;     -- 水温（全モード共通＝ゲートしない）
-- 釣行日時は既存 sessions.date（NOT NULL）/ start_time を利用。
-- water_level / water_clarity（内水面系）は既存カラムを利用。
-- 運用要件: 0 尾（ボウズ）の釣行も session として必ず記録する。これがヒット率の分母になる。

-- 既存行の water_type を spots から backfill（CHECK 追加前に必須）
update sessions se
  set water_type = sp.water_type
  from spots sp
  where sp.id = se.spot_id;

-- 水質ごとの許可セット（潮汐系 vs 内水面系。brackish は両方許可）
alter table sessions drop constraint if exists chk_session_metrics_by_water_type;
alter table sessions add constraint chk_session_metrics_by_water_type check (
  case water_type
    when 'sea'        then water_level is null and water_clarity is null
    when 'freshwater' then tide is null and tide_phase is null and salinity_ppt is null
    when 'brackish'   then true
  end
);

-- sessions.water_type を spot から自動同期（アプリ側で設定不要にする）
create or replace function sync_session_water_type() returns trigger as $$
begin
  select s.water_type into new.water_type from spots s where s.id = new.spot_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_session_water_type on sessions;
create trigger trg_sync_session_water_type
  before insert or update of spot_id on sessions
  for each row execute function sync_session_water_type();

-- 潮 × ヒット率の集計を支えるインデックス（スポット・潮回り・釣行日で絞る）
create index if not exists idx_sessions_spot_tide_date
  on sessions (spot_id, tide_phase, date);

-- ---------- 4. catches（魚ごとの記録） ----------
-- length_cm は既存のため追加不要。
alter table catches
  add column if not exists depth_m   numeric,   -- 水深（全モード共通）
  add column if not exists rig       text,      -- 仕掛け（海・汽水のタックル）
  add column if not exists bait      text,      -- 餅
  add column if not exists is_public boolean not null default false;  -- 公開オプトイン
-- is_released / lure（lures 経由）は既存を利用

create index if not exists idx_catches_is_public on catches (is_public) where is_public;

-- ============================================================
-- 参考（ステップ2・ドラフト）: 公開ビュー
-- 注意: anon への公開は security_invoker / RLS の設計が別途必要。
-- 既存の stats view は security_invoker=true でユーザー RLS を維持しているが、
-- 本ビューは「匿名で公開可の釣果だけ見せる」用途なので別方針が要る。
-- 列名は既存スキーマに合わせてある。グラントは設計確定後に有効化する。
-- ============================================================
create or replace view public_catches as
select
  c.id, c.fish_species, c.weight_g, c.length_cm, c.is_released, c.caught_at,
  s.water_type, s.tide_phase, sp.spot_type, sp.river_zone,
  round(sp.latitude::numeric, 2)  as area_lat,   -- 正確な座標は伏せ、粗いエリアに丸める
  round(sp.longitude::numeric, 2) as area_lng
from catches  c
join sessions s  on s.id  = c.session_id
join spots    sp on sp.id = s.spot_id
where c.is_public = true;

-- grant select on public_catches to anon;  -- セキュリティ設計確定後に有効化
