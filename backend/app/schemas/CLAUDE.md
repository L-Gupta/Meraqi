# schemas — Pydantic models (the shared vocabulary)

**Purpose:** Every data shape that crosses a boundary — API request/response, agent I/O, and the on-disk JSON of every processed report. One file per domain, mirroring `pipeline/` and `api/v1/`. Field-level map: `docs/SCHEMA.md` §5.

**Contents**
- `gl.py` — `ChartOfAccountsCategory`, `RawGLLine` → `MappedGLLine` (the spine: `line_id`, `source_file`, `source_row`), `ValidationReport`, `EBITDA_COMPONENTS` / `NWC_COMPONENTS`.
- `financials.py` — `PnLStatement`, `BalanceSheet`, `CashFlowStatement` and their rows.
- `qoe.py` — `QoEAdjustment`, `WaterfallItem`, `QoEReport`.
- `redflags.py` — `RedFlag`, `RedFlagSummary`, `RedFlagReport`.
- `nwc.py` — `NWCDataPoint`, `NWCPeg`, `WorkingCapitalRatios`, `NWCReport`, `CommercialHealthReport`.
- `net_debt.py`, `dcf.py`, `contracts.py`, `narrative.py`, `projections.py`, `aging.py` (aging + `TieOutResult`/`CrossDocumentValidation`), `documents.py` (`DocumentType` Groups A/B/C, `DocumentInventory`).
- `ingestion.py` — deal API contracts (`CreateDealRequest`, `DealResponse`, `ProcessRequest`, `ProcessingStage`).
- `auth.py`, `notes.py`, `inquiry.py` (incl. `DecisionQueueItem`), `settings.py` (`DealSettings` + `get_deal_settings`).

**How it fits in:** Imported by every other backend package. Deal and user store records are the only persisted data that are plain dicts rather than models.

**Gotchas**
- Amounts are `Decimal`, serialized as JSON **strings** — never float.
- Changing a persisted model changes the on-disk format of existing deals; there's no migration tooling.
- `schemas/**` is in the CI "shared" path filter — any change triggers every backend phase job.
- The uncommitted QoE branch adds override fields to `qoe.py`; not on `main`.
