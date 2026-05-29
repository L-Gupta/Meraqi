# TAM Backend + AI Engine Spec (Beginner-Friendly, Cell-Level)

This document is written for someone with **zero finance background**.
It explains:

1. Exactly what data the frontend expects.
2. Exactly how every number is calculated.
3. Which sheet/document and columns each variable comes from.
4. What each graph needs as input.

Use this to build the real backend and AI calculation engine.

---

## 1) First Principles

## 1.1 One source of truth
Backend must compute metrics once and reuse the same numbers across all tabs.

If Revenue on Executive Summary is `$63.7M`, the same Revenue must appear in Financial Analysis and Reports.

## 1.2 Frontend expects pre-computed values
The UI expects many values as display strings (`"$63.7M"`, `"52%"`) and graph arrays as numbers.

## 1.3 Current frontend APIs
- `GET /api/deal/summary?deal=&period=&basis=`
- `GET /api/deal/analysis?deal=&period=&basis=`
- `GET /api/deal/risk?deal=&period=&basis=`
- `GET /api/deal/documents?deal=`
- `GET /api/deal/customer?deal=&period=&basis=`
- `GET /api/deal/inquiry?deal=&period=&basis=`
- `GET /api/deal/decision-queue?deal=&period=&basis=`
- `POST /api/inquiry/assistant`

Schema contract is in `lib/schemas/types.ts`.

## 1.4 Formula notation used in this document
- `SUM(x_1 ... x_n)` means add all values from period 1 to period n.
- `AVG(x_1 ... x_n)` means `(x_1 + x_2 + ... + x_n) / n`.
- `%` values are decimals multiplied by `100` for display.
  - Example: `0.125` is displayed as `12.5%`.
- `LTM` means last twelve months.
- Placeholder tag convention used below:
  - `[PLACEHOLDER: see 10.x]` means this displayed value is temporary and must be replaced with the formula in the referenced subsection.

---

## 2) Raw Document Inputs and Required Columns

You should parse uploaded files into a canonical backend model.  
Even if seller file formats differ, normalize to these tables and columns.

## 2.1 Trial Balance (`TB_FY24.xlsx`)
Expected source sheet: `TB` (or mapped equivalent)

Required columns:
- `Period` (example: `2026-02`)
- `Entity`
- `AccountCode`
- `AccountName`
- `Debit`
- `Credit`
- `NetAmount`
- `Currency`

Used for:
- Revenue
- COGS
- Opex
- AR/AP/Inventory/Prepaids/Accruals/Cash
- A=L+E tie-out

## 2.2 General Ledger (`GL_Export.csv`)
Required columns:
- `PostingDate`
- `Period`
- `Entity`
- `AccountCode`
- `AccountName`
- `JournalId`
- `Description`
- `Debit`
- `Credit`
- `Amount`
- `SourceSystem`
- `ManualFlag`

Used for:
- Rollforwards
- Manual JE volume
- Period-end anomaly checks

## 2.3 Income Statement schedule
Required columns:
- `Period`
- `Entity`
- `Revenue`
- `COGS`
- `OpexExDA`
- `DA` (optional)
- `EBITDA` (optional pre-calculated)

## 2.4 Balance Sheet schedule
Required columns:
- `Period`
- `Entity`
- `AccountsReceivable`
- `Inventory`
- `Prepaids`
- `AccountsPayable`
- `Accruals`
- `Cash`
- `TotalAssets`
- `TotalLiabilities`
- `Equity`

## 2.5 Cash Flow schedule
Required columns:
- `Period`
- `Entity`
- `OperatingCashFlow`
- `Capex`
- `InvestingCF` (optional)
- `FinancingCF` (optional)

## 2.6 AR Aging
Required columns:
- `Period`
- `Entity`
- `Bucket_0_30`
- `Bucket_31_60`
- `Bucket_61_90`
- `Bucket_90_plus`
- `TotalAR`

## 2.7 AP Aging
Required columns:
- `Period`
- `Entity`
- `Bucket_0_30`
- `Bucket_31_60`
- `Bucket_61_90`
- `Bucket_90_plus`
- `TotalAP`

## 2.8 Bank Statements
Required columns:
- `StatementDate`
- `Entity`
- `AccountNumber`
- `EndingBalance`
- `Currency`

## 2.9 Payroll
Required columns:
- `Period`
- `Entity`
- `PayrollExpense`
- `Headcount` (optional)

## 2.10 Adjustments Register (`Adjustments_Register.xlsx`)
Expected sheet: `Adj`

Required columns:
- `AdjustmentId`
- `Period`
- `Entity`
- `Category`
- `Description`
- `Amount`
- `Status` (`Proposed | Reviewed | Accepted`)
- `RiskClass` (`Low | Medium | High`)
- `EvidenceLink`

## 2.11 Mapping Dictionary + Rulebook
Required columns:
- `SourceAccountCode`
- `MappedLineItem`
- `StatementType` (`IS|BS|CF`)
- `SignConvention`
- `IncludeInReported`
- `IncludeInNormalized`
- `IncludeInProForma`

---

## 3) Canonical Monthly Variables (Base Building Blocks)

For every month `m` in last 12 months:

- `Revenue_m`
- `COGS_m`
- `Opex_m`
- `ReportedEBITDA_m`
- `AcceptedAdjustments_m`
- `AdjustedEBITDA_m`
- `AR_m`
- `Inventory_m`
- `Prepaids_m`
- `AP_m`
- `Accruals_m`
- `NWC_m`
- `OCF_m`
- `Capex_m`
- `CashConversion_m`

All high-level KPIs should be derived from these, not computed ad-hoc in each endpoint.

---

## 4) Exact KPI Formulas + Variable Lineage (All Current UI Numbers)

The sections below use this format:

- **Metric**
- **Formula**
- **Variables**
- **Where each variable comes from (sheet + columns)**

## 4.1 Executive Summary (Main tab)

### 4.1.1 Revenue (LTM)
- Formula:
  - `Revenue_LTM = Revenue_1 + Revenue_2 + ... + Revenue_12`
- Variables:
  - `Revenue_m`
- Source:
  - TB sheet mapped revenue accounts:
    - `TB.NetAmount` where mapped line item = Revenue
  - or IS schedule `IncomeStatement.Revenue`

### 4.1.2 Reported EBITDA (LTM)
- Formula:
  - `ReportedEBITDA_m = Revenue_m - COGS_m - Opex_m`
  - `ReportedEBITDA_LTM = SUM(ReportedEBITDA_m over 12 months)`
- Variables:
  - `Revenue_m`, `COGS_m`, `Opex_m`
- Source:
  - IS columns: `Revenue`, `COGS`, `OpexExDA`
  - or mapped TB lines

