# SECURITY.md — Threat Model and Security Controls (As Implemented)

> Written 2026-09-27. Consolidates what was ARCHITECTURE.md §7 plus
> everything else security-relevant found in the code on `main`
> (`8b00867`). Documents what exists, not a redesign. Any change to the
> files named here is security-sensitive under `CLAUDE.md` §4 — flag it in
> the commit message and PR description.

## 1. Threat model

**What's being protected:** a target company's confidential data room — GL
exports, trial balances, aging, debt agreements — and everything derived
from it (statements, QoE, red flags, narrative). Plus analyst accounts.

**Deployment assumption:** a local, single-machine POC. Frontend and backend
on `localhost`, one operator or a handful of analysts, no public exposure.
Several controls below are explicitly "adequate for that, not for more."

| Threat | Primary control | Section |
|---|---|---|
| Another user reads/modifies a deal by guessing or altering a `deal_id` (IDOR) | `require_deal_owner` on every deal-scoped route, 404-not-403 | §5 |
| Stolen disk / backup / copied `data/` directory | AES-256-GCM on every persisted file; key only in env | §4 |
| Tampered or corrupted files on disk | GCM authentication tag → decrypt fails loudly | §4 |
| Password database leak | Argon2id hashes | §2 |
| Account enumeration | Identical responses for unknown email vs. wrong password; generic forgot-password response | §2 |
| Password-reset token interception via the API response | Tokens emailed, never returned (PR #22); only SHA-256 hash stored; 1 h TTL | §2 |
| Session-cookie theft by page JS (XSS) | httpOnly cookie | §3 |
| CSRF | `SameSite=Lax` cookie + explicit CORS allowlist | §3 |
| Sensitive data in logs | No request/response bodies logged; secrets never logged | §7 |
| Undetected document access | Append-only `access.log` for document reads/exports | §6 |
| Plaintext transport | Out of scope for the app — TLS terminated by a reverse proxy; HSTS sent | §8 |

**Explicitly not defended against today** (see §9): stolen-but-valid JWTs
before expiry, online password guessing (no rate limit), a compromised
host (the key sits in the process env), insider access by the operator, and
anything multi-tenant.

## 2. Authentication and credentials

- **Password storage:** Argon2id via `argon2-cffi`
  (`security/passwords.py`) with the library's tuned default cost
  parameters (not hand-picked). The encoded hash embeds algorithm, version,
  and parameters. `verify_password` never raises — mismatch, malformed, or
  foreign hash → `False`.
- **Password policy:** minimum 8 characters (`SignupRequest`,
  `ResetPasswordRequest`). No complexity/breach check. The signup page
  rejects common personal-email domains **client-side only**; the backend
  accepts any valid email.
- **Login:** one generic `401 "Incorrect email or password"` for both
  unknown email and wrong password.
- **Password reset** (`api/v1/auth.py`, `services/email.py`):
  - `forgot-password` generates `secrets.token_urlsafe(32)`, stores only its
    SHA-256 hash + expiry (now + 1 h) on the user record, and emails
    `{FRONTEND_BASE_URL}/reset-password?token=…`. The response is the same
    generic message whether or not the account exists. The token is
    **never** in the API response (fixed in PR #22 — it previously was, which
    was an account-takeover vector).
  - A fast hash (SHA-256, not Argon2) is deliberate: the token is 256 bits
    of randomness, not a user-chosen secret, so there's nothing to slow down.
  - `reset-password` looks the user up by token hash (full scan), checks
    expiry, sets the new Argon2id hash, and clears the token fields —
    single-use.
  - Delivery: SMTP with STARTTLS when `SMTP_HOST` is set (any provider; no
    vendor SDK). Otherwise the message — **including the live reset link**
    — is written in plaintext to `data/dev_outbox/`. That's a local-dev
    stand-in, deliberately kept out of the application log stream, but it
    means anyone who can read `data/` can reset any account while SMTP is
    unset.
- **`AUDIT` log lines** for signup, login, reset requested/completed, and
  reset email sent (never containing the token/link body).

## 3. Sessions

- **Token:** JWT, HS256 (PyJWT), claims `sub` (user id), `iat`, `exp` =
  now + `JWT_EXPIRY_DAYS` (default 7). Signed with `JWT_SECRET_KEY`
  (validated ≥ 32 chars at startup).
- **Cookie:** `tam_session`, `httponly=True`, `samesite="lax"`, `path="/"`,
  `max_age` = expiry. `secure` is set **unless** the first entry in
  `CORS_ORIGINS` contains `localhost` or `127.0.0.1` (`_is_local_dev()` in
  `auth.py`) — so the flag is driven by CORS config, not by the actual
  request scheme. A non-local deployment must put its real HTTPS origin
  first in `CORS_ORIGINS`.
- **Validation:** `deps.py::get_current_user` decodes the cookie on every
  protected request; missing/invalid/expired → 401; a valid token for a
  deleted user → 401.
- **Logout** deletes the cookie client-side only. The JWT itself remains
  valid until expiry — there is no server-side session store or blocklist
  (documented tradeoff in `jwt_tokens.py`).
- **Frontend middleware** checks only cookie *presence* for routing; it is a
  UX convenience, not a security boundary. The backend is the authority.

## 4. At-rest encryption and key management

- **Algorithm:** AES-256-GCM via
  `cryptography.hazmat.primitives.ciphers.aead.AESGCM`
  (`security/file_crypto.py`). Wire format `nonce(12) || ciphertext+tag`,
  fresh `os.urandom(12)` nonce per encryption, no AAD. Decrypt failures
  (wrong key, truncation, tampering) raise `FileCryptoError`.
- **Coverage:** every user, deal, note, and inquiry record; every processed
  report; every uploaded file and every extracted ZIP member. All JSON goes
  through `storage/json_io.py` (encrypt + atomic temp-file/`os.replace`);
  raw uploads go through `storage/file_store.py`. Decrypted bytes are
  handed to parsers as `BytesIO` — plaintext is never written back to disk.
- **Not encrypted, by design:** `data/access.log` (grep-able audit trail —
  contains user/deal IDs, actions, filenames, no content) and
  `data/dev_outbox/*` (§2).
- **"Envelope encryption" — terminology correction.** Code comments and
  earlier docs call this envelope encryption. As implemented, every file is
  encrypted **directly under the single master key** — there are no
  per-file data keys wrapped by a key-encryption key. A real envelope
  scheme is what a KMS migration would introduce. Behavior is correct; the
  label overstates it.
- **Key:** one `FILE_ENCRYPTION_KEY` (base64 of exactly 32 bytes), read only
  by `config.py` and validated at import (fail-fast: missing, non-base64,
  or wrong length → startup error). Documented as POC-grade: move to a real
  KMS/Vault before production; key loading is isolated to that one settings
  field so the swap doesn't touch call sites.
- **No key rotation.** Changing the key makes all existing data unreadable.
  There's no key ID in the wire format to support multiple keys.

## 5. Authorization

- **Model:** single owner per deal (`deal.owner_user_id`). No roles, teams,
  sharing, or admin surface.
- **Enforcement:** `deps.py::require_deal_owner` is the single choke point,
  used as a dependency on every `/deals/{deal_id}/...` route. Unknown deal
  **and** someone else's deal both return `404 "Deal {id} not found"` — never
  403 — so valid IDs aren't confirmed to non-owners. `GET /deals` filters by
  owner. Deal IDs are UUID4.
- **Regression suite:** `tests/test_api/test_authorization.py` — every new
  deal-scoped endpoint must be added (`.claude/rules/deal-ownership.md`).
- **Next.js assistant route** (`/api/inquiry/assistant`) forwards the
  caller's cookie to the backend, so ownership is still enforced there. The
  route itself has no auth check: with no `dealId` it answers from mock
  data; with a `dealId` but no valid cookie every backend fetch fails and
  the snapshot is all "N/A". It still spends Anthropic tokens either way.

## 6. Audit logging

- **Document access log** (`security/access_log.py`): one JSON line per
  event — `{timestamp, user_id, deal_id, action, filename}` — appended to
  `data/access.log`. Written on every upload decrypt (`file_store.read_upload_decrypted`,
  action `decrypt`; user is the deal owner, looked up best-effort), document
  inventory listing (`list_documents`), supporting-schedule listing
  (`list_supporting_schedules`), and databook export (`export_databook`).
  Never raises — a logging failure can't break the request. Not written for
  reads of processed reports (statements, QoE, etc.).
- **`AUDIT` application log lines** for state changes: deal created, file
  uploaded / rejected, ZIP member extracted / dropped, pipeline triggered,
  auth events (§2). Convention in `.claude/rules/logging-and-audit.md`.
- Neither log is tamper-evident; both are plain append-only files.

## 7. Secrets handling and logging hygiene

- **Secrets:** `FILE_ENCRYPTION_KEY`, `JWT_SECRET_KEY`, `ANTHROPIC_API_KEY`,
  `SMTP_PASSWORD` — loaded only through `config.py` (backend) from repo-root
  `.env` then `backend/.env.local` (override). `.env`, `.env.local`,
  `.env.*.local`, and `backend/.env.local` are gitignored. CI injects them
  as GitHub Actions secrets.
- **Frontend secret:** the Inquiry Copilot reads `ANTHROPIC_API_KEY` /
  `ANTHROPIC_MODEL` from the Next.js server environment (no
  `NEXT_PUBLIC_` prefix, so not bundled to the browser). It's a separate
  key location from the backend's.
- **Never log** secrets, keys, password hashes, reset links, or decrypted
  document contents (`CLAUDE.md` §4). The request-logging middleware logs
  only method, path, status, duration, request ID.
- **Error bodies leak detail by design:** the global 500 handler returns
  `type(exc).__name__` and `str(exc)` to the client ("local, single-operator
  tool, no reason to hide detail" — `main.py`). Acceptable locally;
  reconsider before any shared deployment.
- **Data sent to third parties:** the backend agents send GL account
  descriptions, adjustment/flag context, contract text, and computed
  figures to the Anthropic API; the Copilot sends a summary snapshot of
  computed figures. No raw uploaded file is sent wholesale, but contract
  PDF text is.

## 8. Transport security and TLS termination

- The backend **does not terminate TLS**. It sends
  `Strict-Transport-Security: max-age=63072000; includeSubDomains` on every
  response (harmless over plain HTTP — browsers ignore HSTS there — and it
  saves configuring the proxy to add it).
- Plain `http://localhost` is fine for local dev. Any deployment reachable
  over a network you don't fully trust needs a reverse proxy in front:

**Caddy** (auto-provisions a locally-trusted cert):
```caddyfile
localhost {
    reverse_proxy localhost:8000
}
```

**nginx + mkcert:**
```bash
mkcert -install && mkcert localhost
```
```nginx
server {
    listen 443 ssl;
    server_name localhost;
    ssl_certificate     localhost.pem;
    ssl_certificate_key localhost-key.pem;
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
HSTS only takes effect once the browser has seen it over real HTTPS. When
you deploy behind HTTPS, also put the HTTPS origin first in `CORS_ORIGINS`
so the session cookie gets `secure` (§3).

- **CORS:** explicit allowlist (localhost/127.0.0.1 on 3000, 3001, 5173),
  `allow_credentials=True`, all methods/headers. Override via
  `CORS_ORIGINS` as a JSON array.
- **Upload limits:** extension allowlist (`.csv .xlsx .pdf .zip`), 50 MB per
  file / 200 MB per ZIP, filename path components stripped
  (`Path(filename).name`). ZIP members with other extensions are dropped.

## 9. Known gaps (flagged, not fixed)

1. **No rate limiting** anywhere — login, signup, forgot-password, or the
   LLM-backed endpoints. Online password guessing and LLM-cost abuse are
   unmitigated.
2. **JWTs aren't revocable** before expiry (7 days); logout doesn't
   invalidate the token.
3. **Single static master key**, no KMS, no rotation, no key IDs (§4).
4. **O(n) directory scans** for user-by-email and user-by-reset-token (fine
   at POC scale; a latency cliff and a timing side-channel at scale).
5. **Dev-outbox reset links in plaintext** when SMTP is unset (§2).
6. **`secure` cookie flag keyed off CORS config**, not request scheme (§3).
7. **Verbose 500 bodies** (§7).
8. **No multi-tenant model** — single owner per deal is the hard boundary;
   don't simulate team access with workarounds (`.claude/rules/deal-ownership.md`).
9. **Frontend dependency advisories** — open Dependabot PRs (#30, #32–#38),
   including `next` bumps, are untriaged.
10. **Access log gaps** — processed-report reads aren't logged (§6).
