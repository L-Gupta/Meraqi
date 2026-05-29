"""
QoE Normalizer — applies confirmed adjustments to the reported EBITDA series
and builds the waterfall data structure for the frontend bridge chart.

All arithmetic is Decimal. The normalizer never calls an LLM.
"""

import logging
from decimal import Decimal

from app.schemas.financials import PnLStatement
from app.schemas.qoe import QoEAdjustment, QoEReport, WaterfallItem

logger = logging.getLogger(__name__)

# Number of months for LTM (Last Twelve Months) calculation
LTM_MONTHS = 12


def build_report(
    pnl: PnLStatement,
    adjustments: list[QoEAdjustment],
    deal_id: str,
) -> QoEReport:
    """
    Apply confirmed adjustments to EBITDA and produce the QoEReport.

    Only adjustments with analyst_approved=True are applied.
    Adjustments are applied period-by-period.
    """
    approved = [a for a in adjustments if a.analyst_approved]

    # Start from reported EBITDA per period
    reported_ebitda = dict(pnl.ebitda)
    adjusted_ebitda: dict[str, Decimal] = dict(reported_ebitda)

    for adj in approved:
        pk = adj.period.strftime("%Y-%m")
        if pk not in adjusted_ebitda:
            continue
        if adj.direction == "add_back":
            adjusted_ebitda[pk] = adjusted_ebitda[pk] + adj.adjustment_amount
        else:
            adjusted_ebitda[pk] = adjusted_ebitda[pk] - adj.adjustment_amount

    # LTM: last 12 periods with data
    sorted_periods = sorted(reported_ebitda.keys())
    ltm_periods = sorted_periods[-LTM_MONTHS:]

    ltm_reported = sum(reported_ebitda[p] for p in ltm_periods)
    ltm_adjusted = sum(adjusted_ebitda[p] for p in ltm_periods)
    ltm_adjustment_total = ltm_adjusted - ltm_reported

    waterfall = _build_waterfall(ltm_reported, ltm_adjusted, approved, ltm_periods)

    categories = sorted({a.category for a in approved})

    logger.info(
        "QoE report built for deal %s: %d adjustments, LTM reported=$%s adjusted=$%s",
        deal_id, len(approved), f"{ltm_reported:,.0f}", f"{ltm_adjusted:,.0f}",
    )

    return QoEReport(
        deal_id=deal_id,
        reported_ebitda={k: v for k, v in reported_ebitda.items()},
        adjusted_ebitda={k: v for k, v in adjusted_ebitda.items()},
        ltm_reported=ltm_reported,
        ltm_adjusted=ltm_adjusted,
        ltm_adjustment_total=ltm_adjustment_total,
        adjustments=approved,
        waterfall=waterfall,
        adjustment_count=len(approved),
        categories_adjusted=categories,
    )


def _build_waterfall(
    ltm_reported: Decimal,
    ltm_adjusted: Decimal,
    adjustments: list[QoEAdjustment],
    ltm_periods: list[str],
) -> list[WaterfallItem]:
    """
    Build waterfall items for the bridge chart.

    Groups adjustments by label (rolling up per-period entries of the same type)
    so the chart shows one bar per adjustment category rather than 36 bars for
    monthly owner comp.
    """
    from collections import defaultdict

    items: list[WaterfallItem] = []

    # Base: reported EBITDA
    items.append(WaterfallItem(
        label="Reported EBITDA (LTM)",
        amount=ltm_reported,
        type="base",
    ))

    # Group adjustments by rule_triggered + category for LTM periods
    ltm_set = set(ltm_periods)
    groups: dict[str, dict] = defaultdict(lambda: {
        "amount": Decimal("0"), "direction": "add_back", "ids": [], "label": ""
    })

    for adj in adjustments:
        pk = adj.period.strftime("%Y-%m")
        if pk not in ltm_set:
            continue
        # Group key: rule + category forms a unique bridge bar
        key = adj.rule_triggered or adj.label
        groups[key]["amount"] += adj.adjustment_amount
        groups[key]["direction"] = adj.direction
        groups[key]["ids"].append(adj.adjustment_id)
        # Use a clean label (strip the per-period date suffix for grouped items)
        base_label = adj.label.split("(")[0].strip()
        groups[key]["label"] = base_label

    for key, grp in groups.items():
        if grp["amount"] == 0:
            continue
        signed = grp["amount"] if grp["direction"] == "add_back" else -grp["amount"]
        items.append(WaterfallItem(
            label=grp["label"],
            amount=signed,
            type="addback" if grp["direction"] == "add_back" else "deduction",
            adjustment_ids=grp["ids"],
        ))

    # Result: adjusted EBITDA
    items.append(WaterfallItem(
        label="Adjusted EBITDA (LTM)",
        amount=ltm_adjusted,
        type="result",
    ))

    return items
