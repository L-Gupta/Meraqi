# MEMORY.md — TAM Living Status File

> This is the single source of truth for "where are we right now." Read
> this first in any new session, before `PHASES.md`. It should never be
> more than one session stale — see the Maintenance Protocol at the bottom,
> which is mandatory, not optional.

---

## Current Status

**Phase:** [Phase 0 — Fix the Dashboard Display Bug](PHASES.md#phase-0--fix-the-dashboard-display-bug-current-blocker) (`docs/PHASES.md`). Not started at the code level — diagnosis only so far.

**Current blocker (stated explicitly, not buried):** The product owner is
blocked by dashboard numbers displaying as "straight up random" —
suspected mock data or fabricated numbers, real backend extraction
believed correct. **Root cause is a hypothesis, not yet confirmed live.**
See "Known Issues / Blockers" below for the full diagnostic trail. No fix
has been implemented. No frontend dashboard files have been touched yet.

**Branch:** `feat/qoe-adjustment-override`, with uncommitted changes that
are themselves the subject of Phase 2 (not yet reached — Phase 0 and
Phase 1 must complete first per `PHASES.md`'s Ground Rules). Do not build
on top of this branch's QoE override code as if it's finished — it's
mid-conflict with a product rule, see below.

**Housekeeping note:** `PRD.md`, `ARCHITECTURE.md`, `RULES.md`,
`PHASES.md`, and `DESIGN.md` were moved from the repo root into `docs/`
at some point outside this conversation (currently untracked in git — not
yet committed). This file follows that convention. `STEPS.md` still exists
at the repo root — it's superseded by `PHASES.md` per the product owner's
stated intent, but hasn't been deleted or redirected. Don't trust
`STEPS.md`'s status claims; it was already found stale in two places
(inquiry persistence, narrative frontend wiring) when `PHASES.md` was
written.

---

## Completed

Nothing within `PHASES.md`'s own numbered phases (0–5) is complete yet —
Phase 0 is the active phase and hasn't finished. Everything below is
foundational work completed **before** `PHASES.md` existed (the original
`STEPS.md`-tracked build), confirmed still-accurate by direct code
inspection when `PHASES.md` was written. Treat this as the baseline
`PHASES.md`'s phases build on top of, not as "Phase N complete."

| Feature | Files/Areas | Notes |
|---|---|---|
| Ingestion (GL CSV/XLSX/ZIP data rooms, AR/AP aging, PDF debt agreements) | `backend/app/pipeline/ingestion/*` | Digital/text-extractable PDFs only — no OCR (by design, not MVP) |
| Financial statement builder (P&L, Balance Sheet, Cash Flow) | `backend/app/pipeline/financial_builder/*` | Deterministic Python/Decimal, cent-precision |
| Chart-of-accounts mapping | `backend/app/agents/coa_mapper.py` | LLM-assisted, never LLM-computed |
| QoE engine (rules + LLM review) | `backend/app/pipeline/qoe_engine/*` | Base engine done; override/finalization behavior is Phase 2's unresolved subject — see below |
| Red flag detection (named-category rules) | `backend/app/pipeline/redflag_detector/rules.py` | Owner comp, related-party, AR days, margin decline, NWC volatility, cross-doc tie-outs, etc. General outlier/plausibility detection is **not** in this list — that's Phase 3, not started |
| NWC analyzer + commercial health | `backend/app/pipeline/nwc_analyzer/*` | |
| Net debt bridge + DCF | `backend/app/pipeline/net_debt_bridge/*`, `dcf_engine/*` | |
| PDF contract parsing | `backend/app/pipeline/contracts/*`, `agents/contract_parser.py` | Digital PDFs only |
| Databook export (Excel) | `backend/app/pipeline/databook/generator.py` | |
| Narrative drafting **and its frontend wiring** | `backend/app/pipeline/narrative/*`, `agents/narrative_drafter.py`, `frontend/components/fdd/junior-analyst-report.tsx` | Confirmed done including PDF export (`exportToPrintablePdf`) — `STEPS.md` claims this is still pending; that claim is stale, this file supersedes it |
| Auth + security | `backend/app/security/*`, `backend/app/api/v1/deps.py` | Argon2id, AES-256-GCM at rest, JWT sessions, IDOR-safe (404-not-403) deal ownership |
| Frontend dashboard, panels, all 12 top-level pages | `frontend/app/*`, `frontend/components/fdd/*` | Real-backend-wired per page, with a parallel mock/demo BFF path — **this mock/demo path is directly implicated in the current Phase 0 blocker**, see below |
| Planning docs | `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/PHASES.md`, `docs/DESIGN.md` | All five written and current as of this session |

**Explicitly not built** (by design, not gaps — see `PRD.md` §3.2 and
`PHASES.md`'s Parking Lot): Mapping Studio, customer-level analytics, OCR,
multi-party/external deal access, reviewer/permission roles beyond
single-owner, benchmarking/comps, Celery/Redis/Postgres/S3 migration.

---

## In Progress

### Phase 0 — Dashboard display bug (active, blocking)
**State: diagnosis complete, fix not started, root cause not yet confirmed
live.**

What's been done: traced the reported symptom ("numbers are random,
possibly mock/hallucinated") through the actual frontend code. Ruled out
one lead (the documented `YYYY-MM-DD` vs `YYYY-MM` period-key mismatch
in `frontend/lib/utils/format.ts` — confirmed `/financials/summary`
formats both consistently, so it doesn't hit the dashboard components).
Found a strong, evidenced candidate instead: `frontend/app/dashboard/page.tsx`
falls through to a mock/demo "Executive Overview" view (fed by
`lib/mock-data/data.ts`) whenever `dealId` is falsy, and that view computes
several KPI tabs from **invented formulas** presented as real analysis
(e.g. `predictedValuation = adjustedLtm * valuationMultiple` labeled
"Predicted Valuation (AI)"; `"Normalized Earnings"` is literally
`adjustedLtm * 0.98`; `"Sales tax/VAT exposure"` is a hardcoded `"$0.4M"`
string). If `dealId` is null/stale while the product owner believes a real
deal is selected, this is exactly what would render — and would look
precisely like "random"/"hallucinated" numbers.

What's NOT done yet (this is where the next session picks up):
1. **Live confirmation** — open the actual running app, check DevTools
   Network tab (is it calling `/api/deal/summary` [mock] or
   `/api/v1/deals/{id}/financials/summary` [real]?) and Local Storage
   (`tam-global-state` → `dealId` value). This has not been done — all
   analysis so far is static code reading.
2. If confirmed: trace *why* `dealId` is null/stale — candidates already
   identified but not yet checked: `lib/store/use-global-store.ts`
   persistence behavior, or the auto-select-first-deal effect in
   `components/layout/app-shell.tsx`'s `Topbar` (re-runs on every window
   focus event, per its `useEffect` dependency array).
3. If NOT confirmed (real branch renders but numbers are still wrong):
   pivot to comparing real API responses against the source GL fixture by
   hand — not yet attempted.
4. No fix has been written. No `fix/` branch exists for this yet.

**No frontend dashboard file has been modified this session** — this is
pure diagnosis, zero implementation.

### Phase 2 subject matter — QoE adjustment override (uncommitted, blocked)
**State: code written, but conflicts with a product rule and can't be
finished until a scope decision is made — and per Ground Rules, Phase 2
doesn't formally start until Phase 0 and Phase 1 are done anyway.**

Uncommitted on the current branch (`feat/qoe-adjustment-override`):
- `backend/app/schemas/qoe.py` — adds `override_reason`, `overridden_by`,
  `overridden_at` to `QoEAdjustment`.
- `backend/app/pipeline/qoe_engine/orchestrator.py` — adds
  `apply_override()` (mutates an existing adjustment's
  `normalized_amount`/`analyst_approved` in place) and
  `add_manual_adjustment()` (appends a wholly new analyst-added
  adjustment).
- `backend/app/api/v1/qoe.py` — adds `PATCH /deals/{id}/qoe/adjustments/{id}`
  and `POST /deals/{id}/qoe/adjustments` wrapping the above.
- `backend/app/pipeline/qoe_engine/normalizer.py` — minor supporting change.
- `CLAUDE.md` — the mock-LLM policy wording fix from the RULES.md session
  (unrelated to the override work, just sitting in the same uncommitted
  diff — should be committed separately, on its own, not bundled with
  whatever happens to Phase 2's resolution).

**Why this is blocked, not just "in progress":** the product owner's
explicit instruction (`RULES.md` §0.2/§4/§7.3) is that engine-computed
numbers are finalized — no analyst amount-override. The
`normalized_amount` path in `apply_override()` directly violates this.
Per `PHASES.md` Phase 2 Task 1, the exact resolution scope is still an
open question needing the product owner's direct decision: does a
categorical accept/reject toggle survive? Does `add_manual_adjustment`
(net-new, not an overwrite) survive? Neither has been decided. **Do not
extend this code or build anything on top of the `PATCH` endpoint's
amount-override capability.**

---

## Not Started

Everything else in `PHASES.md`, in order:

- **Phase 1** — Trust audit: systematically check every `dealId`-branched
  page (financial-analysis, risk-assessment, documents, reports,
  customer-analytics — dashboard already covered by Phase 0) for the same
  mock-fallback/fabricated-formula anti-pattern found in Phase 0.
- **Phase 2** — Resolve the QoE finalization conflict (see above);
  update `PRD.md` §3.1/Flow 2 to match once resolved.
- **Phase 3** — General line-item/outlier plausibility red flag detection
  (the "$1M water" case) — confirmed gap, no design decision made yet
  (statistical vs. LLM-assisted vs. hybrid, per `PRD.md` §8's open question).
- **Phase 4** — IAR reframing: define a real IAR structure (needs product
  owner input/reference template, not inventable unilaterally), update
  narrative sections + rename `junior-analyst-report.tsx`'s framing.
- **Phase 5** — MVP acceptance: full ~20-document data room run,
  hand-verified accuracy, red flag confirmation, IAR review, full CI green,
  formal product-owner sign-off.

---

## Known Issues / Blockers

Enough detail for a cold pickup — by a future session or the same one days
later.

1. **[BLOCKING] Dashboard shows wrong/fabricated-looking numbers.**
   Reported symptom: "numbers are just straight up random," suspected
   mock data or hallucination. Leading hypothesis (unconfirmed):
   `dashboard/page.tsx`'s `if (dealId)` branch is failing to trigger (i.e.
   `dealId` is null/stale in `useGlobalStore`), so the page falls through
   to the mock "Executive Overview" view, whose `additionalExecutiveMetrics`/
   `changeTrackingMetrics`/`taxesKpiMetrics` (lines ~102–122 of
   `dashboard/page.tsx`) are computed from arbitrary formulas, not real
   data. **Next step, not yet done:** open the running app with a real
   processed deal, check DevTools Network tab + `localStorage['tam-global-state']`
   to confirm which branch is actually rendering. Full diagnostic plan is
   in `PHASES.md` Phase 0.
2. **QoE adjustment override conflicts with the finalized-numbers rule.**
   See "In Progress" above. Uncommitted, blocked on a product-owner scope
   decision (does accept/reject survive? does manual-add survive?).
3. **General outlier/plausibility red flag rule doesn't exist.** Confirmed
   via direct inspection of `backend/app/pipeline/redflag_detector/rules.py`
   — every rule is a named-category threshold check; nothing flags an
   arbitrary implausible line item (the product owner's own "$1M water"
   example). This is Phase 3, not started, and per `PRD.md` §8 the
   detection approach itself hasn't been designed yet.
4. **`docs/` is untracked in git.** `PRD.md`, `ARCHITECTURE.md`,
   `RULES.md`, `PHASES.md`, `DESIGN.md`, and this file live in `docs/` but
   have never been committed. Not urgent, but note it before assuming
   they're safely persisted beyond the local working tree.
5. **`STEPS.md` (repo root) is stale and superseded but still present.**
   No action has been taken to delete it or add a pointer to `PHASES.md`.
   Low priority, but a future session should not treat `STEPS.md` as
   authoritative if it's encountered before this file.
6. **CLAUDE.md has an uncommitted fix mixed into the QoE-override branch's
   diff.** The §3/§3a mock-LLM wording correction (from the RULES.md
   session) is sitting uncommitted alongside unrelated QoE override code.
   Per `CLAUDE.md` §2 ("keep commits atomic"), this should be committed on
   its own, separate from however Phase 2 resolves — don't let it get
   swept into a Phase 2 commit as a drive-by.

---

## Files Currently Being Touched

Uncommitted working-tree changes as of this session — a new session should
check `git status`/`git diff` itself rather than trust this list blindly
(see Maintenance Protocol), but as of now:

- `CLAUDE.md` — modified (mock-LLM wording fix; unrelated to the rest of
  this diff, should be committed separately — see Known Issue 6)
- `backend/app/api/v1/qoe.py` — modified, uncommitted (Phase 2 subject,
  blocked)
- `backend/app/pipeline/qoe_engine/orchestrator.py` — modified,
  uncommitted (Phase 2 subject, blocked)
- `backend/app/pipeline/qoe_engine/normalizer.py` — modified, uncommitted
  (Phase 2 subject, blocked)
- `backend/app/schemas/qoe.py` — modified, uncommitted (Phase 2 subject,
  blocked)
- `docs/` — new, untracked (`PRD.md`, `ARCHITECTURE.md`, `RULES.md`,
  `PHASES.md`, `DESIGN.md`, this file)

**Not yet touched despite being Phase 0's target:** no file under
`frontend/app/dashboard/`, `frontend/components/fdd/deal-summary-banner.tsx`,
`frontend/components/fdd/real-dashboard.tsx`, or
`frontend/components/layout/app-shell.tsx` has been modified. Phase 0 is
diagnosis-only so far — a session picking this up should expect to start
with live confirmation (DevTools), not assume any fix is partially applied.

---

## Maintenance Protocol

**Any Claude Code session (or the same session, later) that completes a
task or feature in this repo must update this file immediately —
before moving on to the next task, not at the end of a session.**

Concretely, every time something changes:
1. **Move the item** from "In Progress" (or "Not Started") to "Completed,"
   with the files/areas it touched and which phase it belonged to.
2. **Update "Current Status"** at the top — if the active phase changed,
   or the current blocker was resolved (or a new one appeared), reflect
   that immediately. If a blocker was resolved, move it out of "Known
   Issues / Blockers" — don't leave stale blockers sitting there
   unresolved-looking after they're fixed.
3. **Update "Files Currently Being Touched"** to match actual `git status`
   — remove files that got committed, add files newly being edited.
4. **Never let this file describe a state the repo isn't actually in.**
   If you're unsure whether something is "done" or "scaffolded," don't
   guess in either direction — check the code (or ask), the same
   discipline `RULES.md` §8 already requires for everything else in this
   repo.
5. **This file is a status snapshot, not a history log.** Don't append —
   edit in place. If something's worth preserving historically, that's
   what git history is for, not this file.
6. Before trusting anything in this file at the start of a new session,
   **cross-check it against `git status`, `git log`, and a quick read of
   whatever code area it claims is done/in-progress/blocked.** This file
   is written in good faith but can go stale the moment someone forgets
   step 1–3 above — treat it as a strong lead, not an unverified fact,
   exactly per the memory-verification discipline in `RULES.md` §8 and the
   root `CLAUDE.md`'s broader "no self-reported done" philosophy (§3a).
