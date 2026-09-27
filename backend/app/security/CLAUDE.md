# security — crypto, tokens, audit log

**Purpose:** Thin wrappers over vetted libraries for password hashing, at-rest encryption, session tokens, and the document-access audit log. No custom crypto, ever. Full controls and gaps: `docs/SECURITY.md`.

**Contents**
- `passwords.py` — Argon2id via `argon2-cffi` (library-default params); `verify_password` never raises.
- `file_crypto.py` — AES-256-GCM (`cryptography` `AESGCM`); wire format `nonce(12) || ciphertext+tag`; `FileCryptoError` on tamper/wrong key.
- `jwt_tokens.py` — HS256 JWT create/decode (`sub`, `iat`, `exp`); `TokenError`. Not revocable before expiry (documented tradeoff).
- `access_log.py` — `log_document_access` appends one plaintext JSON line to `data/access.log`; never raises.

**How it fits in:** `storage/*` uses `file_crypto`; `api/v1/auth.py` + `deps.py` use `passwords` and `jwt_tokens`; `file_store`, `documents.py`, `databook.py` call `access_log`.

**Gotchas**
- Every file here is security-sensitive under the root CLAUDE.md — flag changes explicitly in the commit message and PR.
- Despite the "envelope encryption" wording in comments, everything is encrypted directly under the single `FILE_ENCRYPTION_KEY`; there are no per-file data keys and no key rotation.
- Never log keys, hashes, tokens, or decrypted content (`.claude/rules/logging-and-audit.md`).
