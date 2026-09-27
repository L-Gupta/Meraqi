# pipeline/contracts — on-demand contract analysis

**Purpose:** (Re-)extract debt instrument terms and clauses from uploaded PDF agreements, merged with debt-schedule CSV data. **Not a pipeline stage** — triggered by `POST /deals/{id}/contracts/analyze`.

**Contents**
- `orchestrator.py` — `run` (sync wrapper over `_run_async`) → `contract_analysis.json`, and rewrites `debt_instruments.json`; `load_contract_analysis`.
- `pdf_extractor.py` — text extraction from PDF bytes (pdfplumber/pymupdf); raises `PdfExtractorError`.

**How it fits in:** Reads `document_inventory.json` and the encrypted uploads, and calls `agents/contract_parser.py` (Opus 5). Output feeds `/contracts`, net debt, and the databook.

**Gotchas**
- Runs synchronously inside the request — a slow LLM call blocks it; `AgentError` → 502.
- Scanned/image PDFs must produce a visible per-document `extraction_warnings` entry, never fabricated terms (`.claude/rules/scanned-pdfs-fail-loud.md`).
- Ingestion also parses PDFs at upload time; this module is the re-run path.
