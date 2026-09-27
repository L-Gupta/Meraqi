---
paths:
  - "frontend/**"
---

# Frontend Error Handling

- **All backend calls go through `fdd-client.ts`**, which throws a plain
  `Error` with a `"METHOD path → status: body"` message on any non-2xx
  response (see [frontend-stack.md](frontend-stack.md)). Don't write ad-hoc
  `fetch` + manual status checking in a component.
- **Catch at the point of user action** (a submit handler, not a global
  error boundary as the primary mechanism) and store the message in local
  component state, rendered as an inline banner — the established pattern
  in `app/upload/page.tsx`: `catch (err) { setErrorMsg(err instanceof Error
  ? err.message : String(err)); setStage("error"); }`. New interactive
  flows should follow this shape rather than inventing a new one.
  `err instanceof Error ? err.message : String(err)` is the established
  narrowing pattern for a caught value of unknown type — use it rather than
  assuming the caught value is always an `Error`.
  - Server-state fetch failures: prefer TanStack Query's own
    `error`/`isError` from `useQuery`/`useApiQuery` over a manually-managed
    loading/error state, since that plumbing already exists.
- **Zod validation failures at the `useApiQuery` boundary surface as a
  thrown/caught error** like any other fetch failure — don't add a silent
  fallback/default value when a response fails to parse; that would hide a
  real backend/frontend contract drift.
