# pipeline/redflag_detector — Stage 7: red flags

**Purpose:** Deterministic, rule-based red flag detection over the computed statements, then LLM enrichment (context + diligence questions) for High/Medium flags. Runs as `redflag_detector`.

**Contents**
- `rules.py` — `detect_all` plus rules: EBITDA margin decline, owner comp high, related-party material, one-time items present, EBITDA volatility, AR days high, deferred revenue decline, low cash conversion (3-band graduated), NWC volatility, revenue seasonality, cross-doc tie-out failures, net-debt reconciliation mismatch. `_apply_materiality_demotion` demotes (never drops) sub-materiality flags to Informational.
- `orchestrator.py` — `run`: loads statements, QoE, NWC, net debt, tie-outs, and deal settings → rules → `RedFlagAnalystAgent.enrich` (High/Medium only, concurrent) → sort by severity → persist `redflag_report.json`; `load_redflag_report`.

**How it fits in:** Runs after QoE, NWC, and net debt because it consumes all three. Feeds `/redflags`, the decision queue (High flags), and the narrative.

**Gotchas**
- No general outlier/plausibility rule exists — every rule is a named-category threshold (the "$1M water" gap, PHASES.md Phase 3).
- The LLM only adds prose (`llm_context`, `diligence_questions`, a string `impact_narrative`); `financial_impact_low/high` come from the rules.
- Low/Informational flags get no enrichment at all.
- Every flag needs `source_gl_line_ids` or `source_document` (`.claude/rules/source-traceability.md`).
