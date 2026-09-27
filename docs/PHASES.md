# PHASES.md — TAM Build Plan

> Status: drafted 2026-08-10 by Claude Code, replacing `STEPS.md` as the
> source of truth for what to build next. Grounded in [PRD.md](PRD.md),
> [ARCHITECTURE.md](ARCHITECTURE.md), [`.claude/rules/`](../.claude/rules/) (formerly `RULES.md`), `CLAUDE.md`, a
> fresh read of `STEPS.md`, and direct inspection of the current codebase
> (git history, uncommitted branch state, actual component code) — not
> `STEPS.md`'s self-reported status, which was already found stale in two
> places during this pass (see §1 and the note on narrative wiring below).
>
> **Split 2026-09-27:** completed work moves to
> [PHASES_ARCHIVE.md](PHASES_ARCHIVE.md). As of this date **no numbered
> phase (0–5) has met its Definition of Done** — `main` hasn't changed
> since PR #29 (2026-08-05) — so the only thing archived is the pre-phase
> baseline that used to be §0 below. Phase 0 is current, Phase 1 is next;
> Phases 2–5 stay in this file (not archived) because they aren't done.
> When a phase's DoD is confirmed, move its section to the archive.

## Ground Rules (read before doing anything in this file)

1. **No phase begins until the previous phase's Definition of Done is met
   AND explicitly confirmed by the product owner.** Not self-reported by
   whoever (human or AI) is doing the work — per `CLAUDE.md` §3a's "no
   self-reported done" policy, extended here to every phase, not just CI.
   Implementation-complete is not the same as done.
2. **Parking Lot rule.** If a task looks urgent, interesting, or clearly
   worth doing while you're in the middle of a phase, but it isn't that
   phase's stated scope — it goes in the **Parking Lot** section at the
   bottom of this file. It does not get started. Say what you noticed, log
   it, keep working the current phase. The product owner triages the
   parking lot; it doesn't self-prioritize into the active phase.
3. **Phases are ordered by actual codebase dependency, not by PRD feature
   priority.** Where a phase exists mainly because something *already
   in-flight* (uncommitted code, a live bug) has to be resolved before
   later work can be trusted, that's stated explicitly in the phase's
   rationale.
4. **Every phase's Definition of Done requires the relevant test tier green
   and Ruff/lint clean**, per `CLAUDE.md` §5 and `.claude/rules/testing.md` — this is a
   floor, not a substitute for the phase-specific criteria below it.

## 0. Current State — What's Actually Done vs. Not

Re-confirmed 2026-09-27 against `main` at `8b00867`:

- **Done and stable:** everything in the pre-phase baseline — see
  [PHASES_ARCHIVE.md](PHASES_ARCHIVE.md) for the full list with the PRs
  that delivered it (ingestion incl. supporting schedules, statements, QoE
  engine, named-category red flags, NWC/commercial health, net debt + DCF,
  contracts, full databook, narrative + its frontend wiring/PDF export,
  auth/encryption/IDOR, notes, inquiries, decision queue, deal settings).
- **Explicitly not built, by design, and not part of MVP per PRD.md §3.2:**
  Mapping Studio (placeholder in Settings), customer-level analytics
  (honest "not supported" card), OCR for scanned PDFs, multi-party/external
  deal access, reviewer/permission roles beyond single-owner.
- **In-progress and currently blocking:** the QoE adjustment override work
  on this branch (`feat/qoe-adjustment-override`, uncommitted) — conflicts
  with the "engine numbers are finalized" rule in `.claude/rules/engine-numbers-finalized.md`.
  Not resolved yet. See Phase 2.
- **Confirmed gap against PRD's MVP bar:** no general line-item /
  unit-economics outlier detection rule exists — every red flag rule is a
  named-category threshold (owner comp %, AR days, etc.), not a plausibility
  check on an arbitrary line item. See Phase 3.
