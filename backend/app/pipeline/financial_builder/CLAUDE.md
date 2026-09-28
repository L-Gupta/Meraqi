# pipeline/financial_builder — Stage 3: CoA mapping + statements

**Purpose:** Classify every GL account into the standard taxonomy (via `CoAMapperAgent`) and build P&L, Balance Sheet, and Cash Flow deterministically. Runs as `financial_builder` — which is also where `coa_mapping` actually happens.

**Contents**
- `orchestrator.py` — `run`: unique (code, description) pairs → `CoAMapperAgent` → `_apply_classifications` → `MappedGLLine`s → build + persist statements; `load_mapped_gl` for other modules; re-runs schedule reconciliation against the new statements.
- `pnl.py` — `PnLStatement` via pure Pandas/Decimal aggregation (economic sign convention).
- `balance_sheet.py` — `BalanceSheet`; checks Assets = Liabilities + Equity per period ($0.05 tolerance).
- `cash_flow.py` — indirect-method `CashFlowStatement` from P&L + BS; `cash_conversion` = operating CF / EBITDA.

**How it fits in:** Reads `raw_gl.json`; writes `mapped_gl.json`, `financials_{pnl,bs,cf}.json`. Every later stage (QoE, NWC, net debt, red flags, DCF, narrative) builds on these.

**Gotchas**
- The `coa_mapping` stage in `pipeline_orchestrator.py` is a no-op; mapping only runs here.
- BS and CF are skipped entirely when the GL has no BalanceSheet lines (P&L-only export) — downstream code must tolerate missing `financials_bs.json` / `financials_cf.json`.
- The LLM only picks a category; it never produces an amount.
- Changes here trigger every downstream CI phase ("upstream" path filter), and `tests/conftest.py::shared_mapped_gl` imports `_apply_classifications`.
