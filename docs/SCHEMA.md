# SCHEMA.md — Persisted Data, Storage Layout, and Background Tasks

> Written 2026-09-27 from `backend/app/storage/*`, `backend/app/schemas/*`,
> `backend/app/config.py`, `backend/app/pipeline_orchestrator.py`, and every
> pipeline orchestrator's read/write calls on `main` (`8b00867`).

## 0. There is no Postgres, Redis, or Celery

**None of these exist in the codebase** — no ORM, no migrations, no Redis
client, no Celery app, no queue definitions, no connection settings in
`config.py` or `pyproject.toml`. `plan.txt` named them as an early cloud
design; they were never built (ARCHITECTURE.md §2, `.claude/rules/backend-stack.md`). This file
documents what actually plays each role:

| Role you'd expect | What TAM actually uses | Section |
|---|---|---|
| Postgres tables / rows | One AES-256-GCM-encrypted JSON file per entity under `data/`, accessed only via `app/storage/*_store.py` | §1–§2 |
| Relationships / foreign keys | String IDs stored in records (`owner_user_id`, `deal_id`), enforced in code (`require_deal_owner`), not by constraints | §2 |
| Redis keys | Filesystem paths — `data/<entity>/<id>.json`, `data/processed/<deal_id>/<report>.json` | §1, §3 |
| Celery tasks / queues | FastAPI `BackgroundTasks` running `pipeline_orchestrator.run()` in the API process; no queue, no broker, no worker, no retry | §4 |

The storage modules are the designated swap seam if a real DB/queue is
ever introduced — see [DECISIONS.md](DECISIONS.md).

## 1. On-disk layout

All paths are relative to the backend's launch directory (normally
`backend/`), configurable via env vars in `config.py`, and created at
startup. The whole tree is gitignored (`backend/data/`).

```
data/
├── users/{user_id}.json                 encrypted  — user record (§2.1)
├── deals/{deal_id}.json                 encrypted  — deal record (§2.2)
├── notes/{deal_id}.json                 encrypted  — DealNotes (§2.3)
├── inquiries/{deal_id}.json             encrypted  — list[InquiryItem] (§2.4)
├── uploads/{deal_id}/{filename}         encrypted  — raw uploaded bytes; ZIP
│                                                     members extracted here,
│                                                     each encrypted
├── processed/{deal_id}/{report}.json    encrypted  — pipeline outputs (§3)
├── dev_outbox/{timestamp}__{to}.txt     PLAINTEXT  — password-reset emails when
│                                                     SMTP_HOST is unset (dev only)
└── access.log                           PLAINTEXT  — JSON-lines document-access
                                                      audit log (SECURITY.md §6)
```

| Env var | Default |
|---|---|
| `USER_STORE_DIR` | `data/users` |
| `DEAL_STORE_DIR` | `data/deals` (`access.log` is written to its parent) |
| `NOTES_DIR` | `data/notes` |
| `INQUIRIES_DIR` | `data/inquiries` |
| `UPLOAD_DIR` | `data/uploads` |
| `PROCESSED_DIR` | `data/processed` |
| `DEV_EMAIL_OUTBOX_DIR` | `data/dev_outbox` |

Encrypted files use the wire format `nonce (12 bytes) || ciphertext+GCM tag`
under the single `FILE_ENCRYPTION_KEY`. JSON writes are atomic (temp file +
`os.replace`) via `storage/json_io.py`. Upload writes (`file_store.save_upload`)
are a direct `write_bytes` of the encrypted blob — not temp-file atomic.

## 2. Entity stores

### Relationships

```
User (users/{id}.json)
 └─1:N─ Deal (deals/{deal_id}.json)           via deal.owner_user_id == user.id
          ├─1:1─ DealNotes   (notes/{deal_id}.json)
          ├─1:N─ InquiryItem (inquiries/{deal_id}.json — one file, JSON array)
          ├─1:N─ Upload      (uploads/{deal_id}/*; also listed in deal.uploaded_files)
          └─1:N─ Report      (processed/{deal_id}/*.json — §3)
```

