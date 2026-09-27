# TAM — Architecture

> Status: living document, drafted 2026-08-10 by Claude Code from a direct
> read of the codebase (backend routers/pipeline/storage/security modules,
> frontend app/components/store, `.github/workflows/ci.yml`, `pyproject.toml`,
> `package.json`). This documents what is actually implemented, not intent —
> see [PRD.md](PRD.md) for product scope and roadmap. Security architecture
> below is documented as-is, per instruction, not redesigned.

## 1. High-Level Request Flow

TAM is a two-process local application: a Next.js frontend (port 3000) and a
FastAPI backend (port 8000), talking over plain REST + an httpOnly session
cookie. There is no database — every persisted entity is an individually
AES-256-GCM-encrypted JSON file on local disk. There is no message queue —
long-running work runs as a FastAPI `BackgroundTask` in the same process that
served the triggering request.

```
Browser (Next.js pages, React Query, Zustand)
  │  fetch(..., { credentials: "include" })   // sends tam_session httpOnly cookie
  ▼
Next.js middleware.ts
  │  presence-only cookie check → redirect to /login or /upload
  ▼
Next.js Server (page renders; some legacy pages still call local
  │  /app/api/deal/* mock BFF routes — see §7)
  ▼
FastAPI (app/main.py)
  │  CORSMiddleware → HSTS middleware → request-logging middleware (X-Request-ID)
  ▼
app/api/v1/router.py  →  one of 16 domain routers (auth, ingestion, qoe, ...)
  │  FastAPI dependency: get_current_user (decode JWT from cookie)
  │  FastAPI dependency: require_deal_owner (404s if deal isn't the caller's)
  ▼
app/pipeline/{stage}/orchestrator.py   (deterministic Python/Decimal/Pandas)
  │  optionally calls app/agents/{name}.py for semantic-only LLM tasks
  ▼
app/storage/{deal,user,note,inquiry}_store.py  /  app/storage/file_store.py
  │  every write/read goes through app/storage/json_io.py
  ▼
app/security/file_crypto.py  →  AES-256-GCM encrypt/decrypt
  ▼
data/{deals,users,uploads,processed,notes,inquiries}/**  (local disk, .gitignored)
```

Response path is the same stack in reverse: Pydantic response models →
FastAPI JSON serialization (Decimal amounts as strings, see §6) → CORS
headers → browser → React Query cache → Zustand-held UI state (selected
deal/period/basis) → component render.

