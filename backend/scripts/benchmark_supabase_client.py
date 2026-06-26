"""Measure per-request Supabase DB-client construction overhead (#70).

This benchmark intentionally does not issue network requests. It compares two
per-request setup paths used by `auth.get_supabase`:

- ``old``: ``create_client(...)`` + ``client.postgrest.auth(jwt)`` — builds the
  full Supabase client (auth/storage/functions/realtime/postgrest), each with
  its own HTTP session, and never closes them (connection leak under load).
- ``new``: ``supabase_client.create_user_postgrest(jwt)`` — builds only a thin
  PostgREST client over a shared, process-wide HTTP connection pool.
"""

from __future__ import annotations

import argparse
import os
import sys
from time import perf_counter

from supabase import create_client

# backend/ をモジュール検索パスに追加 (scripts/ から実行できるように)。
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def _bench_old(iterations: int, url: str, anon_key: str, token: str) -> float:
    started = perf_counter()
    for _ in range(iterations):
        client = create_client(url, anon_key)
        client.postgrest.auth(token)
    return perf_counter() - started


def _bench_new(iterations: int, token: str) -> float:
    # Import here so SUPABASE_URL / SUPABASE_ANON_KEY are read from the env set
    # up below (supabase_client validates them at import time).
    from supabase_client import create_user_postgrest

    started = perf_counter()
    for _ in range(iterations):
        create_user_postgrest(token)
    return perf_counter() - started


def _report(label: str, elapsed: float, iterations: int) -> None:
    print(f"[{label}] iterations={iterations}")
    print(f"[{label}] total_seconds={elapsed:.6f}")
    print(f"[{label}] per_iteration_ms={(elapsed / iterations) * 1000:.6f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=1_000)
    parser.add_argument(
        "--path",
        choices=("old", "new", "both"),
        default="both",
        help="which construction path to measure",
    )
    args = parser.parse_args()

    if load_dotenv:
        load_dotenv()
    url = os.getenv("SUPABASE_URL", "https://benchmark.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "benchmark-anon-key")
    token = os.getenv("BENCHMARK_USER_JWT", "benchmark-user-jwt")
    # supabase_client validates these at import time; ensure they are present.
    os.environ.setdefault("SUPABASE_URL", url)
    os.environ.setdefault("SUPABASE_ANON_KEY", anon_key)

    old = new = None
    if args.path in ("old", "both"):
        old = _bench_old(args.iterations, url, anon_key, token)
        _report("old", old, args.iterations)
    if args.path in ("new", "both"):
        new = _bench_new(args.iterations, token)
        _report("new", new, args.iterations)
    if old is not None and new is not None and new > 0:
        print(f"speedup_old_over_new={old / new:.1f}x")


if __name__ == "__main__":
    main()
