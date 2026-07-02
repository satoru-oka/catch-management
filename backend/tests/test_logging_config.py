"""main._configure_fallback_logging のフォールバック挙動の単体テスト。

root logger はグローバル状態なので、各テストで元のハンドラ・水準を退避して復元する。
"""

from __future__ import annotations

import logging
import sys

import pytest

from main import _configure_fallback_logging


@pytest.fixture
def root_logger():
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    try:
        yield root
    finally:
        root.handlers[:] = saved_handlers
        root.setLevel(saved_level)


def test_adds_stderr_handler_when_root_unconfigured(root_logger, monkeypatch):
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    root_logger.handlers[:] = []

    _configure_fallback_logging()

    assert root_logger.handlers, "root にハンドラが無いときは追加されるべき"
    handler = root_logger.handlers[0]
    assert isinstance(handler, logging.StreamHandler)
    assert handler.stream is sys.stderr
    # 既定は WARNING（アプリは ERROR しか出さず、第三者の INFO で溢れさせない）
    assert root_logger.level == logging.WARNING


def test_respects_existing_handlers(root_logger):
    sentinel = logging.NullHandler()
    root_logger.handlers[:] = [sentinel]
    root_logger.setLevel(logging.CRITICAL)

    _configure_fallback_logging()

    # 既に設定済みなら追加もしないし水準も変えない
    assert root_logger.handlers == [sentinel]
    assert root_logger.level == logging.CRITICAL


def test_log_level_env_overrides_default(root_logger, monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "debug")
    root_logger.handlers[:] = []

    _configure_fallback_logging()

    assert root_logger.level == logging.DEBUG
