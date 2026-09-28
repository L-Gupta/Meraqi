# MEMORY.md — TAM Living Status File

> The single source of truth for "where are we right now." Read this first
> in any new session, before [PHASES.md](PHASES.md). Edit in place — it's a
> snapshot, not a log (history lives in git and
> [PHASES_ARCHIVE.md](PHASES_ARCHIVE.md)). Last updated 2026-09-27.

---

## Current Status

- **Active phase:** [Phase 0 — Fix the Dashboard Display Bug](PHASES.md#phase-0--fix-the-dashboard-display-bug-current--blocker).
  Diagnosis only; no fix written; root cause not confirmed live. Next:
  Phase 1 (trust audit). No numbered phase is complete yet.
- **`main`:** docs-only merges since PR #29 (PR #40 docs refresh,
  2026-09-27). No code has changed since 2026-08-05.
- **In flight:**
  - Docs refresh merged as PR #40; the `.claude/rules/` split follows on
    `chore/rules-to-claude-dir`.
  - `feat/qoe-adjustment-override` — uncommitted QoE override work, blocked
    on a product decision (Phase 2). Don't build on it.
- **Open Dependabot PRs:** #30, #32–#38 (npm), untriaged.

---

## Active Context

### Phase 0 — dashboard shows "random" numbers (blocking)
Leading hypothesis (static code reading only, **not confirmed live**):
`frontend/app/dashboard/page.tsx` falls through to the mock "Executive
Overview" view when `dealId` is falsy/stale. That view computes several KPIs
from invented formulas (`predictedValuation = adjustedLtm *
valuationMultiple`, "Normalized Earnings" = `adjustedLtm * 0.98`, a
hardcoded `"$0.4M"` tax exposure). Ruled out: the `YYYY-MM-DD` vs `YYYY-MM`
period-key mismatch (fixed in PR #21 via `lookupByPeriod()`).

Next steps, none done yet:
1. Live check: DevTools Network (`/api/deal/summary` = mock vs.
   `/api/v1/deals/{id}/financials/summary` = real) and
   `localStorage['tam-global-state'].dealId`.
2. If mock branch confirmed: trace why `dealId` is null/stale —
   `use-global-store.ts` persistence, or the Topbar auto-select effect in
   `app-shell.tsx` (re-runs on every window `focus`).
3. If real branch renders but numbers are wrong: hand-compare API responses
   against the source GL fixture.
4. Fix on a `fix/` branch.

No file under `frontend/app/dashboard/`, `deal-summary-banner.tsx`,
`real-dashboard.tsx`, or `app-shell.tsx` has been modified for this.

### Phase 2 subject — QoE override (uncommitted, blocked)
On `feat/qoe-adjustment-override`, uncommitted: `schemas/qoe.py` (override
fields), `qoe_engine/orchestrator.py` (`apply_override()`,
`add_manual_adjustment()`), `api/v1/qoe.py` (`PATCH`/`POST
/deals/{id}/qoe/adjustments…`), `qoe_engine/normalizer.py`. The
`normalized_amount` overwrite path violates `.claude/rules/engine-numbers-finalized.md` ("engine numbers
are finalized"). Open: does a categorical accept/reject survive? Does
manual-add survive? **Product owner decides** (PHASES.md Phase 2 Task 1);
PRD.md §3.1/Flow 2 get rewritten after (Phase 2 Task 4).

**Housekeeping for that branch:** the `CLAUDE.md` wording fix and the
`docs/` + `.claude/rules/` files that used to sit uncommitted in its
working tree are now on `main`. The branch should be brought up to `main`
before its QoE work is committed, so none of those get committed twice.

### Open decisions awaiting the product owner
Full text in [PHASES.md](PHASES.md) Parking Lot → "Open decisions":
1. Pipeline checkpointing — implement, or keep out of the docs?
2. Scheduled e2e workflow — add, or keep e2e manual-only?
3. Inquiry Copilot default model (`claude-3-5-sonnet-latest`, retired) —
   bump it?

### Known issues (not blocking)
- **LLM can alter a QoE figure on `main`:** `agents/qoe_reviewer.py` lets a `modify` decision overwrite `adjustment_amount` with the model's `corrected_amount` (and leaves `normalized_amount` stale) — violates `.claude/rules/llm-usage.md`. Found 2026-09-27; needs a product-owner call on the fix (likely remove `modify`, or turn it into reject + flag). PHASES.md Parking Lot.
- No general outlier/plausibility red flag rule (Phase 3; design undecided,
  PRD.md §8).
- CI never runs `test_api/test_inquiry.py` / `test_api/test_settings.py`
  integration tests; several routers (`auth`, `ingestion`, `gl`, `inquiry`,
  `settings`) and `services/email.py` are in no CI path filter
  (TESTING.md §6).
- `narrative_drafter` missing from `deal_store` stage bookkeeping
  (ARCHITECTURE.md §10 item 9).

---

## Resolved (compressed)

- **2026-09-27** — Nested `CLAUDE.md` context hierarchy added (30 files across `backend/`, `frontend/`, `.github/`); root `CLAUDE.md` restructured as the entry point with a "Where to Look" table and a mandatory Session-End Maintenance checklist (§6); `context-hierarchy` skill + `context-sync` rule ported from the CS639 p2 project.
- **2026-09-27** — `docs/` committed (was untracked); ARCHITECTURE/PRD/RULES/
  DESIGN/PHASES refreshed against PRs #19–#29; API, SCHEMA, GLOSSARY,
  DECISIONS, TESTING, SECURITY, PHASES_ARCHIVE added; `STEPS.md`/`STATUS.md`
  bannered as superseded; `CLAUDE.md` mock-LLM fix committed separately from
  the QoE branch; `CLAUDE.md` §3/§3a reworded to drop the nonexistent
  checkpointing and nightly e2e (PR #40). Same day: `docs/RULES.md` split
  into `.claude/rules/` (one file per rule, auto-loaded by Claude Code).
- **2026-08-10** — mock-LLM policy settled: mock only in the `unit` tier
  (`.claude/rules/testing.md`). "Engine numbers are finalized" rule stated (`.claude/rules/engine-numbers-finalized.md`).
- **2026-08-03 → 08-05 (PRs #1–#29)** — auth/encryption/IDOR, real-API CI,
  notes, settings, inquiries, decision queue, password reset via email,
  dead pages removed, one-step signup, Margin/Cost QoE, full databook,
  single readiness source. Details in PHASES_ARCHIVE.md.

---

## Maintenance Protocol

Mandatory for any session (human or AI) that finishes a task here:
1. Update **Current Status** immediately — before the next task, not at
   session end.
2. Move finished items out of **Active Context** into a one-line
   **Resolved** entry (dated). When a PHASES.md phase completes, move its
   section to PHASES_ARCHIVE.md.
3. Never describe a state the repo isn't in. Unsure whether something is
   done? Check the code or ask (`.claude/rules/if-in-doubt.md`).
4. At session start, cross-check this file against `git status`,
   `git log`, and the code it names — treat it as a strong lead, not a
   verified fact (`CLAUDE.md` §3a: no self-reported done).
