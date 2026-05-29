"""
Financial statement schemas — P&L, Balance Sheet, Cash Flow.

All amounts are Decimal strings in JSON to prevent floating-point drift.
Periods are always first-of-month dates.
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class PnLRow(BaseModel):
    """One line in the income statement, one period."""
    period: date
    category: str
    label: str
    amount: Decimal          # Positive = income, Negative = expense (economic sign)
    is_revenue: bool
    is_cogs: bool
    is_opex: bool
    is_da: bool              # Depreciation & Amortisation
    is_below_ebitda: bool    # Interest, tax


class PnLStatement(BaseModel):
    """Full P&L for a deal, all periods."""
    deal_id: str
    periods: list[date]
    rows: list[PnLRow]

    # Pre-computed summary lines (Decimal per period, keyed YYYY-MM)
    revenue: dict[str, Decimal]
    gross_profit: dict[str, Decimal]
    ebitda: dict[str, Decimal]
    ebit: dict[str, Decimal]
    net_income: dict[str, Decimal]

    gross_margin: dict[str, float]   # GP / Revenue
    ebitda_margin: dict[str, float]  # EBITDA / Revenue


class BalanceSheetRow(BaseModel):
    period: date
    category: str
    label: str
    amount: Decimal
    section: Literal[
        "Current Assets", "Non-Current Assets",
        "Current Liabilities", "Non-Current Liabilities",
        "Equity",
    ]


class BalanceSheet(BaseModel):
    deal_id: str
    periods: list[date]
    rows: list[BalanceSheetRow]

    total_assets: dict[str, Decimal]
    total_liabilities: dict[str, Decimal]
    total_equity: dict[str, Decimal]
    is_balanced: dict[str, bool]     # Assets == Liabilities + Equity per period


class CashFlowRow(BaseModel):
    period: date
    label: str
    amount: Decimal
    section: Literal["Operating", "Investing", "Financing"]


class CashFlowStatement(BaseModel):
    deal_id: str
    periods: list[date]
    rows: list[CashFlowRow]

    operating_cash_flow: dict[str, Decimal]
    investing_cash_flow: dict[str, Decimal]
    financing_cash_flow: dict[str, Decimal]
    net_cash_flow: dict[str, Decimal]

    # Cash conversion: Operating CF / EBITDA — key QoE metric
    cash_conversion: dict[str, float | None]