### 4.1.3 Adjusted EBITDA (LTM)
- Formula:
  - `AcceptedAdjustments_m = SUM(Adjustments.Amount where Status='Accepted' and Period=m)`
  - `AdjustedEBITDA_m = ReportedEBITDA_m + AcceptedAdjustments_m`
  - `AdjustedEBITDA_LTM = SUM(AdjustedEBITDA_m)`
- Source:
  - Adjustments Register:
    - `AdjustmentId`, `Period`, `Amount`, `Status`

### 4.1.4 Adjustments as % of EBITDA
- Formula:
  - `TotalAdjustments_LTM = AdjustedEBITDA_LTM - ReportedEBITDA_LTM`
  - `AdjustmentPct = TotalAdjustments_LTM / ReportedEBITDA_LTM`
- Output format:
  - percentage string (example `9.8%`)

### 4.1.5 Avg NWC (LTM)
- Formula:
  - `NWC_m = AR_m + Inventory_m + Prepaids_m - AP_m - Accruals_m`
  - `AvgNWC_LTM = (NWC_1 + ... + NWC_12) / 12`
- Source:
  - BS columns:
    - `AccountsReceivable`, `Inventory`, `Prepaids`, `AccountsPayable`, `Accruals`

### 4.1.6 Proposed NWC Peg [PLACEHOLDER in current UI: see 10.10]
- Current frontend placeholder:
  - `NWC_Peg = AvgNWC_LTM * 1.03`
- Production target:
  - `NWC_Peg = Avg normalized NWC ± seasonality adjustment`

### 4.1.7 EBITDA -> OCF Conversion %
- Formula (monthly):
  - `CashConversion_m = OCF_m / AdjustedEBITDA_m`
- Display currently uses:
  - `CashConversion_Avg = AVG(CashConversion_m over 12 months)`
- Source:
  - CF `OperatingCashFlow`
  - EBITDA from above

### 4.1.8 Overall Deal Risk (0-10)
- Formula:
  - output of risk model combining tie-out fails/warns, anomaly signals, document quality, adjustment intensity
- Output:
  - `riskScore` in [0,10]

### 4.1.9 Predicted Valuation (AI) (headline text)
- Current frontend formula:
  - `riskScore = parse("overall-risk" metric before "/10")`
  - `valuationMultiple = clamp(11.5 - 0.55*riskScore + 0.04*RevenueGrowthYoY, 5.5, 13.5)`
  - `PredictedValuation = AdjustedEBITDA_LTM * valuationMultiple`
- Production target:
  - valuation model output from backend with full valuation assumptions

### 4.1.10 Revenue Growth % (YoY / QoQ)
- Current frontend formula:
  - `YoY = (Revenue_last / Revenue_first) - 1`
  - `QoQ = (Revenue_last / Revenue_4_months_back) - 1`

### 4.1.11 EBITDA Margin (Reported vs Adjusted)
- Formula:
  - `ReportedMargin = ReportedEBITDA_LTM / Revenue_LTM`
  - `AdjustedMargin = AdjustedEBITDA_LTM / Revenue_LTM`

### 4.1.12 Normalized Earnings [PLACEHOLDER: see 10.1]
- Current frontend placeholder:
  - `NormalizedEarnings = AdjustedEBITDA_LTM * 0.98`
- Note:
  - `0.98` is an arbitrary prototype multiplier used to represent a simple `2%` normalization haircut.
  - It does **not** come from accounting source data.

### 4.1.13 Run-Rate Earnings [PLACEHOLDER: see 10.2]
- Current frontend placeholder:
  - `RunRateEarnings = AdjustedEBITDA_LTM * 1.01`
- Note:
  - `1.01` is an arbitrary prototype multiplier used to represent a simple `1%` forward uplift.
  - It does **not** come from accounting source data.

### 4.1.14 NWC as % of Revenue
- Formula:
  - `NWC_pct_revenue = AvgNWC_LTM / AvgMonthlyRevenue`
  - where `AvgMonthlyRevenue = Revenue_LTM / 12`

### 4.1.15 % EBITDA impacted by high-risk adjustments [PLACEHOLDER: see 10.3D]
- Current frontend placeholder:
  - `max(2.1, AdjustmentPct * 0.58)`
- Production target:
  - `HighRiskAdjImpactPct = SUM(Adjustments.Amount where RiskClass='High') / ReportedEBITDA_LTM`

### 4.1.16 Change Tracking cards [PLACEHOLDER: see 10.3]
These are currently UI placeholders:
- Delta Adjusted EBITDA since last refresh
- Newly added adjustments ($)
- Newly triggered risks (count)
- % Red / Amber flags

Production implementation:
- compute true deltas from previous snapshot table:
  - `metric_snapshots(deal_id, run_id, metric_id, value, timestamp)`

---

## 4.2 Financial Analysis tab (all sub-tabs)

## 4.2.1 QoE sub-tab

### Reported EBITDA
- same as section 4.1.2

### Adjusted EBITDA
- same as section 4.1.3

### Adjustment %
- same as section 4.1.4

### Recurring vs Non-recurring %
- Formula:
  - `RecurringPct = SUM(Adjustments where RecurringFlag=true) / TotalAdjustments`
  - `NonRecurringPct = 1 - RecurringPct`
- Source:
  - Adjustments register needs `RecurringFlag` or category-based mapping.

### High-risk addbacks (count)
- Formula:
  - `COUNT(AdjustmentId where RiskClass='High' and Status in ('Reviewed','Accepted','Proposed'))`

### Adj EBITDA margin
- Formula:
  - `AdjustedEBITDA_LTM / Revenue_LTM`

### Addback count
- Formula:
  - `COUNT(AdjustmentId)` over selected period

### Positive vs Negative Adjustments ($)
- Formula:
  - `Positive = SUM(Amount where Amount > 0)`
  - `Negative = SUM(Amount where Amount < 0)`

### Run-Rate Earnings (QoE section) [PLACEHOLDER: see 10.2]
- Current frontend placeholder:
  - `AdjustedEBITDA_LTM * 0.98` in this section
- Why this is temporary:
  - This multiplier is a UI placeholder and not derived from financial statements.
- Production target:
  - Replace with backend run-rate model output and keep logic consistent with Executive Summary.

## 4.2.2 Revenue QoE sub-tab

### Reported vs Normalized revenue
- Formula:
  - `ReportedRevenue = Revenue_LTM`
  - `NormalizedRevenue = ReportedRevenue + RevenueNormalizationAdjustments`

### Growth %
- Formula:
  - `(Revenue_last - Revenue_first) / Revenue_first`

### Recurring revenue %
- Formula:
  - `RecurringRevenue / TotalRevenue`

### Concentration Top1/Top3/Top5/Top10
- Formula:
  - `TopNConcentration = Revenue from top N customers / TotalRevenue`
