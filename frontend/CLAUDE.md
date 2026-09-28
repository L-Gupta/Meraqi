# frontend — Next.js analyst UI

**Purpose:** The analyst-facing app (Next.js 15 App Router, React 19, TypeScript, Tailwind, TanStack Query, Zustand, Zod, Recharts). It talks to the FastAPI backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). Human setup notes: `README.md` here; design system and UX contracts: `docs/DESIGN.md`.

**Contents**
- `app/` — 15 pages (5 public, 10 protected), layouts, and Route Handlers (mock BFF + Inquiry Copilot). (See its `CLAUDE.md`.)
- `components/` — real-backend `fdd/` panels, `ui/` primitives, charts, layout, modals. (See its `CLAUDE.md`.)
- `lib/` — `fdd-client.ts` (the only real backend client), mock data, Zustand stores, utilities. (See its `CLAUDE.md`.)
- `hooks/use-api-query.ts` — TanStack Query + Zod validation wrapper.
- `middleware.ts` — redirects based on `tam_session` cookie **presence** only (`/` → `/login`; signed-in users on public pages → `/upload`; signed-out users on protected pages → `/login`).
- `docs/` — early-May specs for the **mock** data contract, not the real API.
- Config: `package.json` (scripts `dev`/`build`/`start`/`lint`), `next.config.ts`, `tailwind.config.ts` (tokens, radius, shadows, `darkMode: class`), `tsconfig.json`, `postcss.config.mjs`.

**How it fits in:** Browser → `lib/api/fdd-client.ts` (cookie credentials) → FastAPI. The Copilot route also calls Anthropic directly from the Next.js server using its own `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` (in `frontend/.env.local`).

**Gotchas**
- Two parallel contracts: real (`fdd-client.ts`) vs. mock (`lib/schemas/types.ts`, `frontend/docs/`), with no compiler link between them.
- With a deal selected, never render mock or invented numbers (PHASES.md Phase 0/1).
- The Copilot's default model is retired — set `ANTHROPIC_MODEL`.
- No frontend unit tests exist; CI runs only `npm run lint` + `npm run build` (Node 22). Use `.claude/rules/frontend-stack.md` for library choices (no axios, no toast library, no competing UI kit).