Exactly one owner per deal; no sharing, teams, or roles. No cascading
deletes exist at the API level (`file_store.delete_deal_files` exists but
no endpoint calls it). Lookups by anything other than ID are full directory
scans (users by email or reset-token hash; deals by owner) — O(n), fine at
POC scale, flagged in SECURITY.md §9.

### 2.1 User — `storage/user_store.py` (plain dict, not a Pydantic model)
| Field | Type | Notes |
|---|---|---|
| `id` | str (UUID4) | primary key; filename |
| `email` | str | stripped + lowercased; uniqueness enforced by a scan at signup, not a constraint |
| `hashed_password` | str | Argon2id encoded hash |
| `full_name` | str | |
| `created_at`, `updated_at` | ISO 8601 str (UTC) | |
| `reset_token_hash` | str \| null | SHA-256 hex of the raw reset token |
| `reset_token_expires_at` | ISO 8601 str \| null | now + 1 h |

API projection: `UserPublic {id, email, full_name, created_at}` — has no
`hashed_password` field at all.

### 2.2 Deal — `storage/deal_store.py` (plain dict)
| Field | Type | Notes |
|---|---|---|
| `deal_id` | str (UUID4) | primary key; filename |
| `owner_user_id` | str | the "foreign key" to User; checked by `require_deal_owner` |
| `company_name`, `deal_name` | str | |
| `currency` | str | ISO 4217-shaped, default `USD` |
| `created_at`, `updated_at` | ISO 8601 str | |
| `stages` | dict[str, `pending`\|`running`\|`complete`\|`failed`] | initialized with 8 stages — **`narrative_drafter` is not in the initial dict** (added when first run) |
| `progress_pct` | int | `complete` count / 8 × 100, over the same 8 stages (excludes `narrative_drafter`) |
| `uploaded_files` | list of `{filename, stored_path, size_bytes, uploaded_at}` | appended per upload and per extracted ZIP member |
| `error` | str \| null | last pipeline failure message |
| `settings` | `DealSettings` as dict | defaults applied at creation; see §5 |

### 2.3 DealNotes — `storage/note_store.py`
`{deal_id, notes: str, report_draft: list[str], updated_at}`. One free-text
blob plus the report-draft snippet list; no per-note IDs or authors. `PUT`
fully replaces it.

### 2.4 InquiryItem — `storage/inquiry_store.py`
The whole list for a deal lives in one file. Item:
`{id, deal_id, request, owner, due_date: str, status: Open|In Progress|Resolved|Deferred, blocking: bool, created_at, updated_at}`.

### 2.5 Derived, never persisted
- **Decision Queue** (`GET /decision-queue`) — rebuilt on every request from
  tie-outs, red flags, document inventory, and blocking inquiries (API.md).
- **Red-flag summary with filters** and **annual P&L rollup** — computed per
  request from persisted reports.

## 3. Processed-report catalog — `data/processed/{deal_id}/`

Each stage writes its outputs here before the next stage starts. File
names are per report, **not** `{stage_name}.json`. Every file is
encrypted JSON produced from a Pydantic model's `model_dump(mode="json")`
(except the two marked *dict*), so downstream readers re-validate with the
same model.

