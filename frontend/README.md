# TAM Frontend

Frontend for TAM (Financial Due Diligence Automation), built with Next.js
15 App Router + React 19 + TypeScript + Tailwind + hand-built shadcn-style
components. It talks to the FastAPI backend in `../backend`. Full-stack
setup is in the root [README.md](../README.md); architecture, API, and
design docs are in [`../docs/`](../docs/).

## Run locally

1. Install Node.js 20+ and npm (CI uses Node 22).
2. `npm install`
3. Start the backend (see the root README), then `npm run dev`.
4. Open `http://localhost:3000`.

Other scripts: `npm run lint`, `npm run build`, `npm start`.

Optional `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # backend base URL; this is the default
ANTHROPIC_API_KEY=your_key_here                  # Inquiry Copilot LLM mode (server-side only)
ANTHROPIC_MODEL=claude-sonnet-5                  # see note below
```

## Included

- Sidebar routes: Executive Summary (`/dashboard`), Upload Deal Data,
  Financial Analysis, Risk Assessment, Customer Analytics, Documents,
  Inquiry, Notes, Reports, Settings.
- Topbar: **Deal selector** (lists your deals from the backend; auto-selects
  the first one if none is selected), **New Deal** (→ `/upload`), and the
  light/dark theme toggle.
- Real-backend panels under `components/fdd/` for a selected deal: QoE
  waterfall + source-GL drill-through, red flags, statements, cash flow,
  margin/cost, NWC, net debt, DCF, tie-outs, contracts, documents, and the
  narrative report with PDF export.
- Clickable KPI cards → metric trace modal; clickable charts → drilldown
  modal.
- A mock-data demo view (`app/api/deal/*` + `lib/mock-data/*`, Zod-validated,
  simulated latency) shown on deal-data pages **only when no deal is
  selected**. It is synthetic — see `docs/` in this folder.
- Inquiry Copilot chat (sidebar), backed by `/api/inquiry/assistant`.

## Notes and inquiries: where they're stored

- **With a deal selected (normal case):** persisted on the backend, per deal.
  Notes and report-draft snippets save via `PUT /api/v1/deals/{id}/notes`
  (Save button); inquiries use full CRUD on `/api/v1/deals/{id}/inquiries`,
  and the Decision Queue comes from `GET /api/v1/deals/{id}/decision-queue`
  (derived on every request, never stored). Nothing about inquiry or
  decision-queue status is kept in `localStorage`.
- **With no deal selected:** the Notes page edits a local-only buffer held
  in the Zustand store and persisted to `localStorage` (`tam-global-state`);
  Save only stamps a local time — nothing reaches the backend. The Inquiry
  page shows a "select a deal" prompt instead of data.

`tam-global-state` also holds the selected deal/period/basis, and
`tam-theme-state` holds the theme.

## Inquiry Copilot LLM setup

The Copilot calls the **Anthropic** Messages API directly from the Next.js
server route (`app/api/inquiry/assistant/route.ts`) when
`ANTHROPIC_API_KEY` is set in this app's environment. It grounds answers in
a snapshot of real backend figures when a deal is selected (mock figures
otherwise). If the key is missing or the call fails, it silently falls back
to deterministic keyword-matched answers (`mode: "fallback"`).

**Set `ANTHROPIC_MODEL`.** The code's default, `claude-3-5-sonnet-latest`,
has been retired, so without an override every Copilot LLM call fails and
you only ever get fallback answers. (Flagged for a code fix — see
`docs/ARCHITECTURE.md` §9.2.)

## Auth and Entry Flow

Authentication is real — it's backed by the FastAPI backend's `/api/v1/auth/*`
endpoints (Argon2id password hashing, JWT session cookie), not a client-side
mock. See [`../docs/SECURITY.md`](../docs/SECURITY.md) for the backend-side
design.

- `/` redirects to `/login`.
- Landing page: `/welcome` (links to sign-up and sign-in).
- New analyst sign-up: `/signup` — a single-step form (name, company email,
  password, plus company/contact fields that aren't persisted yet). Common
  personal-email domains are rejected client-side.
- Sign in: `/login`.
- Forgot/reset password: `/forgot-password` emails a reset link (or, with no
  SMTP configured, the backend writes it to `backend/data/dev_outbox/`) →
  `/reset-password?token=...`.
- After sign-up or sign-in you land on `/upload` to create a deal, upload a
  data room, and start processing; the rest of the app is reached from the
  sidebar.

There is no seeded demo account — sign up to create one. `middleware.ts` only
checks for the presence of the session cookie (`tam_session`) to decide
whether to redirect between the public routes and the protected ones;
signed-in users hitting a public route go to `/upload`. The backend is the
actual source of truth and re-verifies the JWT on every API call, so a
forged or expired cookie still gets rejected with 401 there.

The frontend (`localhost:3000`) and backend (`localhost:8000`) are different
origins, so every backend call in `lib/api/fdd-client.ts` sends
`credentials: "include"` to carry the httpOnly session cookie cross-origin;
the backend's CORS config allows credentialed requests from the frontend's
origin explicitly (see `CORS_ORIGINS` in the backend `.env`).
