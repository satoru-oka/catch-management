# Known Issues / 既知の不具合と修正履歴

> バックエンド・フロントエンドで「実装中に発見した不具合とその修正」を記録する追記式のログ。
> 新しい問題を見つけたら末尾に追加し、既存項目は **編集せずに残す** (履歴として参照できるように)。
>
> エントリ形式:
> - **ID**: `ISSUE-XXX` (連番)
> - **発見日**: `YYYY-MM-DD`
> - **発見経緯**: どのテスト/操作で気付いたか
> - **影響**: 何が壊れていたか / どんなユーザー影響があったか
> - **原因**: なぜそうなっていたか
> - **修正**: どこをどう直したか (コミット ID やファイル参照)
> - **再発防止**: テスト等のセーフティネット

---

## ISSUE-001: `SessionUpdate.date` フィールドが Pydantic で `NoneType` 扱いになる

- **発見日**: 2026-05-06
- **発見経緯**: `backend/tests/test_sessions.py` の単体テスト
  `test_update_session_with_date_field` 実装中、`PUT /api/sessions/{id}` に
  `{"date": "2026-05-07"}` を送ると 422 (`Input should be None`) が返ることを検出。
- **影響**:
  - `PUT /api/sessions/{session_id}` に `date` を含めるリクエストがすべて
    422 で失敗。釣行日の編集が一切できない状態。
  - フロントエンドの「釣行編集」フォームから日付を変更しても保存できない。
- **原因**:
  - `backend/routers/sessions.py` の冒頭で `from datetime import date, time`
    と型をインポートしていた。
  - `SessionUpdate` 内に `date: Optional[date] = None` というフィールドがあり、
    クラス本体の評価中に **フィールド名 `date` がインポートした `datetime.date`
    をシャドー** する構造だった。
  - Python 3.14 で導入された **PEP 649 (遅延アノテーション)** ではアノテーションが
    遅延評価される。Pydantic v2 がモデル構築時にアノテーションを解決すると、
    名前 `date` が「クラス属性として代入された `None`」を指してしまい、結果として
    フィールド型が `NoneType` に決まる。
  - そのため Pydantic は `date` フィールドに `None` 以外の入力が来るとバリデーション
    エラーを投げるようになっていた。
  - `SessionCreate` 側はデフォルト値を持たない (`date: date`) ためシャドーされず、
    たまたま正しく動いていたので長く気付かれなかった。
- **修正**: `backend/routers/sessions.py`
  - `from datetime import date, time` を `import datetime as dt` に変更。
  - フィールド型を `dt.date` / `Optional[dt.date]` / `Optional[dt.time]` で参照する
    形に書き換え、フィールド名と型名のシャドーイングを根絶。
  - 同ファイル冒頭にコメントで再発防止の意図を明記。
- **再発防止**:
  - `backend/tests/test_sessions.py::test_update_session_with_date_field` を
    通常テストとして常時実行 (元々は `xfail` でバグ存在を明示していた)。
  - `test_create_session_normalizes_date_and_time` と合わせて、`date`/`start_time`/
    `end_time` の正常系を網羅。

### 教訓: フィールド名と型名は被らせない

Pydantic モデル (および将来 `from __future__ import annotations` を入れる可能性が
あるすべてのモジュール) では、`from datetime import date, time` のような
**標準型をモジュールから直接取り出す書き方を避ける** こと。`import datetime as dt`
+ `dt.date` の形か、別名 (`from datetime import date as _date`) を使う。

---

## ISSUE-002: フォーム全体で `<label>` が `<input>` と関連付けられていない

- **発見日**: 2026-05-06 (login で初検出)、2026-05-06 (横展開を確認)
- **発見経緯**:
  - 初検出: `frontend/tests/login.test.tsx` の単体テスト
    (`getByLabelText('メールアドレス')`) が「ラベルが見つからない」で失敗。
    Testing Library のクエリは実際の支援技術が辿るのと同じ方法でラベルを解決するため、
    これはそのままアクセシビリティ上の問題でもある。
  - 横展開調査: 同じパターンが (protected) 配下のフォームページ全 6 ファイルにも
    存在することを確認 (合計 43 か所の `<label>`)。
- **影響**:
  - スクリーンリーダー利用者が入力欄の意味を読み上げで取得しにくい。
  - ラベルクリックでフォーカスが対応する入力に移らない (UX の小さな劣化)。
  - 自動 UI テスト (Testing Library) で堅牢なクエリが書けない。
- **原因**:
  - `<label className="...">...</label>` と `<input>` / `<select>` / `<textarea>` を
    兄弟要素として並べているだけで、`htmlFor` / `id` も `aria-label` /
    `aria-labelledby` も無く、入れ子にもなっていなかった。
  - 視覚的には機能しているため、見た目のレビューでは気付きづらい。
