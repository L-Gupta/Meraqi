# backend/app — the FastAPI "FDD Engine"

**Purpose:** The whole backend application: HTTP API, deterministic analysis pipeline, LLM agents, encrypted persistence, and security primitives. System view: `docs/ARCHITECTURE.md` §1–§3.

**Contents**
- `main.py` — app factory: CORS → HSTS → request-logging (`X-Request-ID`, no bodies) middleware, global 500 handler (`{error, detail, request_id, endpoint}`), `GET /health`, mounts `api/v1`.
- `config.py` — `Settings` (pydantic-settings): the **only** reader of env vars (repo-root `.env`, then `backend/.env.local`). Fails fast on a missing or invalid `FILE_ENCRYPTION_KEY` / `JWT_SECRET_KEY`; `anthropic_model` defaults to `claude-sonnet-5`; `use_mock_llm` defaults to `True`; creates the `data/` directories.
- `logging_config.py` — plain-text or JSON (`LOG_JSON`) logging.
- `pipeline_orchestrator.py` — `STAGE_ORDER` + `run()`: executes the requested stages sequentially as a `BackgroundTask`, records each stage's status on the deal, stops at the first failure. No checkpoint reuse or resume.
- `api/v1/` — 17 thin routers; `deps.py` holds auth + `require_deal_owner`. (See its `CLAUDE.md`.)
- `pipeline/` — all financial computation, one subpackage per stage. (See its `CLAUDE.md`.)
- `agents/` — every LLM call, as `BaseAgent` subclasses. (See its `CLAUDE.md`.)
- `schemas/` — Pydantic models shared by all of the above. (See its `CLAUDE.md`.)
- `storage/` — encrypted JSON-file stores; the only path to `data/`. (See its `CLAUDE.md`.)
- `security/` — Argon2id, AES-256-GCM, JWT, access log. (See its `CLAUDE.md`.)
- `services/email.py` — password-reset email: SMTP when `SMTP_HOST` is set, else a plaintext file in `data/dev_outbox/`.

**How it fits in:** Request path = `api/v1` → `pipeline` (→ `agents`) → `storage` → `security`. Long work runs in-process via `BackgroundTasks`; there is no database, queue, or Redis (`docs/SCHEMA.md` §0).

**Gotchas**
- LLMs never compute or alter numbers; engine numbers are final; every figure traces to a source (`.claude/rules/`). ⚠️ `agents/qoe_reviewer.py`'s `modify` path currently breaks the first rule — flagged, not fixed.
- `config.py`, `main.py`, `pipeline_orchestrator.py`, `schemas/`, `storage/`, `security/`, and `agents/base.py` are in CI's "shared" filter: touching them runs every backend phase (real-API cost).
- Security-sensitive areas (`security/`, `storage/`, auth, anything under `data/`) must be flagged in commits and PRs (`docs/SECURITY.md`).
- `logging_config.py`, `services/email.py`, and several routers aren't in any CI path filter.
