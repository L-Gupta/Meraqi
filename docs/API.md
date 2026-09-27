# API.md — Endpoint Reference

> Generated 2026-09-27 by reading every router in `backend/app/api/v1/` and
> every Route Handler under `frontend/app/api/` on `main` (`8b00867`).
> Conventions shared by every endpoint — base path, cookie auth, the three
> error shapes, Decimal-as-string serialization, `X-Request-ID` — are in
> [DESIGN.md](DESIGN.md) §10.1 and not repeated per endpoint. Schemas are in
> `backend/app/schemas/*.py`; field-level detail for persisted shapes is in
> [SCHEMA.md](SCHEMA.md). The live OpenAPI spec is at `GET /docs` / `GET
> /redoc` on a running backend.
>
> Not on `main`, so not listed: the `PATCH`/`POST
> /deals/{id}/qoe/adjustments…` override endpoints on the uncommitted
> `feat/qoe-adjustment-override` branch (PHASES.md Phase 2).

## Legend

- **Auth — `session`:** requires a valid `tam_session` cookie
  (`get_current_user`). Missing cookie → `401 "Not authenticated"`; bad or
  expired JWT → `401 "Invalid or expired session token: …"`; JWT for a
  deleted user → `401`.
- **Auth — `owner`:** `session` **plus** `require_deal_owner`: unknown
  `deal_id` **or** a deal owned by someone else → `404 "Deal {id} not
  found"` (never 403). A deal file that exists but can't be decrypted →
  `DealStoreError` → `500` (global handler shape).
- **"Not processed" 404:** most read endpoints return `404` with a message
  like *"… not found for deal {id}. Run /process first."* until the
  producing pipeline stage has written its report.
- All `422` request-validation errors from FastAPI have
  `{"detail": [ … ]}` (list) — not repeated per row.

Endpoint count: **44** under `/api/v1` across 17 routers, plus `GET
/health`, plus 8 Next.js Route Handlers.

---

## System (`app/main.py`)

| Method | Path | Auth | Response | Notes |
|---|---|---|---|---|
| GET | `/health` | none | `{"status": "ok", "version": "0.1.0", "mock_llm": bool}` | Used by `start.bat` to wait for the backend. |

---

## Auth — `auth.py` (prefix `/api/v1/auth`)

| Method | Path | Auth | Request | Response | Key errors |
|---|---|---|---|---|---|
| POST | `/auth/signup` | none | `SignupRequest {email: EmailStr, password: str ≥8, full_name: str 1–200}` | `201 UserPublic {id, email, full_name, created_at}`; sets `tam_session` cookie | `409` email already registered |
| POST | `/auth/login` | none | `LoginRequest {email, password}` | `200 UserPublic`; sets cookie | `401 "Incorrect email or password"` (same message for unknown email and wrong password) |
| POST | `/auth/logout` | none | — | `{"ok": true}`; deletes cookie | — (stateless; the JWT itself stays valid until expiry — SECURITY.md §3) |
| GET | `/auth/me` | session | — | `UserPublic` | `401` |
| POST | `/auth/forgot-password` | none | `{email}` | `ForgotPasswordResponse {message}` — always *"If an account exists for this email, a reset link has been sent."* | none by design (no enumeration). Reset link is emailed (SMTP) or written to `data/dev_outbox/`; **never** in the response. Token TTL 1 h. |
| POST | `/auth/reset-password` | none (token) | `ResetPasswordRequest {token, new_password ≥8}` | `{"ok": true}` | `400 "Reset token is invalid or has expired"` |

Cookie: `tam_session`, httpOnly, `SameSite=Lax`, `path=/`,
`max_age = JWT_EXPIRY_DAYS` (default 7 days), `secure` unless the first
CORS origin is localhost.

---

## Deals / Ingestion — `ingestion.py` (prefix `/api/v1/deals`)