- Source data required:
  - customer revenue table by month

### Volatility
- Suggested formula:
  - Let monthly revenue values be `R_1 ... R_12`
  - `MeanRevenue = (R_1 + R_2 + ... + R_12) / 12`
  - `Variance = ((R_1-MeanRevenue)^2 + ... + (R_12-MeanRevenue)^2) / 12`
  - `StdDev = sqrt(Variance)`
  - `RevenueVolatility = StdDev / MeanRevenue`

### EOM spike flags
- Rule:
  - if period-end booking ratio exceeds threshold, flag count increases

### Revenue recognized near period-end %
- Formula:
  - `Revenue booked in final X days / total period revenue`
- Source:
  - GL posting dates + revenue account mapping

### One-off/project-based revenue %
- Formula:
  - `Non-recurring project revenue / total revenue`

### Customer churn proxy
- Formula:
  - `(Prior recurring cohort revenue - Current recurring cohort revenue) / Prior recurring cohort revenue`

## 4.2.3 Margin/Cost QoE sub-tab
- Gross Margin % = `(Revenue - COGS)/Revenue`
- EBITDA Margin % = `EBITDA/Revenue`
- Opex % = `Opex/Revenue`
- COGS % = `COGS/Revenue`
- One-time costs = `SUM(one-time adjustment amounts impacting costs)`
- Cost spike flags = count of cost categories with month-over-month spike above threshold
- Payroll % of Opex = `PayrollExpense/Opex`
- Marketing %, IT/Tech %, Rent %, Contractors %: respective cost bucket divided by Revenue
- Temporarily suppressed costs: backend model output
- Cost inflation exposure: backend qualitative/score output

## 4.2.4 Working Capital sub-tab
- Avg NWC: section 4.1.5
- Peg: section 4.1.6
- DSO = `(AR / Revenue) * 365`
- DPO = `(AP / COGS) * 365`
- DIO = `(Inventory / COGS) * 365`
- CCC = `DSO + DIO - DPO`
- AR>60d% = `(AR_61_90 + AR_90+)/TotalAR`
- AP>60d% = `(AP_61_90 + AP_90+)/TotalAP`
- Peak/Trough NWC: `MAX(NWC_m)` and `MIN(NWC_m)`
- NWC normalization adjustments: backend adjustment model output

## 4.2.5 Cash Flow & Conversion sub-tab
- OCF (LTM) = `SUM(OperatingCashFlow_m)`
- Conversion % = `OCF_LTM / AdjustedEBITDA_LTM`
- Capex = `SUM(Capex_m)`
- FCF = `OCF_LTM - Capex_LTM`
- Runway months = `CashBalance / AvgMonthlyBurn`
- WC drag = modeled or bridge difference from EBITDA to OCF
- Negative OCF months = `COUNT(month where OCF_m < 0)`
- Threshold statuses:
  - Weak if conversion `< 60%`
  - High Risk if `< 30%`
  - Critical if `< 0%`

## 4.2.6 Statements sub-tab
Income statement rows displayed:
- Net Revenue
- COGS
- EBITDA
- Adjusted EBITDA

Balance sheet rows displayed:
- Accounts Receivable
- Inventory
- Accounts Payable
- Accruals

Each row currently maps to same trace modal; production should return true line-level lineage.

---

## 4.3 Risk Assessment tab

## 4.3.1 Risk score
- A single score `0..10`

## 4.3.2 Severity bands
- Green: `< 4.5`
- Amber: `>= 4.5 and < 7`
- Red: `>= 7`

## 4.3.3 Tie-out scoreboard values
For each check:

- `Expected` from authoritative schedule
- `Observed` from independent source
- `Diff = Observed - Expected`
- `VariancePct = |Observed - Expected| / |Expected| * 100`
- `TolerancePct` from settings/policy
- Status:
  - Pass if `VariancePct <= TolerancePct`
  - Warn if `TolerancePct < VariancePct <= 1.5 * TolerancePct`
  - Fail otherwise

Tie-outs currently shown:
1. TB <-> IS (Revenue)
2. TB <-> BS (A=L+E)
3. AR Aging <-> BS AR
4. AP Aging <-> BS AP
5. Cash <-> Bank
6. GL rollforward <-> TB

## 4.3.4 Risk register columns
- Risk
- Category
- Severity
- Probability
- Adjustment reliance (% EBITDA)
- Impact area
- Exposure range
- Open/Resolved
- Evidence

## 4.3.5 Anomaly monitor rows
- Discount rate variance
- Margin outliers
- Payroll spikes
- Refunds/credits %
- Manual JE volume %

Each row has:
- Current
- Prior
- Variance
- Status (Pass/Warn)

---

## 4.4 Documents tab

## Coverage heatmap
- Rows: schedule names
- Columns: month labels
- Cell status: `Available | Partial | Missing`
- Backend must return:
  - `coverage[].schedule`
  - `coverage[].months[].month`
  - `coverage[].months[].status`

## File inventory table
Fields:
- file
- detected type
- period coverage
- entity
- status
- confidence

## PBC suggestions
Fields:
- request
- severity
- owner

---

## 4.5 Customer Analytics tab

KPIs:
- Top 10 concentration %
- Largest customer %
- NRR proxy
- # discount anomalies

Formulas:
- `Top10% = Top10 customer revenue / total revenue`
- `LargestCustomer% = largest customer revenue / total revenue`
- `NRR proxy = retained cohort current recurring / retained cohort prior recurring`
- `discount anomaly count = COUNT(month where rate > 1.5 * priorRate)`

---

## 4.6 Reports tab

Report readiness currently:
- Blocked if blocking inquiries > 0 OR tie-out fails > 0
- Draft if warns > 0
- Ready otherwise

Export PDFs/ZIP are currently generated client-side mock text.
Production should move to backend job pipeline.

---

## 4.7 Inquiry + Decision Queue

Inquiry columns:
- id, request, owner, dueDate, status, blocking

Decision Queue columns:
- title
- impactArea
- impactScore
- owner
- dueDate
- status
- blocking
- source label/url

Current impact score logic is heuristic in mock backend. Replace with model-driven score.

---

## 5) Graph-by-Graph Data Requirements

## 5.1 Executive Summary graphs

1. Revenue & Adjusted EBITDA trend
- x: `month`
- y1: `revenue`
- y2: `adjustedEbitda`

2. EBITDA Bridge/Waterfall
- Reported = `SUM(reportedEbitda_m)`
- Addbacks = `SUM(adjustedEbitda_m - reportedEbitda_m)`
- Adjusted = `SUM(adjustedEbitda_m)`

3. NWC trend
- x: month
- y: `nwc`

