# PHASES_ARCHIVE.md — Completed Work

> Split out of [PHASES.md](PHASES.md) on 2026-09-27. PHASES.md holds only
> current and future work; this file holds what's done, so the active plan
> stays short. Append-only: when a numbered phase in PHASES.md meets its
> Definition of Done (confirmed by the product owner, not self-reported),
> move its whole section here under "Completed Phases" with the date and
> the PRs that closed it.

## Completed Phases

**None yet.** As of 2026-09-27, no numbered phase (0–5) in PHASES.md has
met its Definition of Done. `main` has not moved since PR #29
(`8b00867`, merged 2026-08-05), and PHASES.md was written on 2026-08-10.

## Pre-Phase Baseline (done before PHASES.md existed)

This is what used to be PHASES.md §0's "Done and stable" list, plus the
exact commits/PRs behind each item. PHASES.md's phases build on top of
this; none of it is "Phase N complete."

### Original 8-step build (tracked in `STEPS.md`, now historical)
| Date | Commit | What landed |
|---|---|---|
| 2026-05-29 | `a24c541` | Initial commit |
| 2026-06-03 | `a07eef9` | Migrated agents and the frontend assistant route from OpenAI to Anthropic; E2E edge-case test pipeline |
| 2026-06-04 | `8cd9729` | `dependency-review.yml` workflow |
| 2026-06-08 | `631682e`, `84fea12` | First CI pipeline; production-grade backend logging (`logging_config.py`, `X-Request-ID`, `AUDIT` events) |
| 2026-06-08 | `bafc54a` | Multi-document data-room ingestion; Excel databook export |
| 2026-06-24 | `a1e4026` | Step 3 — CoA mapper + financial statement builder |
| 2026-06-24 | `99f151f` | Step 4 — QoE engine + red flag detector |
| 2026-07-08 | `746f21e` | Step 5 — frontend auth flow, ingestion fixes |
| 2026-07-21 | `ba8f613` | Steps 5–8 POC — NWC, contracts, net debt, DCF, narrative, live UI |

### Hardening and feature slices (2026-08-03 → 2026-08-05, PRs #1–#29)
| Date | PR / commit | What landed |
|---|---|---|
| 2026-08-03 | `ca0fe7c` | Real auth (Argon2id, JWT cookie), AES-256-GCM at-rest encryption, per-deal authorization (`require_deal_owner`, 404-not-403) |
| 2026-08-03 | `6fc586f` | Content-based classification and ingestion of supporting schedules previously dropped as UNCLASSIFIED; schedule tie-outs; `GET /supporting-schedules` |
| 2026-08-03 | `893decc` | Removed fake mock report exports from Reports |
| 2026-08-03 | #1 (`e0eae39`, `8ad507e`, `5a21f94`, `a289db3`, …) | Tiered `unit`/`integration`/`e2e` markers + session-scoped `shared_mapped_gl` fixture; parallel per-phase, path-gated CI against the real Anthropic API; default model → `claude-sonnet-5`; agent schema-drift hardening |
| 2026-08-04 | #2 (`c33e591`, `ae725c8`, `78cceb1`, `461417d`, …) | Deal-scoped persisted notes; contract parser / red-flag analyst / narrative drafter pinned to `claude-opus-5`; schema-drift hardening |
| 2026-08-04 | #3 (`0108156`) | Dependabot for pip, npm, GitHub Actions |
| 2026-08-04 | `08fb0ce` | `CLAUDE.md` added to the repo |
| 2026-08-04 | #19 | Deal settings (materiality, tie-out tolerance, cash-conversion bands) wired into calculations |
| 2026-08-04 | #20 | Real inquiry (PBC) CRUD; derived Decision Queue |
| 2026-08-04 | #21 | Real-deal FDD panels brought to chart density; `lookupByPeriod()` period-key fix |
| 2026-08-05 | #22 | Password-reset tokens no longer returned in the API response — emailed via `services/email.py` |
| 2026-08-05 | #23 | Removed dead `/deal-archive` and `/onboarding` pages |
| 2026-08-05 | #24 | Signup collapsed to one step (fake manager picker removed) |
| 2026-08-05 | #25 | Stale agent docstrings fixed; louder `coa_mapping` no-op warning |
| 2026-08-05 | #26 | DCF limitations surfaced next to Enterprise Value |
| 2026-08-05 | #27 | Real Margin/Cost QoE tab; Commercial Health endpoint wired to the UI |
| 2026-08-05 | #28 | Databook: NWC Trend/Pegs, Net Debt/Debt Instruments, DCF, Commercial Health, Contracts, Narrative tabs |
| 2026-08-05 | #29 | Single source of truth for readiness (decision queue); localStorage status overrides dropped |

### Resulting "done and stable" capability set (as of `8b00867`)
- Ingestion: GL CSV/XLSX, ZIP data rooms, AR/AP aging, projections, PDF debt
  agreements (digital only — no OCR, by design), supporting schedules
  (Groups A/B/C — see GLOSSARY.md).
- Deterministic financial statements (P&L, Balance Sheet, Cash Flow).
- CoA mapping (LLM-assisted, never LLM-computed).
- QoE engine (rules + LLM review) with source-GL drill-through.
- Red flags: named-category threshold rules + cross-document tie-outs,
  LLM-enriched diligence questions. **No** general outlier/plausibility rule
  (that's Phase 3).
- NWC + pegs + commercial health; net debt bridge; simple DCF cross-check.
- Contract analysis (manual trigger) + debt-schedule CSV parsing.
- Narrative drafting **and** its frontend wiring + PDF export.
- Full databook export (19 tabs, gracefully partial).
- Auth, at-rest encryption, per-deal authorization, access logging.
- Deal-scoped notes, inquiries, derived decision queue, deal settings.
