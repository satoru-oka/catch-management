"""Measure local Supabase client construction overhead.

This benchmark intentionally does not issue network requests. It measures the
cost of `create_client(...)` plus `client.postgrest.auth(jwt)`, which is the
per-request setup path used by `auth.get_supabase`.
"""

from __future__ import annotations

import argparse
import os
from time import perf_counter

from supabase import create_client

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=1_000)
    args = parser.parse_args()

    if load_dotenv:
        load_dotenv()
    url = os.getenv("SUPABASE_URL", "https://benchmark.supabase.co")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "benchmark-anon-key")
    token = os.getenv("BENCHMARK_USER_JWT", "benchmark-user-jwt")

    started = perf_counter()
    for _ in range(args.iterations):
        client = create_client(url, anon_key)
        client.postgrest.auth(token)
    elapsed = perf_counter() - started

    print(f"iterations={args.iterations}")
    print(f"total_seconds={elapsed:.6f}")
    print(f"per_iteration_ms={(elapsed / args.iterations) * 1000:.6f}")


if __name__ == "__main__":
    main()