4. Cash conversion trend
- x: month
- y: `cashConversion`

## 5.2 Financial Analysis graphs
- EBITDA bridge waterfall (same math)
- Adjustments by category: group by `category`, sum `amount`
- Revenue trend: `trend.revenue`
- Concentration bars: `Top1/3/5/10`
- End-of-month spike: period-end revenue behavior
- Gross margin trend: `(revenue - cogs)/revenue`
- Opex mix: category percentages
- AR/AP aging buckets: `0-30,31-60,61-90,90+`
- EBITDA->OCF bridge: EBITDA, WC drag, OCF
- Conversion trend: monthly conversion %

## 5.3 Risk graphs
- Risk zone scatter:
  - x: score
  - y: risk dimension
  - colored zone background (green/amber/red ranges)

## 5.4 Customer graphs
- Top customer trend:
  - x: month
  - y: top10 and top1 concentration
- Discount anomaly:
  - x: month
  - y: current rate vs prior rate

---

## 6) Important “Current Placeholder” Values You Should Replace

These are currently hardcoded/proxy values in frontend logic and should become backend outputs:

1. `Normalized Earnings = adjustedLtm * 0.98`
2. `Run-Rate Earnings = adjustedLtm * 1.01` (dashboard)
3. `Run-Rate Earnings = adjustedLtm * 0.98` (QoE sub-tab)
4. Several “change tracking” KPIs
5. Parts of anomaly monitor synthetic calculations

Do not keep these multipliers in production.

---

## 7) Backend Build Checklist for Your Cofounder

1. Parse all uploaded docs into canonical tables.
2. Build account mapping engine (raw account -> canonical metric bucket).
3. Compute monthly base variables (Revenue_m, COGS_m, Opex_m, AR_m, etc.).
4. Compute all LTM/ratio metrics from base variables.
5. Build tie-out engine and anomaly engine.
6. Build risk scoring model outputting:
   - overall score
   - dimension scores
   - register entries with severity
7. Build lineage output for each KPI:
   - inputs
   - transformations
   - formula
   - overrides
   - cell trace
8. Serve all endpoint payloads exactly as `lib/schemas/types.ts` expects.
9. Add snapshot versioning so delta metrics are true historical comparisons.
10. Replace placeholders with model-backed values without changing response shape.

---

## 8) Example “No-Finance” Walkthrough (One KPI)

KPI: `Avg NWC (LTM)`

Step 1: For each month, pick these values from Balance Sheet:
- AR (Accounts Receivable)
- Inventory
- Prepaids
- AP (Accounts Payable)
- Accruals

Step 2: Monthly formula:
- `NWC_month = AR + Inventory + Prepaids - AP - Accruals`

Step 3: Average over 12 months:
- `AvgNWC_LTM = (NWC_1 + NWC_2 + ... + NWC_12) / 12`

Step 4: Send to frontend as display string:
- Example: `"$6.1M"`

This same pattern should be applied for every KPI in the system.

---

## 9) Zero-Miss KPI + Number Coverage Matrix (Exact UI Inventory)

This section is a strict inventory of all KPI-like numbers currently rendered in the frontend across the full product (not only Executive Summary).

For each item below:
- **UI label** = what analyst sees
- **Current frontend formula** = exact current behavior from code
- **Production formula target** = what backend should provide
- **Current data source in code** = endpoint field currently used
- **Authoritative source document(s)** = where backend should derive from

## 9.1 Executive Summary (`app/dashboard/page.tsx`)

### 9.1.1 Base KPI cards (`summary.metrics`)
1. **Revenue (LTM)**
- Current frontend formula: value passed from API.
- Production formula target: `Revenue_LTM = SUM(Revenue_m for m=1..12)`
- Current data source in code: `GET /api/deal/summary -> metrics[id="revenue-ltm"].value`
- Authoritative source document(s): TB mapped Revenue accounts or IS.Revenue.

2. **Reported EBITDA (LTM)**
- Current frontend formula: value passed from API.
- Production formula target: `ReportedEBITDA_m = Revenue_m - COGS_m - Opex_m`; `ReportedEBITDA_LTM = SUM(ReportedEBITDA_m)`
- Current data source in code: `summary.metrics[id="reported-ebitda"]`
- Authoritative source document(s): IS (`Revenue`, `COGS`, `OpexExDA`) or mapped TB.

3. **Adjusted EBITDA (LTM)**
- Current frontend formula: value passed from API.
- Production formula target: `AdjustedEBITDA_m = ReportedEBITDA_m + AcceptedAdjustments_m`; `AdjustedEBITDA_LTM = SUM(AdjustedEBITDA_m)`
- Current data source in code: `summary.metrics[id="adjusted-ebitda"]`
- Authoritative source document(s): IS/TB + Adjustments Register (`Amount`, `Status`).

4. **Adjustments as % of EBITDA**
- Current frontend formula: value passed from API.
- Production formula target: `AdjustmentPct = (AdjustedEBITDA_LTM - ReportedEBITDA_LTM) / ReportedEBITDA_LTM`
- Current data source in code: `summary.metrics[id="adj-pct"]`
- Authoritative source document(s): derived from above EBITDA calculations.

5. **Avg NWC (LTM)**
- Current frontend formula: value passed from API.
- Production formula target: `NWC_m = AR_m + Inventory_m + Prepaids_m - AP_m - Accruals_m`; `AvgNWC_LTM = SUM(NWC_m)/12`
- Current data source in code: `summary.metrics[id="avg-nwc"]`
- Authoritative source document(s): BS (`AccountsReceivable`, `Inventory`, `Prepaids`, `AccountsPayable`, `Accruals`).

6. **Proposed NWC Peg** `[PLACEHOLDER in current UI: see 10.10]`
- Current frontend formula: value passed from API.
- Production formula target: `NWC_Peg = Avg normalized NWC +/- seasonality adjustment`
- Current data source in code: `summary.metrics[id="nwc-peg"]`
- Authoritative source document(s): BS + seasonality policy + overrides.

7. **EBITDA -> Operating Cash Flow conversion %**
- Current frontend formula: value passed from API.
- Production formula target: `CashConversion = OCF_LTM / AdjustedEBITDA_LTM` (or monthly then averaged).
- Current data source in code: `summary.metrics[id="cash-conv"]`
- Authoritative source document(s): CF (`OperatingCashFlow`) + EBITDA model.

8. **Overall Deal Risk**
- Current frontend formula: value passed from API.
- Production formula target: weighted risk model from tie-outs + anomaly signals + data integrity + adjustment reliance.
- Current data source in code: `summary.metrics[id="overall-risk"]`
- Authoritative source document(s): risk engine using tie-outs, anomaly checks, evidence quality.

