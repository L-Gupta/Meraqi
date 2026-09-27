# tests/fixtures — test input data

**Purpose:** Committed input files for automated tests (manual-upload samples live in `backend/test-docs/` instead) plus the scripts that generated them. All data is synthetic, for Acme Manufacturing Co., Jan 2022 – Dec 2024.

**Contents**
- `sample_gl.csv` — the core raw GL (P&L + BS rows); input to `shared_mapped_gl`.
- `sample_ar_aging.csv`, `sample_ap_aging.csv`, `mismatched_ar_aging.csv` (forces a tie-out Fail), `sample_projections.csv`, `sample_payroll_schedule.csv`.
- Schedule files — `*_monthly.csv`, `cash_flow_statement.csv`, `revenue/cogs/opex/working_capital/lease/debt_schedule.csv`, `inventory_rollforward.csv`, `fixed_asset_register.csv`, `equity_rollforward_cap_table.csv`, `bank_statement_cashbook.csv` — Group A/B/C inputs for `test_schedule_ingestion.py`.
- `unbalanced_trial_balance.csv`, `synthetic_edge_case.csv`, `ABC_Subsidiary.xlsx` — validator and edge-case paths.
- `Credit_Agreement_FNB.pdf` (digital debt agreement), `corrupt_agreement.pdf` (fail-loud path), `data_room.zip` (multi-document upload).
- `generate_*.py` — regenerate the above (fixtures, ABC xlsx, credit agreement PDF, data-room ZIP, edge case).
- `financial_statements/` — three schedule packages (`proper`, `anomaly`, `anomaly_deep`) with their own `README.md`; not currently referenced by any test.

**How it fits in:** Read by `tests/test_pipeline` and `tests/test_api`.

**Gotchas**
- Changing `sample_gl.csv` changes the input to the one memoized real LLM call and every consumer's expected numbers.
- Regenerate with the scripts rather than hand-editing when a generator exists.
