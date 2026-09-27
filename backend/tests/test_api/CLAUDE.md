# tests/test_api — HTTP-level tests

**Purpose:** Exercise the FastAPI routers through `TestClient` with a real signed-up session (`tests/auth_helpers.py::authenticate`). Tier rules and how to run: `docs/TESTING.md`.

**Contents**
- `test_authorization.py` — **the IDOR regression suite**: every deal-scoped endpoint must 404 for a non-owner (`_DEAL_SCOPED_GET_ENDPOINTS` + POST/PATCH/PUT coverage).
- `test_auth.py` — signup/login/logout/me, generic login failure, forgot/reset password (reads the token from the dev outbox).
- `test_ingestion.py` — deal create/upload/process lifecycle. `test_financials.py` — statements + summary. `test_qoe_redflags.py` — QoE, drill-through, red flag filters.
- `test_inquiry.py` — inquiry CRUD, IDOR, decision-queue derivation. `test_notes.py` — notes GET/PUT. `test_settings.py` — settings persistence and validation.
- `test_middleware.py` — request-ID, HSTS, global error handler shape.

**How it fits in:** Unmarked tests here default to the `integration` tier (`tests/conftest.py`); CI runs each file in its phase job.

**Gotchas**
- A new deal-scoped endpoint without an entry in `test_authorization.py` is untested for the app's main vulnerability class — add it.
- `test_inquiry.py` and `test_settings.py` aren't listed in any `ci.yml` job, so CI never runs them (`docs/TESTING.md` §6).
- Some module docstrings still claim "USE_MOCK_LLM=true"; CI runs these against the real API.