- **Surfaced 2026-08-10:** the dashboard display bug that is Phase 0. No
  commits have landed against it since; it remains diagnosis-only.

---

## Phase 0 — Fix the Dashboard Display Bug (CURRENT — blocker)

**This phase exists because the product owner is currently blocked by it.
Nothing below assumes it's solved until it's confirmed solved.**

### What's reported
Numbers on the dashboard appear "straight up random" — the product owner's
own words, with two live hypotheses: (a) it's still showing mock/demo data,
or (b) the numbers are somehow fabricated ("hallucinated"). The product
owner is confident the real GL data is being extracted correctly by the
backend; the problem is specifically in what's displayed.

### Working hypothesis (from static code review this session — not yet
confirmed live, confirming it is this phase's first task)
`frontend/app/dashboard/page.tsx` branches on `dealId`: if set, it renders
the real, backend-wired components (`DealSummaryBanner`, `RealDashboard`,
`JuniorAnalystReport`); if not, it falls through to an "Executive Overview"
demo view fed by `lib/mock-data/data.ts`. That demo view is not just static
mock data — several of its KPI tabs (`additionalExecutiveMetrics`,
`changeTrackingMetrics`, `taxesKpiMetrics` in `dashboard/page.tsx`) compute
numbers via arbitrary formulas layered on top of the mock trend array (e.g.
`predictedValuation = adjustedLtm * valuationMultiple` where
`valuationMultiple` is an invented formula labeled "AI"; `"Normalized
Earnings"` is literally `adjustedLtm * 0.98`; `"Sales tax/VAT exposure"` is
a hardcoded `"$0.4M"` string). If a real, processed deal is being viewed but
`dealId` is null or doesn't match an owned deal, this is exactly what would
render — and it would look precisely like "random"/"hallucinated" numbers,
because by design they're fabricated placeholder content, never meant to be
mistaken for real output. This matches the product owner's own leading
hypothesis ("I think it might still be mock data").

**This is a hypothesis to confirm, not an assumed diagnosis** — the real
backend path, when it does render, pulls genuine API values with no
comparable fabrication, so if this turns out *not* to be the cause, the bug
is somewhere else entirely (e.g. a real backend computation error) and this
phase's diagnostic tasks below need to pivot there.

### Tasks
1. **Confirm which branch is actually rendering.** With the dashboard open
   and showing wrong numbers: open browser DevTools → Network tab, reload,
   and check whether the page is calling `/api/deal/summary` (mock BFF) or
   `/api/v1/deals/{id}/financials/summary` etc. (real backend). Separately,
   check Application/Storage → Local Storage → `tam-global-state` for the
   current `dealId` value.
2. **If the mock branch is confirmed rendering:** trace why `dealId` is
   null/stale at that moment — check `lib/store/use-global-store.ts`
   persistence, the auto-select-first-deal effect in
   `components/layout/app-shell.tsx`'s `Topbar` (note: this effect re-runs
   on every window focus event and swaps `dealId` if the current one isn't
   found in `GET /api/v1/deals`'s response — confirm whether this is
   involved), and whether the deal shown as "selected" in the Topbar
   dropdown actually matches what `dashboard/page.tsx` is branching on.
3. **If the real branch is confirmed rendering but numbers are still
   wrong:** this is a different bug — pivot to comparing the exact values
   returned by `GET /deals/{id}/financials/summary`,
   `GET /deals/{id}/qoe`, etc. (via `/docs` or DevTools Network tab)
   against the source GL fixture by hand, to find where the real
   computation or the real-path display logic (`deal-summary-banner.tsx`,
   `real-dashboard.tsx`) diverges.
4. **Implement the fix** on a `fix/` branch per `CLAUDE.md` §1, scoped to
   root cause only — no unrelated cleanup bundled in.