- **修正**:
  - `frontend/app/login/page.tsx`: 手動で `id` / `htmlFor` を付与。
  - `frontend/app/(protected)/sessions/new/page.tsx`、
    `frontend/app/(protected)/sessions/[id]/edit/page.tsx`、
    `frontend/app/(protected)/sessions/[id]/catches/new/page.tsx`、
    `frontend/app/(protected)/sessions/[id]/catches/[catchId]/edit/page.tsx`、
    `frontend/app/(protected)/spots/page.tsx`、
    `frontend/app/(protected)/lures/page.tsx`:
    `frontend/scripts/add-label-ids.mjs` で一括変換。`name` 属性を再利用し、
    ページごとに prefix (`session-new-`, `catch-edit-` 等) を付けて id 衝突を回避。
- **再発防止**:
  - 各ページの単体テストで `getByLabelText` を用いてラベル関連付けを
    暗黙的にアサート (`frontend/tests/{login,sessions-new,sessions-edit,
    catches-new,catches-edit,spots,lures}.test.tsx`)。
    labels が外れた瞬間にテストが落ちる構造。
  - 一括変換スクリプト `frontend/scripts/add-label-ids.mjs` を残しているので、
    新しいフォームを追加した際に同じ修正を流せる。

### 教訓: フォームは label と input を必ず関連付ける

`<label>` テキストと `<input>` を兄弟に並べただけでは関連付けは成立しない。

- 推奨: `<label htmlFor="x">...</label> <input id="x" />`
- 代替: `<label>テキスト <input /></label>` (入れ子)

ESLint の `jsx-a11y/label-has-associated-control` ルール導入を検討するとよい。
テストレベルでは `getByLabelText` を使うことで自然に強制できる。

---

## ISSUE-003: 不正な JWT を送ると 401 ではなく 500 が返る

- **発見日**: 2026-05-06
- **発見経緯**: `backend/tests/integration/test_spots_integration.py::test_invalid_token_is_rejected`
  が「壊れた JWT (`Bearer not-a-valid-jwt`) を送って 401 を期待」したところ、実 Supabase に
  接続した結合テストで 500 系エラー (`postgrest.exceptions.APIError: PGRST301
  Expected 3 parts in JWT; got 1`) が漏れていることを検出。
- **影響**:
  - クライアントから見ると、トークンが壊れている (期限切れ・改ざん・空文字) 場合に
    「サーバーエラー」が返る。フロント側は 401 を期待してログアウト/再ログイン処理を
    走らせている (`frontend/lib/api.ts` の `handleUnauthorized`) ので、その動線が
    動かず無限ローディングなどに繋がる。
  - 攻撃者視点でも、JWT が壊れたか期限切れかを 500 で判別される状態は望ましくない。
- **原因**:
  - `routers/spots.py` を含む大半の GET/PUT/DELETE エンドポイントは
    `get_current_user` (Supabase の `auth.get_user()` で JWT を検証) に依存していない。
    JWT は `get_supabase` 経由で PostgREST に **そのまま** 転送される設計
    (RLS 任せで Supabase API コールを節約する意図)。
  - 結果、不正な JWT は PostgREST 側で `PGRST301` (`Expected 3 parts in JWT; got 1`)
    として APIError 例外を投げる。
  - FastAPI 側にこの例外を捕捉するハンドラが無かったため、未処理エラーとして 500 が
    返り、本来の 401 にマップされない。
- **修正**: `backend/main.py`
  - グローバル例外ハンドラ `_postgrest_api_error_handler` を追加。
  - `PGRST301` (JWT 期限切れ / 不正) と `PGRST302` (JWT 設定問題) を **HTTP 401** に
    マップし、レスポンス本文を `{"detail": "Invalid token"}` で統一。
  - その他の PostgREST エラー (例: PG ロール権限拒否 `42501` など) は **HTTP 500** で
    返しつつ、本文を `{"detail": "Database error"}` に統一して詳細メッセージは
    クライアントに漏らさない。
- **再発防止**:
  - ユニットテスト 2 件を `backend/tests/test_auth.py` に追加:
    `test_postgrest_jwt_error_is_mapped_to_401`,
    `test_postgrest_other_error_is_mapped_to_500`。
    `dependency_overrides` で `get_supabase` を例外を投げるダブルに置換し、
    マッピングが崩れた瞬間に CI で落ちるようにした。
  - 結合テスト `test_invalid_token_is_rejected` も引き続き実 Supabase で 401 を
    検証 (修正前と同じテスト本体)。

### 教訓: 「依存しない外部例外」もハンドラを必ず置く

PostgREST のように JWT 検証や DB エラーを **アプリケーションコードを経由せず例外で
返す** ライブラリを使う場合、`@app.exception_handler` で必ず明示的に HTTP 状態に
マップすること。マップ無しだと FastAPI のデフォルト 500 にフォールスルーし、
クライアント契約と認証フローが両方壊れる。

特に「JWT を検証しない (PostgREST に丸投げする)」設計を選ぶ場合は、`PGRST301` /
`PGRST302` の 401 マッピングが事実上の前提になるので、main.py から外せない契約と
して書き残すこと。
