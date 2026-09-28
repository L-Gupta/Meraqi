# .github — CI and dependency automation

**Purpose:** The GitHub Actions workflows that gate merges to `main`, plus Dependabot. Gate behavior in detail: `docs/TESTING.md` §5.

**Contents**
- `workflows/ci.yml` — on push/PR to `main`: path-filtered (`dorny/paths-filter`) per-phase backend jobs (Python 3.11, real Anthropic API, `USE_MOCK_LLM=false`), always-on Ruff + `unit`, frontend `npm run lint` + `build` (Node 22), and the aggregating `ci-gate` job.
- `workflows/dependency-review.yml` — dependency-review action on PRs; reports, doesn't block by severity.
- `dependabot.yml` — weekly pip / npm / github-actions update PRs.

**How it fits in:** `ci-gate` is the single required check; `CLAUDE.md` §3a makes a green gate the only definition of mergeable.

**Gotchas**
- Filters are flat lists with no YAML anchors on purpose (`- *anchor` nests instead of merging).
- A new test file or router must be added to the right job/filter, or CI silently skips it; several routers and two test files are currently uncovered (`docs/TESTING.md` §6).
- No workflow runs the `e2e` tier (open decision, PHASES.md Parking Lot).
- `ci.yml` is in the "shared" filter — editing it triggers every backend job (real-API cost).
