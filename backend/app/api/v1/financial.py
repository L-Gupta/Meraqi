"""
Financial statements API — P&L, Balance Sheet, Cash Flow.

GET /api/v1/deals/{deal_id}/financials/pnl
GET /api/v1/deals/{deal_id}/financials/balance-sheet
GET /api/v1/deals/{deal_id}/financials/cash-flow
GET /api/v1/deals/{deal_id}/financials/summary
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.schemas.financials import BalanceSheet, CashFlowStatement, PnLStatement
from app.storage import file_store

router = APIRouter(tags=["Financial Statements"])


def _path(deal_id: str, filename: str) -> Path:
    return file_store.get_processed_dir(deal_id) / filename


def _load(deal_id: str, filename: str, label: str) -> dict:
    p = _path(deal_id, filename)
    if not p.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{label} not found for deal {deal_id}. Run /process (financial_builder stage) first.",
        )
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@router.get("/deals/{deal_id}/financials/pnl", response_model=PnLStatement)
def get_pnl(
    deal_id: str,
    period: str | None = Query(default=None, description="Filter prefix, e.g. '2023' or '2023-06'"),
) -> PnLStatement:
    data = _load(deal_id, "financials_pnl.json", "P&L")
    pnl = PnLStatement.model_validate(data)
    if period:
        pnl.rows = [r for r in pnl.rows if r.period.strftime("%Y-%m").startswith(period)]
        pnl.periods = sorted({r.period for r in pnl.rows})
    return pnl


@router.get("/deals/{deal_id}/financials/balance-sheet", response_model=BalanceSheet)
def get_balance_sheet(deal_id: str) -> BalanceSheet:
    return BalanceSheet.model_validate(_load(deal_id, "financials_bs.json", "Balance Sheet"))


@router.get("/deals/{deal_id}/financials/cash-flow", response_model=CashFlowStatement)
def get_cash_flow(deal_id: str) -> CashFlowStatement:
    return CashFlowStatement.model_validate(_load(deal_id, "financials_cf.json", "Cash Flow"))


@router.get("/deals/{deal_id}/financials/summary")
def get_summary(deal_id: str) -> dict:
    """Key metrics summary — revenue, EBITDA, margins for every period."""
    data = _load(deal_id, "financials_pnl.json", "P&L")
    pnl = PnLStatement.model_validate(data)

    return {
        "deal_id": deal_id,
        "periods": [p.strftime("%Y-%m") for p in pnl.periods],
        "revenue": {k: str(v) for k, v in pnl.revenue.items()},
        "ebitda": {k: str(v) for k, v in pnl.ebitda.items()},
        "ebitda_margin_pct": {k: round(v * 100, 1) for k, v in pnl.ebitda_margin.items()},
        "gross_margin_pct": {k: round(v * 100, 1) for k, v in pnl.gross_margin.items()},
    }
