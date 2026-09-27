# Testing Policy

Extends `CLAUDE.md` §3's tiered strategy — read that first.

## Mock-LLM tiering (never mock outside `unit`)

- `unit` — no LLM calls at all (mock or real); ms-scale.
- `integration` — real file I/O **and** a real (never mocked) Anthropic
  API call, scoped to one pipeline phase. `USE_MOCK_LLM=false` always.
- `e2e` — the full real pipeline over HTTP, real API calls throughout;
  on-demand only (`pytest -m e2e`, run manually), never a merge gate
  (`CLAUDE.md` §3a). No CI workflow runs it — whether to add a scheduled
  one is an open decision (`docs/PHASES.md` Parking Lot).
- Local/interactive dev defaults to mock (`use_mock_llm: bool = True` in
  `config.py`) purely so the pipeline is runnable without a key — but per
  the product owner's standing instruction, any AI-driven test run in this
  repo (including you) defaults to the real API (`USE_MOCK_LLM=false`, or
  simply don't override the integration tier's default) unless the task is
  specifically the `unit` tier.

Mock mode (`_mock_response()` fixtures, dispatched via
`settings.use_mock_llm`) exists solely so the `unit` tier stays fast and
dependency-free.

*History:* `CLAUDE.md` §3 once said integration tests use "mocked LLM
(USE_MOCK_LLM=1)", contradicting `pyproject.toml`'s marker docstring ("real
(never mocked) LLM/agent call") and every integration job in `ci.yml` (all
`USE_MOCK_LLM: "false"`). Resolved by the product owner in favor of the
implemented behavior; `CLAUDE.md` §3/§3a were corrected to match.

## Other testing rules

- **Every new deal-scoped endpoint gets added to the IDOR regression suite**
  (`test_authorization.py`) — see [deal-ownership.md](deal-ownership.md).
- **New pipeline stages/features are tested in isolation before being wired
  into the default stage order** — `CLAUDE.md` §3's "build stage N, test
  it, merge, then start stage N+1" discipline. Don't build ahead of what's
  verified.
- **Ruff (backend) / `next lint` + `next build` (frontend) pass before any
  task is done** — `CLAUDE.md` §5, load-bearing for the CI gate in §3a.
- **Tooling:** `pytest`, markers `unit`/`integration`/`e2e` per
  `pyproject.toml`, `fastapi.testclient.TestClient`, shared fixtures in
  `tests/conftest.py` and `tests/auth_helpers.py::authenticate()`.
