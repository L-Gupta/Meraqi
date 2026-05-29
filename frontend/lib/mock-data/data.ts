import { type AnalysisResponse, type CustomerResponse, type DocumentsResponse, type Inquiry, type Metric, type RiskResponse, type SummaryResponse } from "@/lib/schemas/types";

const months = ["Mar-25","Apr-25","May-25","Jun-25","Jul-25","Aug-25","Sep-25","Oct-25","Nov-25","Dec-25","Jan-26","Feb-26"];

const formulaRefs = {
  revenue: "Net Revenue = Gross Revenue - Discounts - Returns",
  ebitda: "EBITDA = Revenue - COGS - Opex (excluding D&A)",
  adj: "Adjusted EBITDA = Reported EBITDA + SUM(Accepted Adjustments)",
  adjPct: "Adjustment % = Total Adjustments / Reported EBITDA",
  nwc: "NWC = AR + Inventory + Prepaids - AP - Accruals",
  peg: "Peg = Avg normalized NWC (12m) +/- seasonality adjustments",
  conv: "Cash conversion % = Operating Cash Flow / EBITDA",
  gm: "Gross Margin % = (Revenue - COGS) / Revenue",
  dso: "DSO = (AR / Revenue) * 365",
  dpo: "DPO = (AP / COGS) * 365",
  dio: "DIO = (Inventory / COGS) * 365",
  ccc: "CCC = DSO + DIO - DPO",
  tieOut: "Tie-out variance % = |Observed - Expected| / Expected",
  disc: "Discount anomaly rule: if current discount rate > 1.5 * prior period -> ORANGE",
};

function buildMetric(id: string, label: string, value: string, formula: string, delta?: string, severity?: "Green"|"Amber"|"Red"): Metric {
  return {
    id,
    label,
    value,
    delta,
    severity,
    lineage: [
      {
        title: "Inputs",
        description: "Mapped values extracted from standardized trial balance and supporting schedules.",
        references: ["TB_FY24.xlsx!Revenue", "GL_Export.csv", "Mapping v2.1"],
      },
      {
        title: "Transformations",
        description: "Entity normalization, currency harmonization, and period alignment applied.",
        references: ["Normalization Rulebook", "Entity Map: HoldCo -> OpCo"],
      },
      {
        title: "Formula",
        description: formula,
        references: ["TAM Formula Library"],
      },
      {
        title: "Filters / Overrides",
        description: "Analyst-approved exclusions and seasonality controls applied.",
        references: ["Override Log #104", "Materiality threshold $75k"],
      },
    ],
    cellTrace: [
      {
        step: "1",
        source: "TB_FY24.xlsx / IS / C12:C23",
        logic: "Sum monthly mapped accounts",
        value,
      },
      {
        step: "2",
        source: "Adjustments_Register.xlsx / Adj / A:F",
        logic: formula,
        value,
      },
      {
        step: "3",
        source: "Normalization_Logic.sql",
        logic: "Apply accepted adjustments and basis selection",
        value,
      },
    ],
  };
}

const trend = months.map((month, i) => ({
  month,
  revenue: 4.7 + i * 0.09 + (i % 3 === 0 ? 0.25 : -0.04),
  adjustedEbitda: 0.95 + i * 0.04,
  reportedEbitda: 0.87 + i * 0.04,
  nwc: 5.3 + i * 0.08,
  cashConversion: 41 + i,
  ocf: 0.52 + i * 0.03,
}));

