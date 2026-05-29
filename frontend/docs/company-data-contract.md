# TAM Backend Data Contract (Whole System)

Use this as the canonical payload format to feed the full TAM UI (all tabs, not only Executive Summaries).

## 1) Global Contract

- Every company/deal should be queryable by `dealId` and `dealName`.
- All numeric values should be pre-computed by backend to avoid UI inconsistencies.
- API should return the same numbers across endpoints for shared metrics.
- Currency values should be normalized to one reporting currency per deal.

## 2) Core Types

```ts
type Severity = "Green" | "Amber" | "Red";
type TieOutStatus = "Pass" | "Warn" | "Fail";
type AdjustmentStatus = "Proposed" | "Reviewed" | "Accepted";

type Metric = {
  id: string;
  label: string;
  value: string;      // formatted for UI, e.g. "$63.7M", "52%"
  delta?: string;
  severity?: Severity;
  lineage: {
    title: string;
    description: string;
    references: string[];
  }[];
  cellTrace: {
    step: string;
    source: string;
    logic: string;
    value: string;
  }[];
};

type TimePoint = {
  month: string;      // e.g. "Feb-26"
  revenue: number;
  reportedEbitda: number;
  adjustedEbitda: number;
  nwc: number;
  cashConversion: number;
  ocf: number;
};
```

## 3) API Payloads

### GET `/api/deal/summary?deal={dealId}&period={...}&basis={...}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "metrics": ["Metric[]"],
  "trend": ["TimePoint[]"],
  "insights": [{ "id": "...", "title": "...", "body": "..." }],
  "deltaFeed": [{ "id": "...", "type": "...", "message": "...", "timestamp": "..." }],
  "riskBreakdown": { "red": 2, "amber": 5 }
}
```

### GET `/api/deal/analysis?deal={dealId}&period={...}&basis={...}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "qoeMetrics": ["Metric[]"],
  "revenueMetrics": ["Metric[]"],
  "marginMetrics": ["Metric[]"],
  "wcMetrics": ["Metric[]"],
  "cashMetrics": ["Metric[]"],
  "adjustments": [
    {
      "id": "ADJ-001",
      "category": "One-time Legal",
      "description": "...",
      "amount": 320000,
      "status": "Accepted"
    }
  ],
  "trend": ["TimePoint[]"],
  "concentration": [{ "label": "Top 10", "value": 41 }],
  "aging": [{ "bucket": "0-30", "ar": 62, "ap": 58 }],
  "opexMix": [{ "name": "Payroll", "value": 38 }]
}
```

### GET `/api/deal/risk?deal={dealId}&period={...}&basis={...}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "riskScore": 6.2,
  "dimensions": [{ "subject": "Data integrity", "score": 6.4 }],
  "tieOuts": [
    {
      "name": "TB <-> IS (Revenue)",
      "expected": 63700000,
      "observed": 63620000,
      "diff": -80000,
      "variancePct": 0.13,
      "tolerancePct": 0.25,
      "status": "Pass"
    }
  ],
  "register": [
    {
      "id": "R-01",
      "risk": "Unsupported one-off addbacks",
      "severity": "Red",
      "impactArea": "QoE",
      "exposureRange": "$0.4M-$0.8M",
      "status": "Open",
      "evidence": "..."
    }
  ]
}
```

### GET `/api/deal/documents?deal={dealId}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "coverage": [
    {
      "schedule": "Income Statement",
      "months": [
        { "month": "Jan-26", "status": "Available" }
      ]
    }
  ],
  "inventory": [
    {
      "id": "F-001",
      "file": "TB_FY24.xlsx",
      "detectedType": "Trial Balance",
      "periodCoverage": "Jan-25 to Feb-26",
      "entity": "Apple Inc.",
      "status": "Processed",
      "confidence": 0.98
    }
  ],
  "pbc": [
    {
      "id": "PBC-01",
      "request": "Provide AP aging detail by vendor",
      "severity": "Amber",
      "owner": "Controller"
    }
  ]
}
```

### GET `/api/deal/customer?deal={dealId}&period={...}&basis={...}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "metrics": ["Metric[]"],
  "topTrend": [{ "month": "Feb-26", "top1": 12.0, "top10": 41.0 }],
  "discountAnomalies": [
    { "month": "Feb-26", "rate": 0.072, "priorRate": 0.041, "flagged": true }
  ]
}
```

### GET `/api/deal/inquiry?deal={dealId}&period={...}&basis={...}`

```json
{
  "lastUpdated": "2026-02-12T15:22:00Z",
  "inquiries": [
    {
      "id": "INQ-1001",
      "request": "Reconcile AP aging variance to BS AP",
      "owner": "Controller",
      "dueDate": "2026-02-15",
      "status": "Open",
      "blocking": true
    }
  ]
}
```

## 4) Mandatory Logic Rules (Backend)

- Tie-out status rule (must be consistent everywhere):
  - `Pass` if `variancePct <= tolerancePct`
  - `Warn` if `tolerancePct < variancePct <= 1.5 * tolerancePct`
  - `Fail` if `variancePct > 1.5 * tolerancePct`

- Discount anomaly rule:
  - `flagged = rate > 1.5 * priorRate`

- Cash conversion thresholds:
  - `< 60% => Weak`
  - `< 30% => High Risk`
  - `< 0% => Critical`

- Shared metrics must reconcile across endpoints:
  - Revenue, Reported EBITDA, Adjusted EBITDA, Cash Conversion, Risk Score.

## 5) Notes

- Keep IDs stable (`metric.id`, `risk.id`, `inquiry.id`) to avoid UI jitter.
- Return preformatted display values in `Metric.value`, but include raw numbers in trend/tables.
- Once backend is ready, UI can replace mock APIs with these payloads directly.
