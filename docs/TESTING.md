# TESTING.md — Test Strategy, Running Tests, and the CI Gate

> Written 2026-09-27 from `backend/pyproject.toml`, `backend/tests/**`,
> `.github/workflows/ci.yml`, `CLAUDE.md` §3/§3a, and `.claude/rules/testing.md`. Where
> those disagree with the code, the code wins and the gap is listed in §6.

## 1. Strategy

The full pipeline (ingest → parse → financial calc → LLM agents → report) is
slow (~40 min with real LLM calls), so tests are tiered and CI is scoped to
what changed. Two non-negotiables drive everything:

1. **No mock LLM outside the `unit` tier.** Integration and e2e tests hit the
   real Anthropic API (`USE_MOCK_LLM=false`). Mock mode exists only so
   `unit` stays fast and key-free, and so the app runs without a key. See
   `.claude/rules/testing.md` and [DECISIONS.md](DECISIONS.md).
2. **Deterministic numbers.** LLM output never produces a figure, so the
   financial assertions in integration tests stay stable even with a real
   model in the loop; where model *phrasing* legitimately varies, tests
   assert structure, not text (e.g. narrative tests accept 0–5 well-formed
   sections).

## 2. Tiers

Markers are declared in `backend/pyproject.toml`:

| Marker | Meaning | LLM | How a test gets it |
|---|---|---|---|
| `unit` | ms-scale, no I/O, no agent calls | none | explicit `@pytest.mark.unit` or module-level `pytestmark = pytest.mark.unit` |
| `integration` | real file I/O and/or a real (never mocked) agent call, scoped to one pipeline phase | real | **default** — `tests/conftest.py::pytest_collection_modifyitems` tags every unmarked test `integration` |
| `e2e` | full multi-stage pipeline over HTTP | real | explicit marker — only `test_pipeline/test_golden_path.py` and `test_pipeline/test_e2e_edge_cases.py` |

The default-to-integration hook runs `tryfirst` so `-m integration`
selection sees it.

Suite size on `main`: **28 test files, ~346 `test_*` functions** (before
parametrization) across `test_api/`, `test_pipeline/`, `test_security/`,
`test_storage/`.

## 3. Running the suite

From `backend/`, with the venv active and `.env` / `backend/.env.local`
providing `JWT_SECRET_KEY` and `FILE_ENCRYPTION_KEY` (the app won't import
without them — see README.md):

```bash
# Lint (always)
python -m ruff check .

# Fast loop — no LLM, no key needed
python -m pytest -m unit -q

# One phase, real API (what CI runs for that phase) — needs ANTHROPIC_API_KEY
USE_MOCK_LLM=false python -m pytest -m "unit or integration" -q \
  tests/test_pipeline/test_qoe_and_redflags.py tests/test_api/test_qoe_redflags.py

# Full pipeline acceptance — slow, real API, manual only
USE_MOCK_LLM=false python -m pytest -m e2e -q
```

On Windows PowerShell use `$env:USE_MOCK_LLM="false"; python -m pytest …`.
Setting `USE_MOCK_LLM=false` in `backend/.env.local` also works.

**Scope your runs.** Run the phase you touched, not the whole
`integration` tier — CI's path filters run the rest. The phase → test-file
map is the `run:` line of each job in `ci.yml` (summarized in §5).

Frontend (from `frontend/`): `npm run lint` and `npm run build`. There is
no frontend unit-test runner configured.

## 4. The `shared_mapped_gl` fixture (session-scoped LLM memoization)

`tests/conftest.py::shared_mapped_gl` is a `scope="session"` fixture that
runs real ingestion + **one real `CoAMapperAgent` call** over
`tests/fixtures/sample_gl.csv` and returns the resulting
`list[MappedGLLine]`. `test_financial_builder.py`, `test_nwc_analyzer.py`,
`test_net_debt_and_dcf.py`, and `test_qoe_and_redflags.py` all consume it.

**Why it exists** (commit `e0eae39`, 2026-08-03): each of those files used
to re-derive the same mapped GL through its own helper — in
`test_financial_builder.py`, via `setup_method`, so *every test method*
paid for its own real LLM call on identical input. Only the mapping step is
an LLM call; building statements from mapped lines is cheap, deterministic
Python. Caching just that step once per session cut a local real-API run
from ~40 min to ~13 min, which is what made "real API in CI on every PR"
affordable.

**Rules for using it:**
- Treat the returned lines as read-only — it's shared across the session.
- If a test needs different GL input, don't mutate this fixture's data; build
  its own input (and accept the extra LLM call, or mark it `unit` and avoid
  the agent entirely).
- A change to ingestion, `financial_builder`, or `coa_mapper.py` affects
  every consumer — which is why those paths trigger every downstream CI
  phase (§5).

Related: `tests/auth_helpers.py::authenticate(client)` signs up a unique
user on a `TestClient` so the session cookie rides along on every request —
required now that every deal-scoped route checks ownership.

## 5. CI gate behavior (`.github/workflows/ci.yml`)

Triggers: every push to `main` and every PR targeting `main`. A newer push
on the same ref cancels the in-flight run (`concurrency: cancel-in-progress`).

