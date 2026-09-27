# TAM — Architecture

> Status: living document. First drafted 2026-08-10 by Claude Code from a
> direct read of the codebase; refreshed 2026-09-27 against `main` as of
> PR #29 (commit `8b00867`). Documents what is actually implemented, not
> intent — see [PRD.md](PRD.md) for product scope and roadmap.
>
> **Scope of this file: system structure and infrastructure.** Related
> material lives elsewhere so it isn't duplicated:
> - API conventions and UX contracts → [DESIGN.md](DESIGN.md) §10;
>   per-endpoint reference → [API.md](API.md)
> - Persisted data model, on-disk layout, background tasks → [SCHEMA.md](SCHEMA.md)
> - Threat model and security controls → [SECURITY.md](SECURITY.md)
> - Test strategy and CI gate behavior → [TESTING.md](TESTING.md)

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
Next.js Server (page renders; no-deal-selected demo views call local
  │  /app/api/deal/* mock BFF routes — see §10 item 3; the Inquiry
  │  Copilot calls /app/api/inquiry/assistant, which calls the
  │  Anthropic API directly — see §9)
  ▼
FastAPI (app/main.py)
  │  CORSMiddleware → HSTS middleware → request-logging middleware (X-Request-ID)
  ▼
app/api/v1/router.py  →  one of 17 domain routers (auth, ingestion, qoe, ...)
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
FastAPI JSON serialization (Decimal amounts as strings — see
[DESIGN.md](DESIGN.md) §10) → CORS headers → browser → React Query cache →
Zustand-held UI state (selected deal/period/basis) → component render.

For document/file processing specifically (`POST /deals/{id}/process`):
the endpoint validates the deal exists, kicks off
`app/pipeline_orchestrator.py::run()` as a `BackgroundTask`, and returns
immediately. The frontend polls `GET /deals/{id}/status` (backed by
`deal_store`'s `stages`/`progress_pct` fields) until every requested stage is
`complete` or one is `failed`. Stage sequencing, status values, and failure
behavior are in [SCHEMA.md](SCHEMA.md) §4.

## 2. Tech Stack — What and Why

### Backend
| Piece | Why here |
|---|---|
| **Python 3.11** (`requires-python = ">=3.11"`, CI pins 3.11) | Target runtime; Ruff `target-version = "py311"`. |
| **FastAPI + Uvicorn** | Async I/O for file-heavy endpoints, automatic OpenAPI docs (`/docs`, `/redoc`), first-class Pydantic integration for request/response validation. |
| **Pandas + NumPy** | All financial transformations (GL normalization, statement rollups, ratio math) — chosen so the arithmetic is inspectable, testable Python, never inside an LLM call. |
| **Pydantic v2** | Schema validation at every boundary — API request/response, agent input/output, and the on-disk JSON shape. `MappedGLLine`, `QoEAdjustment`, `RedFlag`, `NWCPeg`, etc. are all Pydantic models; nothing crosses a module boundary as a bare dict except deal/user store records (see [SCHEMA.md](SCHEMA.md) §2). |
| **`anthropic` SDK (`AsyncAnthropic`)** | The backend's LLM provider (the frontend has a second, separate integration — see §9). Used exclusively for semantic tasks (CoA mapping, QoE adjustment review, red-flag enrichment, contract clause extraction, narrative drafting) — never for arithmetic. Async client because agent calls happen inside async pipeline code. |
| **`pdfplumber` + `pymupdf`** | Digital/text-extractable PDF parsing for debt agreements and contracts (`app/pipeline/contracts/pdf_extractor.py`). No OCR engine is integrated — see PRD.md §3.2. |
| **`openpyxl`** | Generates the Excel databook export (`app/pipeline/databook/generator.py`) — tabs: Cover, QoE Waterfall, Adjustment Ledger, GL Mapping, P&L, Balance Sheet, Cash Flow, NWC Trend, NWC Pegs, Net Debt, Debt Instruments, DCF, Commercial Health, Contracts, Narrative, AR Aging, AP Aging, Tie-outs, IRL. Every tab after the QoE ones is omitted gracefully (warning logged) if its source report doesn't exist. The NWC/Net Debt/DCF/Commercial Health/Contracts/Narrative tabs were added in PR #28. |
| **`argon2-cffi`**, **`cryptography` (AESGCM)**, **`pyjwt`** | Password hashing, at-rest encryption, session tokens — see [SECURITY.md](SECURITY.md). |
| **`pydantic-settings`** | `.env`-driven config (`app/config.py`) — the only module that reads env vars; validates the two required secrets at startup. |
| **`pytest` + `pytest-asyncio` + `pytest-rerunfailures` + `httpx`** | Test runner, async support, scoped retry for one known-flaky real-LLM test, `TestClient` for HTTP-level tests. See [TESTING.md](TESTING.md). |
| **`ruff`** | Lint only (line-length 120, `E`/`F`/`I`/`UP` rule sets) — no separate formatter is configured. |

**Notably not in the stack, despite being named in `plan.txt`'s original
design doc:** Celery, Redis, PostgreSQL, S3/Blob storage, OpenAI SDK. These
were early-design placeholders for a future cloud migration; the actual
built system uses FastAPI `BackgroundTasks` (in-process, no queue),
individually-encrypted local JSON files (no DB), local disk (no object
store), and Anthropic (not OpenAI) throughout. `app/storage/*` and
`app/pipeline_orchestrator.py` are structured so those swaps stay localized
(see `session.md`'s "modular monolith" rationale) but none of the swaps have
happened — treat any reference to Celery/Redis/Postgres/S3 elsewhere in the
repo's docs as aspirational, not current.

### Frontend
| Piece | Why here |
|---|---|
| **Next.js 15.1 (App Router) + React 19** | File-based routing for 15 pages — 10 protected, 5 public (§4) — plus a root `/` that middleware redirects to `/login`. Server + client components mixed (most interactive panels are `"use client"`). |
| **TanStack Query v5** | Server-state cache for backend API calls — `staleTime: 30_000`, `refetchOnWindowFocus: false` (see `components/providers.tsx`). |
| **Zustand (+ `persist`)** | Client-only UI state: selected deal/period/basis plus the notes/report-draft scratch buffer (`use-global-store.ts`, persisted to `localStorage` under `tam-global-state`) and theme (`use-theme-store.ts`). Not server state — that's Query's job. |
| **Zod** | Runtime schema validation at the fetch boundary (`hooks/use-api-query.ts`, `lib/schemas/types.ts`) and request validation in the assistant route handler. |
| **Recharts** | All charting (QoE waterfall/bridge, trends, composition, variance-vs-tolerance, severity distribution). |
| **Radix UI primitives + Tailwind** | Unstyled accessible primitives styled with Tailwind; `class-variance-authority` + `tailwind-merge` for variants. Design system details in [DESIGN.md](DESIGN.md). |
| **`jszip`** | Client-side ZIP handling for the multi-file upload flow. |

### CI / supply chain
| Piece | What it does |
|---|---|
| **GitHub Actions `ci.yml`** | Runs on push and PR to `main`. Python 3.11 (`actions/setup-python@v5`), Node 22 (`actions/setup-node@v4`). Path-gated per-phase backend jobs, frontend lint + build, and a single aggregating `ci-gate` job. Details in [TESTING.md](TESTING.md) §5. |
| **GitHub Actions `dependency-review.yml`** | Runs `actions/dependency-review-action@v4` on PRs to `main`; posts a summary comment on every PR. No `fail-on-severity` is configured, so it reports rather than blocks unless made a required check. |
| **Dependabot (`.github/dependabot.yml`)** | Weekly update PRs for `pip` (`/backend`), `npm` (`/frontend`), and `github-actions` (`/`), up to 10 open PRs each, `chore` commit prefix. As of 2026-09-27, eight npm Dependabot PRs (#30, #32–#38) are open and unmerged. |
| **No scheduled/nightly workflow exists.** | `.github/workflows/` contains only `ci.yml` and `dependency-review.yml`. See §8. |

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
├── api/v1/                   One router module per domain (17), all mounted
│   ├── router.py              in router.py onto prefix /api/v1. Routers are
│   ├── deps.py                thin: auth/ownership check → call a pipeline
│   ├── auth.py                orchestrator or storage module → return a
│   ├── ingestion.py           Pydantic response model. No business logic
│   ├── financial.py           lives in a router file.
│   ├── qoe.py                 deps.py is the one place auth/ownership
│   ├── redflags.py            dependencies live — every new deal-scoped
│   ├── nwc.py                 route should depend on require_deal_owner,
│   ├── net_debt.py            never re-check ownership inline.
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
│   ├── base.py                 BaseAgent (§9) and implements
│   ├── coa_mapper.py            _build_messages/_parse_response/
│   ├── qoe_reviewer.py          _mock_response. Agents take Pydantic
│   ├── redflag_analyst.py       models in, return Pydantic models out —
│   ├── contract_parser.py       never a DataFrame, never raw arithmetic.
│   └── narrative_drafter.py
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
│   └── inquiry_store.py          decrypt-then-read. See SCHEMA.md.
│
├── security/                 Password hashing, file encryption, JWT tokens,
│   ├── passwords.py             access logging. Deliberately small and
│   ├── file_crypto.py            dependency-thin (no custom crypto
│   ├── jwt_tokens.py             primitives). See SECURITY.md.
│   └── access_log.py
│
└── services/
    └── email.py               Outbound email seam (password reset) — SMTP
                                 if SMTP_HOST is configured, else writes to
                                 data/dev_outbox/ (local-dev only).
```

`data/` (gitignored, created on startup by `config.py`, relative to the
directory the server is launched from — `backend/data/` when launched via
`start.bat` or `cd backend && uvicorn ...`) holds all persisted state. Full
layout in [SCHEMA.md](SCHEMA.md) §1.

## 4. Frontend File/Folder Structure

```
frontend/
├── middleware.ts              Route-guard: redirects based on tam_session
│                               cookie presence only (real auth check
│                               happens backend-side on every API call).
├── app/
│   ├── layout.tsx              Root layout: font, <Providers>, <AppShell>.
│   ├── (shell)/layout.tsx      Route group re-wrapping children in
│   │                            AppShell — currently redundant with the
│   │                            root layout doing the same (§10 item 8).
│   ├── page.tsx                 Root "/" — middleware redirects to /login
│   │                             before this renders.
│   ├── login/, signup/,
│   │   forgot-password/,
│   │   reset-password/,
│   │   welcome/                 5 public routes (middleware.ts
│   │                             PUBLIC_ROUTES) — real backend auth calls
│   │                             via fdd-client.ts. Authenticated visitors
│   │                             are redirected to /upload.
│   ├── dashboard/                10 protected routes (PROTECTED_ROUTES in
│   ├── upload/                    middleware.ts). Pages that show deal data
│   ├── financial-analysis/        branch on whether a dealId is selected
│   ├── risk-assessment/           (useGlobalStore): with a dealId they
│   ├── customer-analytics/        render real-backend components under
│   ├── documents/                 components/fdd/; without one, some fall
│   ├── inquiry/                   through to the mock BFF-backed demo view
│   ├── notes/                     (§10 item 3) and others (inquiry) show a
│   ├── reports/                   "select a deal" prompt.
│   ├── settings/
│   ├── api/deal/*               Mock BFF — 7 GET Route Handlers (analysis,
│   │                             customer, decision-queue, documents,
│   │                             inquiry, risk, summary) serving synthetic
│   │                             data from lib/mock-data/*.
│   └── api/inquiry/assistant/   POST — Inquiry Copilot. Builds a snapshot
│                                  (real backend data if dealId is set, mock
│                                  data otherwise) and calls the Anthropic
│                                  API directly (§9).
│
├── components/
│   ├── fdd/                     The real, backend-wired panels: qoe-center,
│   │                             redflag-center, nwc-panel, net-debt-panel,
│   │                             margin-panel, tie-outs-panel,
│   │                             contracts-panel, documents-panel,
│   │                             statements-panel, cash-flow-panel,
│   │                             real-dashboard, deal-summary-banner,
│   │                             derived-risk-gauge (client-derived, labeled
│   │                             as such), junior-analyst-report (the
│   │                             narrative/IAR view — naming reframe is
│   │                             PHASES.md Phase 4).
│   ├── charts/                  Recharts wrappers (chart-card, common-charts
│   │                             incl. the shared BridgeChart).
│   ├── modals/                  chart-drilldown-modal, metric-trace-modal —
│   │                             the "where did this come from" click-through.
│   ├── layout/                  app-shell.tsx (nav + topbar: deal selector,
│   │                             "New Deal" → /upload, theme toggle),
│   │                             theme-toggle.tsx.
│   ├── dashboard/               tam-llm-sidebar.tsx (Inquiry Copilot UI).
│   ├── documents/               document-upload-tool.tsx.
│   ├── tables/                  data-table.tsx (hand-rolled sortable table).
│   └── ui/                      Radix-based primitives — see DESIGN.md §4.
│
├── hooks/use-api-query.ts       Thin TanStack Query + Zod wrapper.
│
├── lib/
│   ├── api/fdd-client.ts        The real backend client — every browser
│   │                             call to FastAPI goes through here. Base URL
│   │                             from NEXT_PUBLIC_API_BASE_URL (default
│   │                             http://localhost:8000).
│   ├── mock-data/                Synthetic fixture data + api.ts serving it
│   │                             — backs the mock BFF and no-deal demo view.
│   ├── schemas/types.ts          Zod schemas mirroring the mock BFF
│   │                             contract — NOT the same contract as
│   │                             fdd-client.ts's real backend types.
│   ├── store/                    use-global-store.ts, use-theme-store.ts.
│   └── utils/                    cn.ts, format.ts (incl. lookupByPeriod()
│                                 for the YYYY-MM-DD vs YYYY-MM key mismatch).
│
└── docs/                        Early-May mock-data specs — describe the
                                  mock BFF contract, not the real backend.
```

## 5. Data Model

Moved to [SCHEMA.md](SCHEMA.md): entity stores and their relationships
(§2), the per-deal processed-report catalog (§3), background task and
stage-status model (§4), and the core Pydantic domain models (§5).

## 6. API Structure and Conventions

Moved to [DESIGN.md](DESIGN.md) §10 (conventions: resource shape, auth
flow, error shapes, serialization, correlation IDs, CORS) and
[API.md](API.md) (every endpoint).

## 7. Security Architecture

Moved to [SECURITY.md](SECURITY.md) — threat model, password storage,
session tokens, at-rest encryption, key management, authorization, audit
logging, transport/TLS termination, secrets handling, rate limiting, and
open security gaps.

## 8. Testing and CI (infrastructure summary)

Details — tiers, commands, the memoization fixture, coverage, gate
semantics — are in [TESTING.md](TESTING.md). The infrastructure facts:

- Three pytest markers (`unit`, `integration`, `e2e`) defined in
  `pyproject.toml`; unmarked tests default to `integration`
  (`tests/conftest.py`). 28 test files under `backend/tests/`.
- `ci.yml` runs on push/PR to `main`: `backend-lint` and `backend-unit`
  always; eleven per-phase integration jobs path-gated via
  `dorny/paths-filter`, each with `USE_MOCK_LLM: "false"` against the real
  Anthropic API (the `backend-notes` job sets neither the key nor the flag
  — its tests make no agent calls); frontend `npm run lint` + `npm run
  build` when `frontend/**` changes; `ci-gate` aggregates everything
  (success or skipped = pass) so branch protection needs one required check.
- **The `e2e` tier is not run by any workflow.** There is no scheduled or
  nightly job and no manual-dispatch job for it; the two `e2e`-marked tests
  (`test_golden_path.py`, `test_e2e_edge_cases.py`) run only when someone
  invokes `pytest -m e2e` locally. Earlier docs describing a nightly e2e run
  were describing intent, not a workflow that exists. Whether to add one is
  an open decision — see [PHASES.md](PHASES.md) Parking Lot.

## 9. Integration Points

### 9.1 Anthropic API — backend (`anthropic` Python SDK, `AsyncAnthropic`)
One shared client instance per process (`agents/base.py::get_client()`).
All 5 agents (CoA mapper, QoE reviewer, red-flag analyst, contract parser,
narrative drafter) subclass `BaseAgent`, which enforces:
- **Hard rule: agents never compute or alter a financial figure.** They
  receive Pydantic models, return Pydantic models; arithmetic happens only
  in `app/pipeline/*` before/after the agent call.
- Mock/real dispatch via `settings.use_mock_llm` — `True` by default in
  `config.py` so the pipeline runs without a key using each agent's
  `_mock_response()` fixture. Per project policy (`.claude/rules/testing.md`) mock mode
  is only for the `unit` tier; CI's integration jobs and any AI-driven run
  use the real API.
- Tool-use for structured output — `_tools` written in OpenAI's
  function-calling shape by convention, translated to Anthropic's
  `tools`/`input_schema` inside `_call()`; `max_tokens: 4000`. Retry with
  exponential backoff (3 attempts) on `RateLimitError` (5s/10s/20s),
  `APIConnectionError` (2s/4s/8s), and 5xx/529 `APIStatusError` (5s/10s/20s);
  other 4xx errors raise `AgentError` immediately.
- Token usage logged per call for cost visibility — no aggregation/budget
  layer beyond the log line.

### 9.2 Anthropic API — frontend (`app/api/inquiry/assistant/route.ts`)
A second, independent LLM integration that bypasses `BaseAgent` entirely:
the Next.js route handler calls `https://api.anthropic.com/v1/messages`
directly with `fetch` (`anthropic-version: 2023-06-01`, `temperature: 0.2`,
`max_tokens: 1024`). It reads `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`
from the **frontend's** server-side environment (e.g. `frontend/.env.local`)
— not from the backend's `.env`. Behavior:
- With a `dealId`, it forwards the caller's cookie to nine backend GET
  endpoints and builds a text snapshot of real computed figures (revenue
  LTM, reported/adjusted EBITDA, red-flag counts, tie-out status, net debt,
  etc.); without one, it builds the snapshot from mock data.
- The snapshot + question go to the model with a "use only provided
  context, do not invent data" system prompt. If no key is set, or the call
  fails for any reason (errors are swallowed), it returns a deterministic
  keyword-matched answer from the same snapshot (`mode: "fallback"`,
  `model: "dashboard-rules-v1"`).
- No retry/backoff, no token logging, no mock/real flag — none of
  `BaseAgent`'s guarantees apply here.

> ⚠️ **Flagged, not changed:** the default model is
> `process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest"`. Commit
> `a289db3` (2026-08-03) records that `claude-3-5-sonnet-latest` now
> returns 404 (retired) — that's why the backend default was moved to
> `claude-sonnet-5`. Unless `ANTHROPIC_MODEL` is set in the frontend
> environment, every Copilot LLM call will fail and the route will
> **silently** fall back to the keyword-rules answer. The default should
> probably be bumped (and the silent catch reconsidered); left for the
> product owner to decide.

### 9.3 Model assignments (backend agents)
| Agent | Model | Where set | Why |
|---|---|---|---|
| Default for all agents | `claude-sonnet-5` | `config.py:30` (`anthropic_model`), overridable via `ANTHROPIC_MODEL` in the backend env | Set in `a289db3` after `claude-3-5-sonnet-latest` was retired. |
| `CoAMapperAgent` | default (`claude-sonnet-5`) | — | — |
| `QoEReviewerAgent` | default (`claude-sonnet-5`) | — | — |
| `ContractParserAgent` | `claude-opus-5` (pinned) | `agents/contract_parser.py` class attr `model` | `ae725c8`: Sonnet 5 consistently failed to produce well-formed instrument objects for the fixture debt agreement; Opus 5 held to the tool schema. |
| `RedFlagAnalystAgent` | `claude-opus-5` (pinned) | `agents/redflag_analyst.py` class attr `model` | `78cceb1`: systematic malformed (non-object) enrichment items for some flag categories with Sonnet 5. |
| `NarrativeDrafterAgent` | `claude-opus-5` (pinned) | `agents/narrative_drafter.py` class attr `model` | `461417d`: `sections` returned as prose instead of the declared object array. The pin reduced but did not eliminate this; the orchestrator degrades to an empty section list. |
| Inquiry Copilot (frontend) | `ANTHROPIC_MODEL` or `claude-3-5-sonnet-latest` | `frontend/app/api/inquiry/assistant/route.ts` | See the flag in §9.2. |

The pinning mechanism is `BaseAgent.model: str | None = None`; `_call()`
uses `self.model or settings.anthropic_model`. A pinned agent ignores the
`ANTHROPIC_MODEL` env var.

### 9.4 SMTP (optional, not configured by default)
`services/email.py` sends password-reset email via any SMTP relay (STARTTLS,
optional login) if `SMTP_HOST` is set; otherwise writes the message to
`data/dev_outbox/` as a console-email-backend equivalent. No provider is
configured today. See [SECURITY.md](SECURITY.md) §4.

### 9.5 Nothing else
No payment processor, no analytics/telemetry SDK, no external storage
(S3/Blob) despite `plan.txt` naming it as a future swap target (§2).

## 10. Known Architectural Debt / Shortcuts

Collected from explicit in-code documentation and direct inspection — mostly
the team's own prior self-assessment, consolidated in one place:

1. **No database.** JSON-file-per-entity storage; `storage/*_store.py`
   modules are the intended swap seam for PostgreSQL, but no ORM/migration
   tooling exists yet.
2. **No task queue, no checkpoint reuse.** `BackgroundTasks` only. A process
   crash mid-pipeline loses the in-flight task with no automatic resume.
   `pipeline_orchestrator.run()` records `failed` for visibility and stops
   at the first failing stage, but it never checks for an existing stage
   output, has no `--force`, and has no resume-from-last-good-stage logic —
   re-running is a manual `POST /process` with an explicit `stages` list.
   `CLAUDE.md` §3 previously required all three; whether to implement them
   or keep the docs describing the current behavior is an open decision
   (PHASES.md Parking Lot).
3. **Dual API surface on the frontend.** The mock BFF (`app/api/deal/*`,
   backed by `lib/mock-data/*`) still exists alongside the real backend
   client (`lib/api/fdd-client.ts`). Deal-data pages branch on `dealId` to
   pick one or the other. It's a deliberate no-deal-selected demo mode, not
   dead code — but two parallel type contracts (`lib/schemas/types.ts` vs.
   `fdd-client.ts`) live in one codebase with no compiler-enforced link.
   This demo path is the leading hypothesis for PHASES.md Phase 0.
4. **`junior-analyst-report.tsx` naming/framing.** Per PRD.md §3.1 the
   narrative feature is architecturally sound and fully wired (real
   fetch/generate + PDF export) but framed as an internal summary memo
   rather than the IAR deliverable — PHASES.md Phase 4.
5. **QoE adjustment override is mid-flight, uncommitted,** on
   `feat/qoe-adjustment-override` and conflicts with `.claude/rules/engine-numbers-finalized.md` — see
   PHASES.md Phase 2.
6. **Security items** — non-revocable JWTs, single static key with no
   rotation/KMS, O(n) file-scan user lookups, no auth rate limiting. See
   [SECURITY.md](SECURITY.md) §9.
7. **Inconsistent error response shape** between `HTTPException`,
   request-validation, and the global unhandled-exception handler — see
   [DESIGN.md](DESIGN.md) §10.
8. **`(shell)` route group appears redundant** with the root layout — both
   wrap children in `AppShell`; not confirmed broken.
9. **Stage bookkeeping drift.** `deal_store.create_deal()` initializes
   `stages` without `narrative_drafter`, and `set_stage_status()` computes
   `progress_pct` over 8 stages that exclude it, while `STAGE_ORDER` has 9.
   Effect: progress can read 100% while narrative drafting is still
   running. Flagged, not fixed.
10. **Two LLM integrations with different guarantees** (§9.1 vs. §9.2) —
    the frontend Copilot has no retry, no mock switch, a retired default
    model, and silently swallows errors.
11. **No Dockerfile or compose setup** — local-only run via `uvicorn` and
    `next dev`/`next start`. (`start.bat` will start Docker Desktop and run
    `docker compose up` *if* a compose file exists; none does.)
12. **Frontend dependency advisories.** The old `STATUS.md` note of 8 `npm
    audit` findings (incl. a critical Next.js advisory) predates Dependabot;
    open Dependabot PRs (#30, #38 bump `next`) are the current tracking
    point. Not re-audited in this refresh.
13. **`STEPS.md` and `STATUS.md` are historical.** Both now carry a
    "Superseded" banner; [PHASES.md](PHASES.md) and [MEMORY.md](MEMORY.md)
    are the current sources of truth.
