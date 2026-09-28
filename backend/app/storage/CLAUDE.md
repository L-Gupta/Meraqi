# storage — encrypted JSON-file persistence

**Purpose:** The only way anything reads or writes under `data/`. One store per entity, all funneling through one encrypt-then-atomic-write choke point. No database exists — this is the swap seam if one ever does (`docs/SCHEMA.md`).

**Contents**
- `json_io.py` — `write_json_encrypted` (AES-256-GCM + temp-file/`os.replace`), `read_json_encrypted`, `try_read_json_encrypted`.
- `deal_store.py` — `data/deals/{deal_id}.json`: create/get/update/list (owner-filtered), `set_stage_status` + `progress_pct`, `add_uploaded_file`. `DealStoreError`.
- `user_store.py` — `data/users/{id}.json`: create/get/update; lookup by email or reset-token hash via full directory scan. `UserStoreError`.
- `file_store.py` — encrypted raw uploads (`data/uploads/{deal_id}/`), `read_upload_decrypted` (logs to `access.log`), processed-dir helpers.
- `note_store.py` — `data/notes/{deal_id}.json`. `inquiry_store.py` — `data/inquiries/{deal_id}.json` (one list per deal).

**How it fits in:** Used by routers and pipeline orchestrators; depends only on `security/file_crypto.py` and `config.py`.

**Gotchas**
- Never `open()`/`json.load`/`write_bytes` under `data/` outside this package (`.claude/rules/data-at-rest-encryption.md`). Security-sensitive per CLAUDE.md — flag changes in commits/PRs.
- Upload writes are a direct `write_bytes`, not temp-file atomic like `json_io`.
- `deal_store`'s stage list omits `narrative_drafter`, so `progress_pct` can hit 100% early.
- Lookups by email/token/owner are O(n) scans — fine at POC scale only.
