import { z } from "zod";

export const SeveritySchema = z.enum(["Green", "Amber", "Red"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const PeriodSchema = z.enum(["Monthly", "Quarterly", "Annual"]);
export const BasisSchema = z.enum(["Reported", "Normalized", "Pro Forma"]);

export const CellTraceSchema = z.object({
  step: z.string(),
  source: z.string(),
  logic: z.string(),
  value: z.string(),
});

export const LineageStepSchema = z.object({
  title: z.string(),
  description: z.string(),
  references: z.array(z.string()),
});

export const BenchmarkSchema = z.object({
  sector: z.string(),
  subSector: z.string(),
  lowerQuartile: z.number(),
  upperQuartile: z.number(),
  sectorMedian: z.number(),
  subSectorMedian: z.number(),
  companyValue: z.number(),
  unit: z.enum(["currency_m", "percent", "ratio", "count"]),
  direction: z.enum(["higher_better", "lower_better", "target_band"]),
});

export const BenchmarkCatalogItemSchema = z.object({
  metricId: z.string(),
  benchmark: BenchmarkSchema,
});

export const MetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  delta: z.string().optional(),
  severity: SeveritySchema.optional(),
  benchmark: BenchmarkSchema.optional(),
  lineage: z.array(LineageStepSchema),
  cellTrace: z.array(CellTraceSchema),
});

export const TimePointSchema = z.object({
  month: z.string(),
  revenue: z.number(),
  adjustedEbitda: z.number(),
  reportedEbitda: z.number(),
  nwc: z.number(),
  cashConversion: z.number(),
  ocf: z.number(),
});

export const InsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const DeltaFeedItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

export const AdjustmentSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  amount: z.number(),
  status: z.enum(["Proposed", "Reviewed", "Accepted"]),
});

export const TieOutRowSchema = z.object({
  name: z.string(),
  expected: z.number(),
  observed: z.number(),
  diff: z.number(),
  variancePct: z.number(),
  tolerancePct: z.number(),
  status: z.enum(["Pass", "Warn", "Fail"]),
});

export const RiskRegisterRowSchema = z.object({
  id: z.string(),
  risk: z.string(),
  severity: SeveritySchema,
  impactArea: z.string(),
  exposureRange: z.string(),
  status: z.string(),
  evidence: z.string(),
});

export const CoverageCellSchema = z.object({
  month: z.string(),
  status: z.enum(["Available", "Partial", "Missing"]),
});

export const CoverageRowSchema = z.object({
  schedule: z.string(),
  months: z.array(CoverageCellSchema),
});

export const FileInventorySchema = z.object({
  id: z.string(),
  file: z.string(),
  detectedType: z.string(),
  periodCoverage: z.string(),
  entity: z.string(),
  status: z.string(),
  confidence: z.number(),
});

export const PbcSuggestionSchema = z.object({
  id: z.string(),
  request: z.string(),
  severity: SeveritySchema,
  owner: z.string(),
});

export const InquirySchema = z.object({
  id: z.string(),
  request: z.string(),
  owner: z.string(),
  dueDate: z.string(),
  status: z.string(),
  blocking: z.boolean(),
});

export const InquiryResponseSchema = z.object({
  lastUpdated: z.string(),
  inquiries: z.array(InquirySchema),
});

export const DecisionQueueItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  impactArea: z.string(),
  impactScore: z.number(),
  owner: z.string(),
  dueDate: z.string(),
  status: z.enum(["Open", "In Progress", "Resolved", "Deferred"]),
  blocking: z.boolean(),
  rationale: z.string(),
  sourceTab: z.enum(["risk-assessment", "inquiry", "documents", "financial-analysis"]),
  sourceId: z.string(),
  sourceLabel: z.string(),
  sourceUrl: z.string(),
});

export const DecisionQueueResponseSchema = z.object({
  lastUpdated: z.string(),
  readiness: z.enum(["Ready", "Draft", "Blocked"]),
  items: z.array(DecisionQueueItemSchema),
});

export const SummaryResponseSchema = z.object({
  lastUpdated: z.string(),
  metrics: z.array(MetricSchema),
  benchmarkCatalog: z.array(BenchmarkCatalogItemSchema).optional(),
  trend: z.array(TimePointSchema),
  insights: z.array(InsightSchema),
  deltaFeed: z.array(DeltaFeedItemSchema),
  riskBreakdown: z.object({ red: z.number(), amber: z.number() }),
});

export const AnalysisResponseSchema = z.object({
  lastUpdated: z.string(),
  qoeMetrics: z.array(MetricSchema),
  revenueMetrics: z.array(MetricSchema),
  marginMetrics: z.array(MetricSchema),
  wcMetrics: z.array(MetricSchema),
  cashMetrics: z.array(MetricSchema),
  adjustments: z.array(AdjustmentSchema),
  trend: z.array(TimePointSchema),
  concentration: z.array(z.object({ label: z.string(), value: z.number() })),
  aging: z.array(z.object({ bucket: z.string(), ar: z.number(), ap: z.number() })),
  opexMix: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const RiskResponseSchema = z.object({
  lastUpdated: z.string(),
  dimensions: z.array(z.object({ subject: z.string(), score: z.number() })),
  tieOuts: z.array(TieOutRowSchema),
  register: z.array(RiskRegisterRowSchema),
  riskScore: z.number(),
});

export const DocumentsResponseSchema = z.object({
  lastUpdated: z.string(),
  coverage: z.array(CoverageRowSchema),
  inventory: z.array(FileInventorySchema),
  pbc: z.array(PbcSuggestionSchema),
});

export const CustomerResponseSchema = z.object({
  lastUpdated: z.string(),
  metrics: z.array(MetricSchema),
  topTrend: z.array(z.object({ month: z.string(), top1: z.number(), top10: z.number() })),
  discountAnomalies: z.array(z.object({ month: z.string(), rate: z.number(), priorRate: z.number(), flagged: z.boolean() })),
});

export type Metric = z.infer<typeof MetricSchema>;
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type RiskResponse = z.infer<typeof RiskResponseSchema>;
export type DocumentsResponse = z.infer<typeof DocumentsResponseSchema>;
export type CustomerResponse = z.infer<typeof CustomerResponseSchema>;
export type Inquiry = z.infer<typeof InquirySchema>;
export type InquiryResponse = z.infer<typeof InquiryResponseSchema>;
export type DecisionQueueItem = z.infer<typeof DecisionQueueItemSchema>;
export type DecisionQueueResponse = z.infer<typeof DecisionQueueResponseSchema>;
