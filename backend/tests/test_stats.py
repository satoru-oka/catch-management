from __future__ import annotations

from stats import is_missing_view_error


class _ErrorWithCode(Exception):
    def __init__(self, code: str):
        super().__init__("database error")
        self.code = code


def test_is_missing_view_error_matches_postgres_missing_relation_code():
    assert is_missing_view_error(_ErrorWithCode("42P01"), "user_lure_stats") is True


def test_is_missing_view_error_matches_postgrest_missing_table_code_from_args():
    exc = Exception({"code": "PGRST205", "message": "table not found"})

    assert is_missing_view_error(exc, "user_lure_stats") is True


def test_is_missing_view_error_matches_view_name_and_missing_message():
    exc = RuntimeError('relation "user_lure_stats" does not exist')

    assert is_missing_view_error(exc, "user_lure_stats") is True


def test_is_missing_view_error_matches_view_name_and_postgrest_message():
    exc = RuntimeError("Could not find the table user_monthly_session_stats in schema cache")

    assert is_missing_view_error(exc, "user_monthly_session_stats") is True


def test_is_missing_view_error_rejects_other_errors():
    exc = RuntimeError("permission denied for table catches")

    assert is_missing_view_error(exc, "user_lure_stats") is False
