"""結合テスト共通設定。

実 Supabase に接続するので、ユニットテスト (tests/conftest.py の `client` 等) とは
別世界の fixture セットを提供する。`@pytest.mark.integration` を付けたテストだけが
ここの fixture を使う前提。

設計メモ:
  - `tests/conftest.py` がモジュール load 時にダミーの SUPABASE_URL/ANON_KEY を
    `os.environ.setdefault(...)` でセットしているため、`supabase_client.py` は import 済み
    だが内部の `supabase` クライアントはダミー URL を向いている。
  - integration では `_patch_supabase_module` セッション fixture で
    `supabase_client.supabase` / `auth.supabase` を **テスト用 Supabase の本物クライアント**
    に差し替える (URL / anon_key も同期)。
  - `auth.get_supabase` はリクエストごとに `create_client(SUPABASE_URL, SUPABASE_ANON_KEY)`
    を呼ぶので、上記 URL/KEY 変数の差し替えで自動的にテスト DB を向く。
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest

# `.env.test` をローカル実行時に読み込む (CI では Secrets で渡す)。
try:
    from dotenv import load_dotenv

    env_test = Path(__file__).resolve().parents[2] / ".env.test"
    if env_test.exists():
        load_dotenv(env_test, override=False)
except ImportError:
    # dotenv が無くても CI 上は環境変数が直接渡るので問題なし。
    pass

REQUIRED_ENV_VARS = (
    "TEST_SUPABASE_URL",
    "TEST_SUPABASE_ANON_KEY",
    "TEST_SUPABASE_SERVICE_ROLE_KEY",
)

PLACEHOLDER_ENV_VALUES = {
    # Repository-local examples should not make the full pytest suite try to
    # reach a non-existent Supabase project.
    "TEST_SUPABASE_URL": {
        "https://your-test-project.supabase.co",
    },
    "TEST_SUPABASE_ANON_KEY": {"your-anon-public-key"},
    "TEST_SUPABASE_SERVICE_ROLE_KEY": {"your-service-role-key"},
}


def _configured_env_value(name: str) -> str | None:
    value = os.getenv(name)
    if not value or value in PLACEHOLDER_ENV_VALUES.get(name, set()):
        return None
    return value


def pytest_collection_modifyitems(config, items):
    """integration マーカー付きテストを ENV 未設定時は skip にする。"""
    missing = [v for v in REQUIRED_ENV_VARS if not _configured_env_value(v)]
    if not missing:
        return
    skip_marker = pytest.mark.skip(
        reason=f"integration テスト用環境変数が未設定: {', '.join(missing)}"
    )
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_marker)


def _has_required_env() -> bool:
    return all(_configured_env_value(v) for v in REQUIRED_ENV_VARS)


@pytest.fixture(scope="session")
def admin_supabase():
    """service_role キーで初期化したクライアント。auth admin API とテストデータ
    投入 (RLS バイパス) に使う。"""
    if not _has_required_env():
        pytest.skip("integration env not set")
    from supabase import create_client

    return create_client(
        os.environ["TEST_SUPABASE_URL"],
        os.environ["TEST_SUPABASE_SERVICE_ROLE_KEY"],
    )


@pytest.fixture(scope="session", autouse=True)
def _patch_supabase_module():
    """supabase_client/auth モジュールをテスト用 Supabase に向け直す。

    autouse=True かつ session スコープなので、integration ディレクトリ配下の
    全テストで一度だけ反映される。値はテスト終了時に元に戻すが、ユニットテストと
    同セッションで実行する場合に備えて差し替え前の値を覚えておく。
    """
    if not _has_required_env():
        yield
        return

    from supabase import create_client

    import auth
    import supabase_client

    # get_supabase は supabase_client.create_user_postgrest 経由で
    # supabase_client.SUPABASE_URL / SUPABASE_ANON_KEY を呼び出し時参照する (#70)。
    # 認証 (get_current_user) は auth.supabase / auth.SUPABASE_JWT_SECRET を使う。
    original = {
        "db_url": supabase_client.SUPABASE_URL,
        "db_key": supabase_client.SUPABASE_ANON_KEY,
        "db_client": supabase_client.supabase,
        "auth_client": auth.supabase,
        "auth_jwt_secret": auth.SUPABASE_JWT_SECRET,
    }

    test_url = os.environ["TEST_SUPABASE_URL"]
    test_anon = os.environ["TEST_SUPABASE_ANON_KEY"]
    real_client = create_client(test_url, test_anon)

    supabase_client.SUPABASE_URL = test_url
    supabase_client.SUPABASE_ANON_KEY = test_anon
    supabase_client.supabase = real_client
    auth.supabase = real_client
    # Integration tests obtain real Supabase tokens, but the JWT secret is not
    # part of the current test secret set. Fall back to Supabase Auth API here.
    auth.SUPABASE_JWT_SECRET = None

    try:
        yield
    finally:
        supabase_client.SUPABASE_URL = original["db_url"]
        supabase_client.SUPABASE_ANON_KEY = original["db_key"]
        supabase_client.supabase = original["db_client"]
        auth.supabase = original["auth_client"]
        auth.SUPABASE_JWT_SECRET = original["auth_jwt_secret"]


def _create_user(admin) -> dict:
    """テスト用に使い捨ての Supabase ユーザーを作成し、
    sign_in_with_password で JWT を取得する。"""
    from supabase import create_client

    email = f"it-{uuid.uuid4().hex[:12]}@example.com"
    password = "IntegrationTest123!"

    res = admin.auth.admin.create_user(
        {"email": email, "password": password, "email_confirm": True}
    )
    user_id = res.user.id

    anon = create_client(os.environ["TEST_SUPABASE_URL"], os.environ["TEST_SUPABASE_ANON_KEY"])
    sign_in = anon.auth.sign_in_with_password({"email": email, "password": password})

    return {
        "user_id": user_id,
        "access_token": sign_in.session.access_token,
        "email": email,
    }


@pytest.fixture
def integration_user(admin_supabase):
    """テストごとに使い捨ての Supabase ユーザー。

    終了時に admin で削除。`auth.users` の ON DELETE CASCADE で spots / sessions /
    lures の行も自動的に消える (catches は sessions 経由で連鎖)。"""
    user = _create_user(admin_supabase)
    yield user
    try:
        admin_supabase.auth.admin.delete_user(user["user_id"])
    except Exception as e:
        # 削除失敗はテスト失敗に格上げしない (本体テストの結果を上書きしないため)。
        # ただし将来データが溜まる原因になるのでログだけ出す。
        print(f"[integration cleanup] failed to delete user {user['user_id']}: {e}")


@pytest.fixture
def auth_client(integration_user):
    """integration_user の JWT を Authorization に積んだ TestClient。
    main.app は本番同様にロードされるので、real Supabase を叩く挙動になる。"""
    from fastapi.testclient import TestClient

    from main import app

    headers = {"Authorization": f"Bearer {integration_user['access_token']}"}
    with TestClient(app, headers=headers) as c:
        yield c


@pytest.fixture
def second_user(admin_supabase):
    """RLS 検証用に追加の使い捨てユーザーを返す。`integration_user` と独立。"""
    user = _create_user(admin_supabase)
    yield user
    try:
        admin_supabase.auth.admin.delete_user(user["user_id"])
    except Exception as e:
        print(f"[integration cleanup] failed to delete user {user['user_id']}: {e}")


@pytest.fixture
def second_auth_client(second_user):
    """second_user の JWT を Authorization に積んだ TestClient。"""
    from fastapi.testclient import TestClient

    from main import app

    headers = {"Authorization": f"Bearer {second_user['access_token']}"}
    with TestClient(app, headers=headers) as c:
        yield c
