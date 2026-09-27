# TAM — Product Requirements Document

> Status: living document, first drafted 2026-08-10 by Claude Code from a full repo
> read (README, STATUS.md, STEPS.md, plan.txt, session.md, backend API routers,
> frontend routes, `frontend/docs/*`) plus direct clarification from the product
> owner (Lakshya Gupta). Supersedes `STEPS.md` as the source of product intent —
> `STEPS.md` was a build-order tracker for the original 8-step implementation
> and is being retired/rewritten in a follow-up session. Where this document
> disagrees with comments or naming still in the codebase (e.g. "Junior Analyst
> Report"), this document is correct and the code should eventually be
> relabeled to match.
>
> Refreshed 2026-09-27 against `main` as of PR #29: narrative frontend
> wiring/PDF export marked complete, statement-builder path and databook tab
> list corrected, test-tier wording aligned with `.claude/rules/testing.md`, and the
> nonexistent nightly e2e run removed. The analyst-override conflict (§3.1,
> Flow 2) is deliberately **not** resolved here — see the notes in place.

## 1. Product Summary

TAM is a financial due-diligence engine for M&A Transaction Advisory Services
(TAS) teams. A team uploads a client's raw data room — general ledger
exports, trial balances, AR/AP aging, sales registers, debt agreements — and
TAM normalizes the data, builds GAAP-consistent financial statements,
computes a Quality-of-Earnings (QoE) adjustment waterfall, detects red flags
(accounting anomalies, concentration risk, related-party exposure, data
inconsistencies across source documents), and drafts a real deliverable: an
**Independent Accountant's Report (IAR)** — the standard TAS output a firm
hands to its client, not an internal summary memo. The core problem TAM
solves is that QoE/FDD work is currently slow, manual, and repetitive
(reconciling messy exports, mapping accounts, spotting anomalies across
hundreds of GL lines) — TAM automates the mechanical part while keeping every
number traceable to its source, so a human reviewer can always answer "where
did this number come from?" Determinism is a hard product constraint: all
financial arithmetic is Python/Decimal, never an LLM; LLMs are used only for
semantic tasks (chart-of-accounts mapping, red-flag enrichment/diligence
questions, contract clause extraction, narrative drafting) and never touch a
number that ends up on a financial statement.

## 2. Target Users

**Confirmed (from product owner, 2026-08-10):** TAM is built for Big 4-style
M&A Transaction Advisory Services teams (e.g. EY, KPMG, Deloitte, PwC, and
comparable independent/boutique advisory shops). The primary hands-on user is
a **junior analyst** on a TAS engagement — the person who today manually
reconciles the data room, builds the QoE waterfall, and drafts the first pass
of the IAR for a senior reviewer. TAM's job is to do that first pass for them:
ingest the data room, surface every red flag a manual review would have
caught, and generate an IAR draft with supporting graphs that the analyst
(and eventually a senior manager/partner) reviews and signs off on, rather
than builds from scratch.

**Inferred, not yet confirmed — flagged for a later pass:**
- **Senior manager / partner reviewer** — the person who reviews and approves
  the analyst's IAR draft before it goes to the client. The QoE adjustment
  override fields currently being added (`override_reason`, `overridden_by`,
  `overridden_at` — see uncommitted work on `feat/qoe-adjustment-override`)
  imply a reviewer role distinct from the analyst who ran the pipeline, but no
  role/permission model beyond single-owner-per-deal exists yet in `auth.py`.
- **End client (the acquirer, or their deal team)** — the ultimate consumer of
  the IAR, but not a TAM login today.

**Explicitly out of scope for now (see §4 Non-Goals):** external counsel,
sell-side/target-company users, and any user outside the advisory firm itself
do not get TAM access in the current or near-term model.

## 3. Core Features

Grouped by priority, cross-checked against `backend/app/api/v1/`,
`backend/app/pipeline/`, and `frontend/app/` as of this session. "Built"
means real backend computation wired to a real frontend view — not mock BFF
data (the mock `/api/deal/*` routes remain only as a no-deal-selected demo
and are called out separately).

### 3.1 MVP — Must-Have

The product owner's MVP bar, in their own words: *ingest ~20 documents for an
FDD engagement, every number shown on screen must be 100% accurate — no false
reports or hallucinated numbers — and the AI agents must be able to generate
an accurate IAR with graphs, plus surface real red flags when numbers don't
reconcile across documents or look implausible on their face (e.g. owner
comp far above market, a line item priced absurdly out of line with reality).*

Concretely, that bar breaks into:

| Feature | Status |
|---|---|
| Multi-document data room ingestion (GL CSV/XLSX, ZIP data rooms, AR/AP aging, projections, PDF debt agreements) with classification and routing | **Built** — `pipeline/ingestion/*`, `document_registry.py` |
| Deterministic financial statement construction (P&L, Balance Sheet, Cash Flow) — Python/Decimal only, cent-precision, traceable to source GL lines | **Built** — `pipeline/financial_builder/*`, `GET /financials/{pnl,balance-sheet,cash-flow}` |
| Chart-of-accounts mapping (LLM-assisted, never LLM-computed) | **Built** — CoA mapper agent, mock + real modes |
| QoE adjustment waterfall with full source-GL audit trail per adjustment | **Built** — `pipeline/qoe_engine/*`, `GET /qoe`, `GET /qoe/adjustments/{id}/source` |
| Analyst review/override of QoE adjustments (accept/reject/modify an LLM- or rule-proposed adjustment, with reason + who + when recorded) | **In progress** — schema/orchestrator changes on current branch (`feat/qoe-adjustment-override`), not yet merged. This is the human-in-the-loop control that keeps "no hallucinated numbers" true when an LLM-proposed adjustment is wrong. **⚠️ Unresolved conflict:** this row conflicts with the "engine numbers are finalized" rule (`.claude/rules/engine-numbers-finalized.md`). Resolving it and updating this row is tracked as [PHASES.md](PHASES.md) Phase 2, Task 4 — not decided here. |
| Red flag detection: threshold-rule-based (owner comp %, related-party %, AR days, EBITDA volatility/margin decline, NWC volatility, cash conversion, deferred revenue decline, revenue seasonality) | **Built** — `pipeline/redflag_detector/rules.py` |
| Cross-document consistency red flags (GL vs AR/AP aging tie-out failures, GL-derived net debt vs contract-extracted debt terms mismatch) | **Built** — `_rule_cross_doc_tie_out_failures`, `_rule_net_debt_reconciliation_mismatch`, `GET /tie-outs` |
| **Line-item / unit-economics outlier detection** (a single GL line or unit price implausible relative to the rest of the data set — the "water costing $1M" case) | **Not built.** Current rules are all pre-defined ratio/threshold checks against known categories (owner comp, AR days, etc.); there is no general statistical-outlier or plausibility-check rule that flags an arbitrary line item as "this number looks wrong on its face" independent of a named category. This is a real MVP gap per the product owner's bar, not just a "later" nicety. |
| Red flag severity + diligence questions (LLM-enriched, grounded in the underlying data — never inventing a number) | **Built** — mock + real LLM reviewer agents inject diligence questions on High/Medium flags |
| IAR generation: adjusted financials, QoE highlights, red flags, NWC, net debt/DCF cross-check, narrative sections, with graphs (revenue/EBITDA trend, QoE waterfall, red flag breakdown) | **Partially built, needs reframing.** `NarrativeDrafterAgent` + `pipeline/narrative/orchestrator.py` draft 5 sections (executive summary, key risks, QoE highlights, working capital, recommendations) from a fact sheet of already-computed figures — this is the right architecture (LLM never sees raw GL, every quoted figure traces to `figures_used`). But it's currently framed/labeled in the frontend as a **"Junior Analyst Report"** (`junior-analyst-report.tsx`) — an internal working summary, not the IAR deliverable itself. Per the product owner: **TAM is not building a junior-analyst summary; it is building the IAR.** This needs a product/naming pass: confirm IAR section structure against a real IAR template, and treat the current 5 narrative sections as a starting point, not the finished spec (PHASES.md Phase 4). **Frontend wiring is complete:** `junior-analyst-report.tsx` fetches the persisted narrative (`GET /narrative`), can regenerate it (`POST /narrative/generate`), and exports a printable PDF (`exportToPrintablePdf`). The earlier `STEPS.md` "pending" note was stale. |
| Databook export (Excel) — Cover, QoE Waterfall, Adjustment Ledger, GL Mapping, P&L/Balance Sheet/Cash Flow, NWC Trend, NWC Pegs, Net Debt, Debt Instruments, DCF, Commercial Health, Contracts, Narrative, AR/AP Aging, Tie-outs, IRL tabs | **Built** — `pipeline/databook/generator.py`, `POST /databook/export`. NWC, Net Debt, DCF, Commercial Health, Contracts, and Narrative tabs added in PR #28; each is omitted gracefully if its source report doesn't exist. |
| Audit trail — every QoE adjustment and red flag cites source GL line IDs or source document; document access logged | **Built** — `security/access_log.py`, append-only adjustment ledger |
| At-rest encryption of all persisted data (deal records, uploads, processed output) | **Built** — `security/file_crypto.py`, AES-256-GCM |
| Per-user auth, deal ownership enforcement | **Built** — Argon2id + JWT session, `require_deal_owner` |

### 3.2 Later — Explicitly Deferred, Not Non-Goals

Per the product owner: these are real roadmap items, not things TAM will
never do — just not part of the MVP bar above.

- **Customer-level analytics** (revenue concentration by customer, churn,
  customer count trend) — needs customer-level invoice ingestion, which
  doesn't exist yet. Today the UI shows an honest "requires data this system
  does not ingest" card instead of approximating from aggregate GL.
- **Mapping Studio** — a manual UI for an analyst to override/correct
  chart-of-accounts mappings the LLM/rules got wrong. Currently a labeled
  placeholder in Settings.
- **Multi-party / external deal access** — today every deal has exactly one
  owning user with no sharing; there is no team-collaboration or
  external-party (client, counsel) access model. Given the target users are
  advisory firms with multi-person deal teams, this is a real near-term gap,
  not a hypothetical — the reviewer/override workflow in §3.1 already implies
  at least two roles (preparer, reviewer) touching one deal.
- **OCR for scanned PDFs** — elaborating on current state per the product
  owner's request: the PDF contract parser (`pdfplumber`-based) only handles
  **digital, text-extractable PDFs**. It does not attempt OCR. When a scanned
  or image-only PDF is uploaded, ingestion is designed to **fail clearly**
  (a visible error identifying the file as unparseable) rather than silently
  skip it or hallucinate contract terms from a blank extraction. No OCR
  engine (Tesseract, cloud OCR, etc.) is integrated, and none is planned as
  part of MVP. This is a known, intentional limitation today, not a bug —
  but it does mean any deal whose debt agreements only exist as scans
  currently gets zero contract-term extraction for those documents, silently
  degrading (gracefully, per-document) rather than blocking the rest of the
  pipeline.
- **Benchmarking / comps** against industry or historical deal data.
- **Celery/Redis background processing, PostgreSQL, S3 storage** — current
  JSON-file + FastAPI BackgroundTasks architecture is an intentional
  cloud-ready-but-not-cloud-deployed POC posture (see `session.md` §4); swap
  is designed to be low-friction when it's actually needed, not before.

## 4. Non-Goals

Things TAM will deliberately **not** do, regardless of timeline:

- **LLMs will never compute or alter a financial figure.** Every number on
  every statement, in every QoE adjustment amount, in every red-flag
  financial-impact estimate, is Python/Decimal arithmetic over source data.
  An LLM may propose that an adjustment *category* applies, or draft the
  *sentence* describing a number — it never produces the number itself. This
  is the load-bearing constraint the entire MVP accuracy bar depends on.
- **No custom cryptography.** Password hashing and at-rest encryption use
  vetted libraries only (`argon2-cffi`, `cryptography`) — see `CLAUDE.md` §4.
- **No full-pipeline synchronous requests.** The ~40-minute real-LLM
  end-to-end pipeline is never a request-response path in the product; it
  runs as a background job the user polls. Its `e2e` test tier is never a
  merge gate; today it runs only when invoked manually (`pytest -m e2e`) —
  no CI workflow, nightly or otherwise, runs it (`CLAUDE.md` §3/§3a,
  TESTING.md).
- **Not a general bookkeeping or accounting system.** TAM ingests a data room
  for a point-in-time diligence engagement; it does not replace a client's
  GL system, do ongoing bookkeeping, or manage multi-period close.
- **Not a deal-sourcing or CRM tool.** No pipeline of prospective targets,
  no outreach tracking — TAM starts once a data room exists for a specific
  target.
- **Not a general summary/memo generator.** The narrative feature exists to
  produce sections of a real IAR grounded in computed figures, not a free-text
  "AI writes whatever it wants" summary tool.

## 5. Key User Flows

**Flow 1 — Analyst runs a new engagement end-to-end**
A junior analyst at the advisory firm creates a new deal in TAM, uploads the
target's data room (GL export, AR/AP aging, a couple of debt agreement PDFs,
zipped together — ~20 documents), and triggers processing. TAM classifies and
ingests every file, builds P&L/BS/CF, runs the QoE engine and red flag
detector, and surfaces status via polling. When processing completes, the
analyst opens the dashboard and sees adjusted EBITDA, the QoE waterfall, and
a prioritized red flag list — each number and flag clickable through to its
source GL lines or source document.

