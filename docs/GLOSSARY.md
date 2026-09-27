# GLOSSARY.md

> Terms as they're actually used in TAM's code and docs (2026-09-27). One
> line each; where a term maps to a specific identifier, it's in backticks.

## Finance and due-diligence domain

| Term | Definition |
|---|---|
| **M&A** | Mergers and acquisitions — the deal context TAM supports. |
| **TAS** | Transaction Advisory Services — the Big 4-style practice that performs financial due diligence; TAM's target users. |
| **FDD** | Financial Due Diligence — the analysis of a target's financials before a deal; "FDD Engine" is the backend's name. |
| **Target** | The company being acquired/diligenced; its data room is what TAM ingests. |
| **Data room** | The set of client documents (GL, TB, aging, agreements, schedules) provided for diligence; uploaded as files or a ZIP. |
| **PBC** | "Prepared By Client" — a document or answer requested from the target; TAM's inquiry tracker is a PBC list. |
| **IRL** | Information Request List — the databook tab listing requested documents. |
| **GL** | General Ledger — transaction/balance-level accounting export; the pipeline's primary input (`RawGLLine`). |
| **TB** | Trial Balance — per-account debit/credit totals; used for balance validation. |
| **CoA** | Chart of Accounts — the client's account list; mapped to TAM's standard taxonomy (`ChartOfAccountsCategory`). |
| **CoA mapping** | Classifying each client account into a standard category, LLM-assisted (`CoAMapperAgent`), producing `MappedGLLine`s. |
| **P&L** | Profit & Loss / income statement (`PnLStatement`). |
| **BS** | Balance Sheet (`BalanceSheet`); not built for P&L-only GL exports. |
| **CF** | Cash Flow statement (`CashFlowStatement`), derived from P&L + BS. |
| **EBITDA** | Earnings before interest, taxes, depreciation, and amortization — the core earnings measure QoE adjusts. |
| **Reported EBITDA** | EBITDA as computed directly from the GL, before adjustments. |
| **Adjusted EBITDA** | Reported EBITDA plus/minus QoE adjustments — the normalized earnings figure. |
| **LTM** | Last Twelve Months — the trailing 12-period window used for headline QoE totals (`ltm_reported`, `ltm_adjusted`). |
| **QoE** | Quality of Earnings — analysis normalizing reported earnings for non-recurring/non-operating items (`qoe_engine`, `QoEReport`). |
| **QoE adjustment** | One normalization entry with a direction, amount, and source-GL trail (`QoEAdjustment`). |
| **Add-back** | An adjustment that increases EBITDA (e.g. a one-time legal settlement) — `direction="add_back"`. |
| **Deduction** | An adjustment that decreases EBITDA — `direction="deduction"`. |
| **Normalized amount** | What a line "should" be after adjustment (`normalized_amount`); the field the uncommitted override work tried to make editable. |
| **Waterfall / bridge** | The chart from Reported to Adjusted EBITDA, one bar per adjustment group (`WaterfallItem`: base/addback/deduction/result). |
| **Owner compensation** | Pay to owners/related executives; a classic normalization and red-flag category. |
| **Related party** | A counterparty affiliated with the owners; related-party payments are a red-flag category. |
| **NWC** | Net Working Capital — operating current assets minus operating current liabilities (`NWCDataPoint`). |
| **NWC peg** | The target "normal" NWC level agreed in the deal; TAM proposes candidates by method with confidence intervals (`NWCPeg`). |
| **DSO / DPO / DIO** | Days Sales Outstanding / Days Payables Outstanding / Days Inventory Outstanding (`WorkingCapitalRatios`). |
| **CCC** | Cash Conversion Cycle = DSO + DIO − DPO. |
| **Cash conversion** | Operating cash flow relative to EBITDA per period; low values raise a graduated-severity red flag. |
| **Net debt** | Total debt minus cash and equivalents, from the balance sheet (`NetDebtReport`). |
| **Net debt bridge** | The cash → debt → net debt build-up, plus contract-extracted instrument detail shown alongside (never used to recompute totals). |
| **Debt instrument** | One facility (term loan, revolver, note, lease) with lender, rate, maturity, covenants (`DebtInstrument`). |
| **Covenant** | A contractual condition on a borrower (e.g. leverage ratio); extracted as text. |
| **Change of control (CoC)** | A contract clause triggered by an acquisition — a key M&A risk; extracted as `change_of_control`. |
| **Event of default (EoD)** | Conditions that let a lender accelerate a loan; extracted as `event_of_default`. |
| **Prepayment terms** | Conditions/penalties for early repayment; extracted as `prepayment`. |
| **DCF** | Discounted Cash Flow — TAM's is a deliberately simple directional cross-check (`DCFReport`), with disclosed `limitations`. |
| **FCF** | Free cash flow — approximated in TAM's DCF as EBITDA − capex (no tax/NWC adjustment). |
| **Terminal value** | Value beyond the projection horizon, via Gordon growth (constant-growth perpetuity). |
| **WACC** | Weighted average cost of capital — *not* computed; TAM uses a disclosed default discount rate instead. |
| **Enterprise value (EV)** | Sum of PV of projected FCF + PV of terminal value in the DCF. |
| **Management projections** | Forecast financials provided by the target (`ProjectionSchedule`); required for the DCF. |
| **AR / AP aging** | Receivables / payables split by days outstanding (0–30, 31–60, 61–90, 90+) (`AgingSummary`). |
| **Tie-out** | A reconciliation check that two sources agree within tolerance, e.g. AR aging total vs. GL AR (`TieOutResult`: Pass/Warn/Fail). |
| **Tolerance** | Allowed tie-out variance, percentage (`tie_out_tolerance_pct`, default 0.5%). |
| **Materiality threshold** | Dollar level below which a red flag's whole impact range is demoted to Informational (`materiality_threshold`, default 75,000). |
| **Seasonality** | Recurring intra-year revenue/NWC pattern; detected and disclosed, affects peg method. |
| **Commercial health** | Revenue growth, margin trends, volatility, seasonality (`CommercialHealthReport`); permanently "partial" without customer-level data. |
| **Databook** | The Excel export of all supporting schedules — the one-stop FDD workbook (`databook/generator.py`). |
| **IAR** | Independent Accountant's Report — the real deliverable TAM's narrative is meant to become (PRD.md §3.1, PHASES.md Phase 4). |
| **Mixed export** | A GL export containing both P&L activity and BS snapshots, which needn't net to zero globally (`is_mixed_export`). |
| **P&L-only export** | A GL export with no balance-sheet lines (`is_pl_only_export`) — BS/CF/NWC/net debt are skipped. |

