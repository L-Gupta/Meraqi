# pipeline/dcf_engine — Stage 8: simple DCF cross-check

**Purpose:** A deliberately simple, disclosed DCF from management projections — a directional cross-check, not a valuation model. Runs as `dcf_engine`.

**Contents**
- `orchestrator.py` — `run` → `dcf_report.json`; `load_dcf_report`.

**How it fits in:** Reads `management_projections.json`. Feeds `/dcf`, the dashboard Enterprise Value highlight, and the databook.

**Gotchas**
- FCF = EBITDA − capex (no tax/NWC); default 12% discount / 2% terminal growth, not a deal WACC. Every simplification must stay listed in `limitations` — the UI shows them next to EV.
- `status="skipped"` when no projections were uploaded.
