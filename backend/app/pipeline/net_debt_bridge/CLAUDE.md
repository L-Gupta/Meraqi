# pipeline/net_debt_bridge — Stage 6: net debt

**Purpose:** Net debt (cash, current/long-term debt) computed purely from balance-sheet Decimals, with contract-extracted instrument detail shown alongside. Runs as `net_debt_bridge`.

**Contents**
- `orchestrator.py` — `run` → `net_debt_report.json`; `load_net_debt_report`.

**How it fits in:** Reads `financials_bs.json`, the P&L (for net debt / EBITDA), and `debt_instruments.json`. Feeds `/net-debt`, red flags (`_rule_net_debt_reconciliation_mismatch`), the narrative, and the databook.

**Gotchas**
- Instrument principal is **never** used to recompute totals. A gap vs. the balance sheet is reported as `reconciliation_variance` / `reconciliation_note` and becomes a red flag — a signal, not a tiebreak (`.claude/rules/cross-document-disagreement.md`).
