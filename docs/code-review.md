# Code Review & Refactoring Log

> ファイル単位のコード分析結果と、そこで見つかった改善候補・対応状況を**追記式**に記録するログ。
>
> - 新しい分析を行ったら **末尾に追加**。既存セクションは編集せず、対応が進んだら status を更新する形で履歴を残す。
> - 「忘れてしまう前に書き留める」のが第一目的。各セクションは数ヶ月後の自分が読んでも文脈を再構築できる粒度で書く。
> - `docs/known-issues.md` は **本物の不具合ログ** (本番影響あり)、こちらは **コード品質/設計の改善候補** (動いているが磨ける) という棲み分け。

## 凡例

### 重要度

| マーク | 意味 |
|---|---|
| 🔴 | 高: 本番運用で問題になる / 既にバグの種 |
| 🟡 | 中: 開発体験 / 保守性に効く |
| 🟢 | 低: 磨き上げ |
| ⚪ | 任意: 好みの問題 |

### ステータス

| マーク | 意味 |
|---|---|
| **OPEN** | 未対応 |
| **DONE** | 対応済み (commit / PR を併記) |
| **WONTFIX** | 意図的に残す (理由を必ず併記) |

---

## backend/main.py

**分析日**: 2026-05-06
**分析時の行数**: 41 行 → 修正後 53 行
**役割**: FastAPI アプリの composition root (CORS / 例外ハンドラ / router 登録)

### 強み (記録のみ)

