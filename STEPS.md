# FDD Engine — Step-by-Step Implementation Tracker

## How We Work
- One step at a time. Build → Test manually → Confirm → Advance.
- Cloud-ready architecture from the start (local POC now, cloud later).
- Big 4 quality bar: every financial calculation is traceable to source data.
- LLM agents are mocked until an Anthropic API key is available.

---

## STEP 1 — Backend Foundation (Current)
**Goal**: FastAPI server starts, deal can be created, file can be uploaded, status can be polled.

### Files Created
- [ ] `backend/pyproject.toml` — all Python dependencies declared
- [ ] `backend/app/__init__.py`
- [ ] `backend/app/main.py` — FastAPI app factory, CORS, router mounting
- [ ] `backend/app/config.py` — pydantic-settings reading .env
- [ ] `backend/app/storage/__init__.py`
- [ ] `backend/app/storage/deal_store.py` — JSON file persistence per deal
- [ ] `backend/app/storage/file_store.py` — uploaded file management
- [ ] `backend/app/schemas/__init__.py`
- [ ] `backend/app/schemas/ingestion.py` — UploadJob, DealStatus, ProcessingStage
- [ ] `backend/app/api/__init__.py`
- [ ] `backend/app/api/v1/__init__.py`
- [ ] `backend/app/api/v1/router.py` — aggregates all v1 routers
- [ ] `backend/app/api/v1/ingestion.py` — deal CRUD + file upload + status endpoints
- [ ] `.env.example`
- [ ] `.gitignore`

### Manual Test Checklist (before advancing to Step 2)
- [ ] `cd backend && pip install -e ".[dev]"` runs without errors
- [ ] `uvicorn app.main:app --reload` starts without errors
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] `POST http://localhost:8000/api/v1/deals` with body `{"company_name": "Acme Corp", "deal_name": "Project Falcon", "currency": "USD"}` returns `{"deal_id": "<uuid>", ...}`
- [ ] `POST http://localhost:8000/api/v1/deals/{deal_id}/upload` with a CSV file returns `{"files_received": 1, ...}`
- [ ] `GET http://localhost:8000/api/v1/deals/{deal_id}/status` returns current status JSON
- [ ] Uploaded file exists on disk at `data/uploads/{deal_id}/`
- [ ] Deal JSON exists at `data/deals/{deal_id}.json`
- [ ] FastAPI auto-docs at `http://localhost:8000/docs` show all endpoints

**Status: IN PROGRESS**

---

## STEP 2 — Data Ingestion Pipeline (Pending)
**Goal**: GL CSV/Excel files are loaded, normalized, and validated. Trial balance check passes.

Files: `pipeline/ingestion/loader.py`, `normalizer.py`, `validator.py`
Schemas: `schemas/gl.py` (RawGLLine, MappedGLLine, ChartOfAccountsCategory)

Test Checklist:
- [ ] Upload `tests/fixtures/sample_gl.csv` → process → normalized GL lines returned
- [ ] Unbalanced trial balance file returns validation error with details
- [ ] Excel (.xlsx) file processes identically to CSV

---

## STEP 3 — Chart of Accounts Mapper + Financial Statement Builder (Pending)
**Goal**: Unknown GL codes mapped to standard categories; P&L, Balance Sheet, Cash Flow built from mapped GL.

Files: `agents/base.py`, `agents/coa_mapper.py`, `pipeline/financial_builder/pnl.py`, `balance_sheet.py`, `cash_flow.py`

Test Checklist:
- [ ] `GET /api/v1/deals/{id}/financials/pnl?period=annual` returns structured P&L
- [ ] Revenue + COGS = Gross Profit (exactly, to the cent)
- [ ] Balance Sheet balances: Assets == Liabilities + Equity
- [ ] Mock mode works without Anthropic API key

---

## STEP 4 — QoE Engine + Red Flag Detector (Pending)
**Goal**: One-time items detected, EBITDA adjusted, waterfall data produced, red flags classified.

Files: `pipeline/qoe_engine/`, `pipeline/redflag_detector/`, `agents/qoe_reviewer.py`, `agents/redflag_analyst.py`

Test Checklist:
- [ ] Planted legal settlement in fixture GL detected as one-time item
- [ ] Owner comp excess detected across all 36 months
- [ ] `GET /api/v1/deals/{id}/qoe` waterfall array sums correctly
- [ ] `GET /api/v1/deals/{id}/redflags` returns ≥3 flags with correct severity

---

## STEP 5 — React Frontend Dashboard (Pending)
**Goal**: Upload → Process → View QoE waterfall + Red Flag table in browser.

Files: `frontend/` (Vite + React + TypeScript scaffold)

Test Checklist:
- [ ] `npm run dev` starts at localhost:5173 without errors
- [ ] Upload page accepts CSV file, polls status, shows "Complete"
- [ ] QoE Center renders waterfall chart with clickable bars
- [ ] Red Flag table shows High/Medium/Low badges, sortable by severity

---

## STEP 6 — NWC Analyzer + Commercial Health (Pending)
## STEP 7 — PDF Contract Parser (Pending)
## STEP 8 — Databook Export + Narrative Drafter (Pending)

---

## Architecture Decisions Log
| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-28 | JSON file storage (not DB) for POC | Local dev simplicity; will swap to PostgreSQL for cloud deployment |
| 2026-05-28 | Mock LLM agents by default | No API key yet; enables full pipeline testing without cost |
| 2026-05-28 | Python Decimal for all financial amounts | Prevents floating-point drift in financial calculations |
| 2026-05-28 | Amounts serialized as strings in JSON | Frontend parses to number only for display; preserves precision |
| 2026-05-28 | FastAPI BackgroundTasks for processing | Sufficient for <50K row files; will replace with Celery+Redis for cloud |
