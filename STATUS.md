# Repository Status

| Current | Should Be |
| --- | --- |
| Repository is connected to `origin`; parent upstream changes from `arymaheshwari/TAM` have been merged locally, so `main` is currently ahead of `origin/main` by 3 commits. | Push the synced branch to `origin` after reviewing local changes, and keep upstream sync as a normal workflow before major changes. |
| Backend FastAPI app starts successfully and responds at `/health` with `status: ok`. | Add deployment health checks that verify `/health` automatically in CI/CD and runtime monitoring. |
| Backend API can create deals through `POST /api/v1/deals`. | Add automated API smoke tests that run on every pull request. |
| Backend dependencies are installed in `backend/.venv`; the app can run locally with Uvicorn. | Standardize the local Python version around the project target, preferably Python 3.11, and document setup in a root README. |
| Backend test suite is working: `67 passed`, including the new upstream E2E edge-case test. | Add backend tests to CI so regressions are caught before merge. |
| Backend pipeline modules are covered by tests for ingestion, financial builder, QoE, and red flag logic. | Expand coverage to API routes, upload/process lifecycle, failure cases, and frontend/backend integration. |
| Backend has useful development logging through Python `logging`, module loggers, and `logger.exception` on pipeline failures. | Add production-grade logging: structured JSON logs, request IDs, request/response middleware, latency, status codes, audit events, and external log sink support. |
| Backend CORS allows local frontend ports including `3000`, `3001`, and Vite-style `5173`. | Move local-only CORS origins into environment-specific config before production. |
| Backend config is environment-aware through `.env` and `backend/.env.local`. | Add `.env.example` or root setup docs that list required and optional variables. |
| Frontend dependencies install successfully with `npm install`. | Keep dependencies updated and review lockfile changes intentionally. |
| Frontend Next.js app starts locally and renders the UI. | Make the desired initial route explicit; if this is an analyst app, decide whether startup should land on login, welcome, dashboard, or report screen. |
| Frontend production build completes successfully with `npm run build`. | Add frontend build to CI so broken builds block merges. |
| Frontend lint currently passes with `npm run lint`. | Keep lint as a required CI check. |
| UI routes exist for dashboard, documents, financial analysis, risk assessment, inquiry, reports, upload, notes, settings, login, signup, onboarding, and welcome. | Align entry flow with the intended product behavior; user noted the UI may need to load a report screen instead of the login screen. |
| UI has reusable components for layout, tables, charts, KPI cards, modals, QoE center, and red flag center. | Continue consolidating duplicated page logic into shared components as features stabilize. |
| Frontend has mock API/data layers that make the UI usable without backend data for many dashboard pages. | Replace mock/synthetic values with backend-computed values where the spec marks placeholders. |
| `frontend/lib/api/fdd-client.ts` is wired to the backend at `http://localhost:8000/api/v1`. | Move the backend API base URL to an environment variable such as `NEXT_PUBLIC_API_BASE_URL`. |
| There is detailed product/spec documentation in `plan.txt`, `STEPS.md`, and `frontend/docs/backend-ai-engine-spec.md`. | Add a root-level README that summarizes how to install, run, test, and troubleshoot the full stack. |
| Upstream added `.github/workflows/dependency-review.yml` for dependency review. Full build/test CI is still missing. | Add CI/CD, starting with PR checks for backend tests, backend lint, frontend lint, frontend build, and dependency audit. |
| No Dockerfile or compose setup was found. | Add Dockerfiles and a compose file when deployment/runtime parity becomes important. |
| `npm audit` reports 8 frontend vulnerabilities, including a critical Next.js advisory. | Update dependencies carefully, likely starting with Next.js and related transitive packages, then rerun build/lint. |
| Backend Ruff is configured in `backend/pyproject.toml`. | Fix current Ruff findings; latest scan found 95 errors, with 31 auto-fixable. |
| Ruff findings are mostly minor cleanup: import ordering, long lines, unused imports, modern type-hint updates, and an ambiguous variable name in tests. | Run `python -m ruff check . --fix` in `backend`, manually handle remaining line-length/type-hint issues, then make Ruff a CI gate. |
| Backend tests pass despite warnings. | Reduce test warning noise; latest run produced many `datetime.utcnow()` deprecation warnings from dependencies/runtime paths. |
| Some backend comments still describe pipeline stages as stubs even though many stages now have implementation. | Refresh outdated comments/docs so they match the current backend implementation. |
| Frontend docs explicitly identify placeholder/synthetic calculations and replacement formulas. | Track placeholder replacement as implementation tasks and connect each visible KPI to authoritative backend outputs. |
| Inquiry page contains a visible discussion-thread placeholder. | Replace placeholder discussion UI with real comments, seller responses, and attachment handling or hide it until implemented. |
| Settings page labels Mapping Studio as a placeholder. | Either implement Mapping Studio or make it clearly unavailable/roadmapped in product copy. |
| Local frontend/backend communication was verified through health checks, deal creation, frontend page load, and CORS preflight. | Add an automated end-to-end smoke test that starts both services and validates browser/API communication. |