| Method | Path | Auth | Request | Response | Key errors |
|---|---|---|---|---|---|
| POST | `/deals` | session | `CreateDealRequest {company_name 1–200, deal_name 1–200, currency: ^[A-Z]{3}$ = "USD"}` | `201 DealResponse` | — |
| GET | `/deals` | session | — | `list[DealResponse]` — caller's deals only, newest first | — |
| GET | `/deals/{deal_id}` | owner | — | `DealResponse` | — |
| GET | `/deals/{deal_id}/status` | owner | — | `DealResponse` (same payload; the polling endpoint) | — |
| POST | `/deals/{deal_id}/upload` | owner | multipart `files: list[UploadFile]` | `UploadResponse {deal_id, files_received, files: list[UploadedFileInfo]}` | `400` no files; `422` extension not in `.csv/.xlsx/.pdf/.zip`; `413` > 50 MB (> 200 MB for `.zip`); `422` bad ZIP (`ZipExtractorError`). ZIP members that aren't csv/xlsx/pdf are dropped with an `AUDIT zip_member_dropped` log. Same-name uploads overwrite. |
| POST | `/deals/{deal_id}/process` | owner | `ProcessRequest {stages?: list[ProcessingStage]}` — omit to run all of `STAGE_ORDER` | `ProcessResponse {deal_id, message, stages_queued}` — returns immediately; work runs as a `BackgroundTask` | `422` no files uploaded; `409` a requested stage is already `running` |

`DealResponse`: `{deal_id, company_name, deal_name, currency, created_at,
updated_at, stages: {stage: "pending"|"running"|"complete"|"failed"},
progress_pct: int, uploaded_files: list[UploadedFileInfo], error: str|null}`.
`ProcessingStage`: `ingestion | coa_mapping | financial_builder | qoe_engine
| redflag_detector | nwc_analyzer | dcf_engine | net_debt_bridge |
narrative_drafter`. Stage semantics: [SCHEMA.md](SCHEMA.md) §4.

---

## Documents — `documents.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/documents` | owner | `DocumentInventory {deal_id, documents: list[DocumentRecord], missing_recommended: list[str], warnings}` | Writes an `access.log` entry (`list_documents`). |
| GET | `/deals/{deal_id}/supporting-schedules` | owner | `dict[str, list[dict]]` — raw parsed tables for lease / fixed-asset / equity / payroll / bank-statement uploads (Group C) | `404` (`IngestionError`) if not produced yet. Writes `access.log` (`list_supporting_schedules`). |

## GL Inspection — `gl.py`