5. **Decide what happens to the mock/demo branch long-term** — flag as a
   product question rather than deciding unilaterally: given how easily
   it's mistaken for real output (this whole phase), should it be more
   clearly labeled as demo content, gated differently, or is the current
   behavior (silent fallback when no deal is selected) acceptable once the
   root cause of *why* no real deal was selected is fixed? Log the answer,
   don't just patch around it.

### Definition of Done
- [ ] Root cause identified and written down (which code path, why) —
      confirmed against the live app, not just static code review.
- [ ] Fix implemented on a `fix/` branch, committed per `CLAUDE.md` §2.
- [ ] Ruff clean; relevant backend test tier green if backend code changed;
      `next lint`/`next build` clean if frontend code changed.
- [ ] **Live re-test, performed by the product owner, not self-reported:**
      upload a real GL fixture, process to completion, open `/dashboard`,
      confirm the real components render (not the Executive Overview demo
      tabs), and confirm every displayed figure hand-traces to the source
      fixture.
- [ ] Product owner explicitly confirms in this conversation (or the next
      one) that the dashboard now shows correct numbers before Phase 1
      starts.

---

## Phase 1 — Trust Audit: No Other Fabricated Numbers Anywhere (NEXT)

**Why this comes right after Phase 0, before any new feature work:** Phase
0 will have just found one concrete case of formula-fabricated numbers
rendering where real numbers were expected. PRD.md's entire MVP bar is "zero
hallucinated numbers, ever." Before building anything else on top of this
UI, it's worth confirming Phase 0's bug is not one instance of a wider
pattern — otherwise every later phase's "product owner reviews the numbers"
Definition-of-Done step is unreliable.

### Tasks
1. Systematically check every page that branches on `dealId` (dashboard,
   financial-analysis, risk-assessment, documents, reports, customer-analytics)
   for the same anti-pattern found in Phase 0: does the real (`dealId`-set)
   branch ever fall through to `lib/mock-data/*`-backed content, or compute
   a displayed number via an invented formula rather than reading it
   directly from a real API response?
2. Confirm every real-path component's numbers are either (a) a real value
   read directly from a backend response, or (b) an explicit "unavailable/
   not supported" state (per the existing honest-card pattern in
   `customer-analytics/page.tsx`) — never a third thing.
3. Run the existing test suite tiers relevant to any code touched
   (`unit`, then `integration` with the real Anthropic API per `.claude/rules/testing.md`
   §5.1) to confirm no regression from Phase 0/1 changes.

### Definition of Done
- [ ] Every real-data page audited; findings written down (clean, or list
      of additional instances found and fixed).
- [ ] No real-path component falls back to mock data or an invented
      formula when a real deal is selected.
- [ ] Relevant test tiers green.
- [ ] Product owner reviews at least one real processed deal across every
      page and confirms every number checks out (or explicitly accepts a
      documented "unavailable" state) before Phase 2 starts.

---

# Later Phases (not started)

Kept here, not archived — the archive is for completed phases only.

## Phase 2 — Resolve the QoE Adjustment Finalization Conflict

**Why this comes before any IAR/red-flag feature work:** this is *already
in-flight, uncommitted, and touching the exact files* (`qoe.py`,
`qoe_engine/orchestrator.py`, `qoe_engine/normalizer.py`, `schemas/qoe.py`)
that Phase 3 and Phase 4 will also need to touch. Leaving a half-resolved
design conflict sitting uncommitted in those files means any later phase
that edits QoE-adjacent code either builds on top of code that's about to
change shape, or has to work around merge conflicts with it. It's cheaper
to resolve now than to carry it forward.

### Background
`.claude/rules/engine-numbers-finalized.md` documents the conflict: the product owner's instruction is
that **any number generated by the FDD engine is finalized — no analyst
override of the numeric value.** The current uncommitted `apply_override()`
(`app/pipeline/qoe_engine/orchestrator.py`) lets a caller overwrite
`normalized_amount` in place via `PATCH
/deals/{id}/qoe/adjustments/{adjustment_id}`, discarding the prior value
with no history preserved. This conflicts with the new rule and with how
PRD.md §3.1/Flow 2 currently describes analyst override as an MVP
must-have.

