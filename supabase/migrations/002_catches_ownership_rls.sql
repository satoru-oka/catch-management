-- ============================================================
-- catches の所有権を RLS で担保する (#66)
--
-- 背景:
--   anon key はブラウザに露出するため、ユーザーは自分の JWT + anon key で
--   PostgREST を直接叩ける。FastAPI 側のアプリ層チェック (validate_lure_id,
--   「session 存在チェック後に catch を insert」) はセキュリティ境界として
--   機能しない。
--
--   既存の "catches_own" ポリシーは session 所有権しか見ていないため、
--   PostgREST 直叩きで「自分の session に他人の lure_id を付けた catch」を
--   insert/update できてしまう。lures への FK は RLS をバイパスして検証される
--   ため、他人の lure_id でも FK 制約は通ってしまう。
--
-- 方針 (backend/CLAUDE.md「RLS を authoritative にする」に沿う):
--   1. catches.lure_id -> lures(id) ON DELETE SET NULL の FK を保証 (idempotent)
--   2. catches の INSERT / UPDATE の WITH CHECK に lure 所有権条件を追加
--   3. session 所有権も USING / WITH CHECK 両方へ明示的に書き下す
--
-- 再実行可能 (idempotent) なように drop if exists してから作り直す。
-- Supabase SQL Editor で実行する想定。
-- ============================================================

-- ---------- 1. lure_id の FK を保証 ----------
-- base schema (docs/database-setup.md) に既にあるが、未適用環境向けに idempotent に。
do $$ begin
  alter table catches
    add constraint catches_lure_id_fkey
    foreign key (lure_id) references lures(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------- 2. 既存の包括ポリシーを所有権つきに置き換える ----------
-- 旧: session 所有権のみ (lure 所有権を検査しない)
drop policy if exists "catches_own" on catches;

-- 読み取り: 自分の session に属する catch のみ
drop policy if exists "catches_select" on catches;
create policy "catches_select" on catches
  for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- 追加: 自分の session かつ (lure 未指定 or 自分の lure)
drop policy if exists "catches_insert" on catches;
create policy "catches_insert" on catches
  for insert with check (
    session_id in (select id from sessions where user_id = auth.uid())
    and (
      lure_id is null
      or exists (
        select 1 from lures where lures.id = lure_id and lures.user_id = auth.uid()
      )
    )
  );

-- 更新: 対象行 (USING) も変更後 (WITH CHECK) も自分の session、
--       かつ変更後の lure_id は未指定または自分の lure。
drop policy if exists "catches_update" on catches;
create policy "catches_update" on catches
  for update
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  )
  with check (
    session_id in (select id from sessions where user_id = auth.uid())
    and (
      lure_id is null
      or exists (
        select 1 from lures where lures.id = lure_id and lures.user_id = auth.uid()
      )
    )
  );

-- 削除: 自分の session に属する catch のみ
drop policy if exists "catches_delete" on catches;
create policy "catches_delete" on catches
  for delete using (
    session_id in (select id from sessions where user_id = auth.uid())
  );
