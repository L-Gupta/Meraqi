---
paths:
  - "backend/**"
---

# Backend Error Handling

- **Route handlers raise `HTTPException`, never return an ad-hoc error
  dict.** Status codes follow the patterns already established: `401` for
  unauthenticated, `404` for not-found-or-not-yours (see
  [deal-ownership.md](deal-ownership.md)), `409` for a conflicting state
  (duplicate email, already-running pipeline stage), `413` for oversized
  upload, `422` for a validation failure the framework didn't already catch
  (bad file type, malformed business input).
- **Wrap a caught domain exception with `from exc`** when translating it to
  an `HTTPException` — e.g. `raise HTTPException(status_code=404,
  detail=str(exc)) from exc`. This preserves the original traceback for
  logs while giving the client a clean message. This is the pattern used
  consistently across `ingestion.py`, `databook.py`, `settings.py`, etc.
- **Domain-specific exceptions live near their module and get translated at
  the API boundary**, not raised as bare `Exception`. Existing examples:
  `FileCryptoError`, `DealStoreError`, `UserStoreError`, `ZipExtractorError`,
  `AgentError`, `DatabookError`, `AdjustmentNotFoundError`. A new pipeline
  or storage module that can fail in a specific, expected way should define
  its own exception class rather than letting a generic `Exception`/`KeyError`
  propagate up to the global handler.
- **The global handler in `main.py` (`unhandled_exception_handler`) is a
  last resort, not a design pattern to lean on.** It exists so no request
  ever returns a bare, contentless 500 — it logs the full traceback and
  returns a structured body (`error`, `detail`, `request_id`, `endpoint`).
  New code should aim to never reach it by catching and translating
  expected failure modes explicitly.
  **Known inconsistency, not yet resolved:** this handler's response shape
  (`{"error", "detail", "request_id", "endpoint"}`) doesn't match a normal
  `HTTPException`'s shape (`{"detail"}` only) — see `docs/DESIGN.md`
  §10.1 and `docs/ARCHITECTURE.md` §10. Don't silently "fix" this by changing one shape to match the
  other; it's a public API contract change and should be raised with the
  product owner first.
- **Best-effort, non-critical operations (audit logging, owner-lookup for a
  log line) may swallow exceptions — but only when already explicitly
  documented as intentional**, matching the existing pattern in
  `security/access_log.py` (never raises — logs the failure instead) and
  `storage/file_store.py`'s owner-lookup-for-logging (`except Exception:
  pass`, with a comment explaining it's best-effort). A new bare
  `except Exception: pass` without that kind of explicit justification and
  comment is not acceptable — it's indistinguishable from silently hiding a
  real bug.
- **Every state-changing action logs an `AUDIT` line** (see
  [logging-and-audit.md](logging-and-audit.md)) — this is as much an
  error-handling convention as a logging one, since for a due-diligence
  audit trail, "what happened and who did it" needs to be reconstructable
  even when nothing errored.
