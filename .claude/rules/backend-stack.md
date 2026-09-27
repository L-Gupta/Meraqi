---
paths:
  - "backend/**"
---

# Backend Stack — Use / Avoid

## Use by default

| Task | Use | Why |
|---|---|---|
| HTTP framework | FastAPI, already the only one in the stack | Async, auto OpenAPI, Pydantic-native. Don't introduce Flask/Django for any new surface. |
| Request/response/data validation | Pydantic v2 models in `app/schemas/` | This is the enforced contract everywhere — API boundary, agent I/O, and (via `json_io.py`) the on-disk shape. Every new entity gets a schema file here before it gets an endpoint. |
| Financial arithmetic | Python `Decimal` + Pandas, in `app/pipeline/` only | Never float, never an LLM. This is the hardest rule in the whole system — see [llm-usage.md](llm-usage.md). |
| Persistence | Go through `app/storage/*_store.py`, which goes through `app/storage/json_io.py` | Never call `open()`/`json.load`/`json.dump` directly on anything under `data/` — see [data-at-rest-encryption.md](data-at-rest-encryption.md). |
| File encryption | `app/security/file_crypto.py` (AES-256-GCM) exclusively | Never a new encryption call site outside this module — see `CLAUDE.md` §4. |
| Password hashing | `app/security/passwords.py` (Argon2id via `argon2-cffi`) | Same — never a new hashing call site. |
| Session tokens | `app/security/jwt_tokens.py` (PyJWT, HS256) | Existing pattern; if a future requirement needs revocation, that's a design discussion (see the tradeoff already documented in that module's docstring), not a silent swap. |
| LLM calls | Subclass `app/agents/base.py::BaseAgent`, Anthropic SDK only | See [llm-usage.md](llm-usage.md). |
| Logging | `logging.getLogger(__name__)` per module, structured `extra={...}`, `AUDIT`-prefixed lines for state-changing actions | See [logging-and-audit.md](logging-and-audit.md). |
| Testing | `pytest`, markers `unit`/`integration`/`e2e` per `pyproject.toml`, `fastapi.testclient.TestClient`, shared fixtures in `tests/conftest.py` and `tests/auth_helpers.py::authenticate()` | See [testing.md](testing.md). |
| Lint | Ruff (`E`, `F`, `I`, `UP`; line-length 120) | Already configured in `pyproject.toml`; run before considering any backend task done, per `CLAUDE.md` §5. |

## Explicitly avoid

- **No ORM or database driver** (SQLAlchemy, Prisma, etc.) — there is no
  database. If a task seems to need one, that's an architecture decision
  requiring explicit product-owner sign-off, not something to add
  unilaterally. `app/storage/*_store.py` is deliberately the seam for this
  swap later (see `docs/ARCHITECTURE.md` §2) — don't jump ahead of it.
- **No OpenAI SDK, no other LLM provider SDK.** `plan.txt` (an early design
  doc) mentions OpenAI/`gpt-4o`; the only provider is Anthropic — via
  `app/agents/base.py`, plus one direct-`fetch` exception in the frontend's
  Inquiry Copilot route (see [llm-usage.md](llm-usage.md)). Treat any OpenAI reference
  elsewhere in the repo's docs as stale, not a second supported provider.
- **No Celery, no Redis, no message queue.** Long-running work is a FastAPI
  `BackgroundTask`. Don't add queue infrastructure without an explicit
  product-owner request — it's a real future migration (again, named in
  `plan.txt`) but not decided or started.
