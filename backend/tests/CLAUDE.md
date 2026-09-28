# backend/tests — pytest suite

**Purpose:** Tiered tests (`unit` / `integration` / `e2e`) for the backend: 28 files, ~346 test functions. Strategy, commands, CI mapping, and known gaps: `docs/TESTING.md`.

**Contents**
- `conftest.py` — tags every unmarked test `integration`; defines the session-scoped `shared_mapped_gl` fixture (one real CoA-mapping LLM call, shared by four test files).
- `auth_helpers.py` — `authenticate(client)`: signs up a unique user so the session cookie rides on every request.
- `test_api/` — HTTP-level tests via `TestClient`, incl. the IDOR regression suite `test_authorization.py`. (See its `CLAUDE.md`.)
- `test_pipeline/` — per-stage tests plus the two `e2e` full-pipeline tests. (See its `CLAUDE.md`.)
- `test_security/` — `test_passwords.py`, `test_file_crypto.py` (Argon2id, AES-GCM round-trip + tamper detection); `unit`.
- `test_storage/` — `test_note_store.py`, `test_inquiry_store.py` (encrypted store round-trips); `unit`.
- `fixtures/` — committed synthetic input data + generator scripts. (See its `CLAUDE.md`.)

**How it fits in:** CI runs `unit` everywhere and each phase's integration files when their paths change (`.github/CLAUDE.md`). Needs `JWT_SECRET_KEY` + `FILE_ENCRYPTION_KEY`; integration also needs `ANTHROPIC_API_KEY`.

**Gotchas**
- No mocked LLM outside `unit` — run integration with `USE_MOCK_LLM=false` (`.claude/rules/testing.md`).
- Run only the phase you touched locally; CI covers the rest.
- New deal-scoped endpoints go into `test_api/test_authorization.py`; new test files go into the matching `ci.yml` job.
- Some test docstrings still say "USE_MOCK_LLM=true" — stale.
