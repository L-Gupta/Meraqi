# Data at Rest — Encryption and File I/O

Restates and sharpens `CLAUDE.md` §4, which already governs any change
touching `security/passwords.py`, `security/file_crypto.py`, auth, or file
I/O in `data/deals`/`uploads`/`processed` — read that section too.

- **Never bypass `app/security/file_crypto.py` for anything written under
  `data/`.** Every persisted file — deal/user/note/inquiry records,
  uploaded documents, processed pipeline output — is AES-256-GCM encrypted
  before it touches disk. There is no "just this once, unencrypted" case.
- **No raw file I/O on anything under `data/`.** No `open()`, no
  `Path.write_bytes()`/`write_text()`, no `json.dump`/`json.load` outside
  `app/storage/json_io.py` and the few storage modules that call it.
  `json_io.py` is the one choke point that guarantees encryption + atomic
  writes. A raw write bypasses encryption; a raw read either fails on
  encrypted bytes or (worse) silently reads/writes something unencrypted.
- **No custom cryptography, ever, for any reason.** Never write a new
  hashing/encryption/token-signing routine, even a "temporary" or "just for
  this one feature" one. `argon2-cffi` and `cryptography` only, via
  `app/security/file_crypto.py`, `app/security/passwords.py`,
  `app/security/jwt_tokens.py`. This is the single most important
  library-avoidance rule in the repo.
- **Uploaded and processed documents are the client's confidential
  financial records — treat every new feature touching them as
  security-sensitive by default**, even if it's "just" a display feature.
  A new report/export/summary view is still a new place decrypted
  financial data flows through; apply the same no-plaintext-logging,
  audit-logged-access discipline as existing document-handling code
  (`file_store.py`, `access_log.py`).
