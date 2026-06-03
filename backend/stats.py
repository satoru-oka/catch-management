def is_missing_view_error(exc: Exception, view_name: str) -> bool:
    code = getattr(exc, "code", None)
    if code is None and exc.args and isinstance(exc.args[0], dict):
        code = exc.args[0].get("code")

    message = str(exc).lower()
    normalized_view_name = view_name.lower()
    return code in {"42P01", "PGRST205"} or (
        normalized_view_name in message
        and ("does not exist" in message or "could not find" in message)
    )