- 業務ロジックなし。composition root として教科書的
- 例外ハンドラのコメントが `docs/known-issues.md ISSUE-003` を参照しており、3 ヶ月後の自分でも経緯を追える
- `getattr(exc, "code", None)` で SDK バージョン差を吸収する防御
- `_request: Request` の `_` 接頭辞で「未使用だが規約で必要」を明示
- 5xx の本文を `"Database error"` で統一し、SQL 詳細をクライアントに漏らさない

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| M-1 | 🔴 | CORS の origin が `localhost:3000` ハードコード。本番デプロイで CORS preflight が静かに失敗する | **DONE** PR #7 (15231ca): `ALLOWED_ORIGINS` env で上書き可、未設定時はローカル既定 |
| M-2 | 🟡 | PGRST301/302 以外の 500 経路がログに残らず障害調査不能 | **DONE** PR #7 (15231ca): `logger.exception("Unhandled PostgREST error: code=%s", code)` |
| M-3 | 🟡 | 未捕捉例外で FastAPI のデフォルト HTML が返り、フロントの `apiFetch` が `res.json()` で SyntaxError → 無限ローディング | **DONE** PR #7 (15231ca): `@app.exception_handler(Exception)` で 500 JSON 統一 |
| M-4 | 🟡 | `allow_credentials=True` だが Bearer 認証で Cookie 不使用 | **WONTFIX**: 将来 Cookie 認証に切り替える可能性を残す。害なし |
| M-5 | 🟢 | `/` の役割が曖昧 (liveness check として `/healthz` が無い) | **DONE** [#8](https://github.com/satoru-oka/catch-management/issues/8): 互換の `/` は残し、`/healthz` が `{"status": "ok"}` を返す |
| M-6 | 🟢 | `include_router` の順序が import 順 (アルファベット) と不一致 | **DONE** PR #7 (15231ca): アルファベット順に揃えた |

---

## backend/supabase_client.py (旧 backend/database.py)

**分析日**: 2026-05-06
**分析時の行数**: 16 行
**役割**: 設定値の名前空間 + 認証検証専用 Supabase client の生成

### 強み (記録のみ)

- 環境変数欠落時に明確なメッセージで `RuntimeError` を投げる fail-fast 設計
- line 15 のコメントが「auth 専用」役割を明示し、`auth.py:get_supabase` との役割分担が分かる
- `supabase: Client` の型注釈で Pylance の参照ジャンプが効く
- 副作用 (`load_dotenv` / `create_client`) がモジュール直下に集約

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| D-1 | 🔴 | line 10 `ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS")` が dead code (どこからも import されていない)。`main.py` が直接 `os.getenv` を呼んでいるため不要。エディタ補助 (Copilot 等) の自動挿入と推定 | **DONE** PR #7 マージ時 (commit `edea6b5`): ブランチ間で working tree が同期され当該行は存在しない |
| D-2 | 🟡 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` の型が `str \| None` のまま narrow されない。`auth.py` で `create_client(...)` に渡す時、将来 mypy/pyright を厳格化すると警告 | **DONE** [#9](https://github.com/satoru-oka/catch-management/issues/9): `supabase_client.py` で env 読み取り後に `str` 型へ確定 |
| D-3 | 🟡 | モジュール名 `database.py` が誤誘導 (実 DB アクセスは `auth.py:get_supabase`)。`config.py` か `supabase_client.py` の方が実態に近い | **DONE** [#10](https://github.com/satoru-oka/catch-management/issues/10): `backend/supabase_client.py` にリネームし import を更新 |
| D-4 | 🟡 | `load_dotenv()` と `create_client()` が import 時に走る。テストで env 必須、起動エラーが import エラーとして現れる | **WONTFIX (現状)**: 個人開発スコープでは害なし。チーム拡大時に再検討 |
| D-5 | ⚪ | `Client` 型を `auth.py` でも別途 import している。一箇所に集約可 | **WONTFIX** [#11](https://github.com/satoru-oka/catch-management/issues/11): 外部型は利用箇所で import し、設定モジュールへの結合を増やさない |

---

## backend/auth.py

**分析日**: 2026-05-07
**分析時の行数**: 30 行
**役割**: JWT 検証 (`get_current_user`) と user-scoped Supabase client 生成 (`get_supabase`)

### 強み (記録のみ)

- 責務が綺麗に 2 つに分かれている (`user_id` を返す vs `Client` を返す)
- 例外チェイン `from e` で原因例外を保持しつつ HTTP 401 にマップ ([auth.py:21](backend/auth.py#L21))
- line 27 のコメントが「JWT を PostgREST に渡すと RLS が効く」設計意図を明示
- `try` の中で `HTTPException` を再 raise する分岐 ([auth.py:17-18](backend/auth.py#L17-L18)) が、内部で投げる 401 を broad except で握り潰さない設計

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| A-1 | 🟡 | `get_current_user` で毎リクエスト Supabase Auth API に外部コール (~50-200ms)。POST 系の体感に効き、Supabase Auth が単一障害点 | **DONE** [#13](https://github.com/satoru-oka/catch-management/issues/13): `SUPABASE_JWT_SECRET` 設定時は `python-jose` でローカル検証。未設定環境は互換 fallback |
| A-2 | 🟡 | `get_supabase` がリクエスト毎に `create_client` を呼び、httpx 接続プールが生きない | **WONTFIX** [#14](https://github.com/satoru-oka/catch-management/issues/14): 共有 mutable client は JWT 混入リスクが高いため採用せず、`scripts/benchmark_supabase_client.py --iterations 1000` で約 20.17ms/回 |
| A-3 | 🟢 | `SUPABASE_URL` / `SUPABASE_ANON_KEY` の型 narrowing が弱い | **DUPE**: D-2 で扱い済み |
| A-4 | 🟢 | broad な `except Exception` で Supabase Auth 障害も `Invalid token` 401 にマップされる。フロントが自動ログアウトする | **DONE** [#15](https://github.com/satoru-oka/catch-management/issues/15): fallback 検証時も auth service 障害は 503、invalid token は 401、未知例外は 500 に分類 |
| A-5 | ⚪ | `HTTPBearer()` の `auto_error` を明示していない | **DONE** [#30](https://github.com/satoru-oka/catch-management/issues/30): `auto_error` を明示し、未認証レスポンスは A-6 で 401 に統一 |
| A-6 | 🟢 | Authorization ヘッダ無しが FastAPI 既定の 403 になり、未認証 = 401 の API 仕様とずれる | **DONE** [#51](https://github.com/satoru-oka/catch-management/issues/51): `HTTPBearer(auto_error=False)` + 明示 `401 Not authenticated` |

---

## backend/routers/spots.py

**分析日**: 2026-05-07
**分析時の行数**: 79 行
**役割**: ポイント (釣り場マスター) の CRUD + ポイント別釣行履歴

### 強み (記録のみ)

- 標準 CRUD パターンを最も素直に体現 (他 router の手本)
- `SpotCreate` / `SpotUpdate` の Pydantic モデル分離で必須/任意を明示
- 全エンドポイントで `result.data` 空 → 404 のお決まり

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| S-1 | 🟢 | `create_spot` のみ `model_dump()` で None を含めて INSERT。他 router と挙動が違う | **DONE** (X-3) [#21](https://github.com/satoru-oka/catch-management/issues/21): `None` フィールドを除外 |
| S-2 | 🟢 | `update_spot` は None を除外するため、フィールドを NULL にクリアできない | **DONE** [#20](https://github.com/satoru-oka/catch-management/issues/20): `exclude_unset=True` に変更し、明示 `null` は更新ペイロードに残す |
| S-3 | ⚪ | line 1 が空行 (Ruff 整理の残骸)。意味なし | **DONE** [#32](https://github.com/satoru-oka/catch-management/issues/32): 先頭空行を削除 |
| S-4 | 🟢 | `list_spot_sessions` にページング無し | **OPEN** (X-1 で扱う) [#19](https://github.com/satoru-oka/catch-management/issues/19) |
| S-5 | ⚪ | `list_spots` に並び順指定なし。フロントの追加順依存 | **DONE** [#33](https://github.com/satoru-oka/catch-management/issues/33): `.order("name")` で安定化 |

---

## backend/routers/sessions.py

**分析日**: 2026-05-07
**分析時の行数**: 120 行
**役割**: 釣行 (session) CRUD + 月別集計

### 強み (記録のみ)

- ISSUE-001 の経緯コメント ([sessions.py:12-15](backend/routers/sessions.py#L12-L15)) で `import datetime as dt` の理由を明記。同じ轍を踏まない
- Supabase の埋め込み JOIN (`*, spots(...), catches(*)`) で N+1 を回避
- `monthly_stats` を `/{session_id}` より前に定義してパスマッチングの優先度を確保

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| SS-1 | 🟡 | `monthly_stats` が全行フェッチ → Python 集計。データ増加で線形劣化 | **DONE** [#18](https://github.com/satoru-oka/catch-management/issues/18): `user_monthly_session_stats` view を優先し、未作成環境では fallback |
| SS-2 | 🟡 | `list_sessions` にページング無し | **OPEN** (X-1 で扱う) [#19](https://github.com/satoru-oka/catch-management/issues/19) |
| SS-3 | 🟢 | `update_session` は None を除外するためフィールドクリア不可 | **DONE** [#20](https://github.com/satoru-oka/catch-management/issues/20): `model_dump(mode="json", exclude_unset=True)` に変更し、明示 `null` は更新ペイロードに残す |
| SS-4 | 🟢 | `if "date" in data: data["date"] = str(...)` を 3 フィールドで繰り返し。Pydantic v2 の `model_dump(mode="json")` で自動化可能 | **DONE** [#31](https://github.com/satoru-oka/catch-management/issues/31): `SessionCreate` / `SessionUpdate` を `model_dump(mode="json")` ベースに変更 |
| SS-5 | 🟢 | `monthly_stats` が期間 (年月範囲) を絞らない。長期運用すると全月返す | **DONE** [#33](https://github.com/satoru-oka/catch-management/issues/33): `from_month` / `to_month` (`YYYY-MM`) を view/fallback 両方へ適用 |

---

## backend/routers/catches.py

**分析日**: 2026-05-07
**分析時の行数**: 98 行
**役割**: 釣果 CRUD (POST は session 配下、それ以外は単独パス)

### 強み (記録のみ)

- URL 設計が UX と一致: 釣果は session に従属して作るが、編集/削除は単独パスで簡潔
- session 所有確認 ([catches.py:41-43](backend/routers/catches.py#L41-L43)) を RLS 任せにせず明示的に行い、404 メッセージを統一
- `list_catches` の `fish_species` (eq) と `lure_name` (ilike) で部分一致検索もサポート

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| C-1 | 🟡 | `lure_id` の所有者検証が無く、他人の lure_id を参照する catch を挿入できる可能性 (FK は通る) | **DONE** [#16](https://github.com/satoru-oka/catch-management/issues/16): `create_catch` / `update_catch` で RLS 越しに `lures` を確認し、見えない `lure_id` は 400 |
| C-2 | 🟡 | `lure_id` と `lure_name` / `lure_color` の denormalization で drift が起きる仕様の整理が未着手 | **DONE** [#17](https://github.com/satoru-oka/catch-management/issues/17): 履歴 snapshot として drift を許容する方針を architecture に明記 |
| C-3 | 🟢 | `list_catches` にページング無し | **OPEN** (X-1) [#19](https://github.com/satoru-oka/catch-management/issues/19) |
| C-4 | 🟢 | `update_catch` でフィールドクリア不可 | **DONE**: `model_dump(mode="json", exclude_unset=True)` に変更し、明示 `null` は更新ペイロードに残す |
| C-5 | 🟢 | `list_catches` のフィルタが `fish_species` / `lure_name` のみ。日付範囲・サイズ範囲もよくある検索軸 | **DONE** [#33](https://github.com/satoru-oka/catch-management/issues/33): `date_from/to`, `length_min/max`, `weight_min/max` を追加 |

---

## backend/routers/lures.py

**分析日**: 2026-05-07
**分析時の行数**: 80 行
**役割**: ルアーマスター CRUD + ルアー別集計

### 強み (記録のみ)

- spots と並ぶ最もシンプルな CRUD
- `list_lures` に `.order("name")` で安定した表示順を保証
- `lure_stats` のコメント ([lures.py:66](backend/routers/lures.py#L66)) で「RLS が効くので user_id フィルタ不要」を明示

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| L-1 | 🟡 | `lure_stats` が全行フェッチ → Python 集計 | **DONE** (SS-1) [#18](https://github.com/satoru-oka/catch-management/issues/18): `user_lure_stats` view を優先し、未作成環境では fallback |
| L-2 | 🟡 | `lure_stats` が `lure_name` 文字列でグルーピング。lure を rename すると統計が分裂 | **WONTFIX** (C-2) [#17](https://github.com/satoru-oka/catch-management/issues/17): ルアー名は履歴 snapshot として扱うため、統計も当時名で集計 |
| L-3 | 🟢 | `update_lure` でフィールドクリア不可 | **DONE** [#20](https://github.com/satoru-oka/catch-management/issues/20): `exclude_unset=True` に変更し、明示 `null` は更新ペイロードに残す |
| L-4 | ⚪ | `list_lures` に並び替え指定パラメータ無し (常に name asc) | **DONE (仕様化)** [#33](https://github.com/satoru-oka/catch-management/issues/33): 現状は `name asc` 固定で安定表示。任意 sort は必要になったら別 issue |
| L-6 | 🟢 | `lure_stats` fallback が未使用の `lure_color` を SELECT している | **DONE** [#49](https://github.com/satoru-oka/catch-management/issues/49): fallback select を `lure_name, length_cm` に縮小 |

---

## 横断的項目

複数のファイルに共通する改善候補。

| # | 重要度 | 内容 | 影響範囲 | 状況 |
|---|---|---|---|---|
| X-1 | 🟡 | list 系エンドポイントに **ページング無し** | spots / sessions / catches / lures (5 endpoint) | **OPEN** [#19](https://github.com/satoru-oka/catch-management/issues/19) |
| X-2 | 🟡 | PUT で `if v is not None` フィルタにより **NULL クリア不可** | spots / sessions / catches / lures (4 endpoint) | **DONE** [#20](https://github.com/satoru-oka/catch-management/issues/20): 全 PUT を `exclude_unset=True` ベースにして、未指定と明示 `null` を区別 |
| X-3 | 🟢 | INSERT の None 扱いが [spots.py:39](backend/routers/spots.py#L39) のみ非対称 | spots vs others | **DONE** [#21](https://github.com/satoru-oka/catch-management/issues/21): `create_spot` も optional `None` を除外 |
| X-6 | 🟡 | stats view fallback の欠落判定 helper が `sessions.py` / `lures.py` で重複 | sessions / lures | **DONE** [#48](https://github.com/satoru-oka/catch-management/issues/48): `backend/stats.py:is_missing_view_error` に抽出 |

---

## backend 再分析 (2026-05-13)

**分析日**: 2026-05-13
**範囲**: `ui-redesign` ブランチでの全体再レビュー。既出 ID と重複しないものだけ追加。

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| C-6 | 🟢 | `list_catches` の `ilike("lure_name", f"%{lure_name}%")` ([catches.py:62](backend/routers/catches.py#L62)) が `%` / `_` をエスケープしていない。「100%」検索でワイルドカード扱いになる。supabase-py が SQL インジェクションは防ぐので脆弱性ではなく UX | **DONE** [#33](https://github.com/satoru-oka/catch-management/issues/33): `%` / `_` / `\` を escape して literal 検索に寄せる |
| L-5 | ⚪ | `routers/lures.py` 冒頭が空行 ([lures.py:1](backend/routers/lures.py#L1))。S-3 と同じ Ruff 整理残骸 | **DONE** [#32](https://github.com/satoru-oka/catch-management/issues/32): 先頭空行を削除 |
| X-4 | 🟡 | RLS 一元依存だが、**クロステナント GET スモークテスト** が無い。RLS が事故で外れると anon key 経由で他人のデータが見える | **OPEN** [#24](https://github.com/satoru-oka/catch-management/issues/24): `tests/integration/test_rls.py` で user A/B fixture を立て、spots / sessions / catches / lures の 4 テーブルに対し「B のトークンで A のレコード ID を select.eq → 空配列」を assert |
| X-5 | 🟢 | `create_*` のみ `get_current_user` 依存、`update_*` / `delete_*` は依存無し (RLS 任せ) の **非対称**。読み手が「create だけユーザー必須」と誤読する余地 | **DONE** [#27](https://github.com/satoru-oka/catch-management/issues/27): mutate 系は全て `get_current_user` 依存を持つ形に統一 |

---

## frontend/lib/supabase.ts

**分析日**: 2026-05-13
**分析時の行数**: 12 行
**役割**: ブラウザ用 Supabase クライアントのシングルトン生成

### 強み (記録のみ)

- モジュール内クロージャ `let client` で再生成を防ぐシングルトン
- `createClient` 関数として export することで Next.js のサーバー/クライアント境界を明示

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| FS-1 | 🔴 | `process.env.NEXT_PUBLIC_SUPABASE_URL!` / `NEXT_PUBLIC_SUPABASE_ANON_KEY!` の **non-null 断言** で握りつぶし ([supabase.ts:8-9](frontend/lib/supabase.ts#L8-L9))。未設定時は "createClient is not a function" 系の難読ランタイムエラー。`backend/supabase_client.py` と同じく明示 throw に統一すべき | **DONE** [#23](https://github.com/satoru-oka/catch-management/issues/23): `createClient()` が env 欠落時に明示的な Error を投げるようにし、単体テストを追加 |

---

## frontend/lib/api.ts

**分析日**: 2026-05-13
**分析時の行数**: 68 行
**役割**: 認証付き fetch ラッパー + `ApiError` + 401 ハンドリング

### 強み (記録のみ)

- `ApiError` で `status` / `detail` を保持し、各画面で `e instanceof ApiError` の分岐が綺麗に書ける
- 401 検知時に `signOut` + `/login` 強制遷移で stale token を残さない
- 204 を `undefined as T` で返す型ハック ([api.ts:66](frontend/lib/api.ts#L66)) が明示的

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| FA-1 | 🟡 | 401 ハンドリングが `apiFetch` 内と `(protected)/layout.tsx` の `onAuthStateChange` で **2 箇所**並走 ([api.ts:50-53](frontend/lib/api.ts#L50-L53), [(protected)/layout.tsx:26-28](frontend/app/(protected)/layout.tsx#L26-L28))。経路二重で保守時に片方だけ直す事故が起きやすい | **DONE** [#34](https://github.com/satoru-oka/catch-management/issues/34): `apiFetch` は `auth:unauthorized` 通知、signOut / redirect は protected layout に集約 |
| FA-2 | 🟢 | `handleUnauthorized` が `window.location.href` でフルリロード ([api.ts:28](frontend/lib/api.ts#L28))。SPA 状態を捨てるが、認証失敗時は stale state を消したいので意図的と推定 | **WONTFIX (現状)**: コメントで「意図」を 1 行残すと親切 |

---

## frontend/app/(protected)/page.tsx

**分析日**: 2026-05-13
**分析時の行数**: 328 行
**役割**: ホーム画面 (今日の釣果 / KPI / 最近の釣果)。PR #22 で大幅再構成

### 強み (記録のみ)

- `Promise.all` で catches / sessions / user を並行取得し、初期描画レイテンシを抑制
- `Stat` / `KpiCard` を内側に切り出してコンポーネント階層が読みやすい
- `formatJpDate` / `catchDate` / `todayIso` を純粋関数化してテスタブル
- `WEEKDAY` 配列を module スコープに配置、毎レンダー再生成しない

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| H-1 | 🟡 | `todayIso()` が `new Date().toISOString().slice(0, 10)` で **UTC ベース** ([page.tsx:21-23](frontend/app/(protected)/page.tsx#L21-L23))。JST 深夜に開くと「今日」が UTC 前日になり、登録した釣果が前日扱いに | **DONE** [#26](https://github.com/satoru-oka/catch-management/issues/26), [#46](https://github.com/satoru-oka/catch-management/issues/46): `tokyoDateIso` を `frontend/lib/date.ts` に切り出し、home と `sessions/new` の初期日付へ展開済み |
| H-2 | 🟡 | `catches.filter` / `reduce` / `new Map(sessions.map(...))` がレンダーごとに走る ([page.tsx:69-85](frontend/app/(protected)/page.tsx#L69-L85))。釣果が数百件溜まると体感に出る | **DONE** [#35](https://github.com/satoru-oka/catch-management/issues/35): 派生値を `useMemo` 化 |
| H-3 | 🟢 | `greetingName[0]` で頭文字取得 ([page.tsx:116](frontend/app/(protected)/page.tsx#L116))。サロゲートペア (絵文字名) で文字化けする | **DONE** [#35](https://github.com/satoru-oka/catch-management/issues/35), [#47](https://github.com/satoru-oka/catch-management/issues/47): `profileInitial()` に共通化し、settings の avatar fallback にも適用 |
| H-4 | 🟢 | `eslint-disable-next-line @next/next/no-img-element` で `<img>` 直書き ([page.tsx:108](frontend/app/(protected)/page.tsx#L108), [page.tsx:205](frontend/app/(protected)/page.tsx#L205))。Supabase Storage のホストを `next.config.ts` に登録すれば `next/image` 化可 | **WONTFIX** [#35](https://github.com/satoru-oka/catch-management/issues/35): avatar / photo URL の remote host が未固定のため、画像機能設計時に再検討 |

---

## frontend/app/(protected)/sessions/[id]/page.tsx

**分析日**: 2026-05-13
**分析時の行数**: 114 行
**役割**: 釣行詳細 + 配下の釣果一覧

### 強み (記録のみ)

- `apiFetch` のエラーをそのまま画面表示に流し、ロード状態がシンプル
- 削除前 `confirm()` で誤操作防止
- 釣果 0 件時のエンプティステート (4xl 🐟) で初学者にも分かりやすい

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| SD-1 | 🟡 | 釣果カードが `<div onClick>` で navigation ([sessions/[id]/page.tsx:90-94](frontend/app/(protected)/sessions/[id]/page.tsx#L90-L94))。Tab focus されず、スクリーンリーダー到達不可。ISSUE-002 の a11y 改善と整合させたい | **DONE** [#25](https://github.com/satoru-oka/catch-management/issues/25): 釣果カードを編集画面への `<Link>` に変更し、リンクとして focus / 認識できるようにした |
| SD-2 | 🟢 | `c.length_cm && \`${c.length_cm}cm\`` の `&&` 条件 ([sessions/[id]/page.tsx:100](frontend/app/(protected)/sessions/[id]/page.tsx#L100))。サイズ 0 は実質ありえないので実害無し | **DONE** [#35](https://github.com/satoru-oka/catch-management/issues/35): `c.length_cm != null` に変更 |

---

## frontend/components/BottomNav.tsx

**分析日**: 2026-05-13
**分析時の行数**: 38 行
**役割**: モバイル風タブナビ (PR #22 で追加)

### 強み (記録のみ)

- タブ定義が配列で集約され、追加削除が 1 箇所
- `max-w-2xl mx-auto` で広い画面でも横幅が破綻しない

### 改善候補

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| BN-1 | 🟡 | `isActive = pathname === tab.path` が完全一致判定 ([BottomNav.tsx:21](frontend/components/BottomNav.tsx#L21))。`/sessions/new` や `/sessions/[id]` 配下では「記録」が active にならない | **DONE** [#36](https://github.com/satoru-oka/catch-management/issues/36): `activePaths` で `/sessions/*` を「記録」active に統一 |
| BN-2 | 🟢 | `<button onClick={() => router.push(...)}>` で navigation。`<Link>` に置換すると prefetch + 右クリック「新規タブで開く」も使える | **DONE** [#36](https://github.com/satoru-oka/catch-management/issues/36): BottomNav navigation を `<Link href>` に変更 |
| BN-3 | ⚪ | 絵文字アイコンが OS によって描画ブレ (Win/Android/iOS)。lucide-react などに揃えると統一感 | **WONTFIX** [#36](https://github.com/satoru-oka/catch-management/issues/36): 既存依存に icon library が無いため、今回は挙動改善を優先し絵文字を維持 |

---

## frontend 横断的項目

複数のフロントファイルに共通する改善候補。

| # | 重要度 | 内容 | 影響範囲 | 状況 |
|---|---|---|---|---|
| FX-1 | 🟡 | フォーム edit 系で「空文字を送らない」回避策で NULL クリア不可。X-2 の表側 | sessions/[id]/edit, catches/[catchId]/edit, lures, spots | **OPEN** [#38](https://github.com/satoru-oka/catch-management/issues/38): X-2 (backend で `exclude_unset=True`) 解消後に撤去 |
| FX-2 | 🟢 | `useEffect` の依存配列が `apiFetch` などモジュールスコープ関数を省略している箇所多数 | (protected) 配下のページほぼ全部 | **DONE** [#28](https://github.com/satoru-oka/catch-management/issues/28): Next.js の hooks lint を CI で `npm run lint -- --max-warnings=0` として継続実行 |
| FX-3 | 🟡 | home / settings で user metadata から profile を組み立てる処理が重複し、settings だけ Unicode unsafe な頭文字取得が残る | home, settings, frontend/lib/profile.ts | **DONE** [#47](https://github.com/satoru-oka/catch-management/issues/47): `extractProfile()` / `profileInitial()` に共通化 |
| FL-1 | 🟢 | ログイン済みでも `/login` を直接開くとログインフォームが表示される | login | **DONE** [#50](https://github.com/satoru-oka/catch-management/issues/50): 初回 `getSession()` で既存 session があれば `/` へ `replace` |
| SN-1 | 🔴 | `/sessions/new` の初期日付が `toISOString()` 由来で JST 0:00〜9:00 に前日になる | sessions/new, frontend/lib/date.ts | **DONE** [#46](https://github.com/satoru-oka/catch-management/issues/46): `tokyoDateIso()` を共有 helper 化し、home と sessions/new で利用 |

---

## リポジトリ衛生

ファイル単位ではなくリポジトリ全体の些末な手入れ項目。

| # | 重要度 | 内容 | 状況 |
|---|---|---|---|
| RP-1 | 🟡 | リポジトリルートに未追跡 `c9bc9e20-1e36-4ed5-8d86-a2fec9e07361.png` (約 1.8MB)。レビュー添付の残骸と推定 | **DONE** [#37](https://github.com/satoru-oka/catch-management/issues/37): 現在の working tree に対象ファイルが存在しないことを確認 |
| RP-2 | 🟢 | `docs/architecture.bakup.20260506.md` の typo (`bakup` → `backup`)。古い差分の保管が不要なら削除 | **DONE** [#37](https://github.com/satoru-oka/catch-management/issues/37): `bakup` / `backup` 版とも現存しないことを確認 |
| RP-3 | 🟢 | `README.md` のクローン手順がプレースホルダ URL (`your-username/...`) | **DONE** [#12](https://github.com/satoru-oka/catch-management/issues/12): 実リポジトリ URL に置換済み |
| RP-4 | 🟢 | `backend/CLAUDE.md` 不在。frontend 側には [CLAUDE.md](frontend/CLAUDE.md) (Next.js の注意書き) がある。ISSUE-001 の Python 3.14 PEP 649 シャドー問題を再発防止の 1 行として残すと良い | **DONE** [#37](https://github.com/satoru-oka/catch-management/issues/37): backend runtime / Pydantic / RLS 方針の note を追加 |
| RP-5 | 🟢 | `docs/architecture.md` / `docs/code-review.md` のスナップショットが現状から遅れている | **DONE** [#52](https://github.com/satoru-oka/catch-management/issues/52): architecture の日付・branch・規模スナップショットを更新 |
| R-1 | 🟡 | README がセットアップ中心で、概要 / 機能 / 技術スタック / docs 導線 / 今後の改善予定が弱い | **DONE** [#12](https://github.com/satoru-oka/catch-management/issues/12): onboarding 入口として構成済み、環境変数表と GitHub issues 導線を追加 |

---

## 今後の運用

### 新しいファイルを分析した時

1. このファイルの末尾に `## backend/xxx.py` セクションを追加
2. 強み (記録のみ) と 改善候補テーブルを記載
3. 各項目に **連番 ID** (例: `R-1`, `R-2`) を付与してコミットメッセージから参照できるようにする
4. PR でその項目に対応したら、status を **DONE** に更新し commit ID/PR 番号を併記

### 既存項目を再評価する時

- ステータス変更は **追記** 形式 (例: `OPEN → DONE PR #7 (commit-sha)`)
- WONTFIX に変更する時は **理由を併記**
- 元の評価そのものは**書き換えない** (履歴として残す)

### 改善候補の優先順位を見たい時

ファイルを横断して 🔴 → 🟡 → 🟢 の OPEN 項目を grep:

```bash
grep -E "🔴.*OPEN|🟡.*OPEN" docs/code-review.md
```
