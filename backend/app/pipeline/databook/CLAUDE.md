# pipeline/databook — Excel databook export

**Purpose:** Assemble every persisted report into one `.xlsx` workbook. **Not a pipeline stage** — built on demand by `POST /deals/{id}/databook/export`.

**Contents**
- `generator.py` — `generate(deal_id) -> bytes`. Tabs: Cover, QoE Waterfall, Adjustment Ledger, GL Mapping, P&L, Balance Sheet, Cash Flow, NWC Trend, NWC Pegs, Net Debt, Debt Instruments, DCF, Commercial Health, Contracts, Narrative, AR Aging, AP Aging, Tie-outs, IRL.

**How it fits in:** Read-only consumer of `data/processed/{deal_id}/*`. The API route logs each export to `access.log`.

**Gotchas**
- Only `qoe_report.json` is required (`DatabookError` → 422). Every other tab is omitted with a warning if its source is missing — keep new tabs gracefully optional.
- The Contracts tab is usually absent (contract analysis is manually triggered).
