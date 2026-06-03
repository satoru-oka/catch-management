from typing import Any

from fastapi import HTTPException


def first_or_404(data: list[dict[str, Any]] | None, detail: str) -> dict[str, Any]:
    if not data:
        raise HTTPException(status_code=404, detail=detail)
    return data[0]


def assert_found(data: list[dict[str, Any]] | None, detail: str) -> None:
    if not data:
        raise HTTPException(status_code=404, detail=detail)