**Flow 2 — Analyst reviews and overrides an AI-proposed QoE adjustment**
The QoE engine flags a legal settlement as a one-time add-back and an LLM
reviewer agent confirms it with reasoning. The analyst disagrees with a
different, lower-confidence adjustment the LLM proposed — say, a partial
owner-comp normalization — and rejects it with a typed reason. The
adjustment ledger records who overrode it, when, and why (append-only); the
QoE waterfall and downstream IAR figures recompute deterministically from
the now-corrected adjustment set. *(This flow's backend plumbing is in
progress on `feat/qoe-adjustment-override`.)*

> ⚠️ **This flow conflicts with `.claude/rules/engine-numbers-finalized.md`** ("engine numbers are
> finalized — no analyst override of the numeric value"). Known to the
> product owner; resolution and the rewrite of this flow are tracked as
> [PHASES.md](PHASES.md) Phase 2, Task 4. Don't build against this flow as
> written until that's decided.

**Flow 3 — Analyst investigates a red flag before the client call**
The red flag center shows a High-severity flag: "Owner Compensation Elevated
(22.4% of Revenue)." The analyst clicks through to the diligence questions
the LLM generated for this flag, drills into the source GL lines that drove
the calculation, and cross-references the affected periods. They add a note
via the Notes panel to bring into the client discussion.

**Flow 4 — Analyst generates and exports the IAR**
Once QoE adjustments are reviewed and red flags are triaged, the analyst
triggers IAR generation. TAM drafts each section (grounded only in
already-computed figures — never raw GL, never invented numbers), the
analyst reviews the draft in the UI, regenerates a section if needed, and
exports it (alongside the full Excel databook of supporting schedules) to
hand to a senior reviewer.

## 6. Edge Cases and Failure Scenarios

Given sensitive financial documents, multi-document data rooms, and a
target user base (Big 4-style firms) with real audit/compliance
expectations:

- **Unbalanced or inconsistent source files.** Trial balance doesn't
  balance, or a mixed P&L-activity + BS-snapshot export doesn't sum to zero
  globally — ingestion must return a specific validation error, not a
  silently wrong statement. (Built: `validator.py`, `is_mixed_export` flag.)
- **Cross-document disagreement.** AR aging total doesn't match GL AR
  balance; contract-extracted debt terms don't match GL-derived net debt.
  Must surface as a Data Quality red flag with the variance, not silently
  prefer one source. (Built: tie-out red flags, 5% tolerance note on debt
  reconciliation.)
- **Scanned/image-only PDFs.** Must fail clearly and per-document (not
  silently drop the file, not block the rest of the pipeline, not fabricate
  contract terms from empty extraction). See §3.2 OCR discussion.
- **Messy/inconsistent column naming across client exports** ("Account" vs
  "Acct Code" vs "GL Account") — column inference with explicit failure mode
  when inference isn't confident, rather than silently misreading a column.
- **LLM output must never leak into a number.** If an LLM agent call fails,
  times out, or returns malformed output, the pipeline must degrade
  gracefully (skip enrichment, mark data as partial) rather than block
  deterministic financial computation or substitute a guessed figure.
- **An adjustment or red flag with no traceable source.** Should never be
  possible to persist — every `QoEAdjustment` and `RedFlag` requires
  `source_gl_line_ids` or `source_document`.
- **Multi-user contention on one deal.** Not yet a real scenario (single
  owner per deal today), but becomes one as soon as the reviewer/override
  flow (§3.1) ships with more than one role — two people acting on the same
  adjustment ledger at once needs a conflict story before that ships broadly.
- **Sensitive document handling.** Decrypted document contents and secrets
  must never appear in logs (`CLAUDE.md` §4); every document read/download
  is appended to the access log for audit purposes.
- **Large data rooms.** Current BackgroundTasks-based processing is
  documented as sufficient for <50K row files; a ~20-document real-world data
  room should be well within that, but there's no current stress-tested
  upper bound documented — worth establishing as part of MVP hardening.

## 7. Success Criteria

A phase/feature under this PRD is "done" when, from the analyst's
perspective:

- **Accuracy bar (the core MVP gate):** for a ~20-document real-world-shaped
  data room, every number rendered anywhere in the UI or IAR export is
  reproducible by hand from source documents — zero hallucinated or
  approximated figures presented as authoritative. This is testable: every
  displayed figure has a `source_gl_line_ids` / `figures_used` trace, and
  that trace resolves to real source data, not a placeholder.
- **Red flag completeness:** the red flag set for a data room with known
  planted issues (legal settlement, excess owner comp, a deliberately
  implausible line-item price) is fully detected — including, once built,
  the general outlier/plausibility check called out in §3.1, not just the
  existing named-category rules.
- **IAR quality:** a generated IAR's sections, structure, and supporting
  graphs are recognizable as a real IAR by someone who has produced one
  manually at a Big 4-style TAS practice — not a generic AI summary. (This
  needs a template/rubric check against a real IAR, not just internal review
  — flagged as follow-up work, not yet defined in this PRD.)
- **No regression in determinism:** CI's `unit` tier (no LLM calls) and its
  per-phase `integration` tier (real Anthropic API, `USE_MOCK_LLM=false` —
  never mocked, per `.claude/rules/testing.md` and `CLAUDE.md` §3) stay green, and the
  real-LLM `e2e` tier passes when run manually before an MVP sign-off — a
  change that makes numbers non-reproducible or LLM-dependent is a
  regression regardless of how good the feature looks.
- **Audit trail intact:** for any number or flag a reviewer questions, the
  UI can answer "where did this come from" in at most one click-through,
  down to source GL line or source document.

## 8. Open Questions (flagged, not resolved here)

- Exact IAR section structure/template — the current 5 narrative sections
  (executive summary, key risks, QoE highlights, working capital,
  recommendations) are a starting point, not a confirmed IAR spec. Needs a
  real IAR template to check against.
- Reviewer/approver role and permission model — implied by the
  QoE-override work in flight, not yet designed (`auth.py` today only knows
  "the one owning user").
- General line-item/unit-economics outlier detection — needs a design pass
  (statistical approach vs. LLM-assisted plausibility check vs. both) before
  implementation; flagged in §3.1 as a real MVP gap, not yet scoped.
- Firm-level tenancy model (one TAM instance per firm? shared with per-firm
  data isolation? client-facing sharing at all?) — target users are multiple
  named firms (EY, KPMG, Deloitte, PwC), which implies more than
  single-owner-per-deal auth eventually, but the shape of that isn't decided.