### 9.1.2 Headline number
9. **Predicted Valuation (AI)** and **x Adj. EBITDA multiple**
- Current frontend formula:
  - `riskScore = parse(summary.metrics["overall-risk"])`
  - `valuationMultiple = clamp(11.5 - 0.55*riskScore + 0.04*RevenueGrowthYoY, 5.5, 13.5)`
  - `PredictedValuation = AdjustedEBITDA_LTM * valuationMultiple`
- Production formula target: backend valuation model output with assumptions (WACC, terminal growth, scenario probabilities, etc.).
- Current data source in code: derived from `summary.trend` + `summary.metrics`.
- Authoritative source document(s): full valuation model inputs from financial history + assumptions.

### 9.1.3 Additional KPI cards (derived in UI today)
10. **Revenue Growth % (YoY / QoQ)**
- Current frontend formula:
  - `YoY = (Revenue_last / Revenue_first - 1) * 100`
  - `QoQ = (Revenue_last / Revenue_4_months_back - 1) * 100`
- Production formula target: same formula but backend-computed.
- Current data source in code: `summary.trend[].revenue`
- Authoritative source document(s): TB/IS monthly Revenue.

11. **EBITDA Margin (Reported vs Adjusted)**
- Current frontend formula:
  - `ReportedMargin = ReportedEBITDA_LTM / Revenue_LTM`
  - `AdjustedMargin = AdjustedEBITDA_LTM / Revenue_LTM`
- Current data source in code: `summary.trend[].reportedEbitda`, `summary.trend[].adjustedEbitda`, `summary.trend[].revenue`
- Authoritative source document(s): IS/TB + Adjustments.

12. **Normalized Earnings** `[PLACEHOLDER: see 10.1]`
- Current frontend formula: `AdjustedEBITDA_LTM * 0.98` (placeholder only)
- Production formula target: backend normalized earnings model output.
- Current data source in code: derived from `summary.trend`.
- Authoritative source document(s): adjustments + normalization policy + one-time item classification.

13. **Run-Rate Earnings** `[PLACEHOLDER: see 10.2]`
- Current frontend formula: `AdjustedEBITDA_LTM * 1.01` (placeholder only)
- Production formula target: backend run-rate model.
- Current data source in code: derived from `summary.trend`.
- Authoritative source document(s): trend-normalized earnings model.

14. **NWC as % of Revenue**
- Current frontend formula: `(AVG(nwc) / AVG(revenue)) * 100`
- Production formula target: `AvgNWC_LTM / AvgMonthlyRevenue * 100`
- Current data source in code: `summary.trend[].nwc`, `summary.trend[].revenue`
- Authoritative source document(s): BS + Revenue model.

15. **% EBITDA impacted by high-risk adjustments** `[PLACEHOLDER: see 10.3D]`
- Current frontend formula: `max(2.1, AdjustmentPct * 0.58)` (placeholder)
- Production formula target: `SUM(HighRiskAcceptedAdjustments) / ReportedEBITDA_LTM * 100`
- Current data source in code: derived from trend proxy.
- Authoritative source document(s): Adjustments Register (`RiskClass`, `Status`, `Amount`).

### 9.1.4 Change Tracking KPI cards (currently synthetic) `[PLACEHOLDER: see 10.3]`
16. **Delta Adjusted EBITDA since last refresh**
- Current frontend formula: `max(0.12, AdjustedEBITDA_LTM * 0.018)`
- Production formula target: `AdjustedEBITDA_CurrentRun - AdjustedEBITDA_PreviousRun`
- Current data source in code: synthetic from trend.
- Authoritative source document(s): metric snapshots by run.

17. **Newly added adjustments ($)**
- Current frontend formula: `max(0.2, AdjustedEBITDA_LTM * 0.034)`
- Production formula target: `SUM(Adjustment.Amount added between previous and current run)`
- Current data source in code: synthetic from trend.
- Authoritative source document(s): adjustment history table + run IDs.

18. **Newly triggered risks (count)**
- Current frontend formula: `max(1, round(abs(RevenueGrowthQoQ)/2.4))`
- Production formula target: count of risk rules newly moving to triggered state vs prior run.
- Current data source in code: synthetic from growth proxy.
- Authoritative source document(s): risk engine event log.

19. **% Red / Amber Flags**
- Current frontend formula:
  - `RedPct = clamp(16 + abs(RevenueGrowthQoQ), 18, 44)`
  - `AmberPct = max(46, 82 - abs(RevenueGrowthQoQ))`
- Production formula target:
  - `RedPct = RedFlagCount / TotalFlagCount * 100`
  - `AmberPct = AmberFlagCount / TotalFlagCount * 100`
- Current data source in code: synthetic.
- Authoritative source document(s): risk register and anomaly rule statuses.

### 9.1.5 Decision Queue panel on Executive Summary
20. **Readiness badge**
- Current frontend formula: value from decision queue endpoint (`Ready | Draft | Blocked`).
- Production formula target: deterministic readiness policy from blockers, tie-outs, unresolved decisions.
- Current data source in code: `GET /api/deal/decision-queue -> readiness`
- Authoritative source document(s): inquiry status, tie-out status, decision queue state.

21. **Impact score per decision row**
- Current frontend formula: value from endpoint.
- Production formula target: weighted impact score model by area, exposure, urgency, dependency.
- Current data source in code: `decisionQueue.items[].impactScore`
- Authoritative source document(s): risk metrics, tie-out variances, inquiry blockers.

## 9.2 Financial Analysis (`app/financial-analysis/page.tsx`)

### 9.2.1 QoE sub-tab
Displayed KPIs:
- Reported EBITDA
- Adjusted EBITDA
- Adjustment %
- Recurring vs Non-recurring %
- High-risk addbacks
- Adj EBITDA margin
- Addback count
- Positive vs Negative Adjustments ($)
- Run-Rate Earnings

Additional displayed numeric cards `[PLACEHOLDER: see 10.3 and 10.2]`:
- **Adjustment Category Totals** card values by category:
  - Current frontend formulas are synthetic allocation percentages of `totalAdjustmentAmount`:
    - One-Time: `34%`
    - Owner/Management: `16%`
    - Related-Party: `9%`
    - Non-Operating: `18%`
    - Accounting Policy: `5%`
    - Run-Rate Cost savings/increases: `8%`
    - Exceptional: `10%`
  - Production formula target: direct group-by sum from adjustments table:
    - `SUM(Amount where Category = X and Status in included statuses)`
  - Source documents: Adjustments Register (`Category`, `Amount`, `Status`).

### 9.2.2 Revenue QoE sub-tab
Displayed KPIs:
- Reported vs Normalized revenue
- Growth %
- Recurring revenue %
- Concentration (Top 1/3/5/10)
- Volatility
- EOM spike flags
- Top 5 / Top 10 concentration %
- Largest Customer %
- Revenue recognized near period-end %
- One-off / project-based revenue %
- Customer churn proxy

