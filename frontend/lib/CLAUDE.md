# frontend/lib — client, stores, schemas, utilities

**Purpose:** Non-UI frontend code: the one real backend client, the demo-mode mock data, client-state stores, and helpers. (Subfolders are small and share this file.)

**Contents**
- `api/fdd-client.ts` — **every** browser call to FastAPI: `get/post/put/patch/del` with `credentials: "include"`, throws `Error("METHOD path → status: body")` on non-2xx; typed wrappers per domain. Base URL `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
- `mock-data/data.ts`, `mock-data/api.ts` — synthetic data and the async getters behind the mock BFF / no-deal demo view.
- `schemas/types.ts` — Zod schemas for the **mock** contract (`frontend/docs/*.md`), not the real backend.
- `store/use-global-store.ts` — Zustand (`persist` → `localStorage["tam-global-state"]`): selected deal/period/basis + the local notes/report-draft buffer. `store/use-theme-store.ts` — theme (`tam-theme-state`).
- `utils/cn.ts` — `clsx` + `tailwind-merge`. `utils/format.ts` — formatting + `lookupByPeriod()`.

**How it fits in:** Imported by pages, `components/fdd/*`, and the Route Handlers.

**Gotchas**
- Never `fetch` FastAPI directly from a component — add a wrapper to `fdd-client.ts` (`.claude/rules/frontend-stack.md`).
- Never keep backend data in Zustand; that's TanStack Query's job.
- A stale or null persisted `dealId` makes pages fall back to mock data — the leading Phase 0 hypothesis (`docs/MEMORY.md`).
- `mock-data` must never feed the real-deal path.
