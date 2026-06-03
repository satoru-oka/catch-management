"""pytest 共通設定。

Supabase クライアントとユーザー認証は外部 I/O なので、テストでは
FastAPI の dependency_overrides 経由でフェイク実装に差し替える。
"""

from __future__ import annotations

import os

# supabase_client.py は import 時に環境変数を要求するのでダミー値を流し込む。
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "unit-test-secret")

from typing import Any

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user, get_supabase
from main import app

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


class FakeResult:
    def __init__(self, data: Any):
        self.data = data


class FakeQueryBuilder:
    """`db.table().select().eq()...execute()` のチェーン呼び出しを記録する。

    各メソッドは self を返すので任意の順番で連結できる。`execute()` で
    FakeSupabase に登録された次のレスポンスを返却する。
    """

    def __init__(self, db: FakeSupabase, table: str):
        self._db = db
        self._table = table
        self._ops: list[tuple[str, tuple, dict]] = []

    def _record(self, name: str, *args, **kwargs) -> FakeQueryBuilder:
        self._ops.append((name, args, kwargs))
        return self

    def select(self, *a, **k):
        return self._record("select", *a, **k)

    def insert(self, *a, **k):
        return self._record("insert", *a, **k)

    def update(self, *a, **k):
        return self._record("update", *a, **k)

    def delete(self, *a, **k):
        return self._record("delete", *a, **k)

    def eq(self, *a, **k):
        return self._record("eq", *a, **k)

    def ilike(self, *a, **k):
        return self._record("ilike", *a, **k)

    def gte(self, *a, **k):
        return self._record("gte", *a, **k)

    def lte(self, *a, **k):
        return self._record("lte", *a, **k)

    def order(self, *a, **k):
        return self._record("order", *a, **k)

    def range(self, *a, **k):
        return self._record("range", *a, **k)

    def execute(self) -> FakeResult:
        self._db.calls.append({"table": self._table, "ops": self._ops})
        return self._db._consume_result()


class FakeSupabase:
    """ルーターが必要とする最小限の supabase Client 互換オブジェクト。

    テストは `queue_result()` で execute() の戻り値を順番にセットし、
    `calls` 属性でルーターが発行したクエリを検査できる。
    """

    def __init__(self):
        self._results: list[FakeResult | Exception] = []
        self.calls: list[dict] = []

    def queue_result(self, data: Any) -> None:
        self._results.append(FakeResult(data))

    def queue_error(self, exc: Exception) -> None:
        self._results.append(exc)

    def table(self, name: str) -> FakeQueryBuilder:
        return FakeQueryBuilder(self, name)

    def _consume_result(self) -> FakeResult:
        if not self._results:
            return FakeResult([])
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


@pytest.fixture
def fake_db() -> FakeSupabase:
    return FakeSupabase()


@pytest.fixture
def client(fake_db: FakeSupabase) -> TestClient:
    """認証と Supabase をフェイクに差し替えた TestClient。"""

    app.dependency_overrides[get_supabase] = lambda: fake_db
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    try:
        # ルーターは Authorization ヘッダ自体は使わないが、HTTPBearer に
        # 引っかからないよう一応ダミーを付けておく (override により実検証はされない)。
        with TestClient(app, headers={"Authorization": "Bearer test-token"}) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
