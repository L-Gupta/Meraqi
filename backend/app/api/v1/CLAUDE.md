# api/v1 — HTTP routers

**Purpose:** The FastAPI surface under `/api/v1`: 17 thin routers (44 endpoints) that authenticate, check deal ownership, call a pipeline orchestrator or storage module, and return a Pydantic model. Per-endpoint reference: `docs/API.md`; conventions: `docs/DESIGN.md` §10.1.

**Contents**
- `router.py` — mounts all 17 routers on `/api/v1`.
- `deps.py` — `get_current_user` (JWT from `tam_session` cookie → 401) and `require_deal_owner` (404 for missing **or** foreign deals). The only place auth/ownership lives.
- `auth.py` — signup/login/logout/me/forgot-password/reset-password; sets the session cookie; reset links go out via `services/email.py`.
- `ingestion.py` — deal create/list/get/status, file upload (extension + size limits, ZIP extraction), `POST /process` → `BackgroundTask`.
- `documents.py` — document inventory, supporting schedules (both write `access.log`).
- `gl.py` — raw GL lines (paginated), validation report, per-period summary.
- `financial.py` — P&L (incl. `?period=annual` rollup), balance sheet, cash flow, summary.
- `qoe.py` — QoE report + per-adjustment source-GL drill-through.
- `redflags.py` — red flags (severity/category filters) + summary.
- `nwc.py` — NWC report + commercial health. `net_debt.py`, `dcf.py`, `tieouts.py` — one GET each.
- `contracts.py`, `narrative.py` — GET the report, or POST to regenerate **synchronously** (LLM; `AgentError` → 502).
- `databook.py` — POST export → `.xlsx` bytes (logs `access.log`).
- `inquiry.py` — inquiry CRUD + the derived (never persisted) decision queue and readiness.
- `notes.py` — GET/PUT deal notes. `settings.py` — GET/PATCH deal settings.

**How it fits in:** The only entry point from the frontend. Routers hold no business logic — they delegate to `pipeline/*` and `storage/*` and translate domain exceptions to `HTTPException`.

**Gotchas**
- Every deal-scoped route must depend on `require_deal_owner` and be added to `tests/test_api/test_authorization.py` (`.claude/rules/deal-ownership.md`). 404, never 403.
- State-changing routes log an `AUDIT` line (`.claude/rules/logging-and-audit.md`).
- Three different error shapes exist (`docs/DESIGN.md` §10.1) — don't "fix" one silently.
- `auth.py`, `ingestion.py`, `gl.py`, `inquiry.py`, `settings.py`, and `router.py` aren't in any CI path filter; changing only these runs lint + unit tests only (`docs/TESTING.md` §6).
- The uncommitted QoE branch adds PATCH/POST adjustment endpoints to `qoe.py`; they are not on `main`.
