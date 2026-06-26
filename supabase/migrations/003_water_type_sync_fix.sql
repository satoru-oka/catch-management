-- ============================================================
-- water_type 同期トリガーの不整合を解消する (#77)
--
-- 001_dual_domain_schema.sql のトリガーには 2 つの問題があった:
--
--   1. spot_id = NULL を扱えない
--      sessions.spot_id は nullable (FK は ON DELETE SET NULL)。
--      旧トリガーは常に spots からの lookup 結果を NEW.water_type へ代入するため、
--      spot 未指定 / 参照先なしのとき water_type が NULL になり NOT NULL 制約に違反。
--      → spot なしの session を作れない / spot 削除時の ON DELETE SET NULL が失敗。
--
--   2. spots.water_type 変更が既存 sessions に同期されない
--      旧トリガーは sessions の INSERT / spot_id 更新時しか動かない。
--      spot の分類を変えても古い sessions.water_type が残り、CHECK や公開ビューと
--      食い違う。
--
-- 方針: 「spots を真実」とする 001 の設計を維持し、
--   - spot 未指定時は lookup せず既定値 / 既存値を保つ (NOT NULL を維持)
--   - spots.water_type 変更時は関連 sessions へ同期する
--   - water_type 変更で chk_session_metrics_by_water_type に違反する既存メトリクスは
--     新しい water_type に合わせて NULL クリアする (再分類で値が消えるのは許容)
--
-- 再実行可能。Supabase SQL Editor で実行する想定。
-- ============================================================

-- ---------- 1. session 側: spot からの同期 (INSERT / spot_id 更新時) ----------
-- spot_id NULL を安全に扱い、spot の water_type に合わない行内メトリクスはクリアする。
create or replace function sync_session_water_type() returns trigger as $$
declare
  resolved water_type;
begin
  if new.spot_id is null then
    -- spot 未指定: lookup しない。
    --   INSERT 時は列 default ('freshwater') が BEFORE トリガー前に適用済みなので
    --   NEW.water_type は NULL にならない。
    --   UPDATE で spot_id を NULL にする場合は既存 water_type を維持する。
    if tg_op = 'UPDATE' then
      new.water_type := old.water_type;
    end if;
    return new;
  end if;

  select s.water_type into resolved from spots s where s.id = new.spot_id;

  if resolved is null then
    -- 参照先 spot が無い (通常は FK で起きないが防御的に)。NULL 代入は避ける。
    if tg_op = 'UPDATE' then
      new.water_type := old.water_type;
    end if;
    -- INSERT の場合は列 default をそのまま使う。
    return new;
  end if;

  new.water_type := resolved;

  -- 新しい water_type に許可されない行内メトリクスをクリアして
  -- chk_session_metrics_by_water_type 違反を防ぐ。
  if resolved = 'sea' then
    new.water_level := null;
    new.water_clarity := null;
  elsif resolved = 'freshwater' then
    new.tide := null;
    new.tide_phase := null;
    new.salinity_ppt := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_session_water_type on sessions;
create trigger trg_sync_session_water_type
  before insert or update of spot_id on sessions
  for each row execute function sync_session_water_type();

-- ---------- 2. spot 側: water_type 変更を既存 sessions へ伝播 ----------
create or replace function sync_sessions_on_spot_water_type() returns trigger as $$
begin
  if new.water_type is distinct from old.water_type then
    update sessions
      set water_type    = new.water_type,
          -- 新分類で許可されないメトリクスを同時にクリア (CHECK 違反回避)
          water_level   = case when new.water_type = 'sea' then null else water_level end,
          water_clarity = case when new.water_type = 'sea' then null else water_clarity end,
          tide          = case when new.water_type = 'freshwater' then null else tide end,
          tide_phase    = case when new.water_type = 'freshwater' then null else tide_phase end,
          salinity_ppt  = case when new.water_type = 'freshwater' then null else salinity_ppt end
      where spot_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_sessions_on_spot_water_type on spots;
create trigger trg_sync_sessions_on_spot_water_type
  after update of water_type on spots
  for each row execute function sync_sessions_on_spot_water_type();

-- ---------- 3. 既存データの整合 (再実行しても安全) ----------
-- spot を持つ session は spot に合わせ、spot 無しの session は既定値で埋める。
update sessions se
  set water_type = sp.water_type
  from spots sp
  where sp.id = se.spot_id
    and se.water_type is distinct from sp.water_type;

update sessions
  set water_type = 'freshwater'
  where spot_id is null and water_type is null;