| File | Written by (stage) | Schema | Read by |
|---|---|---|---|
| `document_inventory.json` | `ingestion` | `DocumentInventory` | `/documents`, decision queue, contracts, assistant |
| `raw_gl.json` | `ingestion` | `list[RawGLLine]` | `/gl/lines`, `/gl/periods`, `financial_builder` |
| `validation_report.json` | `ingestion` | `ValidationReport` | `/gl/validation` |
| `ar_aging.json`, `ap_aging.json` | `ingestion` (if aging uploaded) | `AgingReport` | NWC, tie-outs, databook |
| `management_projections.json` | `ingestion` (if uploaded) | `ProjectionSchedule` | `dcf_engine` |
| `debt_instruments.json` | `ingestion` (PDF agreements via `ContractParserAgent`, debt-schedule CSVs); rewritten by `POST /contracts/analyze` | `DebtSchedule` | `net_debt_bridge`, contracts |
| `cross_document_validation.json` | `ingestion`; updated by `financial_builder` | `CrossDocumentValidation` | `/tie-outs`, red flags, decision queue |
| `schedule_reconciliation.json` | `ingestion`; updated by `financial_builder` | *dict* | tie-outs |
| `supporting_schedules.json` | `ingestion` | *dict* `{doc_type: list[row]}` | `/supporting-schedules` |
| `mapped_gl.json` | `financial_builder` (runs CoA mapping via `CoAMapperAgent`) | `list[MappedGLLine]` | QoE drill-through, databook |
| `financials_pnl.json` | `financial_builder` | `PnLStatement` | `/financials/pnl`, `/summary`, QoE, NWC, … |
| `financials_bs.json` | `financial_builder` (skipped for P&L-only exports) | `BalanceSheet` | `/financials/balance-sheet`, NWC, net debt |
| `financials_cf.json` | `financial_builder` (skipped for P&L-only exports) | `CashFlowStatement` | `/financials/cash-flow` |
| `qoe_report.json` | `qoe_engine` (LLM review via `QoEReviewerAgent`) | `QoEReport` | `/qoe`, narrative, databook (required) |
| `nwc_report.json`, `commercial_report.json` | `nwc_analyzer` | `NWCReport`, `CommercialHealthReport` | `/nwc`, `/commercial` |
| `net_debt_report.json` | `net_debt_bridge` | `NetDebtReport` | `/net-debt`, red flags, narrative |
| `redflag_report.json` | `redflag_detector` (enrichment via `RedFlagAnalystAgent`) | `RedFlagReport` | `/redflags`, decision queue, narrative |
| `dcf_report.json` | `dcf_engine` | `DCFReport` | `/dcf` |
| `narrative_report.json` | `narrative_drafter` stage **or** `POST /narrative/generate` (`NarrativeDrafterAgent`) | `NarrativeReport` | `/narrative`, databook |
| `contract_analysis.json` | `POST /contracts/analyze` only (not a pipeline stage) | `ContractAnalysisReport` | `/contracts`, databook |

Re-running a stage overwrites its files. Nothing checks whether a file
already exists before recomputing, and there's no staleness tracking
between reports (e.g. `qoe_report.json` isn't invalidated when
`financials_pnl.json` is rewritten).

## 4. Background tasks (the Celery-equivalent)

### 4.1 Pipeline run
- **Trigger:** `POST /deals/{deal_id}/process` →
  `background_tasks.add_task(pipeline_orchestrator.run, deal_id, stages)`.
  Runs in the same Uvicorn process after the response is sent.
- **"Queue":** none. Concurrency guard: the endpoint returns `409` if any
  requested stage is currently `running` for that deal. Two different deals
  can run concurrently.
- **Stage order (`STAGE_ORDER`):** `ingestion` → `coa_mapping` →
  `financial_builder` → `qoe_engine` → `nwc_analyzer` → `net_debt_bridge` →
  `redflag_detector` → `dcf_engine` → `narrative_drafter`. Requested stages
  run **in the order the caller lists them**; unknown names are skipped
  with a warning. (Omitting `stages` runs `STAGE_ORDER`.)
- **`coa_mapping`** has no implementation of its own — mapping happens
  inside `financial_builder`. Requested without `financial_builder`, it's a
  logged no-op that still reports `complete`.
- **Status transitions (per stage, in the deal record):** `pending` (set by
  the endpoint for every requested stage) → `running` → `complete` |
  `failed`. On the first failure the run stops; `deal.error` gets the
  message. Later stages stay `pending`.