Current UI-only synthetic logic to replace in backend `[PLACEHOLDER: see 10.4]`:
- `Revenue recognized near period-end %` uses volatility proxy with clamp.
- `One-off / project-based revenue %` uses `8 + totalAdjustmentAmount*4` clamp.
- `Customer churn proxy` uses volatility proxy.

Production formulas:
- Period-end revenue % = `Revenue booked in final N days / total period revenue`.
- One-off % = `one-time/project revenue / total revenue`.
- Churn proxy = `(prior cohort recurring revenue - current cohort recurring revenue) / prior cohort recurring revenue`.

### 9.2.3 Margin / Cost QoE sub-tab
Displayed KPIs:
- Gross margin %
- EBITDA margin %
- Opex % of revenue
- COGS % revenue
- One-time costs
- Cost spike flags
- Payroll % of opex
- Margin Trend (LTM)
- Marketing %
- IT / Tech %
- Rent / Facilities %
- Contractors / Outsourcing %
- Temporarily suppressed costs ($)
- Cost inflation exposure

Current UI-only synthetic logic to replace `[PLACEHOLDER: see 10.5]`:
- Margin trend in bps from reported vs adjusted margin proxy.
- Marketing/IT/Rent/Contractors are scaled from current opex mix proxies.
- Temporarily suppressed costs uses fixed percentage proxy.
- Cost inflation exposure is static qualitative value.

Production targets:
- derive each cost category from mapped Opex account groups and payroll/vendor indices.

### 9.2.4 Working Capital sub-tab
Displayed KPIs:
- Avg NWC
- Peg
- DSO / DPO / DIO / CCC
- AR>60d%
- AP>60d%
- Peak / Trough NWC
- NWC as % of Revenue
- NWC Normalization Adjustments ($)
- Accounts Receivable
- Inventory
- Prepaids / Other CA
- Accounts Payable
- Accruals / Other CL
- AR > revenue growth
- Payables compression
- Inventory buildup
- Seasonality mismatch

Current UI-only synthetic logic to replace `[PLACEHOLDER: see 10.6]`:
- NWC normalization adjustment value.
- composition amounts from `avgNwc` multipliers.
- qualitative driver flags are static/synthetic.

Production targets:
- composition from true BS latest values.
- driver flags from rule engine comparing period-over-period trends.

### 9.2.5 Cash Flow & Conversion sub-tab
Displayed KPIs:
- OCF (LTM)
- Conversion %
- Capex
- FCF
- Runway
- WC drag
- Negative OCF months
- Conversion threshold (<60) status
- Conversion threshold (<30) status
- Conversion threshold (<0) status

Current UI-only synthetic logic to replace `[PLACEHOLDER: see 10.5 and 10.7]`:
- WC drag bridge value in waterfall.
- threshold statuses now based on average conversion only.

Production targets:
- derive WC drag from actual EBITDA->OCF bridge components.
- threshold statuses from policy table in settings.

### 9.2.6 Statements sub-tab (clickable line items)
Displayed values:
- Income Statement rows: Net Revenue, COGS, EBITDA, Adjusted EBITDA (Latest and LTM)
- Balance Sheet rows: AR, Inventory, AP, Accruals (Latest and LTM)

Current UI-only synthetic logic to replace `[PLACEHOLDER: see 10.6]`:
- COGS shown as `53%` proxy of Revenue.
- BS line items shown as multipliers of NWC.

Production targets:
- fetch actual standardized statement row values from backend model.
- expose lineage per row/cell.

## 9.3 Risk Assessment (`app/risk-assessment/page.tsx`)

### 9.3.1 Headline and gauge numbers
1. **Overall deal risk: X/10** (top-right chip)
- Current source: `risk.riskScore` from API.
- Production formula target: weighted risk model output.

2. **Circular gauge fill %**
- Current frontend formula: `(riskScore/10)*100`
- Production target: same rendering logic from backend score.

3. **Severity pill (Green/Amber/Red)**
- Current frontend rule:
  - Green `< 4.5`
  - Amber `>= 4.5 and < 7`
  - Red `>= 7`
- Production target: same thresholds unless policy-configurable.

4. **Red / Amber / Green counts**
- Current formula:
  - count risk register rows by `severity`.
- Source now: `risk.register[]`.
- Production target: same based on backend register severities.

5. **Open Risks / Resolved Risks**
- Current formula:
  - Open = count `status != "Mitigated"`
  - Resolved = count `status == "Mitigated"`
- Source now: `risk.register[]`.
- Production target: same.

### 9.3.2 Risk Hotspots panel
6. **Top risk dimension rows**
- Current formula:
  - sort `risk.dimensions[]` by score descending, take top 3.
- Current displayed number per row:
  - `{dimension.score} / 10`
- Progress bar fill:
  - `(dimension.score/10)*100`
- Production target: backend returns fully modeled `dimensions[]`.

### 9.3.3 Tie-out scoreboard table
7. **Expected / Observed / Diff / Variance% / Tolerance / Status**
- Current source: `risk.tieOuts[]`.
- Production formulas:
  - `Diff = Observed - Expected`
  - `VariancePct = abs(Observed-Expected)/abs(Expected)*100`
  - status thresholds:
    - Pass `VariancePct <= TolerancePct`
    - Warn `TolerancePct < VariancePct <= 1.5*TolerancePct`
    - Fail otherwise
- Source documents:
  - TB, IS, BS, AR aging, AP aging, bank statement, GL rollforward datasets.

### 9.3.4 Anomaly Detection Monitor table
8. **Discount rate variance**
9. **Margin outliers**
10. **Payroll spikes**
11. **Refunds/credits %**
12. **Manual JE volume %**

Current frontend behavior `[PLACEHOLDER: see 10.7]`:
- these 5 rows are currently generated from score proxies.
- each row includes Current, Prior, Variance, Status.

Production target:
- backend should compute each anomaly metric from source transactions and return deterministic values.

## 9.4 Customer Analytics (`app/customer-analytics/page.tsx`)

Displayed KPI cards:
1. Top 10 concentration %
2. Largest customer %
3. NRR proxy
4. #discount anomalies

Displayed anomaly list rows:
- For each month:
  - Current discount rate
  - Prior discount rate
  - Rule status:
    - `ORANGE` if `rate > 1.5 * priorRate`
    - `OK` otherwise

Current source:
- `GET /api/deal/customer`:
  - `metrics[]`
  - `topTrend[]`
  - `discountAnomalies[]`

Production source documents:
- customer invoice-level revenue table, discount fields, prior-period history.

## 9.5 Reports (`app/reports/page.tsx`)