For document/file processing specifically (`POST /deals/{id}/process`):
the endpoint validates the deal exists, kicks off
`app/pipeline_orchestrator.py::run()` as a `BackgroundTask`, and returns
immediately. The frontend polls `GET /deals/{id}/status` (backed by
`deal_store`'s `stages`/`progress_pct` fields) until every requested stage is
`complete` or one is `failed`.

## 2. Tech Stack — What and Why

### Backend
| Piece | Why here |
|---|---|
| **FastAPI + Uvicorn** | Async I/O for file-heavy endpoints, automatic OpenAPI docs (`/docs`, `/redoc`), first-class Pydantic integration for request/response validation. |
| **Pandas + NumPy** | All financial transformations (GL normalization, statement rollups, ratio math) — chosen so the arithmetic is inspectable, testable Python, never inside an LLM call. |
| **Pydantic v2** | Schema validation at every boundary — API request/response, agent input/output, and the on-disk JSON shape. `MappedGLLine`, `QoEAdjustment`, `RedFlag`, `NWCPeg`, etc. are all Pydantic models; nothing crosses a module boundary as a bare dict except deal/user store records (see §5). |
| **`anthropic` SDK (`AsyncAnthropic`)** | The only LLM provider. Used exclusively for the semantic tasks listed in §7 (CoA mapping, QoE adjustment review, red-flag enrichment, contract clause extraction, narrative drafting) — never for arithmetic. Async client because agent calls happen inside async FastAPI request handlers and pipeline stages. |
| **`pdfplumber` + `pymupdf`** | Digital/text-extractable PDF parsing for debt agreements and contracts (`app/pipeline/contracts/pdf_extractor.py`). No OCR engine is integrated — see PRD.md §3.2 for the current scope of that gap. |
| **`openpyxl`** | Generates the Excel databook export (`app/pipeline/databook/generator.py`) — QoE waterfall, adjustments, GL mapping, aging, tie-outs, IRL tabs. |
| **`argon2-cffi`** | Password hashing — see §5. |
| **`cryptography` (AESGCM)** | At-rest file encryption — see §5. |
| **`pyjwt`** | Session tokens — see §5. |
| **`pydantic-settings`** | `.env`-driven config (`app/config.py`) — see §5 for the two required secrets it validates at startup. |
| **`pytest` + `pytest-asyncio` + `httpx`** | Test runner, async test support, `TestClient` for FastAPI HTTP-level tests. Tiered via markers — see §8. |
| **`ruff`** | Lint only (line-length 120, `E`/`F`/`I`/`UP` rule sets) — no separate formatter is configured. |

**Notably not in the stack, despite being named in `plan.txt`'s original
design doc:** Celery, Redis, PostgreSQL, S3/Blob storage, OpenAI SDK. These
were early-design placeholders for a future cloud migration; the actual
built system uses FastAPI `BackgroundTasks` (in-process, no queue),
individually-encrypted local JSON files (no DB), local disk (no object
store), and the Anthropic SDK (not OpenAI) throughout. `app/storage/*` and
`app/pipeline_orchestrator.py` are structured so those swaps stay localized
(see `session.md`'s "modular monolith" rationale) but none of the swaps have
happened yet — treat any reference to Celery/Redis/Postgres/S3 elsewhere in
the repo's docs as aspirational, not current.

### Frontend
| Piece | Why here |
|---|---|
| **Next.js 15 (App Router) + React 19** | File-based routing for the 12 top-level pages (§4); server + client components mixed (most interactive panels are `"use client"`). |
| **TanStack Query v5** | Server-state cache for backend API calls — `staleTime: 30_000`, `refetchOnWindowFocus: false` (see `components/providers.tsx`); avoids re-fetching on every tab switch. |
| **Zustand (+ `persist`)** | Client-only UI state: selected deal/period/basis (`use-global-store.ts`, persisted to `localStorage` under `tam-global-state`) and theme (`use-theme-store.ts`). Deliberately not server state — that's Query's job. |
| **Zod** | Runtime schema validation of API responses in `hooks/use-api-query.ts` and `lib/schemas/types.ts` — catches a backend/frontend contract drift at the fetch boundary instead of downstream in a component. |
| **Recharts** | All charting (QoE waterfall, revenue/EBITDA trend lines, red flag breakdowns). |
| **Radix UI primitives + Tailwind** | Unstyled accessible primitives (`dialog`, `tabs`, `tooltip`) styled with Tailwind; `class-variance-authority` + `tailwind-merge` for variant-driven component styling (`components/ui/*`). |
| **`jszip`** | Client-side ZIP handling for the multi-file upload flow. |

## 3. Backend File/Folder Structure

```
backend/app/
├── main.py                   FastAPI app factory: middleware stack, global
│                              exception handler, /health, router mount.
├── config.py                 pydantic-settings Settings — the ONLY place
│                              that reads env vars. Validates
│                              FILE_ENCRYPTION_KEY/JWT_SECRET_KEY at import
│                              time (fail-fast, not at first use).
├── logging_config.py         Plain-text or JSON (LOG_JSON=true) log
│                              formatting; used by main.py's request-logging
│                              middleware and every module's `logging.getLogger`.
├── pipeline_orchestrator.py  Top-level stage sequencer (STAGE_ORDER + run()),
│                              called as a BackgroundTask from ingestion.py.
│                              New pipeline stages get registered here.
│
├── api/v1/                   One router module per domain, all mounted in
│   ├── router.py              router.py onto prefix /api/v1. Routers are thin:
│   ├── deps.py                 auth/ownership check → call a pipeline
│   ├── auth.py                 orchestrator or storage module → return a
│   ├── ingestion.py             Pydantic response model. No business logic
│   ├── financial.py             lives in a router file.
│   ├── qoe.py                 deps.py is the one place auth/ownership
│   ├── redflags.py              dependencies live — every new deal-scoped
│   ├── nwc.py                   route should depend on require_deal_owner,
│   ├── net_debt.py              never re-check ownership inline.
│   ├── dcf.py
│   ├── contracts.py
│   ├── narrative.py
│   ├── databook.py
│   ├── documents.py
│   ├── gl.py
│   ├── tieouts.py
│   ├── inquiry.py
│   ├── notes.py
│   └── settings.py
│
├── pipeline/                 Deterministic computation, one subpackage per
│   ├── ingestion/              stage, each with its own orchestrator.py
│   ├── financial_builder/      entry point (called from
│   ├── qoe_engine/              pipeline_orchestrator.py::_run_stage). This
│   ├── redflag_detector/        is where Pandas/Decimal math lives — NOT in
│   ├── nwc_analyzer/            api/v1/ or agents/. rules.py files
│   ├── dcf_engine/              (qoe_engine, redflag_detector) hold the
│   ├── net_debt_bridge/         individual threshold/detection rules as
│   ├── contracts/               pure functions.
│   ├── narrative/
│   └── databook/
│
├── agents/                   LLM-touching code ONLY. Every agent subclasses
│   ├── base.py                 BaseAgent (§7) and implements
│   ├── coa_mapper.py            _build_messages/_parse_response/
│   ├── qoe_reviewer.py          _mock_response. Agents take Pydantic
│   ├── redflag_analyst.py       models in, return Pydantic models out —
│   └── contract_parser.py       never a DataFrame, never raw arithmetic.
│
├── schemas/                  Pydantic models — the shared vocabulary between
│   ├── gl.py                   API, pipeline, and agents. gl.py's
│   ├── financials.py            ChartOfAccountsCategory enum and
│   ├── qoe.py                    RawGLLine/MappedGLLine are the spine
│   ├── redflags.py               everything downstream is keyed off of.
│   ├── nwc.py                  One file per domain, mirroring pipeline/
│   ├── net_debt.py               and api/v1/ naming.
│   ├── dcf.py
│   ├── contracts.py
│   ├── documents.py
│   ├── ingestion.py
│   ├── aging.py
│   ├── projections.py
│   ├── narrative.py
│   ├── inquiry.py
│   ├── notes.py
│   ├── settings.py
│   └── auth.py
│
├── storage/                  Persistence layer — every module here is a thin
│   ├── json_io.py               wrapper the rest of the app is meant to
│   ├── deal_store.py             go through, never touching `open()`/
│   ├── user_store.py             `json.load` directly. json_io.py is the
│   ├── file_store.py             single choke point for
│   ├── note_store.py             encrypt-then-atomic-write /
│   └── inquiry_store.py          decrypt-then-read. One `*_store.py` per
│                                  entity (deal, user, upload, note, inquiry).
│
├── security/                 See §5 — password hashing, file encryption,
│   ├── passwords.py             JWT tokens, access logging. Deliberately
│   ├── file_crypto.py            small and dependency-thin (no custom
│   ├── jwt_tokens.py             crypto primitives).
│   └── access_log.py
│
└── services/
    └── email.py               Outbound email seam — SMTP if configured,
                                 else writes to a local dev-outbox directory
                                 (no real provider wired up yet).
```

`data/` (gitignored, created on startup by `config.py`) holds the actual
persisted state: `deals/`, `users/`, `uploads/{deal_id}/`,
`processed/{deal_id}/{stage}.json`, `notes/`, `inquiries/`, plus the
top-level `access.log` (append-only, JSON-lines, unencrypted by design so
it's grep-able for audit purposes).

## 4. Frontend File/Folder Structure

```
frontend/
├── middleware.ts              Route-guard: redirects based on tam_session
│                               cookie presence only (§5 — real auth check
│                               happens backend-side on every API call).
├── app/
│   ├── layout.tsx              Root layout: font, <Providers>, <AppShell>.
│   ├── (shell)/layout.tsx      Route group re-wrapping children in
│   │                            AppShell — currently redundant with the
│   │                            root layout doing the same (both wrap
│   │                            children in AppShell); worth a look before
│   │                            adding pages to (shell) specifically.
│   ├── page.tsx                 Root "/" — middleware immediately
│   │                             redirects to /login before this renders
│   │                             for any real visit.
│   ├── login/, signup/,
│   │   forgot-password/,
│   │   reset-password/,
│   │   welcome/                 Public routes (see middleware.ts
│   │                             PUBLIC_ROUTES) — real backend auth calls
│   │                             via fdd-client.ts, not the mock BFF.
│   ├── dashboard/                Protected routes (PROTECTED_ROUTES in
│   ├── upload/                    middleware.ts). Each page.tsx branches
│   ├── financial-analysis/        on whether a dealId is selected
│   ├── risk-assessment/           (useGlobalStore): with a dealId, it
│   ├── customer-analytics/        renders real-backend components (the
│   ├── documents/                 "Real*"/"*Panel" components under
│   ├── inquiry/                   components/fdd/); with no dealId, it
│   ├── notes/                     falls through to the mock BFF-backed
│   ├── reports/                   demo view (§7).
│   ├── settings/
│   └── api/deal/*, api/inquiry/*  Mock BFF routes — Next.js Route Handlers
│                                   serving synthetic data from
│                                   lib/mock-data/*. See §7 — this is a
│                                   deliberate demo-mode fallback, not dead
│                                   code, but it means there are two parallel
│                                   API surfaces in this codebase.
│
├── components/
│   ├── fdd/                     The real, backend-wired panels — one per
│   │                             domain (qoe-center, redflag-center,
│   │                             nwc-panel, net-debt-panel, tie-outs-panel,
│   │                             contracts-panel, documents-panel,
│   │                             statements-panel, cash-flow-panel,
│   │                             real-dashboard, deal-summary-banner,
│   │                             junior-analyst-report — see PRD.md's note
│   │                             that this last one's naming/framing needs
│   │                             to change to reflect the IAR deliverable,
│   │                             not a summary memo).
│   ├── charts/                  Recharts wrappers (chart-card, common-charts).
│   ├── modals/                  Drill-through UI: chart-drilldown-modal,
│   │                             metric-trace-modal — the audit-trail
│   │                             "where did this come from" click-through.
│   ├── layout/                  app-shell.tsx (nav + topbar + deal
│   │                             switcher), theme-toggle.tsx.
│   ├── dashboard/                tam-llm-sidebar.tsx.
│   ├── documents/                document-upload-tool.tsx.
│   ├── tables/                   data-table.tsx (TanStack-less; a plain
│   │                             sortable table component).
│   └── ui/                      Radix-based primitives (button, card,
│                                 dialog, tabs, tooltip, badge, sheet,
│                                 skeleton, table, textarea).
│
├── hooks/
│   └── use-api-query.ts         Thin TanStack Query + Zod wrapper (§2).
│
├── lib/
│   ├── api/fdd-client.ts        The real backend client — every call to
│   │                             FastAPI goes through here. Auth section
│   │                             plus typed wrappers per domain
│   │                             (financials, QoE, red flags, NWC, net
│   │                             debt, DCF, contracts, narrative,
│   │                             tie-outs, notes, inquiries, databook).
│   ├── mock-data/                Synthetic fixture data + api.ts serving
│   │                             it — backs the mock BFF routes and the
│   │                             no-deal-selected demo view only.
│   ├── schemas/types.ts          Zod schemas mirroring the mock BFF
│   │                             contract (see frontend/docs/*.md) — NOT
│   │                             the same contract as fdd-client.ts's
│   │                             real backend types.
│   ├── store/                    use-global-store.ts, use-theme-store.ts (§2).
│   └── utils/                    cn.ts (Tailwind class merge), format.ts.
│
└── docs/
    ├── backend-ai-engine-spec.md   Original beginner-oriented spec for the
    │                                 mock BFF's expected data shapes/formulas
    │                                 — describes the aspirational full
    │                                 contract, not the current real-backend
    │                                 contract (fdd-client.ts).
    └── company-data-contract.md    Same category — canonical payload shapes
                                     for the whole mock UI.
```

## 5. Data Model Overview

There is no schema/migrations directory — TAM's "schema" is the union of
Pydantic models in `backend/app/schemas/*.py`, each persisted as its own
encrypted JSON file or array thereof. Core entities and relationships:

- **User** (`user_store.py`) — `id`, `email` (unique, case-normalized),
  `hashed_password` (Argon2id), `full_name`, password-reset token fields.
  One file per user.
- **Deal** (`deal_store.py`) — `deal_id`, `owner_user_id` (FK by convention,
  not enforced by a DB constraint — enforced in code via
  `require_deal_owner`), `company_name`, `deal_name`, `currency`, `stages`
  (dict of stage name → `pending`/`running`/`complete`/`failed`),
  `progress_pct`, `uploaded_files` (list of filename/path/size/timestamp),
  `settings` (embedded `DealSettings`). **One deal has exactly one owning
  user** — this is the single-owner-per-deal model noted in PRD.md §2/§4 as
  a real gap for the multi-analyst-team target user.
- **RawGLLine → MappedGLLine** (`schemas/gl.py`) — the spine of the whole
  pipeline. Every line carries `source_file` + `source_row` for audit
  traceability; `MappedGLLine` adds `standard_category`
  (`ChartOfAccountsCategory` enum — Revenue, COGS, SG&A subcategories,
  below-the-line, full balance sheet categories, equity) plus
  `financial_statement`, `is_ebitda_component`, `is_nwc_component`, and
  mapping provenance (`mapping_source`: `llm`/`rule`/`manual`,
  `mapping_confidence`, `mapping_reasoning`).
- **Financial Statements** (`schemas/financials.py`) — P&L, Balance Sheet,
  Cash Flow, built per-period from `MappedGLLine`s; not separately
  persisted as their own store, computed and cached under
  `data/processed/{deal_id}/financials.json`.
- **QoEAdjustment** (`schemas/qoe.py`) — one row per adjustment, always
  citing `source_gl_line_ids`; `detection_method` (`rule`/`llm`/`manual`),
  `llm_reasoning`/`llm_confidence` when LLM-reviewed, and (as of the
  in-progress `feat/qoe-adjustment-override` branch)
  `override_reason`/`overridden_by`/`overridden_at` for analyst review —
  see PRD.md §3.1.
- **RedFlag** (`schemas/redflags.py`) — `severity`, `category`, `title`,
  `financial_impact_low/high`, `source` (`rule_engine`/`llm_analysis`/
  `contract_parser`), `source_gl_line_ids` or `source_document`,
  `diligence_questions` (LLM-enriched).
- **NWCDataPoint / NWCPeg** (`schemas/nwc.py`) — working-capital time
  series and the recommended peg calculation.
- **DebtInstrument** (`schemas/contracts.py`) — extracted from PDF debt
  agreements: lender, rate, maturity, covenants, change-of-control,
  prepayment terms.
- **NarrativeReport** (`schemas/narrative.py`) — the 5 drafted sections,
  each tracking `figures_used` back to already-computed figures (never raw
  GL) — the grounding mechanism for the IAR narrative (PRD.md §3.1 flags
  this needs a reframing pass, not a data-model change).
- **DealNotes**, **InquiryItem/DecisionQueueItem** (`schemas/notes.py`,
  `schemas/inquiry.py`) — analyst notes and the PBC (Prepared-By-Client)
  tracker; Decision Queue items are computed fresh on every request from
  tie-out failures + high-severity red flags + missing documents + open
  inquiries, never persisted as their own entity.

All amounts are `Decimal`, serialized as JSON strings (never native JSON
numbers) end-to-end — the frontend parses them to `number` only at the
point of display, per the comment at the top of `fdd-client.ts`.

## 6. API Structure and Conventions

- **Base path:** `/api/v1`, one `APIRouter` per domain, all mounted in
  `app/api/v1/router.py`.
- **Resource shape:** deal-scoped resources nest under
  `/deals/{deal_id}/...` (e.g. `/deals/{id}/qoe`,
  `/deals/{id}/qoe/adjustments/{adj_id}/source`). Every such route depends
  on `require_deal_owner`, which both 404s on a nonexistent deal and 404s
  (not 403s) when the deal exists but isn't owned by the caller — a
  deliberate choice to avoid confirming a valid-but-foreign `deal_id` via
  status code (`deps.py` docstring calls this out explicitly as the IDOR
  fix).
- **Auth flow:** `POST /auth/signup` / `POST /auth/login` set an httpOnly,
  `SameSite=Lax` session cookie (`tam_session`, a JWT, `secure` flag off
  only on localhost — see `_is_local_dev()` in `auth.py`). Every subsequent
  request relies on the browser sending that cookie
  (`credentials: "include"` in `fdd-client.ts`); FastAPI decodes it via
  `get_current_user` on every protected route. `GET /auth/me` returns the
  current user. `POST /auth/logout` clears the cookie. Password reset is
  token-based (`forgot-password` issues a token, returned directly in the
  API response today since no real email provider is wired — see §7/§9).
- **Long-running work:** `POST /deals/{id}/process` triggers
  `pipeline_orchestrator.run()` as a `BackgroundTask` and returns
  immediately; clients poll `GET /deals/{id}/status`. There is no
  job/task ID — status is deal-scoped, not per-invocation.
- **Response bodies:** Pydantic `response_model`s throughout — FastAPI
  handles serialization, including `Decimal → str`.
- **Error shape:** two distinct shapes depending on where the error
  originates:
  - Handled errors (`HTTPException` raised deliberately, e.g. 404 on
    ownership, 422 on a validation failure) → FastAPI's default
    `{"detail": "..."}`.
  - Unhandled exceptions → caught by the global handler in `main.py`
    (`unhandled_exception_handler`), which returns
    `{"error": ExceptionType, "detail": str(exc), "request_id": ..., "endpoint": "METHOD /path"}`
    with a 500. **This is an inconsistency worth flagging** (§9): the two
    error shapes don't share a key (`detail` alone vs. `error`+`detail`+
    `request_id`+`endpoint`), so a frontend error handler that only reads
    `detail` gets it in both cases but loses the richer 500 context, and
    there's no single documented error contract.
- **Request correlation:** every response carries `X-Request-ID` (echoed
  from the request header if the client sent one, else generated); logged
  alongside method/path/status/duration by the request-logging middleware.
- **CORS:** explicit origin allowlist in `config.py`
  (`localhost`/`127.0.0.1` on ports 3000/3001/5173), `allow_credentials:
  True` (required for the cookie-based auth to work cross-origin in local
  dev).
- **Transport security:** the backend does not terminate TLS; it sends
  `Strict-Transport-Security` on every response unconditionally (harmless
  over plain HTTP — browsers ignore HSTS there) so a fronting reverse proxy
  doesn't need to separately add it. See README.md for the documented
  Caddy/nginx setups for any non-localhost deployment.

## 7. Security Architecture (as implemented)

Documented as-is per instruction — this is what exists today, not a
proposal.

- **Password storage:** Argon2id via `argon2-cffi`
  (`security/passwords.py`), using the library's own tuned default cost
  parameters rather than hand-picked ones. `verify_password` never raises —
  it returns `False` on any mismatch or malformed/foreign hash.
- **Session tokens:** JWT (HS256, via PyJWT), `sub` = user ID, `exp` =
  `now + jwt_expiry_days` (default 7). Explicitly documented tradeoff in
  `jwt_tokens.py`'s module docstring: stateless (no session store to
  clean up, fits the JSON-file storage model) but **not revocable before
  expiry** without a blocklist — acceptable for a local POC session length,
  called out as needing server-side sessions or a blocklist before any
  "logout everywhere" / compromised-token-revocation requirement is real.
- **At-rest encryption:** AES-256-GCM (`security/file_crypto.py`, via
  `cryptography.hazmat.primitives.ciphers.aead.AESGCM`) for every file the
  app persists — deal/user/note/inquiry JSON records, uploaded documents,
  and processed pipeline output. Wire format: `nonce (12 bytes) ||
  ciphertext+tag`; nonce is freshly random (`os.urandom`) per encryption
  call, never reused or persisted. GCM is authenticated, so
  `decrypt_bytes` raises `FileCryptoError` (wrapping `InvalidTag`) on any
  tampering or corruption rather than returning garbage plaintext. All
  reads/writes of encrypted JSON funnel through one choke point,
  `storage/json_io.py`, which also makes every write atomic
  (temp-file-then-`os.replace`) so a crash mid-write can't leave a
  corrupted or half-encrypted file. `storage/file_store.py` applies the
  same encrypt/decrypt to raw uploaded file bytes (never writes decrypted
  plaintext to disk — callers that need to hand a file to
  pandas/pdfplumber/zipfile wrap the decrypted bytes in `BytesIO` instead
  of a temp file).
- **Key management:** a single `FILE_ENCRYPTION_KEY` (base64, must decode
  to exactly 32 bytes) read from `.env` via `pydantic-settings`, validated
  at process startup (`config.py`'s `field_validator` — fails fast with an
  actionable error, not a silent empty-bytes default, thanks to
  `validate_default=True`). Explicitly documented as a POC-grade posture:
  the master key lives directly in an env var; moving to a real KMS/Vault
  (AWS KMS, GCP KMS, HashiCorp Vault) is called out as required before any
  production use, and the key-loading is deliberately isolated to this one
  settings field so that swap doesn't touch any call site using
  `settings.file_encryption_key`. **No key rotation mechanism exists** —
  changing the key would make all previously-encrypted data unreadable;
  worth flagging if key rotation ever becomes a requirement.
- **Authorization:** every deal has exactly one `owner_user_id`;
  `require_deal_owner` (§6) is the single enforcement point, used as a
  FastAPI dependency on every deal-scoped route. Its docstring explicitly
  frames this as "the fix for the core IDOR issue."
- **Audit logging:** `security/access_log.py` appends one JSON line per
  document read/download/decrypt event (`user_id`, `deal_id`, `action`,
  `filename`, timestamp) to an unencrypted, append-only
  `data/access.log` — deliberately plaintext so it's grep-able for a
  due-diligence audit trail without needing to decrypt it first. Logging
  failures are swallowed (never raise) so a broken log write can't break
  the request it's logging.
- **Request/response logging hygiene:** the request-logging middleware in
  `main.py` explicitly does not log request/response bodies — only
  method/path/status/duration/request-id — because uploads and financial
  payloads may contain sensitive data.
- **Transport:** see §6 — HSTS header sent unconditionally, TLS
  termination is the deploying operator's responsibility (reverse proxy),
  not something this app does itself.
- **What's incomplete/inconsistent, flagged (not fixed) here:**
  - JWT is not revocable before expiry (see above) — no logout-everywhere.
  - Single static encryption key, no rotation, no KMS — documented as
    intentional-for-now in both `config.py` and README.md, not a surprise,
    but still a real gap before any real deployment.
  - `user_store.get_user_by_email` and
    `find_user_by_reset_token_hash` are full-directory-scan lookups
    (module docstring calls this "fine at POC scale... swap for an
    indexed/DB lookup before that stops being true") — a latent
    performance cliff, not a correctness bug, but worth tracking.
  - Password-reset currently returns the reset token/link directly in the
    API response instead of emailing it (no real email provider
    configured by default — `services/email.py` falls back to a local
    dev-outbox directory) — README.md already flags this as unsuitable
    for real users until a provider (SES/SendGrid/etc.) is wired in.
  - No rate limiting on `/auth/login` or `/auth/signup` visible anywhere
    in the router or middleware stack — worth confirming this is
    acceptable for the current local/POC threat model before it isn't.

## 8. Testing and CI

Three pytest markers (`pyproject.toml`): `unit` (ms-scale, no I/O, no agent
calls), `integration` (real file I/O and/or a real, never-mocked LLM call,
scoped to one pipeline phase), `e2e` (full multi-stage pipeline over HTTP,
kept out of per-phase CI). 28 test files under `backend/tests/`, split into
`test_api/`, `test_pipeline/`, `test_security/`, `test_storage/`, plus
shared fixtures.

CI (`.github/workflows/ci.yml`) is phase-gated via `dorny/paths-filter`: a
`backend-lint` (Ruff) and `backend-unit` job always run; one integration job
per pipeline phase (ingestion, financial-builder, qoe-redflag, nwc,
net-debt-dcf, contracts, narrative, databook, auth-security, notes,
documents-api) runs only if that phase's files (or anything in the
cross-cutting "shared" set — config, storage, security, schemas, deps,
pipeline_orchestrator, agents/base.py) changed. **Every integration job runs
with `USE_MOCK_LLM: "false"` against the real Anthropic API** — mocking is
strictly a local-dev/unit-test default (`config.py`'s `use_mock_llm: bool =
True`), never how CI validates agent behavior. A single `ci-gate` job
aggregates all of the above (succeeds if every job that ran, passed —
skipped jobs don't block) so branch protection only needs to require one
check regardless of how many phase jobs exist. Frontend CI is `next lint` +
`next build`, gated on any change under `frontend/**`. The real end-to-end
pipeline (`e2e` marker) is intentionally excluded from this workflow
entirely — per `CLAUDE.md` and `plan.txt`, it runs nightly/on-demand, not as
a merge gate.

## 9. Integration Points

- **Anthropic API (`anthropic` Python SDK, `AsyncAnthropic`)** — the only
  external LLM integration. One shared client instance per process
  (`agents/base.py::get_client()`). All 5 agents (CoA mapper, QoE reviewer,
  red-flag analyst, contract parser, narrative drafter) subclass
  `BaseAgent`, which enforces:
  - **Hard rule, stated explicitly here because it drives the whole
    pipeline architecture: agents never compute or alter a financial
    figure.** They receive Pydantic models, return Pydantic models;
    arithmetic happens only in `app/pipeline/*` before/after the agent
    call.
  - Mock/real dispatch via `settings.use_mock_llm` — `True` by default,
    meaning **the full pipeline runs end-to-end without any Anthropic API
    key**, using each agent's `_mock_response()` fixture. This is the
    documented default for local dev and CI's fast `backend-unit` job; CI's
    per-phase integration jobs override it to `false` and hit the real API
    (§8).
  - Tool-use (function-calling) for structured output — `_tools` defined
    in each subclass in OpenAI's function-calling shape, translated to
    Anthropic's `tools`/`input_schema` format inside `_call()`; retry with
    exponential backoff on `RateLimitError`, `APIConnectionError`, and 5xx
    `APIStatusError` (3 attempts, 5s/10s/20s or 2s/4s/8s backoff depending
    on error type); non-5xx `APIStatusError` (4xx) is treated as
    non-retryable and raised immediately as `AgentError`.
  - Token usage logged per call (`usage.input_tokens`/`output_tokens`) for
    cost visibility — no aggregation/budget-tracking layer beyond the log
    line.
- **SMTP (optional, not configured by default)** — `services/email.py`
  sends password-reset email via any SMTP relay if `smtp_host` is set;
  otherwise writes the message to a local `dev_email_outbox_dir` as a
  console-email-backend equivalent. No provider is wired up today.
- **No other third-party APIs** — no payment processor, no analytics/telemetry
  SDK, no external storage (S3/Blob) despite being named in `plan.txt` as a
  future swap target (§2).

## 10. Known Architectural Debt / Shortcuts (as of this session)

Collected from explicit in-code documentation, `STATUS.md`, and direct
inspection — not new findings, mostly the team's own prior self-assessment,
consolidated in one place:

1. **No database.** JSON-file-per-entity storage, chosen for local-dev
   simplicity; `storage/*_store.py` modules are the intended swap seam for
   PostgreSQL, but no ORM/migration tooling exists yet.
2. **No task queue.** `BackgroundTasks` only — fine for the documented
   <50K-row-file scale, but a process crash mid-pipeline loses the
   in-flight background task with no automatic resume (the pipeline
   orchestrator does record a `failed` status for visibility, but nothing
   retries it).
3. **Dual API surface on the frontend.** The mock BFF (`app/api/deal/*`,
   `app/api/inquiry/*`, backed by `lib/mock-data/*`) still exists alongside
   the real backend client (`lib/api/fdd-client.ts`). Every real page
   branches on `dealId` to pick one or the other. This is a deliberate
   no-deal-selected demo mode, not leftover dead code — but it does mean
   two parallel type contracts (`lib/schemas/types.ts` vs. whatever
   `fdd-client.ts` returns) live in the same codebase, which is a real
   trap for future work: a change to a real endpoint's response shape has
   no compiler-enforced link to the mock schema it's supposed to
   (eventually) replace.
4. **`junior-analyst-report.tsx` naming/framing.** Per PRD.md §3.1, the
   narrative feature is architecturally sound (grounded fact-sheet-only
   drafting) but is currently labeled and scoped as an internal summary
   memo rather than the actual IAR deliverable — a product-framing gap,
   not a code defect, but it will touch this component and its backend
   narrative sections when addressed.
5. **QoE adjustment override is mid-flight.** Uncommitted changes on the
   current branch (`feat/qoe-adjustment-override`) add
   `override_reason`/`overridden_by`/`overridden_at` to `QoEAdjustment` and
   corresponding orchestrator/API logic — not yet merged, not yet covered
   by the CI phase-gate job list beyond whatever `qoe_redflag`'s existing
   path filters already catch.
6. **Security items already flagged in §7**: non-revocable JWTs, single
   static encryption key with no rotation/KMS, O(n) file-scan user lookups,
   password reset without real email delivery, no visible auth rate
   limiting.
7. **Inconsistent error response shape** between `HTTPException`-raised
   errors (`{"detail": ...}`) and the global unhandled-exception handler
   (`{"error", "detail", "request_id", "endpoint"}`) — see §6.
8. **`(shell)` route group appears redundant** with the root layout — both
   wrap children in `AppShell` (§4); not confirmed broken, but worth a
   second look before building on it.
9. **`STEPS.md`** (the original 8-step build tracker) is being retired per
   the product owner as of this session — some of its status notes (e.g.
   Step 5's claim that inquiry tracking is "not backend-persisted") are
   already stale relative to the actual code (`inquiry_store.py` is a real
   JSON-file-backed store with full CRUD). Treat `STEPS.md` as historical,
   not current, going forward — PRD.md and this document are the intended
   source of truth.
10. **No Dockerfile or compose setup** — local-only run via `uvicorn`
    (backend) and `next dev`/`next start` (frontend), per `STATUS.md`.
11. **`npm audit`** reported 8 frontend vulnerabilities including a
    critical Next.js advisory as of the last `STATUS.md` pass — not
    re-verified in this session; worth a fresh `npm audit` before treating
    that as current.
