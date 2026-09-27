# pipeline/qoe_engine — Stage 4: Quality of Earnings

**Purpose:** Detect non-recurring / non-arm's-length items, have the LLM review them, and compute reported → adjusted EBITDA with a waterfall. Runs as `qoe_engine`.

**Contents**
- `rules.py` — `detect_all`: full add-back rules for Legal Settlements, M&A Transaction Costs, Related-Party Consulting, Restructuring, Other Non-Recurring (`_rule_full_addback`, grouped by period + description), plus `_rule_owner_comp_excess`.
- `orchestrator.py` — `run`: rules → `QoEReviewerAgent` → `normalizer.build_report` → persist `qoe_report.json`; `load_qoe_report`.
- `normalizer.py` — `build_report`: applies adjustments to the per-period EBITDA series (Decimal only), LTM totals, and `_build_waterfall` for the bridge chart.

**How it fits in:** Reads `mapped_gl.json` + `financials_pnl.json`. `qoe_report.json` feeds `/qoe`, red flags (`_rule_one_time_items_present`), the narrative, and is the one report the databook export **requires**.

**Gotchas**
- ⚠️ **Rule violation on `main`, flagged not fixed:** `agents/qoe_reviewer.py` lets the LLM return `decision="modify"` with a `corrected_amount`, which overwrites `adjustment_amount` (leaving `normalized_amount` stale) and flows into adjusted EBITDA. That's an LLM setting a financial figure — against `.claude/rules/llm-usage.md` and PRD §4. Don't build on it.
- Uncommitted work on `feat/qoe-adjustment-override` adds `apply_override()` / `add_manual_adjustment()` here; its amount-overwrite path conflicts with `.claude/rules/engine-numbers-finalized.md` (PHASES.md Phase 2). Not on `main`.
- Every adjustment must cite `source_gl_line_ids` (`.claude/rules/source-traceability.md`); the `/qoe/adjustments/{id}/source` drill-through depends on it.
