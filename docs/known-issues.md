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
