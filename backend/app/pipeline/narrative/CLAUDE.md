# pipeline/narrative — Stage 9: narrative drafting

**Purpose:** Build a fact sheet of already-computed figures and have `NarrativeDrafterAgent` phrase 5 report sections around it. Runs as `narrative_drafter`, or on demand via `POST /narrative/generate`.

**Contents**
- `orchestrator.py` — `run` → `narrative_report.json` (sections + `figures_used` + `data_gaps`); `load_narrative_report`.

**How it fits in:** Reads the QoE, red flag, NWC, and net debt reports. Output feeds `junior-analyst-report.tsx` (view + PDF export) and the databook Narrative tab.

**Gotchas**
- The agent never sees raw GL and never does arithmetic; `figures_used` is the audit trail — keep it verbatim.
- Model output often drifts from the tool schema; malformed sections degrade to fewer/zero sections rather than failing.
- The 5 sections are a starting point, not the IAR spec (PHASES.md Phase 4).
- `narrative_drafter` is missing from `deal_store`'s initial `stages` dict and `progress_pct` math.