export const summaryData: SummaryResponse = {
  lastUpdated: "2026-02-11T16:20:00Z",
  metrics: [
    buildMetric("revenue-ltm", "Revenue (LTM)", "$63.7M", formulaRefs.revenue, "+4.1%"),
    buildMetric("reported-ebitda", "Reported EBITDA (LTM)", "$12.2M", formulaRefs.ebitda, "+2.6%"),
    buildMetric("adjusted-ebitda", "Adjusted EBITDA (LTM)", "$13.4M", formulaRefs.adj, "+3.9%"),
    buildMetric("adj-pct", "Adjustments as % of EBITDA", "9.8%", formulaRefs.adjPct, "+0.6ppt", "Amber"),
    buildMetric("avg-nwc", "Avg NWC (LTM)", "$6.1M", formulaRefs.nwc, "+2.1%"),
    buildMetric("nwc-peg", "Proposed NWC Peg", "$6.3M", formulaRefs.peg, "+$0.2M"),
    buildMetric("cash-conv", "EBITDA -> Operating Cash Flow conversion %", "52%", formulaRefs.conv, "+3ppt", "Amber"),
    buildMetric("overall-risk", "Overall Deal Risk", "6.2 / 10", formulaRefs.tieOut, "-0.4", "Amber"),
  ],
  trend,
  insights: [
    {
      id: "insight-1",
      title: "Normalization lift remains concentrated",
      body: "74% of accepted addbacks are tied to one-off legal and transition costs, limiting recurring margin distortion.",
    },
    {
      id: "insight-2",
      title: "Working capital drag easing",
      body: "DSO improved 5 days since Q3 while AP aging stayed stable, reducing CCC by 3 days over the last run.",
    },
    {
      id: "insight-3",
      title: "Revenue quality watchpoint",
      body: "Two end-of-month spikes persist in enterprise segment; monitor rebate timing with sales ops evidence.",
    },
  ],
  deltaFeed: [
    { id: "d1", type: "New File", message: "Bank statement bundle Jan-26 ingested.", timestamp: "2026-02-11T14:05:00Z" },
    { id: "d2", type: "Adjustment", message: "Adj-014 (legal settlement) moved to Accepted.", timestamp: "2026-02-11T13:22:00Z" },
    { id: "d3", type: "Tie-out", message: "AR Aging <-> BS AR variance improved from 1.8% to 0.4%.", timestamp: "2026-02-11T12:10:00Z" },
    { id: "d4", type: "Anomaly", message: "Discount spike flagged in Feb-26 (>1.5x Jan-26).", timestamp: "2026-02-11T11:40:00Z" },
  ],
  riskBreakdown: { red: 2, amber: 6 },
};

export const analysisData: AnalysisResponse = {
  lastUpdated: "2026-02-11T16:20:00Z",
  qoeMetrics: [
    buildMetric("qoe-reported-ebitda", "Reported EBITDA", "$12.2M", formulaRefs.ebitda),
    buildMetric("qoe-adjusted-ebitda", "Adjusted EBITDA", "$13.4M", formulaRefs.adj),
    buildMetric("qoe-adjustment-pct", "Adjustment %", "9.8%", formulaRefs.adjPct),
    buildMetric("qoe-rec-vs-non", "Recurring vs Non-recurring %", "82% / 18%", formulaRefs.adj),
    buildMetric("qoe-highrisk", "High-risk addbacks", "4", formulaRefs.adjPct, undefined, "Red"),
    buildMetric("qoe-margin", "Adj EBITDA margin", "21.0%", formulaRefs.gm),
    buildMetric("qoe-count", "Addback count", "17", formulaRefs.adj),
  ],
  revenueMetrics: [
    buildMetric("rev-reported-norm", "Reported vs Normalized revenue", "$63.7M / $62.9M", formulaRefs.revenue),
    buildMetric("rev-growth", "Growth %", "8.4%", formulaRefs.revenue),
    buildMetric("rev-recurring", "Recurring revenue %", "69%", formulaRefs.revenue),
    buildMetric("rev-top1", "Concentration (Top 1/3/5/10)", "12% / 25% / 34% / 41%", formulaRefs.revenue),
    buildMetric("rev-vol", "Volatility", "6.3%", formulaRefs.revenue),
    buildMetric("rev-eom", "EOM spike flags", "2", formulaRefs.disc, undefined, "Amber"),
  ],
  marginMetrics: [
    buildMetric("margin-gross", "Gross margin %", "46.8%", formulaRefs.gm),
    buildMetric("margin-ebitda", "EBITDA margin %", "19.2%", formulaRefs.ebitda),
    buildMetric("margin-opex", "Opex % of revenue", "27.6%", formulaRefs.ebitda),
    buildMetric("margin-cogs", "COGS % revenue", "53.2%", formulaRefs.gm),
    buildMetric("margin-onetime", "One-time costs", "$0.9M", formulaRefs.adj),
    buildMetric("margin-spikes", "Cost spike flags", "3", formulaRefs.gm, undefined, "Amber"),
    buildMetric("margin-payroll", "Payroll % of opex", "38%", formulaRefs.gm),
  ],
  wcMetrics: [
    buildMetric("wc-avg", "Avg NWC", "$6.1M", formulaRefs.nwc),
    buildMetric("wc-peg", "Peg", "$6.3M", formulaRefs.peg),
    buildMetric("wc-dso", "DSO/DPO/DIO/CCC", "35 / 29 / 42 / 48", formulaRefs.ccc),
    buildMetric("wc-ar60", "AR>60d%", "8.3%", formulaRefs.dso, undefined, "Amber"),
    buildMetric("wc-ap60", "AP>60d%", "6.1%", formulaRefs.dpo),
  ],
  cashMetrics: [
    buildMetric("cash-ocf", "OCF (LTM)", "$6.4M", formulaRefs.conv),
    buildMetric("cash-conv", "Conversion %", "52%", formulaRefs.conv),
    buildMetric("cash-capex", "Capex", "$2.1M", "FCF = OCF - Capex"),
    buildMetric("cash-fcf", "FCF", "$4.3M", "FCF = OCF - Capex"),
    buildMetric("cash-runway", "Runway", "18 months", "Runway = Cash / Avg Monthly Burn"),
    buildMetric("cash-wcdrag", "WC drag", "$1.2M", formulaRefs.nwc, undefined, "Amber"),
    buildMetric("cash-neg", "Negative OCF months", "2", formulaRefs.conv, undefined, "Red"),
  ],
  adjustments: [
    { id: "ADJ-001", category: "One-time Legal", description: "Settlement expense normalization", amount: 320000, status: "Accepted" },
    { id: "ADJ-004", category: "Owner Compensation", description: "Excess compensation normalization", amount: 210000, status: "Reviewed" },
    { id: "ADJ-009", category: "Non-operating", description: "FX one-time impact", amount: 180000, status: "Proposed" },
    { id: "ADJ-014", category: "Restructuring", description: "Post-close duplication costs", amount: 490000, status: "Accepted" },
  ],
  trend,
  concentration: [
    { label: "Top 1", value: 12 },
    { label: "Top 3", value: 25 },
    { label: "Top 5", value: 34 },
    { label: "Top 10", value: 41 },
  ],
  aging: [
    { bucket: "0-30", ar: 62, ap: 58 },
    { bucket: "31-60", ar: 30, ap: 36 },
    { bucket: "61-90", ar: 6, ap: 4 },
    { bucket: "90+", ar: 2, ap: 2 },
  ],
  opexMix: [
    { name: "Payroll", value: 38 },
    { name: "G&A", value: 21 },
    { name: "Sales", value: 19 },
    { name: "IT", value: 12 },
    { name: "Other", value: 10 },
  ],
};

