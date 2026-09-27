# backend/app/pipeline — deterministic computation

**Purpose:** Where every financial figure is computed — Python `Decimal` + Pandas, one subpackage per stage, each with an `orchestrator.py` entry point that reads and writes encrypted reports under `data/processed/{deal_id}/`. Agents are called from here for semantic help only.

**Contents** (details in each subfolder's `CLAUDE.md`)

Pipeline stages, in `STAGE_ORDER` (sequenced by `app/pipeline_orchestrator.py`):
1. `ingestion/` — classify + parse every upload; GL validation; aging, projections, debt schedules; cross-document tie-outs. (Also parses PDF agreements via the contract-parser LLM.)
2. `coa_mapping` — no folder; it's a no-op stage, since mapping runs inside `financial_builder`.
3. `financial_builder/` — CoA mapping (LLM picks categories) → P&L, Balance Sheet, Cash Flow.
4. `qoe_engine/` — add-back rules → LLM review → reported → adjusted EBITDA + waterfall.
5. `nwc_analyzer/` — NWC series, pegs, DSO/DPO/DIO, commercial health.
6. `net_debt_bridge/` — net debt from the balance sheet; contract detail alongside, never recomputing totals.
7. `redflag_detector/` — named-category threshold rules → LLM enrichment for High/Medium.
8. `dcf_engine/` — simple disclosed DCF cross-check from projections.
9. `narrative/` — fact sheet of computed figures → LLM prose (`figures_used` audit trail).

On-demand, not stages: `contracts/` (POST `/contracts/analyze`, re-extracts PDF terms) and `databook/` (POST `/databook/export`, 19-tab Excel).

**How it fits in:** Called by `pipeline_orchestrator.run()` (as a `BackgroundTask`) or directly by `api/v1` routers for on-demand work. Reads/writes only via `storage/`; calls LLMs only via `agents/`. Report catalog: `docs/SCHEMA.md` §3.

**Gotchas**
- Only arithmetic lives here, and all of it is deterministic — no LLM may produce or alter a number (`.claude/rules/llm-usage.md`). ⚠️ `qoe_engine` currently violates this through `agents/qoe_reviewer.py`'s `modify` path (flagged, not fixed).
- Engine output is final — no overwrite paths (`.claude/rules/engine-numbers-finalized.md`); the uncommitted QoE override branch conflicts with this.
- Every QoE adjustment / red flag must cite a source (`.claude/rules/source-traceability.md`); cross-document disagreements are surfaced, never resolved by picking a winner.
- Stages always recompute — no checkpoint reuse or resume exists (open decision in PHASES.md). BS/CF-dependent stages must tolerate P&L-only deals.
- No general outlier red flag rule yet (PHASES.md Phase 3).