| Method | Path | Auth | Query | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/gl/lines` | owner | `page ≥1 =1`, `page_size 1–1000 =100`, `account_code` (prefix), `period` (prefix, e.g. `2023`) | `{deal_id, total, page, page_size, lines: list[RawGLLine-as-dict]}` | 404 not processed |
| GET | `/deals/{deal_id}/gl/validation` | owner | — | `ValidationReport` (debits/credits, `is_balanced`, `unbalanced_periods`, `is_pl_only_export`, `is_mixed_export`, warnings) | 404 not processed |
| GET | `/deals/{deal_id}/gl/periods` | owner | — | `{deal_id, periods: [{period: "YYYY-MM", total_lines, total_debits, total_credits}], total_periods}` | 404 not processed |

## Financial Statements — `financial.py`

| Method | Path | Auth | Query | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/financials/pnl` | owner | `period`: `annual` (roll up to one row per year; summaries keyed `"YYYY"`), `2023` (that year's months), `2023-06` (one month) | `PnLStatement {periods, rows: list[PnLRow], revenue, gross_profit, ebitda, ebit, net_income, gross_margin, ebitda_margin}` | 404 until `financial_builder` runs |
| GET | `/deals/{deal_id}/financials/balance-sheet` | owner | — | `BalanceSheet {periods, rows, total_assets, total_liabilities, total_equity, is_balanced}` | 404 (also for P&L-only exports, which produce no BS) |
| GET | `/deals/{deal_id}/financials/cash-flow` | owner | — | `CashFlowStatement {periods, rows, operating/investing/financing/net_cash_flow, cash_conversion}` | 404 |
| GET | `/deals/{deal_id}/financials/summary` | owner | — | `{deal_id, periods: ["YYYY-MM"], revenue, ebitda (string amounts), ebitda_margin_pct, gross_margin_pct (floats, 1 dp)}` | 404 |

## Quality of Earnings — `qoe.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/qoe` | owner | `QoEReport {reported_ebitda, adjusted_ebitda (per YYYY-MM), ltm_reported, ltm_adjusted, ltm_adjustment_total, adjustments: list[QoEAdjustment], waterfall: list[WaterfallItem], adjustment_count, categories_adjusted}` | 404 until `qoe_engine` runs |
| GET | `/deals/{deal_id}/qoe/adjustments/{adjustment_id}/source` | owner | `{adjustment_id, label, adjustment_amount, source_line_count, gl_lines: list[MappedGLLine]}` — the audit drill-through | 404 report missing / adjustment id unknown / mapped GL missing |

## Red Flags — `redflags.py`

| Method | Path | Auth | Query | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/redflags` | owner | `severity` (comma list of `High,Medium,Low,Informational`), `category` (case-insensitive substring) | `RedFlagReport {deal_id, flags, summary}` — `summary` recomputed over the filtered set | 404 until `redflag_detector` runs |
| GET | `/deals/{deal_id}/redflags/summary` | owner | — | `RedFlagSummary {high, medium, low, informational, total}` (unfiltered) | 404 |

## Working Capital — `nwc.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/nwc` | owner | `NWCReport {status, message, has_ar_aging, has_ap_aging, data_points, pegs, peak/trough, nwc_volatility, ratios (DSO/DPO/DIO/CCC)}` | 404 until `nwc_analyzer` runs |
| GET | `/deals/{deal_id}/commercial` | owner | `CommercialHealthReport {status, revenue_growth_yoy_pct, gross/ebitda_margin_trend_pct, revenue_volatility, seasonality_detected, seasonality_note, unavailable_metrics}` — status is permanently `partial` (no customer-level data) | 404 |

## Net Debt — `net_debt.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/net-debt` | owner | `NetDebtReport {status, period, cash_and_equivalents, current_debt, long_term_debt, total_debt, net_debt, net_debt_to_ebitda, bridge, instruments, instrument_principal_total, reconciliation_variance, reconciliation_note}` | 404 until `net_debt_bridge` runs |

## DCF — `dcf.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/dcf` | owner | `DCFReport {status: complete|skipped|failed, projection_periods, assumptions {discount_rate_annual, terminal_growth_rate_annual}, projected_fcf, pv_of_fcf, sum_pv_of_fcf, terminal_value, pv_of_terminal_value, enterprise_value, limitations}` | 404 until `dcf_engine` runs; `skipped` without management projections |

## Contracts — `contracts.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| POST | `/deals/{deal_id}/contracts/analyze` | owner | `ContractAnalysisReport {status, instruments: list[DebtInstrument], clauses: list[ContractClause], extraction_warnings}` — **synchronous** LLM call (`ContractParserAgent`, Opus 5); also merges debt-schedule CSV instruments | `502 "LLM call failed during contract analysis: …"` on `AgentError` |
| GET | `/deals/{deal_id}/contracts` | owner | `ContractAnalysisReport` | 404 until analyzed |

## Narrative — `narrative.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| POST | `/deals/{deal_id}/narrative/generate` | owner | `NarrativeReport {status: complete|partial|skipped, message, generated_at, sections: list[{section_id, title, content}], figures_used: {name: value}, data_gaps}` — **synchronous** LLM call (`NarrativeDrafterAgent`, Opus 5) | `502` on `AgentError`. Malformed model output degrades to fewer/zero sections rather than erroring. |
| GET | `/deals/{deal_id}/narrative` | owner | `NarrativeReport` | 404 until generated |

## Databook — `databook.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| POST | `/deals/{deal_id}/databook/export` | owner | `.xlsx` bytes, `Content-Disposition: attachment; filename="{deal_name}_FDD_Databook.xlsx"` — tab list in ARCHITECTURE.md §2 | `422` (`DatabookError`, e.g. no QoE report yet); `500 "Databook export failed: …"` on unexpected errors. Writes `access.log` (`export_databook`). |

## Tie-Outs — `tieouts.py`

| Method | Path | Auth | Response | Key errors |
|---|---|---|---|---|
| GET | `/deals/{deal_id}/tie-outs` | owner | `CrossDocumentValidation {deal_id, tie_outs: list[TieOutResult {name, expected, observed, difference, variance_pct, tolerance_pct, status: Pass|Warn|Fail, source_documents}], warnings}` | 404 until ingestion runs |

## Inquiry + Decision Queue — `inquiry.py`

| Method | Path | Auth | Request | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/inquiries` | owner | — | `list[InquiryItem]` | — |
| POST | `/deals/{deal_id}/inquiries` | owner | `InquiryCreate {request ≥1, owner="Unassigned", due_date: str, status="Open", blocking=false}` | `201 InquiryItem` | — |
| PATCH | `/deals/{deal_id}/inquiries/{inquiry_id}` | owner | `InquiryUpdate` (all fields optional) | `InquiryItem` | `404` unknown inquiry |
| DELETE | `/deals/{deal_id}/inquiries/{inquiry_id}` | owner | — | `204` | `404` unknown inquiry |
| GET | `/deals/{deal_id}/decision-queue` | owner | — | `DecisionQueueResponse {deal_id, last_updated, readiness: Ready|Draft|Blocked, items: list[DecisionQueueItem]}` | never 404s for missing reports — each missing source just contributes no items |

`InquiryStatus`: `Open | In Progress | Resolved | Deferred`. Decision
Queue derivation (never persisted): tie-out **Fail**s (impact = variance %,
capped 99), **High** red flags (85), open/in-progress **blocking** inquiries
(75), **missing recommended documents** (60, non-blocking); sorted by
impact. `readiness` = `Blocked` if any blocking item or tie-out fail, else
`Draft` if any tie-out warn or Medium flag, else `Ready`.

## Notes — `notes.py`

| Method | Path | Auth | Request | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/notes` | owner | — | `DealNotes {deal_id, notes: str, report_draft: list[str], updated_at}` — empty defaults if none saved | — |
| PUT | `/deals/{deal_id}/notes` | owner | `DealNotesUpdate {notes, report_draft}` (full replace) | `DealNotes` | — |

## Settings — `settings.py`

| Method | Path | Auth | Request | Response | Key errors |
|---|---|---|---|---|---|
| GET | `/deals/{deal_id}/settings` | owner | — | `DealSettings {materiality_threshold=75000, tie_out_tolerance_pct=0.5, cash_conversion_medium_pct=60, cash_conversion_high_pct=30, cash_conversion_critical_pct=0}` | — |
| PATCH | `/deals/{deal_id}/settings` | owner | `DealSettingsUpdate` (partial; merged onto current) | `DealSettings` | `422` if the merged bands violate `critical ≤ high ≤ medium` (returned as a **string** `detail`, unlike framework 422s) |

Settings take effect on the next pipeline run (they drive tie-out tolerance,
red-flag materiality demotion, and cash-conversion severity).

---

## Next.js Route Handlers (`frontend/app/api/`)

These are served by the Next.js server on port 3000, not FastAPI.

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/inquiry/assistant` | none at the route; forwards the caller's cookie to the backend | `{question: str ≥2, deal?, period?, basis?, dealId?: str|null}` | `{answer: str, mode: "llm"|"fallback", model: str}` | Inquiry Copilot. With `dealId`, snapshots nine real backend endpoints (backend enforces ownership); without, uses mock data. Calls the Anthropic API directly (ARCHITECTURE.md §9.2). Never returns an error status — every failure becomes a `fallback` answer. |
| GET | `/api/deal/summary`, `/api/deal/analysis`, `/api/deal/risk`, `/api/deal/documents`, `/api/deal/customer`, `/api/deal/inquiry`, `/api/deal/decision-queue` | none | query params (deal/period/basis) | mock payloads per `frontend/docs/*.md` / `lib/schemas/types.ts` | **Mock BFF** — synthetic data for the no-deal-selected demo view. Not the real backend contract. |
