# CLAUDE.md — TAM (M&A Due-Diligence Tool)

This file governs how Claude Code works in this repository. It's the entry point: it owns
**process** (branching, commits, CI gate, session-end maintenance) and points everywhere else for
architecture, testing, and security. Follow it exactly unless the user explicitly overrides it in
a session.

## 0. Where to Look

Start every session by reading `docs/MEMORY.md` (current status). Then consult:

| For… | Read |
|---|---|
| What's happening right now, active blockers | `docs/MEMORY.md` |
| What to build next; phase Definitions of Done; Parking Lot | `docs/PHASES.md` (completed work: `docs/PHASES_ARCHIVE.md`) |
| Product scope, users, MVP bar, non-goals | `docs/PRD.md` |
| System structure, tech stack, integrations, LLM model assignments | `docs/ARCHITECTURE.md` |
| Every endpoint (method, path, auth, shapes, errors) | `docs/API.md` |
| Persisted data, `data/` layout, processed-report catalog, background tasks | `docs/SCHEMA.md` |
| API conventions, UX contracts, design system | `docs/DESIGN.md` |
| Test tiers, how to run tests, the LLM memoization fixture, CI gate details | `docs/TESTING.md` |
| Threat model, auth/crypto/secrets controls, known security gaps | `docs/SECURITY.md` |
| Why something is the way it is | `docs/DECISIONS.md` (append-only) |
| Domain and project terms | `docs/GLOSSARY.md` |
| Hard rules (no LLM math, finalized numbers, IDOR, encryption, logging, stacks…) | `.claude/rules/*.md` — loaded automatically |
| A specific directory's purpose, files, and gotchas | that directory's `CLAUDE.md` — loaded automatically when you work there (hierarchy: `backend/`, `backend/app/**`, `backend/tests/**`, `frontend/**`, `.github/`) |
| Human setup / run / test commands | `README.md` |

## 1. Branching Strategy

Every unit of work gets its own branch. Never commit directly to `main`.

| Prefix   | Used for                                                        | Branched from |
|----------|------------------------------------------------------------------|---------------|
| `feat/`  | New feature implementation                                       | `main`        |
| `test/`  | Writing/running tests for a feature (see below)                  | the `feat/` branch it tests |
| `fix/`   | Bug fixes                                                         | `main`        |
| `exp/`   | Experiments, spikes, diagnostics, one-off checks — not for prod   | `main`        |
| `chore/` | Maintenance: deps, config, docs, refactors with no behavior change | `main`        |

Naming: `feat/document-encryption`, `test/document-encryption`, `fix/argon2-verify-crash`,
`exp/check-pdfplumber-memory-usage`, `chore/bump-cryptography-version`.

### Feature workflow (the important one)
For every new feature:
1. Branch `feat/<feature-name>` from `main`.
2. Implement the feature on that branch, committing atomically as you go (see §2).
3. Once the implementation is in a working state, branch `test/<feature-name>` off
   the `feat/` branch.