Displayed KPI-like status:
1. **Report Readiness**
- Current frontend formula:
  - `Blocked` if blocking inquiries > 0 OR tie-out fails > 0
  - `Draft` if warns > 0
  - `Ready` otherwise
- Current source:
  - `risk.tieOuts[]` and `inquiry.inquiries[]`.
- Production target:
  - same, or policy-driven readiness model.

## 9.6 Inquiry (`app/inquiry/page.tsx`)

Displayed KPI-like fields in Decision Queue:
- `impactScore` (one decimal)
- `blocking` flag
- status badge (`Open/In Progress/Resolved/Deferred`)
- readiness in title (`Decision Queue (Readiness)`)

Current source:
- `GET /api/deal/decision-queue`.

Production target:
- model-driven impact scoring + persistent workflow statuses.

## 9.7 Documents (`app/documents/page.tsx`)

Displayed KPI-like fields:
- Coverage heatmap status by schedule/month (`Available | Partial | Missing`)
- File inventory confidence %

Current source:
- `GET /api/deal/documents`.

Production source documents:
- ingestion logs + parser confidence engine + coverage matrix model.

## 9.8 Summary: what is still synthetic today (must be replaced by backend)

The following are currently placeholder/synthetic and should become backend-computed:
- Normalized Earnings (`*0.98`) `[PLACEHOLDER: see 10.1]`
- Run-Rate Earnings (`*1.01` and QoE `*0.98`) `[PLACEHOLDER: see 10.2]`
- several change tracking cards `[PLACEHOLDER: see 10.3]`
- some Revenue QoE synthetic cards `[PLACEHOLDER: see 10.4]`
- multiple Margin/Cost synthetic cards `[PLACEHOLDER: see 10.5]`
- Working capital composition proxy multipliers `[PLACEHOLDER: see 10.6]`
- Anomaly detection monitor synthetic rows in Risk tab `[PLACEHOLDER: see 10.7]`
- parts of Decision Queue impact scoring/readiness logic in mock layer `[PLACEHOLDER: see 10.8]`

When backend is ready, keep the same response shape in `lib/schemas/types.ts` but replace these synthetic calculations with real model outputs.

---

## 10) Placeholder Replacement Playbook (Exact Derivation Guide)

This section explains exactly what “placeholder/synthetic” means in TAM and how to replace those values with real computed outputs.

Definition:
- **Placeholder value** = a temporary UI/demo formula used to make cards/charts move, but not sourced from full accounting logic.
- **Real computed value** = deterministic output produced by backend from canonical financial tables and rule/model pipelines.

Replacement rule:
1. Keep the same response field name and response schema (`lib/schemas/types.ts`).
2. Replace only the computation source.
3. Compute at backend run-time from canonical tables.
4. Store run snapshots so delta metrics compare current vs previous run.

## 10.1 Normalized Earnings (`AdjustedEBITDA_LTM * 0.98` today)

Current placeholder:
- `NormalizedEarnings = AdjustedEBITDA_LTM * 0.98`

Replace with real computation:
- `NormalizedEarnings = ReportedEBITDA_LTM + Sum(NormalizingAdjustments_i)`

Where each variable comes from:
- `ReportedEBITDA_LTM`:
  - From IS/TB mapped values.
  - IS columns: `Revenue`, `COGS`, `OpexExDA` by month.
- `NormalizingAdjustments_i`:
  - From Adjustments Register rows classified as normalizing.
  - Required columns: `AdjustmentId`, `Amount`, `Category`, `Status`, `RecurringFlag`, `OneTimeFlag`.

Backend implementation steps:
1. Pull last 12 months monthly P&L.
2. Compute monthly and LTM reported EBITDA.
3. Filter adjustments where:
   - `Status in ('Reviewed','Accepted')`
   - `Category in allowed normalization categories`
   - exclude clearly non-recurring items if policy says so.
4. Sum included adjustment amounts.
5. Add to reported EBITDA and return as display value.

## 10.2 Run-Rate Earnings (`*1.01` dashboard, `*0.98` QoE today)

Current placeholders:
- Dashboard: `RunRate = AdjustedEBITDA_LTM * 1.01`
- QoE tab: `RunRate = AdjustedEBITDA_LTM * 0.98`

Replace with real computation:
- `RunRateEarnings = (LatestQuarterAdjustedEBITDA * 4) + ForwardCostActions - TemporaryBenefitsReversal`

Where variables come from:
- `LatestQuarterAdjustedEBITDA`:
  - from monthly adjusted EBITDA, sum last 3 months.
- `ForwardCostActions`:
  - approved run-rate cost programs table.
- `TemporaryBenefitsReversal`:
  - adjustments flagged temporary/supplier deferral/one-off benefit.

Required tables/columns:
- Adjustments: `Amount`, `EffectiveFrom`, `DurationType`, `RunRateEligibleFlag`.
- Cost actions: `ProgramId`, `AnnualizedImpact`, `Confidence`, `ApprovedFlag`.

## 10.3 Change Tracking cards (currently synthetic)

### A) Delta Adjusted EBITDA since last refresh
Current placeholder:
- `max(0.12, AdjustedEBITDA_LTM * 0.018)`

Real formula:
- `DeltaAdjustedEBITDA = AdjustedEBITDA_LTM(CurrentRunId) - AdjustedEBITDA_LTM(PreviousRunId)`

Required storage:
- `metric_snapshots`: `deal_id`, `run_id`, `metric_id`, `metric_value`, `timestamp`.

### B) Newly added adjustments ($)
Current placeholder:
- `max(0.2, AdjustedEBITDA_LTM * 0.034)`

Real formula:
- `NewAdjustments = SUM(Amount where Adjustment.CreatedAt in (PreviousRunTime, CurrentRunTime])`

Required columns:
- Adjustments table: `CreatedAt`, `Amount`, `DealId`, `RunId`.

### C) Newly triggered risks (count)
Current placeholder:
- `max(1, round(abs(RevenueGrowthQoQ)/2.4))`

Real formula:
- `NewRisks = COUNT(RiskRuleId where PriorStatus='Pass' and CurrentStatus in ('Warn','Fail'))`

Required columns:
- risk events table: `RuleId`, `PriorStatus`, `CurrentStatus`, `RunId`.

### D) % Red / Amber flags
Current placeholder:
- heuristic percentages based on growth.

Real formulas:
- `RedPct = RedFlagCount / TotalFlagCount * 100`
- `AmberPct = AmberFlagCount / TotalFlagCount * 100`

Source:
- risk register + anomaly status rows in current run.

## 10.4 Revenue QoE synthetic metrics replacement

### A) Revenue recognized near period-end %
Current placeholder:
- volatility-based clamp.