## TAM product and architecture terms

| Term | Definition |
|---|---|
| **TAM** | The product/repo name (also "Meraqi" locally); FastAPI "FDD Engine" backend + Next.js frontend. |
| **Deal** | One diligence engagement for one target, owned by one user (`deal_store`, `deal_id`). |
| **Stage** | One step of the pipeline (`STAGE_ORDER`), with status `pending`/`running`/`complete`/`failed` on the deal. |
| **Pipeline** | The sequential background run of stages triggered by `POST /process` (`pipeline_orchestrator.run`). |
| **Processed report** | A stage's persisted output under `data/processed/{deal_id}/` (SCHEMA.md §3). |
| **Checkpoint** | In `CLAUDE.md`'s original wording, a stage output that later runs could reuse/resume from. Outputs are persisted, but no reuse/resume logic exists (open decision). |
| **Agent** | A `BaseAgent` subclass wrapping one semantic LLM task; never computes numbers. |
| **Mock LLM** | `USE_MOCK_LLM=true` — agents return canned `_mock_response()` fixtures; allowed only for the `unit` tier. |
| **Fact sheet / `figures_used`** | The already-computed figures handed to the narrative drafter, persisted verbatim as the narrative's audit trail. |
| **Diligence questions** | LLM-generated follow-up questions attached to High/Medium red flags. |
| **Red flag** | A discrete risk item with severity, category, impact range, and source trail (`RedFlag`). |
| **Severity** | `High` / `Medium` / `Low` / `Informational`. |
| **Document inventory** | Classified list of uploaded files plus `missing_recommended` document types (`DocumentInventory`). |
| **Document Groups A / B / C** | Supporting-schedule classes: **A** — restatements of GL-derived figures, reconciled (tie-outs) never used to recompute; **B** — structured data GL can't give (debt schedule → `DebtInstrument`); **C** — recognized and viewable, not analyzed (lease, fixed assets, equity, payroll, bank). |
| **Inquiry** | A PBC request tracked per deal (`InquiryItem`), optionally `blocking`. |
| **Decision Queue** | The prioritized list of what blocks report readiness, derived on every request, never persisted. |
| **Readiness** | `Ready` / `Draft` / `Blocked` — deal-level status from the decision queue. |
| **Impact score** | A UI prioritization weight in the decision queue — not a financial figure. |
| **Junior Analyst Report** | The current frontend label for the narrative view (`junior-analyst-report.tsx`); slated to be reframed as the IAR. |
| **Inquiry Copilot** | The chat sidebar (`tam-llm-sidebar.tsx`) backed by `/api/inquiry/assistant`. |
| **Mock BFF** | The Next.js `/api/deal/*` routes serving synthetic data for the no-deal demo view ("backend-for-frontend"). |
| **Demo view / mock fallback** | What deal-data pages render when no `dealId` is selected — the leading suspect in PHASES.md Phase 0. |
| **Mapping Studio** | A planned (not built) UI for correcting CoA mappings; currently a labeled placeholder in Settings. |
| **Engine numbers are finalized** | Product rule: no user or AI may overwrite a pipeline-computed figure (`.claude/rules/engine-numbers-finalized.md`). |

