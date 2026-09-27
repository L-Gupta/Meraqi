# DECISIONS.md — Decision Log

> **Append-only.** One dated line per decision: *what* was decided, *why*,
> and where it's evidenced. Never edit or delete a past entry. If a
> decision is reversed, append a new entry that references the old one
> ("Supersedes 2026-08-03 …").
>
> Seeded 2026-09-27 from ARCHITECTURE.md, RULES.md, code docstrings, and git
> history. Dates are the commit date (or document date) where the decision
> first appears. Undated architectural choices that predate a clear commit
> are dated to the commit that first contains them.

## Format

`YYYY-MM-DD — <Decision>. Why: <reason>. (<evidence: commit / file / doc>)`

## Log

- 2026-06-03 — Anthropic (Claude) is the only LLM provider; OpenAI removed from backend agents and the frontend assistant route. Why: project direction at the time; single-provider keeps the agent layer simple. (`a07eef9`; RULES.md §2)
- 2026-06-08 — Structured application logging with `X-Request-ID` correlation, optional JSON output, and `AUDIT` lines for state changes; never log request/response bodies. Why: debuggability without leaking financial data. (`631682e`; `main.py`; RULES.md §1)
- 2026-06-08 — Local JSON files per entity instead of a database. Why: local-POC simplicity; `storage/*_store.py` is the swap seam for Postgres later. (`bafc54a`; `deal_store.py` docstring; ARCHITECTURE.md §2)
- 2026-06-08 — FastAPI `BackgroundTasks` instead of Celery/Redis for the pipeline. Why: sufficient for <50K-row files at POC scale; no broker to operate; `pipeline_orchestrator.py` is the swap seam. (`bafc54a`; `session.md`; ARCHITECTURE.md §2)
- 2026-06-24 — LLMs never compute or alter a financial figure; all arithmetic is Python `Decimal`/Pandas in `app/pipeline/*`, agents only do semantic tasks (CoA mapping, review, enrichment, extraction, drafting). Why: every number must be reproducible and traceable — the core accuracy bar. (`a1e4026`, `99f151f`; RULES.md §4; PRD.md §4)
- 2026-06-24 — Every QoE adjustment and red flag must cite `source_gl_line_ids` or a `source_document`. Why: "where did this number come from" must always be answerable in one click. (`99f151f`; RULES.md §7.1)
- 2026-06-24 — Monetary amounts are `Decimal`, serialized as JSON strings end-to-end; parsed to `number` only at display. Why: no float rounding drift in financial figures. (`schemas/*`; `fdd-client.ts` header comment)
- 2026-07-21 — Net debt totals come only from the balance sheet; contract-extracted instrument detail is shown alongside and never used to recompute them. Why: avoid double-counting between two sources of truth; disagreement is surfaced, not resolved. (`ba8f613`; `schemas/net_debt.py` docstring)
- 2026-07-21 — DCF is a disclosed, simplified directional cross-check (EBITDA − capex, default 12% discount / 2% terminal growth), with every simplification listed in `limitations`. Why: no capital-structure inputs to derive a real WACC; don't look more precise than it is. (`schemas/dcf.py`; `da8d953`)
- 2026-08-03 — Argon2id (via `argon2-cffi`, library-default parameters) for password hashing, over bcrypt/PBKDF2. Why: OWASP-recommended, Password Hashing Competition winner, memory-hard; library defaults are maintained as hardware changes. (`ca0fe7c`; `security/passwords.py` docstring)
- 2026-08-03 — AES-256-GCM via `cryptography`'s `AESGCM` for all at-rest data, single master key from `FILE_ENCRYPTION_KEY`, validated at startup. Why: authenticated encryption detects tampering; vetted library, no custom crypto; key loading isolated for a future KMS swap. (`ca0fe7c`; `security/file_crypto.py`; `config.py`)
- 2026-08-03 — Encrypt at the I/O boundary only (`json_io.py`, `file_store.py`); parsers stay plaintext-in/plaintext-out via `BytesIO`; never write decrypted plaintext to disk. Why: one choke point to audit; no temp-file leaks. (`ca0fe7c`; RULES.md §1/§2)
- 2026-08-03 — Stateless JWT (HS256) in an httpOnly `SameSite=Lax` cookie, over server-side sessions. Why: no session store to maintain, fits JSON-file storage; accepted cost is no revocation before expiry. (`ca0fe7c`; `security/jwt_tokens.py` docstring)
- 2026-08-03 — Deal ownership enforced in one dependency (`require_deal_owner`), returning 404 (not 403) for foreign deals. Why: close the IDOR hole on all deal-scoped routes in one place; don't confirm valid IDs to non-owners. (`ca0fe7c`; `api/v1/deps.py`)
- 2026-08-03 — Document access audit log is a plaintext, append-only JSON-lines file, and logging failures never raise. Why: grep-able audit trail without decryption; audit must not break the request. (`ca0fe7c`; `security/access_log.py`)
- 2026-08-03 — Classify uploaded documents by content (columns/row labels) first, filename second; supporting schedules are reconciled against GL-derived statements (tie-outs), never used to replace them. Why: filenames in real data rooms are unreliable; the GL stays the single source of truth. (`6fc586f`; `document_registry.py`)
- 2026-08-03 — Tiered pytest markers; unmarked tests default to `integration`. Why: keep a fast no-LLM `unit` loop while making the real-API tier the default for anything with I/O or agents. (`e0eae39`; `tests/conftest.py`)
- 2026-08-03 — Session-scoped `shared_mapped_gl` fixture memoizes the one real CoA-mapping LLM call across test files. Why: four files re-ran the identical real call (per test method in one file); caching only the LLM step cut the real-API run from ~40 to ~13 min and made real-API CI affordable. (`e0eae39`; TESTING.md §4)
- 2026-08-03 — No mock LLMs in CI's integration jobs: every phase job runs `USE_MOCK_LLM=false` against the real Anthropic API. Why: mocks can't catch real tool-schema drift, which turned out to be the dominant agent failure mode. (`8ad507e`, `5a21f94`; RULES.md §0.1)
- 2026-08-03 — CI is split into parallel per-phase jobs selected by path filters, aggregated by a single `ci-gate` check; filters are flat lists with no YAML anchors. Why: real-API CI cost/time scales with what changed; one required check survives job renames; YAML anchors nest instead of merging. (`8ad507e`; `ci.yml` comments)
- 2026-08-03 — Default Anthropic model is `claude-sonnet-5`. Why: `claude-3-5-sonnet-latest` was retired and 404'd in CI. (`a289db3`; `config.py:30`)
- 2026-08-04 — Per-agent model override on `BaseAgent`; ContractParser, RedFlagAnalyst, and NarrativeDrafter pinned to `claude-opus-5`. Why: Sonnet 5 systematically broke those agents' tool schemas on real runs; Opus 5 held (narrative still degrades gracefully). (`ae725c8`, `78cceb1`, `461417d`; ARCHITECTURE.md §9.3)
- 2026-08-04 — Dependabot weekly updates for pip, npm, and GitHub Actions. Why: keep dependencies current with reviewed PRs rather than ad-hoc bumps. (`0108156`)
- 2026-08-04 — Deal settings (materiality, one tie-out tolerance, 3-band cash-conversion severity) are per-deal and drive calculations; materiality demotes flags to Informational rather than dropping them. Why: settings that don't change results are misleading; never hide a flag. (#19, `67378e3`)
- 2026-08-04 — Decision Queue items are derived on every request and never persisted; only inquiry-sourced items have mutable status. Why: never invent state — only surface what's computed elsewhere. (#20, `4b447d9`; #29, `2cec967`)
- 2026-08-05 — Password-reset links are emailed (SMTP seam, no vendor SDK; dev-outbox fallback), never returned in the API response. Why: returning the token was an account-takeover vector. (#22, `62754a7`)
- 2026-08-05 — Remove UI that pretends to do something it doesn't (dead `/onboarding` and `/deal-archive` pages, fake signup manager picker, localStorage status overrides). Why: fake UI erodes trust in real output. (#23, #24, #29)
- 2026-08-05 — One source of truth for deal readiness: the backend decision queue. Why: Reports and Inquiry computed readiness differently and could disagree. (#29, `2cec967`)
- 2026-08-10 — Mock-LLM policy: mock mode is allowed only in the `unit` tier; integration, e2e, local dev against a real deal, and any AI-driven run use the real API. Why: resolves the contradiction between `CLAUDE.md` and `pyproject.toml`/`ci.yml`; implemented behavior was right. (RULES.md §0.1; committed with the `CLAUDE.md` fix in `chore/docs-refresh`)
- 2026-08-10 — Engine-computed numbers are finalized — no user or AI may overwrite a pipeline-produced figure. Why: product owner's instruction; accuracy bar. Conflicts with the in-flight QoE override branch; resolution pending (PHASES.md Phase 2). (RULES.md §0.2/§4/§7.3)
- 2026-08-10 — `PHASES.md` replaces `STEPS.md` as the build plan; phases start only after the previous phase's DoD is confirmed by the product owner. Why: `STEPS.md` self-reported status had gone stale; no self-reported "done". (PHASES.md Ground Rules)
- 2026-09-27 — Docs describe what exists, not intent: `CLAUDE.md` §3/§3a reworded to drop pipeline checkpoint reuse/`--force`/resume and the nightly e2e run, neither of which exists. Whether to build either is left open. Why: instructions that describe nonexistent machinery mislead every agent that reads them. (`chore/docs-refresh`; PHASES.md Parking Lot)
- 2026-09-27 — Doc ownership split: ARCHITECTURE.md = system/infra; DESIGN.md = design system + API/UX contracts; SECURITY.md, SCHEMA.md, API.md, TESTING.md own their topics; PHASES_ARCHIVE.md holds completed work. Why: the same facts had drifted apart across overlapping docs. (`chore/docs-refresh`)
- 2026-09-27 — `docs/RULES.md` is replaced by one file per rule under `.claude/rules/`, which Claude Code loads automatically (backend/frontend rules scoped by `paths:`). Why: rules should be in the agent's context without anyone remembering to open a doc. Earlier entries citing `RULES.md` map as: §0.1/§5 → `testing.md`; §0.2/§4 (finalized numbers)/§7.3 → `engine-numbers-finalized.md`; §1–§2 → `backend-stack.md`/`frontend-stack.md`/`llm-usage.md`/`logging-and-audit.md`; §3 → `backend-error-handling.md`/`frontend-error-handling.md`; §4 (data/crypto) → `data-at-rest-encryption.md`; §5.2/§7.5 → `deal-ownership.md`; §7.1 → `source-traceability.md`; §7.2 → `cross-document-disagreement.md`; §7.4 → `scanned-pdfs-fail-loud.md`; §7.7 → `data-room-scale.md`; §6 → `git-conventions.md`; §8 → `if-in-doubt.md`. (`chore/rules-to-claude-dir`)