- **Durability:** none. A process restart mid-run leaves stages stuck at
  `running` (which also blocks re-triggering those stages with `409`) until
  the deal record is edited. No retry, no resume, no checkpoint reuse.
- **LLM calls inside the run:** CoA mapping (`financial_builder`), QoE
  review (`qoe_engine`), red-flag enrichment (`redflag_detector`), PDF
  contract parsing (`ingestion`), narrative drafting (`narrative_drafter`).
  Each goes through `BaseAgent` retry/backoff (ARCHITECTURE.md §9.1).

### 4.2 Synchronous LLM operations (not background)
`POST /contracts/analyze` and `POST /narrative/generate` run inside the
request (FastAPI threadpool, `asyncio.run` of the async agent) and return
the report directly.

## 5. Core domain models (`backend/app/schemas/`)

The field-level truth is the Pydantic source; this is the map.

- **RawGLLine → MappedGLLine** (`gl.py`) — the spine. Every line carries
  `line_id` (UUID, the audit key), `period` (first of month), `account_code`,
  `account_description`, `amount` (Decimal), `source_file` + `source_row`.
  `MappedGLLine` adds `standard_category` (`ChartOfAccountsCategory`
  enum), `financial_statement` (`PnL`/`BalanceSheet`/`Memo`),
  `is_ebitda_component`, `is_nwc_component`, and mapping provenance
  (`mapping_source`: `llm`/`rule`/`manual`, `mapping_confidence`,
  `mapping_reasoning`).
- **PnLStatement / BalanceSheet / CashFlowStatement** (`financials.py`) —
  per-period rows + per-period summary maps.
- **QoEAdjustment** (`qoe.py`) — `direction` (`add_back`/`deduction`),
  `reported_amount`, `adjustment_amount` (always positive),
  `normalized_amount`, `source_gl_line_ids`, `detection_method`
  (`rule`/`llm`/`manual`), `rule_triggered`, LLM review fields,
  `analyst_approved` (default `True`). The uncommitted QoE branch adds
  `override_reason`/`overridden_by`/`overridden_at` (not on `main`).
  **WaterfallItem** links bars to `adjustment_ids`.
- **RedFlag** (`redflags.py`) — `severity` (`High`/`Medium`/`Low`/
  `Informational`), `category`, `title` (≤100 chars), `description`,
  `financial_impact_low/high`, `affected_periods`, `source`
  (`rule_engine`/`llm_analysis`/`contract_parser`/`manual`), `rule_id`,
  `source_gl_line_ids` / `source_document`, `diligence_questions`.
- **NWCDataPoint / NWCPeg / WorkingCapitalRatios / CommercialHealthReport**
  (`nwc.py`).
- **DebtInstrument / ContractClause / ContractAnalysisReport**
  (`contracts.py`); **NetDebtReport** (`net_debt.py`); **DCFReport**
  (`dcf.py`).
- **AgingSummary / TieOutResult / CrossDocumentValidation** (`aging.py`).
- **DocumentType / DocumentRecord / DocumentInventory** (`documents.py`) —
  see GLOSSARY.md for document Groups A/B/C.
- **NarrativeReport** (`narrative.py`) — 5 `SectionId`s
  (`executive_summary`, `key_risks`, `qoe_highlights`, `working_capital`,
  `recommendations`), plus `figures_used` (the grounding trail) and
  `data_gaps`.
- **DealSettings** (`settings.py`) — `materiality_threshold` (75,000),
  `tie_out_tolerance_pct` (0.50), `cash_conversion_{medium,high,critical}_pct`
  (60/30/0) with an ordering validator.

### Serialization rules
Amounts are `Decimal` in Python and JSON **strings** on disk and on the
wire; ratios are floats; dates are ISO 8601; period keys are `"YYYY-MM"`
(`"YYYY"` for annual rollups).