Real formula:
- `PeriodEndRevenuePct = RevenueBookedLastNDays / RevenueForPeriod * 100`

Exact derivation:
1. Use GL revenue entries for the month.
2. `RevenueForPeriod = SUM(GL.Amount where mapped to revenue and Period = m)`
3. `RevenueBookedLastNDays = SUM(GL.Amount where PostingDate in last N calendar days of period and mapped to revenue)`
4. Divide and multiply by 100.

Required columns:
- GL: `PostingDate`, `Amount`, `AccountCode`, `Period`.
- Mapping dictionary: `AccountCode -> Revenue`.

### B) One-off / project-based revenue %
Current placeholder:
- `8 + totalAdjustmentAmount*4` clamp.

Real formula:
- `OneOffRevenuePct = OneOffRevenue / TotalRevenue * 100`

Where from:
- Invoice/order table or GL line tagging:
  - `RevenueType` (`Recurring`, `Project`, `OneOff`).

### C) Customer churn proxy
Current placeholder:
- volatility proxy.

Real formula:
- `ChurnProxyPct = (PriorCohortRecurringRevenue - CurrentCohortRecurringRevenue) / PriorCohortRecurringRevenue * 100`

Where from:
- customer monthly recurring table:
  - `CustomerId`, `Month`, `RecurringRevenue`, `ActiveFlag`.

## 10.5 Margin/Cost synthetic metrics replacement

### A) Margin Trend (LTM)
Current placeholder:
- synthetic bps from current trend.

Real formula:
- `MarginTrendBps = (AdjustedMargin_CurrentLTM - AdjustedMargin_PriorLTM) * 10,000`

Where:
- `AdjustedMargin = AdjustedEBITDA_LTM / Revenue_LTM`.

### B) Marketing %, IT/Tech %, Rent/Facilities %, Contractors %
Current placeholder:
- scaled proxy off opex mix.

Real formula pattern:
- `CategoryPct = CategoryCost_LTM / Revenue_LTM * 100`

CategoryCost derivation:
- Sum mapped Opex accounts by category using mapping table.

Required columns:
- TB/GL: `AccountCode`, `NetAmount/Amount`, `Period`.
- Mapping table: `AccountCode`, `CostCategory`.

### C) Temporarily suppressed costs ($)
Current placeholder:
- fixed proportion of total adjustments.

Real formula:
- `SuppressedCosts = SUM(Amount where AdjustmentTag='TemporaryCostSuppression' and Status in included statuses)`

### D) Cost inflation exposure
Current placeholder:
- static text (`Moderate`).

Real formula example:
- `InflationExposureScore = w1*VendorCostInflation + w2*PayrollInflation + w3*UtilitiesInflation`
- map score to band (`Low/Moderate/High`).

Sources:
- AP/vendor spend trend, payroll trend, external inflation index table.

## 10.6 Working Capital composition placeholders replacement

Current placeholders:
- AR/Inventory/AP/etc shown as multipliers of avg NWC.

Replace with real values:
- `AR_latest = BS.AccountsReceivable at latest month`
- `Inventory_latest = BS.Inventory at latest month`
- `Prepaids_latest = BS.Prepaids at latest month`
- `AP_latest = BS.AccountsPayable at latest month`
- `Accruals_latest = BS.Accruals at latest month`

LTM companion values:
- average each monthly series over last 12 months.

## 10.7 Risk anomaly monitor placeholders replacement

Current placeholders:
- discount/margin/payroll/refund/manual-JE rows generated from risk score proxies.

Replace with deterministic rules:

1. Discount rate variance %
- `DiscountRate_m = Discounts_m / GrossRevenue_m`
- `Variance_m = DiscountRate_m - DiscountRate_(m-1)`
- warn if `DiscountRate_m > 1.5 * DiscountRate_(m-1)`.

2. Margin outliers
- compute gross margin by product/customer.
- z-score or IQR outlier rule.

3. Payroll spikes
- `PayrollMoM = (Payroll_m - Payroll_(m-1)) / Payroll_(m-1) * 100`
- warn above threshold.

4. Refunds/credits %
- `RefundPct = Refunds_m / Revenue_m * 100`

5. Manual JE volume %
- `ManualJEPct = ManualJEAmount_m / TotalJEAmount_m * 100`

Required source columns:
- GL: `ManualFlag`, `Amount`, `PostingDate`, `AccountCode`.
- Revenue/discount/refund tables or mapped GL categories.

## 10.8 Decision Queue impact score placeholder replacement

Current behavior `[PLACEHOLDER: see 10.8]`:
- score comes from mock API heuristics.

Replace with model score:
- `ImpactScore = 0.35*FinancialExposureScore + 0.25*DeadlineUrgency + 0.20*BlockingWeight + 0.20*DependencyWeight`

Example component derivations:
- `FinancialExposureScore`: normalized value from affected EBITDA/NWC/Cash at risk.
- `DeadlineUrgency`: days to due date transformed to 0..10.
- `BlockingWeight`: 10 if blocking, else lower.
- `DependencyWeight`: count/criticality of downstream report dependencies.

## 10.9 Implementation checklist for replacing placeholders safely

1. Add backend unit tests for every replaced formula.
2. Add run snapshot table before switching UI to real deltas.
3. Keep response schema unchanged; only value computation changes.
4. Add `calculation_version` and `run_id` to responses for auditability.
5. Expose lineage details in APIs for each replaced metric.
6. Run reconciliation test: Executive Summary vs Financial Analysis must match for same metric IDs.

## 10.10 Proposed NWC Peg placeholder replacement

Current placeholder:
- `NWC_Peg = AvgNWC_LTM * 1.03`

Replace with real computation:
- `NWC_Peg = AvgNormalizedNWC + SeasonalityAdjustment + PolicyOverride`

Where each component comes from:
- `AvgNormalizedNWC`:
  - start from monthly NWC:
    - `NWC_m = AR_m + Inventory_m + Prepaids_m - AP_m - Accruals_m`
  - normalize by removing non-recurring working-cap swings:
    - one-time receivable/payable events from adjustments log.
- `SeasonalityAdjustment`:
  - calculated from historical monthly seasonality profile (for same company or peer baseline).
  - example:
    - `SeasonalityAdjustment = AVG(peak-season NWC - annual avg NWC over historical years)`.
- `PolicyOverride`:
  - manual approved override entered by analyst/controller with evidence memo.

Required columns/tables:
- BS monthly table: `AccountsReceivable`, `Inventory`, `Prepaids`, `AccountsPayable`, `Accruals`, `Period`.
- Adjustment events: `WorkingCapitalTag`, `Amount`, `OneTimeFlag`, `Period`.
- Overrides table: `DealId`, `MetricId`, `OverrideAmount`, `ApprovedBy`, `Reason`, `Timestamp`.
