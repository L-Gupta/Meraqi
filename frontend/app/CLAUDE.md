# frontend/app — Next.js App Router pages

**Purpose:** The 15 routed pages plus the root layout and the Next.js Route Handlers. Each page folder holds a single `page.tsx`, so they're described here rather than in their own files.

**Contents**
- `layout.tsx` — root layout: Manrope font, `<Providers>`, `<AppShell>`. `globals.css` — design tokens (light/dark) + decorative `.tam-*` classes. `page.tsx` — `/`, redirected to `/login` by middleware.
- `(shell)/layout.tsx` — route group that wraps children in `AppShell` again; redundant with the root layout.
- Public (5): `welcome/`, `login/`, `signup/` (single step; personal-email domains rejected client-side only), `forgot-password/`, `reset-password/`. Signed-in users are redirected to `/upload`.
- Protected (10): `upload/` (create deal, upload, process), `dashboard/`, `financial-analysis/`, `risk-assessment/`, `customer-analytics/`, `documents/`, `reports/` (readiness + databook export), `inquiry/` (PBC tracker + decision queue), `notes/`, `settings/`.
- `api/` — Route Handlers: the mock BFF and the Inquiry Copilot (see `api/CLAUDE.md`).

**How it fits in:** `middleware.ts` (in `frontend/`) guards routes by cookie presence only; real auth happens on every FastAPI call. Pages compose `components/fdd/*` for real data. UX contracts: `docs/DESIGN.md` §10.2.

**Gotchas**
- Deal-data pages branch on `dealId`. With a deal, only real API data or an explicit "unavailable" state may render; without one, the dashboard, financial-analysis, risk-assessment, documents, reports, and customer-analytics pages fall back to mock demo views, inquiry prompts you to select a deal, and notes is local-only. The mock fallback is the Phase 0 suspect.
- The Copilot route's default model is retired (see `api/CLAUDE.md`).
- Errors surface inline at the failing action, not through a global toast system (`.claude/rules/frontend-error-handling.md`).
