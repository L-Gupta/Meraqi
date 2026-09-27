# pipeline/nwc_analyzer — Stage 5: working capital + commercial health

**Purpose:** Monthly NWC series, peg candidates, DSO/DPO/DIO/CCC, and commercial-health metrics (growth, margin trend, volatility, seasonality) — all deterministic. Runs as `nwc_analyzer`.

**Contents**
- `orchestrator.py` — `run` → `nwc_report.json` + `commercial_report.json`; `load_nwc_report`, `load_commercial_report`.

**How it fits in:** Reads the balance sheet (NWC components per `schemas/gl.py::NWC_COMPONENTS`), P&L, and aging. Feeds `/nwc`, `/commercial`, red flags (NWC volatility), the narrative, and the databook.

**Gotchas**
- Needs a balance sheet; P&L-only deals get a `skipped`/`partial` report.
- `CommercialHealthReport.status` is permanently `partial` — customer-level metrics need invoice data TAM doesn't ingest.
