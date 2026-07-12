-- ============================================================
-- sessions.spot_id の所有権をRLSで担保する (FISHMG-10)
--
-- FastAPIを迂回してPostgRESTを直接呼ばれても、他ユーザーのspot UUIDを
-- 自分のsessionへ紐付けられないようINSERT/UPDATEのWITH CHECKを強化する。
-- spot_idはnullableなので、未指定は引き続き許可する。
--
-- 再実行可能。Supabase SQL Editorで実行する想定。
-- ============================================================

drop policy if exists "sessions_own" on sessions;

create policy "sessions_own" on sessions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      spot_id is null
      or exists (
        select 1 from spots as owned_spot
        where owned_spot.id = sessions.spot_id
          and owned_spot.user_id = auth.uid()
      )
    )
  );
