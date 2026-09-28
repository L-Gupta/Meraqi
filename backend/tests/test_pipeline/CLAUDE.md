# tests/test_pipeline — pipeline-stage tests

**Purpose:** Test each pipeline stage in isolation against fixture data, mostly with a real LLM call where the stage has one (`integration` tier), plus two full-pipeline `e2e` acceptance tests.

**Contents**
- `test_ingestion.py`, `test_multi_document_ingestion.py`, `test_schedule_ingestion.py` — GL loading/normalizing/validation, data-room routing, Group A/B/C schedule classification + reconciliation.
- `test_cross_document_validator.py` (`unit`) — tie-out math.
- `test_financial_builder.py` — CoA mapping + P&L/BS/CF (uses `shared_mapped_gl`).
- `test_qoe_and_redflags.py`, `test_redflag_settings.py` (`unit`) — QoE rules/review, red flag rules, settings-driven materiality and cash-conversion bands.
- `test_nwc_analyzer.py`, `test_net_debt_and_dcf.py` — NWC/commercial health, net debt bridge, DCF.
- `test_contract_parser.py`, `test_contract_analysis.py` — PDF extraction + contract agent (one accepted-flaky test via `pytest-rerunfailures`).
- `test_narrative_drafter.py` — narrative grounding (tolerates 0–5 well-formed sections).
- `test_databook.py` — every databook tab renders, and optional tabs omit cleanly.
- `test_golden_path.py`, `test_e2e_edge_cases.py` — `e2e`: full pipeline over HTTP; manual only.

**How it fits in:** Each file maps to one CI phase job (`docs/TESTING.md` §5).

**Gotchas**
- Reuse the session-scoped `shared_mapped_gl` fixture instead of re-running CoA mapping; treat its lines as read-only.
- Assert structure, not LLM phrasing.
- A new test file must be added to the matching `ci.yml` job, or CI never runs it.
