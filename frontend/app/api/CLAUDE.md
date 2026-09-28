# frontend/app/api — Next.js Route Handlers

**Purpose:** Server-side routes served by Next.js on port 3000 — **not** the real backend. Two unrelated things live here: the mock BFF for the no-deal demo view, and the Inquiry Copilot. Reference: `docs/API.md` → "Next.js Route Handlers".

**Contents**
- `deal/{summary,analysis,risk,documents,customer,inquiry,decision-queue}/route.ts` — the **mock BFF**: GET handlers serving synthetic data from `lib/mock-data/*`, shaped per `lib/schemas/types.ts` and `frontend/docs/*.md`.
- `inquiry/assistant/route.ts` — POST, the Inquiry Copilot: builds a snapshot (9 real backend GETs, forwarding the user's cookie, when a `dealId` is given; mock data otherwise), calls the Anthropic Messages API directly with `fetch`, falls back to keyword-matched answers on any failure.

**How it fits in:** Pages call these only on the demo path (mock BFF) or from `components/dashboard/tam-llm-sidebar.tsx` (Copilot). Real data goes browser → `lib/api/fdd-client.ts` → FastAPI.

**Gotchas**
- ⚠️ The Copilot defaults to `claude-3-5-sonnet-latest`, which is retired. Without `ANTHROPIC_MODEL` set, it silently uses fallback answers (flagged in `docs/ARCHITECTURE.md` §9.2).
- The Copilot bypasses `BaseAgent` (no retry, no mock switch, no token logging) — a flagged exception to `.claude/rules/llm-usage.md`; don't copy the pattern.
- Mock BFF types have no compiler link to the real backend types — a real API change won't break them.
- Never let mock numbers render when a real deal is selected (PHASES.md Phase 0/1).
