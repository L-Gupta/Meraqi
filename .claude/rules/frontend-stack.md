---
paths:
  - "frontend/**"
---

# Frontend Stack — Use / Avoid

## Use by default

| Task | Use | Why |
|---|---|---|
| Backend API calls | `lib/api/fdd-client.ts` exclusively | Every real backend call funnels through this one file's `get`/`post`/`put`/`patch`/`del` wrappers, which handle `credentials: "include"` (required for the cross-origin session cookie) and a consistent thrown-`Error`-on-non-2xx shape. Never call `fetch()` directly against the FastAPI backend from a component — add a typed wrapper to `fdd-client.ts` instead. |
| HTTP client library | Native `fetch`, not axios or any other client | No HTTP client dependency beyond native `fetch` exists in `package.json` — don't add one. |
| Server state (data from the backend) | TanStack Query (`hooks/use-api-query.ts` or direct `useQuery`) | Caching, staleness, refetch behavior already configured in `components/providers.tsx`. Never hold backend response data in Zustand — see the state-management split below. |
| Client-only UI state | Zustand (`lib/store/use-global-store.ts`, `use-theme-store.ts`) | Selected deal/period/basis, theme, report-draft scratch state — things that are purely local UI state, not server data. `use-global-store.ts` persists to `localStorage`; be deliberate about what's worth persisting across sessions vs. what should reset. |
| Runtime response validation | Zod, at the fetch boundary (`useApiQuery`, `lib/schemas/types.ts`) | Catches a backend/frontend contract drift at the point of fetch, not three components downstream. Any new typed wrapper added to `fdd-client.ts` should have a corresponding Zod schema if it's consumed through `useApiQuery`. |
| UI primitives | Radix UI + Tailwind, composed via `class-variance-authority`/`tailwind-merge` in `components/ui/` | Existing pattern for every styled primitive (button, card, dialog, tabs, etc.) — extend this set rather than importing a competing component library (MUI, Chakra, shadcn's own CLI output verbatim, etc.). |
| Charts | Recharts (`components/charts/`) | Only charting library in the stack. |
| Forms | `@hookform/resolvers` + Zod (present in `package.json`) | Use this pairing for any new form rather than introducing Formik or uncontrolled-input-only patterns. |
| Lint/build | `next lint`, `next build` | Both must pass before considering any frontend task done, per `CLAUDE.md` §5. |

## Explicitly avoid

- **No axios or any second HTTP client.** `fetch` + `fdd-client.ts` is the
  pattern; don't introduce a second one for "convenience" on a new page.
- **No new global toast/notification library** (react-hot-toast, sonner,
  etc.) without asking first. The existing pattern — local component state
  (`errorMsg`/`setErrorMsg`) rendered as an inline banner at the point of
  the failing action (see `app/upload/page.tsx`) — is what's used
  everywhere today. If a task seems to need cross-page/global
  notifications, that's a UX decision to raise with the product owner, not
  a library choice to make silently.
- **No component library that competes with the existing Radix+Tailwind
  system** (MUI, Chakra, Ant Design, etc.) for any new page or panel.
