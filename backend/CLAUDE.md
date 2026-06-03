# Backend Agent Notes

- Pydantic models should reference `date` / `time` types through `import datetime as dt` to avoid field-name shadowing issues under Python 3.14 lazy annotations.
- Runtime Supabase access must go through `get_supabase` so the user's JWT is forwarded to PostgREST and RLS stays authoritative.
- Do not use the Supabase `service_role` key in backend runtime code. It is reserved for integration-test setup and cleanup only.
