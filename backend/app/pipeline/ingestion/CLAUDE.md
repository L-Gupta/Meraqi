# pipeline/ingestion — Stage 1: data-room intake

**Purpose:** Turn uploaded files (GL/TB CSV/XLSX, ZIPs, AR/AP aging, projections, PDF debt agreements, supporting schedules) into validated, typed artifacts under `data/processed/{deal_id}/`. Runs as the `ingestion` stage.

**Contents**
- `orchestrator.py` — stage entry (`run`): classifies every upload, routes it to the right parser, persists all artifacts; `load_document_inventory` / `load_supporting_schedules` for the API.
- `document_registry.py` — classifies files by **content first** (column sets, row labels), filename as fallback; builds `DocumentInventory` incl. `missing_recommended`.
- `loader.py` — reads CSV/XLSX with robust encoding handling; `infer_column_map` guesses GL columns.
- `normalizer.py` — DataFrame → `list[RawGLLine]` (dates, signed Decimal amounts, `source_file`/`source_row`).
- `validator.py` — debit/credit balance checks; detects P&L-only and mixed exports → `ValidationReport`.
- `aging_loader.py`, `aging_normalizer.py` — AR/AP aging column inference → `AgingSummary`.
- `projections_parser.py` — management projections → `ProjectionSchedule` (feeds the DCF).
- `schedule_parser.py` — Group A restatement schedules (BS/IS/CF/revenue/COGS/opex/WC/inventory) → `{label: {YYYY-MM: Decimal}}`.
- `debt_schedule_parser.py` — Group B `debt_schedule.csv` → `DebtInstrument`s, no LLM.
- `supporting_schedule_parser.py` — Group C (lease, fixed assets, equity, payroll, bank) → plain rows, view-only.
- `cross_document_validator.py` — AR/AP-vs-GL tie-outs and Group A reconciliation → `CrossDocumentValidation` (Pass/Warn/Fail at the deal's `tie_out_tolerance_pct`).
- `zip_extractor.py` — safe ZIP extraction; each member re-encrypted before it touches disk.

**How it fits in:** First stage in `STAGE_ORDER`. Everything downstream reads its outputs (`raw_gl.json`, `document_inventory.json`, aging, projections, `debt_instruments.json`, `cross_document_validation.json`, …) — full catalog in `docs/SCHEMA.md` §3.

**Gotchas**
- PDF agreements are parsed here via `ContractParserAgent` (a real LLM call, Opus 5) — ingestion is not LLM-free.
- Digital PDFs only; scanned PDFs must fail loudly per document (`.claude/rules/scanned-pdfs-fail-loud.md`).
- Supporting schedules are reconciled against the GL, **never** used to recompute statements; disagreements surface as tie-outs, never tiebreaks (`.claude/rules/cross-document-disagreement.md`).
- Never write decrypted bytes to disk — decrypt via `file_store.read_upload_decrypted` into `BytesIO`.