export const riskData: RiskResponse = {
  lastUpdated: "2026-02-11T16:20:00Z",
  dimensions: [
    { subject: "Data integrity", score: 6.4 },
    { subject: "Earnings quality", score: 5.6 },
    { subject: "Revenue quality", score: 6.8 },
    { subject: "Margin sustainability", score: 6.1 },
    { subject: "Working capital risk", score: 6.6 },
    { subject: "Cash flow risk", score: 5.7 },
  ],
  tieOuts: [
    { name: "TB <-> IS (Revenue)", expected: 63700000, observed: 63620000, diff: -80000, variancePct: 0.13, tolerancePct: 0.25, status: "Pass" },
    { name: "TB <-> BS (A=L+E)", expected: 128400000, observed: 127900000, diff: -500000, variancePct: 0.39, tolerancePct: 0.2, status: "Fail" },
    { name: "AR Aging <-> BS AR", expected: 6020000, observed: 5995000, diff: -25000, variancePct: 0.41, tolerancePct: 0.5, status: "Pass" },
    { name: "AP Aging <-> BS AP", expected: 4510000, observed: 4440000, diff: -70000, variancePct: 1.55, tolerancePct: 1.0, status: "Warn" },
    { name: "Cash <-> Bank", expected: 3150000, observed: 3139000, diff: -11000, variancePct: 0.35, tolerancePct: 0.5, status: "Pass" },
    { name: "GL rollforward <-> TB", expected: 128400000, observed: 127600000, diff: -800000, variancePct: 0.62, tolerancePct: 0.4, status: "Warn" },
  ],
  register: [
    { id: "R-01", risk: "Unsupported one-off addbacks", severity: "Red", impactArea: "QoE", exposureRange: "$0.4M-$0.8M", status: "Open", evidence: "ADJ-009 lacks memo evidence" },
    { id: "R-02", risk: "Revenue timing cut-off variance", severity: "Amber", impactArea: "Revenue QoE", exposureRange: "$0.2M-$0.5M", status: "Monitoring", evidence: "EOM spikes in Dec-25 and Feb-26" },
    { id: "R-03", risk: "AP aging mismatch", severity: "Amber", impactArea: "Working Capital", exposureRange: "$0.1M-$0.3M", status: "Open", evidence: "AP>60d balance not fully reconciled" },
    { id: "R-04", risk: "Entity mapping drift", severity: "Green", impactArea: "Data Integrity", exposureRange: "<$0.1M", status: "Mitigated", evidence: "Latest mapping dictionary signed off" }
  ],
  riskScore: 6.2,
};

