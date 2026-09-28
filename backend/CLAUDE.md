# backend — Python service + tests

**Purpose:** The FastAPI "FDD Engine" (Python 3.11) and its pytest suite. Setup and run commands: root `README.md`.

**Contents**
- `app/` — the application: routers, deterministic pipeline, LLM agents, schemas, encrypted storage, security. (See its `CLAUDE.md`.)
- `tests/` — tiered pytest suite, the IDOR regression suite, the `shared_mapped_gl` memoization fixture, and fixtures. (See its `CLAUDE.md`.)
- `pyproject.toml` — dependencies (`[dev]` extra for pytest/ruff), Ruff config (`E,F,I,UP`, line length 120), pytest markers `unit`/`integration`/`e2e`.
- `.env.example` — every env var with comments. Copy it to the repo-root `.env` or `backend/.env.local`.
- `test-docs/` — sample files for **manual** uploads (not used by automated tests); has its own `README.md`.
- `data/` (gitignored, created at runtime) — all persisted state, encrypted except `access.log` and `dev_outbox/`.

**How it fits in:** Serves `/api/v1` on port 8000 to the Next.js frontend. CI (`.github/`) lints it, runs `unit`, and runs each affected phase's integration tests against the real Anthropic API.

**Gotchas**
- The app won't import without `FILE_ENCRYPTION_KEY` and `JWT_SECRET_KEY`, and that includes tests.
- `use_mock_llm` defaults to `True` in code, but policy is real API everywhere except the `unit` tier (`.claude/rules/testing.md`).
- Run from `backend/` so `data/` lands in `backend/data/`.
