# TAM — Financial Due Diligence Engine

A local proof-of-concept M&A financial-due-diligence tool: a FastAPI backend
(Python 3.11) that ingests a data room, builds deterministic financial
statements, and runs Quality-of-Earnings, red-flag, working-capital, net-debt,
DCF, contract, and narrative analysis; plus a Next.js frontend
(TypeScript) for analysts. LLMs (Anthropic Claude) are used only for
semantic tasks — every number is computed in Python.

## Documentation

Start with [`docs/`](docs/):

| Doc | What it covers |
|---|---|
| [docs/MEMORY.md](docs/MEMORY.md) | Where things stand right now — read first |
| [docs/PHASES.md](docs/PHASES.md) | The build plan (current + upcoming phases); [PHASES_ARCHIVE.md](docs/PHASES_ARCHIVE.md) for what's done |
| [docs/PRD.md](docs/PRD.md) | Product scope, users, MVP bar |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System structure, tech stack, integrations, model assignments |
| [docs/API.md](docs/API.md) | Every endpoint |
| [docs/SCHEMA.md](docs/SCHEMA.md) | Persisted data, on-disk layout, background tasks |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system + API/UX contracts |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model and security controls |
| [docs/TESTING.md](docs/TESTING.md) | Test tiers, how to run, CI gate |
| [docs/RULES.md](docs/RULES.md) | Operating rules for AI agents in this repo |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Append-only decision log |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Domain and project terms |
| [CLAUDE.md](CLAUDE.md) | Branching, commits, CI gate, testing policy |

`STATUS.md` and `STEPS.md` are historical and superseded.

## Prerequisites

- Python **3.11+** (CI uses 3.11)
- Node.js **20+** and npm (CI uses Node 22)
- An Anthropic API key for anything beyond the `unit` test tier or the
  no-key mock mode
- Windows only, optional: `start.bat` for one-click startup

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
```

Create the env file. `config.py` reads the **repo-root** `.env` first, then
`backend/.env.local` (overrides). Start from the template:

```bash
cp backend/.env.example .env        # run from the repo root
```

Then fill in the two **required** secrets — the backend refuses to start
without them:

```bash
# FILE_ENCRYPTION_KEY — base64 of 32 random bytes (AES-256 master key)
python -c "import base64, os; print(base64.b64encode(os.urandom(32)).decode())"
# JWT_SECRET_KEY — at least 32 characters
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

For real LLM calls set `ANTHROPIC_API_KEY=...` and `USE_MOCK_LLM=false`
(the code default is `true`, which runs the pipeline on canned fixture
responses — fine for clicking around without a key, not for real analysis).
`ANTHROPIC_MODEL` defaults to `claude-sonnet-5`; three agents are pinned to
`claude-opus-5` regardless (docs/ARCHITECTURE.md §9.3).

Optional: `SMTP_HOST` (+ port/user/password/from) for real password-reset
email. Without it, reset emails are written to `backend/data/dev_outbox/`.

### 2. Frontend

```bash
cd frontend
npm install
```

Optional `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # default if unset
ANTHROPIC_API_KEY=...                            # enables the Inquiry Copilot's LLM mode
ANTHROPIC_MODEL=claude-sonnet-5                  # set this: the code's default model is retired
```

## Run

**Windows one-click:** double-click or run `start.bat` from the repo root.
It checks for `backend/.venv` and `frontend/node_modules` (running
`npm install` if needed), starts the backend (`uvicorn` on
`127.0.0.1:8000`, `--reload`) and the frontend (`npm run dev` on port 3000)
in their own windows, waits for `GET /health`, and opens the browser. It
also starts Docker Desktop and runs `docker compose up` *only if* a compose
file exists — none does today, and nothing requires Docker. Close the two
windows to stop.

**Manually (any OS):**

```bash
# terminal 1
cd backend && uvicorn app.main:app --reload --port 8000
# terminal 2
cd frontend && npm run dev
```

Then open http://localhost:3000 → sign up → you land on `/upload` → create a
deal, upload files (sample data in `backend/test-docs/`), and process it.
Backend API docs: http://localhost:8000/docs. Runtime data lives in
`backend/data/` (gitignored, encrypted at rest).

## Test

From `backend/` (details and phase → test-file map in
[docs/TESTING.md](docs/TESTING.md)):

```bash
python -m ruff check .                     # lint
python -m pytest -m unit -q                # fast, no LLM, no key needed
# real API, scoped to the phase you touched:
USE_MOCK_LLM=false python -m pytest -m "unit or integration" -q tests/test_pipeline/test_nwc_analyzer.py
# full pipeline, slow (~40 min), manual only:
USE_MOCK_LLM=false python -m pytest -m e2e -q
```

Integration and e2e tests use the real Anthropic API by policy — no mock
LLMs outside the `unit` tier.

From `frontend/`: `npm run lint` and `npm run build`.

CI (GitHub Actions) runs lint, unit, the affected phases' integration tests,
and the frontend build on every PR to `main`; a PR merges only once the
`CI gate` check is green.

## Security

This is a local POC, but it's built to handle real financial documents. In
short: Argon2id-hashed passwords and a JWT session cookie; every deal owned
by exactly one user and checked on every deal-scoped endpoint; every file
the app writes encrypted with AES-256-GCM under a single `FILE_ENCRYPTION_KEY`
(move to a KMS/Vault before any production use); password-reset links
**emailed** (SMTP, or the local dev outbox) and never returned in the API
response; a document-access audit log at `backend/data/access.log`. The
backend doesn't terminate TLS — put a reverse proxy in front of it for
anything beyond localhost (Caddy/nginx examples in
[docs/SECURITY.md](docs/SECURITY.md) §8, which also lists known gaps such as
no rate limiting).
