# Logging and Audit Trail

- **Never log secrets, keys, hashed passwords, decrypted document contents,
  or raw financial line-item data.** The existing request-logging
  middleware in `main.py` already deliberately excludes request/response
  bodies for this reason — match that judgment in any new logging you add.
  An `AUDIT` log line records *that* a document was read/decrypted and by
  whom (see `access_log.py`), never its contents.
- **Pattern:** `logging.getLogger(__name__)` per module, structured
  `extra={...}` for machine-parseable fields, and `AUDIT` string-prefixed
  `logger.info`/`logger.warning` calls for state-changing actions — see
  `ingestion.py`'s `AUDIT deal_created`/`AUDIT file_uploaded`/`AUDIT
  upload_rejected`/`AUDIT pipeline_triggered` lines, and `qoe.py`'s
  in-progress `AUDIT qoe_adjustment_overridden`.
- **Every state-changing action logs an `AUDIT` line.** Any new endpoint
  that creates, deletes, or overrides something a due-diligence audit trail
  would care about logs an `AUDIT` line with the same key=value shape.
  "What happened and who did it" must be reconstructable even when nothing
  errored.
