"""
Quality of Earnings schemas.

QoEAdjustment: a single normalisation entry with full audit trail to source GL lines.
QoEReport: the full output — reported EBITDA, adjustment list, adjusted EBITDA, waterfall.

Waterfall items drive the bridge chart in the frontend:
  base       → Reported EBITDA (LTM)
  addback    → positive bar (adds to EBITDA)
  deduction  → negative bar (reduces EBITDA)
  result     → Adjusted EBITDA (LTM)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class QoEAdjustment(BaseModel):
    adjustment_id: str
    deal_id: str
    period: date
    label: str                              # e.g. "Owner Compensation Normalisation"
    category: str                           # e.g. "Owner/Related Party"
    direction: Literal["add_back", "deduction"]
    reported_amount: Decimal                # What the GL shows
    adjustment_amount: Decimal              # The delta (always positive)
    normalized_amount: Decimal              # What the amount should be post-adjustment
    source_gl_line_ids: list[str] = Field(default_factory=list)
    detection_method: Literal["rule", "llm", "manual"]
    rule_triggered: str | None = None       # e.g. "OWNER_COMP_EXCESS"
    llm_reviewed: bool = False
    llm_reasoning: str | None = None
    llm_confidence: float | None = None
    analyst_approved: bool = True           # Default True; human review in future
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WaterfallItem(BaseModel):
    label: str
    amount: Decimal                         # Positive = addback; negative = deduction
    type: Literal["base", "addback", "deduction", "result"]
    adjustment_ids: list[str] = Field(default_factory=list)  # Links to QoEAdjustment


class QoEReport(BaseModel):
    deal_id: str

    # Period-by-period EBITDA (keyed YYYY-MM)
    reported_ebitda: dict[str, Decimal]
    adjusted_ebitda: dict[str, Decimal]

    # LTM (last twelve months) totals
    ltm_reported: Decimal
    ltm_adjusted: Decimal
    ltm_adjustment_total: Decimal

    adjustments: list[QoEAdjustment]

    # Waterfall bridge data for frontend chart
    waterfall: list[WaterfallItem]

    # Summary stats
    adjustment_count: int
    categories_adjusted: list[str]