## Security and engineering terms

| Term | Definition |
|---|---|
| **IDOR** | Insecure Direct Object Reference — accessing another user's deal by ID; prevented by `require_deal_owner`. |
| **404-not-403** | Returning 404 for a foreign deal so its existence isn't confirmed. |
| **Argon2id** | Memory-hard password hashing algorithm used for user passwords. |
| **AES-256-GCM** | Authenticated symmetric encryption used for every persisted file. |
| **Envelope encryption** | Per-object data keys wrapped by a master key. **TAM doesn't actually do this yet** — it encrypts directly under one master key (SECURITY.md §4). |
| **KMS** | Key Management Service (AWS/GCP KMS, Vault) — the planned home for the master key. |
| **JWT** | JSON Web Token — the stateless session token in the `tam_session` cookie. |
| **HSTS** | Strict-Transport-Security header telling browsers to use HTTPS only. |
| **Access log** | `data/access.log` — plaintext JSON-lines record of document reads/exports. |
| **`AUDIT` line** | A `logger.info("AUDIT <event> key=value …")` log entry for a state-changing action. |
| **Dev outbox** | `data/dev_outbox/` — where password-reset emails land when no SMTP server is configured. |
| **`unit` / `integration` / `e2e`** | The three pytest tiers (TESTING.md §2). |
| **Phase (CI)** | A path-gated per-pipeline-area job in `ci.yml` (e.g. `backend-qoe-redflag`) — not the same as a PHASES.md phase. |
| **Phase (plan)** | A numbered stage of the build plan in PHASES.md (0–5). |
| **`ci-gate`** | The single aggregating CI job branch protection should require. |
| **`shared_mapped_gl`** | The session-scoped pytest fixture that memoizes the one real CoA-mapping LLM call (TESTING.md §4). |
| **Parking Lot** | PHASES.md's list of noticed-but-not-started work. |
