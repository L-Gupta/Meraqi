# Test Documents — Meraqi FDD Engine

Ready-to-upload sample files for **manual** testing of the FDD pipeline
through the UI or `/docs`. All files represent **Acme Manufacturing Co.**
across a 36-month period (Jan 2022 – Dec 2024).

Automated tests don't read this folder — they use `backend/tests/fixtures/`
(including `data_room.zip` for multi-document ingestion). See
[`docs/TESTING.md`](../../docs/TESTING.md).

---

## Folder Structure

All 23 files sit directly in `test-docs/` — there are no subfolders. The
groupings below are for reading convenience only.

```
test-docs/
├── README.md
├── gl_acme_manufacturing.csv / .xlsx, gl_edge_cases.csv      General ledger
├── trial_balance_balanced.csv, trial_balance_unbalanced.csv  Trial balance
├── balance_sheet_monthly.csv, income_statement_monthly.csv,
│   cash_flow_statement.csv                                   Statement schedules
├── ar_aging_{summary,detailed}.csv, ap_aging_{summary,detailed}.csv
└── *_schedule.csv, *_register.csv, *_rollforward*.csv,
    payroll_headcount.csv, bank_statement_cashbook.csv        Supporting schedules
```

There is no pre-built data-room ZIP in this folder. To test multi-document
upload, select several files at once in the upload page, or zip any subset
yourself — the pipeline classifies each file by content.

---

## Files at a Glance

### General ledger
| File | Description |
|------|-------------|
| `gl_acme_manufacturing.csv` | 1,514-row GL — P&L entries + Balance Sheet snapshots, 36 monthly periods |
| `gl_acme_manufacturing.xlsx` | Excel version of the same GL (identical content) |
| `gl_edge_cases.csv` | GL with synthetic edge cases — tests validation and normalisation edge paths |

### Trial balance
| File | Description |
|------|-------------|
| `trial_balance_balanced.csv` | Balanced trial balance — debits = credits |
| `trial_balance_unbalanced.csv` | Intentionally unbalanced — use to test the validator error path |

### Statement schedules
These are classified as supporting schedules (Group A) and **reconciled**
against the GL-derived statements as tie-outs — they don't replace them.

| File | Description |
|------|-------------|
| `balance_sheet_monthly.csv` | Monthly BS schedule, 36 periods; Assets = Liabilities + Equity per period |
| `income_statement_monthly.csv` | Monthly P&L; Revenue, COGS, Gross Profit, OpEx, EBITDA |
| `cash_flow_statement.csv` | Monthly cash flow; Operating, Investing, Financing sections |

### AR / AP aging
| File | Description |
|------|-------------|
| `ar_aging_summary.csv` | Single-row AR summary by aging bucket (0–30, 31–60, 61–90, 90+) |
| `ar_aging_detailed.csv` | Detailed AR aging by customer and invoice number |
| `ap_aging_summary.csv` | Single-row AP summary by aging bucket |
| `ap_aging_detailed.csv` | Detailed AP aging by vendor and invoice |

### Supporting schedules
| File | Description | How the pipeline uses it |
|------|-------------|---|
| `revenue_schedule.csv` | Revenue by GL account | Reconciled (Group A) |
| `cogs_schedule.csv` | Cost of Goods Sold breakdown | Reconciled (Group A) |
| `opex_schedule.csv` | Operating Expense schedule | Reconciled (Group A) |
| `working_capital_schedule.csv` | NWC peg components | Reconciled (Group A) |
| `inventory_rollforward.csv` | Inventory movement by period | Reconciled (Group A) |
| `debt_schedule.csv` | Debt instruments, balances, and interest | Parsed into debt instruments (Group B) |
| `lease_schedule.csv` | Lease obligations (ASC 842 / IFRS 16 style) | Viewable only (Group C) |
| `fixed_asset_register.csv` | Fixed assets, depreciation, NBV | Viewable only (Group C) |
| `equity_rollforward_cap_table.csv` | Equity rollforward and cap table | Viewable only (Group C) |
| `payroll_headcount.csv` | Payroll and headcount by department | Viewable only (Group C) |
| `bank_statement_cashbook.csv` | Bank statement / cashbook reconciliation | Viewable only (Group C) |

Groups are defined in [`docs/GLOSSARY.md`](../../docs/GLOSSARY.md).

---

## How to Use

Every deal endpoint requires a signed-in session, so start from the UI (or
sign up/log in via `/docs` first so the browser holds the `tam_session`
cookie).

**Via the UI (simplest):**
1. Start the stack (`start.bat`, or see the root README).
2. Sign up at `http://localhost:3000/signup` — you land on `/upload`.
3. Create a deal, select files from this folder, and start processing.

**Via the API (`http://localhost:8000/docs`):**
1. `POST /api/v1/auth/signup` (or `/login`) — sets the session cookie.
2. `POST /api/v1/deals` to create a deal.
3. `POST /api/v1/deals/{id}/upload` with one or more files.
4. `POST /api/v1/deals/{id}/process`, then poll `GET /api/v1/deals/{id}/status`.

**Multi-document test:** upload the GL plus aging, statement schedules, and
supporting schedules together — each file is classified and ingested in a
single pass; check `GET /api/v1/deals/{id}/documents` and `/tie-outs`.

**Error path testing:** upload `trial_balance_unbalanced.csv` — the validator
report (`GET /api/v1/deals/{id}/gl/validation`) should show
`is_balanced: false` with details.