export const documentsData: DocumentsResponse = {
  lastUpdated: "2026-02-11T16:20:00Z",
  coverage: [
    "Income Statement","Balance Sheet","Cash Flow","Trial Balance","General Ledger","AR Aging","AP Aging","Bank Statements","Payroll"
  ].map((schedule, idx) => ({
    schedule,
    months: months.map((m, i) => ({
      month: m,
      status: i < 9 ? "Available" : i === 10 - (idx % 2) ? "Partial" : i === 11 && idx % 3 === 0 ? "Missing" : "Available",
    })),
  })),
  inventory: [
    { id: "F-001", file: "TB_FY24.xlsx", detectedType: "Trial Balance", periodCoverage: "Jan-25 to Feb-26", entity: "TAM OpCo", status: "Processed", confidence: 0.98 },
    { id: "F-002", file: "GL_JanFeb26.csv", detectedType: "General Ledger", periodCoverage: "Jan-26 to Feb-26", entity: "TAM OpCo", status: "Processed", confidence: 0.95 },
    { id: "F-003", file: "AR_Aging_Feb26.xlsx", detectedType: "AR Aging", periodCoverage: "Feb-26", entity: "TAM OpCo", status: "Partial", confidence: 0.83 },
    { id: "F-004", file: "Bank_Stmt_Jan26.pdf", detectedType: "Bank Statements", periodCoverage: "Jan-26", entity: "TAM HoldCo", status: "Processed", confidence: 0.91 }
  ],
  pbc: [
    { id: "PBC-01", request: "Provide AP aging detail by vendor for Feb-26", severity: "Amber", owner: "Controller" },
    { id: "PBC-02", request: "Support memo for ADJ-009 FX impact", severity: "Red", owner: "Finance Manager" },
    { id: "PBC-03", request: "Bank rec support for HoldCo cash account", severity: "Amber", owner: "Treasury" },
  ],
};

export const customerData: CustomerResponse = {
  lastUpdated: "2026-02-11T16:20:00Z",
  metrics: [
    buildMetric("cust-top10", "Top 10 concentration %", "41%", formulaRefs.revenue),
    buildMetric("cust-largest", "Largest customer %", "12%", formulaRefs.revenue),
    buildMetric("cust-nrr", "NRR proxy", "106%", "NRR proxy = (Current recurring rev from retained cohort / Prior recurring rev cohort)"),
    buildMetric("cust-disc", "#discount anomalies", "3", formulaRefs.disc, undefined, "Amber"),
  ],
  topTrend: months.map((month, i) => ({ month, top1: 10 + Math.min(i * 0.2, 2), top10: 37 + Math.min(i * 0.45, 4) })),
  discountAnomalies: months.map((month, i) => {
    const priorRate = 0.04 + i * 0.002;
    const rate = i === 11 ? priorRate * 1.7 : priorRate * (1 + (i % 4 === 0 ? 0.22 : 0.08));
    return { month, rate, priorRate, flagged: rate > 1.5 * priorRate };
  }),
};

export const inquiryData: Inquiry[] = [
  { id: "INQ-1001", request: "Reconcile AP aging variance to BS AP", owner: "Controller", dueDate: "2026-02-15", status: "Open", blocking: true },
  { id: "INQ-1002", request: "Provide support for ADJ-009 FX adjustment", owner: "Finance Manager", dueDate: "2026-02-13", status: "In Progress", blocking: true },
  { id: "INQ-1003", request: "Confirm deferred revenue policy updates", owner: "Revenue Ops", dueDate: "2026-02-18", status: "Open", blocking: false },
  { id: "INQ-1004", request: "Upload payroll file for Feb-26", owner: "HR Lead", dueDate: "2026-02-14", status: "Closed", blocking: false },
];