### Tasks
1. **Decide the exact scope of "finalized."** The product owner's
   instruction is clear that the *amount* is not analyst-editable. Still
   open (flag, don't guess): does an analyst retain a categorical
   accept/reject toggle on an existing adjustment (not changing its value,
   just whether it counts), and does `add_manual_adjustment` (adding a
   wholly new, analyst-attributed adjustment the engine never proposed)
   stay in scope? Both are architecturally different from overwriting an
   engine-computed number — confirm with the product owner before assuming
   either way.
2. **Implement accordingly:** remove or redesign the `normalized_amount`
   override path in `apply_override()` per the decision in (1); keep or
   remove `analyst_approved` toggle and `add_manual_adjustment` per the
   same decision.
3. **Update `PATCH`/`POST /deals/{id}/qoe/adjustments*` endpoints** in
   `app/api/v1/qoe.py` to match — including removing the now-inapplicable
   `QoEAdjustmentOverride.normalized_amount` field if that path is cut.
4. **Update `PRD.md` §3.1 and Flow 2** to reflect the resolved policy —
   this was explicitly flagged as required follow-up when RULES.md was
   written and hasn't been done yet.
5. **Update/extend `test_authorization.py`** and any QoE-specific tests for
   the final endpoint shape.

### Definition of Done
- [ ] Product owner has explicitly confirmed the exact scope from Task 1
      (not inferred).
- [ ] Code matches the confirmed scope; no path exists anywhere in the API
      that lets a caller overwrite an engine-computed numeric figure.
- [ ] `PRD.md` §3.1/Flow 2 updated to match.
- [ ] `backend-qoe-redflag` CI phase green (Ruff + `unit`/`integration`
      tests, real Anthropic API per `.claude/rules/testing.md`).
- [ ] Product owner reviews the final QoE adjustment workflow (via
      `/docs` or the frontend, once wired) and confirms it matches intent.

---

## Phase 3 — General Outlier / Plausibility Red Flag Detection

**Why this comes after Phase 2, not before:** doesn't strictly depend on
Phase 2's data model, but both phases touch `redflag_detector`/`qoe_engine`
territory and the codebase is cleaner to build in with Phase 2's uncommitted
changes already resolved rather than concurrent. This is the concrete MVP
gap named in `PRD.md` §3.1: *"a general statistical-outlier or plausibility
check that flags an arbitrary line item as 'this number looks wrong on its
face' independent of a named category"* — the "$1M water" case.

### Tasks
1. **Resolve the open design question from `PRD.md` §8**: statistical
   approach (e.g. z-score/IQR outlier on unit-price or line-amount fields
   within a category) vs. LLM-assisted plausibility check vs. hybrid.
   Per the architecture's hard rule (`.claude/rules/llm-usage.md`, ARCHITECTURE.md §9),
   whatever is chosen, **the detection math itself must be deterministic
   Python** — an LLM may enrich/explain a flag already deterministically
   raised, never decide on its own that a number is implausible.
2. **Implement as a new `_rule_*` function** in
   `app/pipeline/redflag_detector/rules.py`, following the existing
   pattern exactly: pure function, returns `list[RedFlag]`, every flag
   cites real `source_gl_line_ids`.
3. **Add a test fixture** with a deliberately planted implausible line item
   (matching the product owner's own example — an absurd unit price) and
   assert it's detected, following the pattern of the existing planted
   legal-settlement/owner-comp fixtures in `tests/fixtures/`.
4. **Wire into `redflag_detector/orchestrator.py`**'s rule set and confirm
   it doesn't fire false positives against the existing clean fixture data
   (`tests/fixtures/financial_statements/proper`).

### Definition of Done
- [ ] Design decision documented (which detection approach, why).
- [ ] New rule implemented, deterministic, every flag has a real source
      trace.
- [ ] New test fixture + assertion added and passing.
- [ ] No new false positives against existing clean fixtures.
- [ ] `backend-qoe-redflag` CI phase green.
- [ ] Product owner confirms the new rule fires correctly against a real or
      fixture data room with a planted anomaly.

---

## Phase 4 — IAR Reframing (Narrative → Real Deliverable)

**Why this comes after Phase 2 and 3:** the narrative drafter's fact sheet
reads QoE adjustments directly (`pipeline/narrative/orchestrator.py`) — building
a finalized IAR section structure around adjustment data that was still
being redesigned in Phase 2 would be premature. It also benefits from
Phase 3 existing, so a "Key Risks" section can meaningfully include
outlier-detected flags, not just the pre-existing named-category ones.

### Background
Per `PRD.md` §3.1: *"TAM is not building a junior-analyst summary; it is
building the IAR."* The current 5 narrative sections (executive summary,
key risks, QoE highlights, working capital, recommendations) and the
`junior-analyst-report.tsx` component/naming are a starting point, not a
confirmed IAR spec.

### Tasks
1. **Define the target IAR structure** against a real IAR template/rubric
   — this is explicitly an open question in `PRD.md` §8, not something to
   invent unilaterally. Needs product owner input (or a reference document)
   before implementation starts.
2. **Update `pipeline/narrative/orchestrator.py` and
   `agents/narrative_drafter.py`** section definitions to match the
   approved structure, preserving the existing grounding mechanism (every
   quoted figure traces to `figures_used`, agent never sees raw GL — this
   constraint doesn't change, only the section structure does).
3. **Rename/reframe the frontend component** (`junior-analyst-report.tsx`
   and its "AI draft" framing) to reflect that it produces the actual IAR
   deliverable, not an internal working summary.
4. **Confirm PDF export** (`exportToPrintablePdf`) still produces a
   correctly-formatted document under the new structure.

### Definition of Done
- [ ] IAR structure defined and explicitly approved by the product owner
      before implementation.
- [ ] Narrative sections + agent updated to match; grounding mechanism
      (figures_used traceability) intact and tested.
- [ ] Frontend component renamed/reframed accordingly.
- [ ] `backend-narrative` CI phase green.
- [ ] Product owner reviews a generated IAR against the approved structure
      and confirms it reads as a real IAR deliverable, not a generic
      AI summary.

---

## Phase 5 — MVP Acceptance

**Why this is last:** it's the integration checkpoint against PRD.md §7's
actual MVP success criteria, and can't meaningfully happen until Phases
0–4 are individually done — it's the first point where the whole system is
being judged as a whole rather than phase-by-phase.

### Tasks
1. Assemble (or use) a realistic ~20-document data room (GL, AR/AP aging,
   a couple of debt agreement PDFs) matching PRD.md's MVP bar.
2. Run it through the full pipeline end-to-end.
3. Hand-verify every number rendered anywhere in the UI or IAR export
   against the source documents.
4. Confirm all expected red flags fire, including the new outlier rule
   from Phase 3, with no false positives against the clean parts of the
   data.
5. Review the generated IAR against the Phase 4-approved structure.

### Definition of Done
- [ ] Every number in the UI and the exported IAR/databook hand-traces to
      source, zero exceptions, confirmed by the product owner directly
      (per PRD.md §7's accuracy bar).
- [ ] All planted/expected red flags detected; no unexpected false
      positives.
- [ ] Generated IAR accepted as MVP-quality by the product owner.
- [ ] Full CI green (`ci-gate`, all phase jobs + frontend).
- [ ] Product owner formally signs off that MVP (per `PRD.md` §1–§7) is
      complete.

---

## Parking Lot

Logged, not started. Surfaced during this planning pass or already known
from `PRD.md`/`ARCHITECTURE.md`; revisit after Phase 5 or when the product
owner explicitly reprioritizes.

- **Mapping Studio** — manual CoA mapping override UI (PRD.md §3.2).
- **Customer-level analytics** — needs customer-invoice ingestion (PRD.md §3.2).
- **Multi-party/external deal access + reviewer/permission roles beyond
  single-owner** — PRD.md §3.2/§8; the reviewer-role question may get
  simpler post-Phase 2 (finalized numbers reduce what a "reviewer" needs to
  do), worth revisiting the open question then rather than now.
- **OCR for scanned PDFs** — explicitly not MVP (PRD.md §3.2).
- **Benchmarking/comps against industry or historical deal data** (PRD.md §3.2).
- **Celery/Redis/PostgreSQL/S3 migration** — named in `plan.txt` as future,
  not started, not needed at current scale (ARCHITECTURE.md §2).
- **Error response shape inconsistency** between `HTTPException`
  (`{"detail"}`), request-validation 422s (`{"detail": [...]}`), and the
  global handler (`{"error","detail","request_id","endpoint"}`) —
  DESIGN.md §10.1 / ARCHITECTURE.md §10, a public API contract change,
  needs explicit sign-off, not a drive-by fix.
- **`(shell)` route group redundancy** with the root layout — ARCHITECTURE.md §10.
- **JWT non-revocability, single static encryption key with no rotation/KMS,
  O(n) user-lookup scans, auth rate limiting** — all flagged in
  SECURITY.md §9 as pre-production hardening, not MVP-blocking at current
  local/POC scale.
- **Frontend dependency advisories** — the old `STATUS.md` `npm audit`
  finding (8 incl. a critical Next.js advisory) is superseded by open
  Dependabot PRs (#30, #32–#38; #30 and #38 bump `next`). Triage/merge
  them; not part of the MVP accuracy/IAR/red-flag bar.

### Open decisions surfaced by the 2026-09-27 docs refresh
These need a product-owner call; the docs currently describe what exists.

- **Pipeline checkpointing: implement it, or drop it from the docs?**
  `CLAUDE.md` §3 used to require checkpoint reuse, a `--force` flag, and
  resume-from-last-good-checkpoint. `pipeline_orchestrator.py` has none of
  these (ARCHITECTURE.md §10 item 2); `CLAUDE.md` was reworded to describe
  current behavior. Pick one: build it (touches `pipeline_orchestrator.py`
  and the `/process` API) or keep the requirement out.
- **Scheduled e2e workflow: add it, or drop the claim?** Several docs said
  the `e2e` tier runs nightly; no such workflow exists. The docs now say
  "manual only." Pick one: add a `schedule:`/`workflow_dispatch` workflow
  (real-API cost, ~40 min per run) or keep it manual.
- **Inquiry Copilot model default.** `frontend/app/api/inquiry/assistant/route.ts`
  defaults to `claude-3-5-sonnet-latest`, which was recorded as retired
  (404) in commit `a289db3`; without `ANTHROPIC_MODEL` set, the Copilot
  silently falls back to keyword rules. Probably bump the default — code
  change not made (ARCHITECTURE.md §9.2).

### Other findings from the refresh (flagged, not fixed)
- **CI coverage gap:** `tests/test_api/test_inquiry.py` and
  `tests/test_api/test_settings.py` are unmarked (→ `integration` tier) but
  aren't listed in any `ci.yml` phase job, so they never run in CI. Also,
  several routers (`auth.py`, `ingestion.py`, `gl.py`, `inquiry.py`,
  `settings.py`) and `services/email.py` aren't in any path filter, so a
  change to only those triggers just lint + unit. See TESTING.md §6.
- **Stage bookkeeping drift:** `narrative_drafter` is missing from
  `deal_store`'s initial `stages` dict and its `progress_pct` stage list
  (ARCHITECTURE.md §10 item 9).
- **Stale test-module docstrings:** several test files still say "All tests
  use USE_MOCK_LLM=true" — contradicted by CI and `.claude/rules/testing.md` (TESTING.md §6).