| Job | Runs when | What |
|---|---|---|
| `changes` | always | `dorny/paths-filter@v3` maps the diff to phases |
| `backend-lint` | always | `ruff check .` (Python 3.11) |
| `backend-unit` | always | `pytest -m unit` over the whole suite (mock default; unit tests make no agent calls) |
| `backend-ingestion` | ingestion/upstream paths | `test_ingestion.py`, `test_multi_document_ingestion.py`, `test_schedule_ingestion.py`, `test_api/test_ingestion.py` |
| `backend-financial-builder` | upstream paths | `test_financial_builder.py`, `test_api/test_financials.py` |
| `backend-qoe-redflag` | upstream + QoE/red-flag paths | `test_qoe_and_redflags.py`, `test_api/test_qoe_redflags.py` |
| `backend-nwc` | upstream + NWC paths | `test_nwc_analyzer.py` |
| `backend-net-debt-dcf` | upstream + net debt/DCF paths | `test_net_debt_and_dcf.py` |
| `backend-contracts` | upstream + contracts paths | `test_contract_analysis.py`, `test_contract_parser.py` |
| `backend-narrative` | upstream + narrative paths | `test_narrative_drafter.py` |
| `backend-databook` | upstream + databook paths | `test_databook.py` |
| `backend-auth-security` | shared paths + `api/v1/notes.py` | `test_api/test_auth.py`, `test_api/test_authorization.py`, `tests/test_security/` |
| `backend-notes` | shared + notes paths | `test_storage/test_note_store.py`, `test_api/test_notes.py` (no API key needed) |
| `backend-documents-api` | upstream + documents/tie-outs/financial API paths | `test_api/test_middleware.py` |
| `frontend` | `frontend/**` | `npm ci`, `npm run lint`, `npm run build` (Node 22) |
| `ci-gate` | always (`if: always()`) | passes only if every job above is `success` or `skipped` |

- **Integration jobs run `-m "unit or integration"` with
  `USE_MOCK_LLM: "false"` and a real `ANTHROPIC_API_KEY`** (except
  `backend-notes`). Secrets: `ANTHROPIC_API_KEY`, `JWT_SECRET_KEY`,
  `FILE_ENCRYPTION_KEY`.
- **"Shared" paths** (config, main, pipeline_orchestrator, agents/base,
  schemas, storage, security, deps, pyproject, conftest, auth_helpers,
  ci.yml) trigger every phase. **"Upstream" paths** (ingestion,
  coa_mapper, financial_builder) trigger every phase that consumes mapped GL.
- **Branch protection should require only `ci-gate`.** Skipped jobs don't
  block; any failure or cancellation does.
- Per `CLAUDE.md` §3a, a PR is mergeable only after `ci-gate` is green on
  GitHub — never on a self-reported local run.
- `dependency-review.yml` also runs on PRs (reports; doesn't fail on
  severity as configured).
- **The `e2e` tier is not in any workflow** — no nightly, no scheduled, no
  manual-dispatch job. It runs only when invoked locally. Whether to add a
  scheduled workflow is an open decision (PHASES.md Parking Lot).

## 6. Coverage expectations and known gaps

**Expectations** (from `CLAUDE.md` §3, `.claude/rules/testing.md`):
- Every new deal-scoped endpoint gets added to
  `test_api/test_authorization.py`'s IDOR sweep — mandatory, not optional.
- New pipeline stages are tested in isolation (and their output schema
  validated by a Pydantic model) before being wired into `STAGE_ORDER`.
- Ruff clean + the touched phase's tier green before calling a task done;
  `next lint` + `next build` for frontend changes.
- A new test file must be added to the matching `ci.yml` job's `run:` list,
  and any new source path to the matching filter — otherwise CI never runs it.
- No line-coverage tool is configured (no `pytest-cov`), so there is no
  numeric coverage target.

**Known gaps (flagged 2026-09-27, not fixed):**
1. **Never run in CI:** `tests/test_api/test_inquiry.py` (13 tests) and
   `tests/test_api/test_settings.py` (5 tests) are unmarked → `integration`,
   but aren't listed in any job's `run:` line. Their tests are neither
   `unit` (so `backend-unit` skips them) nor listed in a phase job.
2. **No path filter covers** `backend/app/api/v1/auth.py`, `ingestion.py`,
   `gl.py`, `inquiry.py`, `settings.py`, `router.py`,
   `backend/app/services/email.py`, or `backend/app/logging_config.py` — a
   change touching only those files runs lint + unit and nothing else.
   (`auth_security`'s filter lists `api/v1/notes.py` instead of `auth.py`,
   which looks like a copy-paste slip.)
3. **Stale test docstrings:** `test_api/test_financials.py`,
   `test_api/test_qoe_redflags.py`, and several `test_pipeline/*` modules
   still say "All tests use USE_MOCK_LLM=true (no API cost)." CI runs them
   with the real API; the docstrings predate that policy.
4. **One accepted flaky test:** `test_contract_analysis.py` carries a
   `@pytest.mark.flaky` (via `pytest-rerunfailures`) for a known real-LLM
   non-determinism in clause-summary phrasing.