4. Write and run tests on the `test/` branch. If tests reveal bugs, fix them back
   on the `feat/` branch (don't patch bugs inside the test branch), then rebase
   `test/` on top.
5. Once tests pass cleanly, merge `test/<feature-name>` back into `feat/<feature-name>`.
6. Open a **pull request** from `feat/<feature-name>` into `main` — do not merge
   directly. See §3a for what happens next.
7. Only start the next feature/slice once that PR has been merged (i.e. CI is
   green and the merge has actually happened) — not as soon as local testing looks
   done.

### Bugfix / check workflow
- A bug found during manual use or review → `fix/<short-bug-description>`.
- A diagnostic, spike, or "let's just check something" task → `exp/<short-description>`.
  `exp/` branches are disposable — they don't need to be merged, and Claude Code
  should say so explicitly rather than assuming an `exp/` branch is headed for `main`.

Observed conventions (PRs merged on GitHub, never locally; same-branch `test:` commits):
`.claude/rules/git-conventions.md`.

## 2. Commit Discipline

- Commit early and often — after every coherent, working unit of change, not
  just at the end of a session. A good rule of thumb: if you've touched more
  than ~3 files or ~1 logical concern without committing, stop and commit.
- Every commit must leave the repo in a working state (code runs, imports
  resolve) — no "WIP, broken" commits.
- Use Conventional Commits format:
  - `feat: add AES-256-GCM encryption for uploaded documents`
  - `fix: correct nonce reuse bug in file_crypto decrypt path`
  - `test: add tamper-detection test for GCM auth tag`
  - `chore: pin cryptography to 42.x`
  - `docs: note KMS migration seam in file_crypto.py`
- Keep commits atomic: one logical change per commit. Don't bundle an
  unrelated refactor into a feature commit.
- Before merging any `feat/` or `fix/` branch into `main`, squash-check the
  history for stray WIP commits and clean it up if needed.

## 3. Testing

Tiers, markers, commands, the `shared_mapped_gl` fixture, and coverage expectations live in
**`docs/TESTING.md`**; the mock-LLM policy lives in `.claude/rules/testing.md` (never mock the LLM
outside the `unit` tier). Process rules that stay here:

- Don't run the full pipeline or the whole `integration` tier as your default loop — run `unit`,
  then only the phase you touched. CI runs the rest.
- `e2e` is manual-only (`pytest -m e2e`) and never a merge gate.
- **A feature or pipeline stage isn't "done" — and the next dependent one doesn't start — until**
  its tests pass with zero known failures and its output is a validated Pydantic model. Build
  stage N, test it in isolation (mocked *upstream data* is fine; a mocked LLM is not outside
  `unit`), merge, *then* start stage N+1.
- Pipeline stages always recompute; there is no checkpoint reuse, `--force`, or resume
  (`docs/SCHEMA.md` §4). Whether to build that is an open decision (`docs/PHASES.md` Parking
  Lot) — don't build it without that decision.

## 3a. CI Gate — No Self-Reported "Done"

A PR into `main` is not considered mergeable based on a self-reported summary
(e.g. "lint/build clean, verified manually"). It is only mergeable once GitHub
Actions CI has independently run and passed on that PR — concretely, once the
single `ci-gate` check is green (what it aggregates: `docs/TESTING.md` §5).

- Do not merge a `feat/` branch into `main` until that PR shows a green CI
  check. If CI is red, fix the branch and push again — don't merge around it.
- When a slice/feature is implementation-complete, the correct status update is
  "PR open, waiting on CI" — not "done and merged" — until the merge has
  actually happened post-green-CI.
- CI must stay fast: never add the full `e2e` pipeline to it. No workflow runs `e2e`
  today (adding a scheduled one is an open decision — `docs/PHASES.md` Parking Lot).

## 4. Security-Sensitive Code

Controls, threat model, and known gaps: **`docs/SECURITY.md`**. The hard rules (no custom
crypto, no raw I/O under `data/`, never log secrets or decrypted content, `require_deal_owner`
on every deal route) are in `.claude/rules/` and load automatically. The process rule that stays
here: **any change touching `security/`, `storage/`, auth, key loading, or file I/O under
`data/` must be flagged explicitly in the commit message and PR description**, even if it looks
small.

## 5. General

- Don't touch business logic (deal parsing, financial calculations) when the
  task is scoped to I/O, security, or infra — keep changes surgical.
- Before starting multi-file work, state a short plan of which files will be
  touched.
- Run Ruff and the relevant test tier before considering any task complete.
- When code and a doc disagree, say so and let the product owner decide
  (`.claude/rules/if-in-doubt.md`).

## 6. Session-End Maintenance

**Run this proactively — without being asked — at every natural session-end point:** when the
user says a piece of work is done, before a final "done / merged / PR open" summary, when
wrapping up or switching to an unrelated task, and before ending the session. Don't wait for an
explicit "update the docs." Work through every step, even when you expect nothing to change.

1. **`docs/MEMORY.md`** — update Current Status and Active Context to match reality
   (`git status`, `git log`, what actually merged). Follow MEMORY.md's own Maintenance Protocol:
   edit in place, move finished items to a one-line dated **Resolved** entry, keep it a snapshot
   rather than a log.
2. **`docs/PHASES.md`** — if a phase's status changed, update it. When a phase's Definition of
   Done is met *and confirmed by the product owner*, move its whole section to
   `docs/PHASES_ARCHIVE.md`. New out-of-scope ideas go in the Parking Lot.
3. **`docs/DECISIONS.md`** — append one dated line per real decision made this session (what,
   why, evidence). Append only; never edit old entries. Implementation details aren't decisions.
4. **Context-sync check** — for every directory whose files changed this session (check
   `git diff --name-only` against the session's starting point), read that directory's nearest
   `CLAUDE.md` and verify it still describes the directory. Update it if a module was added,
   removed, or renamed, or a responsibility or gotcha changed. Don't update it for line-level
   edits. Touch a parent `CLAUDE.md` only if what it tells a top-down reader changed
   (`.claude/rules/context-sync.md`). Edit what's stale; never regenerate from source. If
   unsure, flag it to the user instead of guessing.
5. **Flag reference-doc follow-ups; don't rewrite them speculatively.** If this session added
   or changed endpoints → say whether `docs/API.md` needs an update. Persisted models,
   `data/` files, or pipeline stages → `docs/SCHEMA.md`. Tests, markers, or CI jobs →
   `docs/TESTING.md` (and whether the new test file is in `ci.yml`). Auth, crypto, or secrets →
   `docs/SECURITY.md`.
6. **Report it.** End your summary with a short "Session-end maintenance" block: say the
   checklist ran and list exactly what changed (file + one line each) and what was flagged. If
   nothing needed updating, say "nothing needed updating."

Doc updates made by this checklist follow §1–§2 like any other change: commit them on the
current branch if they belong to its work, otherwise on a `chore/` branch.
