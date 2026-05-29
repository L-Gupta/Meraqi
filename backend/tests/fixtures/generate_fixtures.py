"""
Generates realistic fixture data for FDD Engine testing.

Acme Manufacturing Co. — 3 years (Jan 2022 – Dec 2024), 36 months
Planted anomalies for QoE / Red Flag detection testing:
  1. Owner excess compensation (6001 Management Salaries ~2x market rate every month)
  2. Legal settlement (6099) — February 2023 (Month 14): $285,000 one-time charge
  3. M&A advisory fees (6098) — July 2024 (Month 30): $180,000 one-time charge
  4. Related-party consulting (6097) — every month: $22,000/mo to owner entity
"""

import csv
import random
from datetime import date
from pathlib import Path

random.seed(42)
Path(__file__).parent.mkdir(parents=True, exist_ok=True)

# (account_code, description, statement, normal_balance, monthly_base_amount)
COA = [
    # REVENUE
    ("4001", "Product Sales - Domestic",   "PnL", "credit", 850_000),
    ("4002", "Product Sales - Export",     "PnL", "credit", 120_000),
    ("4003", "Service Revenue",            "PnL", "credit",  45_000),
    ("4004", "Shipping & Handling Income", "PnL", "credit",  12_000),
    # COGS
    ("5001", "Raw Materials - Steel",      "PnL", "debit",  280_000),
    ("5002", "Raw Materials - Plastics",   "PnL", "debit",   55_000),
    ("5003", "Direct Labour",              "PnL", "debit",  210_000),
    ("5004", "Manufacturing Overhead",     "PnL", "debit",   95_000),
    ("5005", "Freight In",                 "PnL", "debit",   18_000),
    # SG&A
    ("6001", "Management Salaries",        "PnL", "debit",  120_000),  # PLANTED: ~2x market rate
    ("6002", "Sales Team Salaries",        "PnL", "debit",   65_000),
    ("6003", "Office Rent",                "PnL", "debit",   22_000),
    ("6004", "Utilities",                  "PnL", "debit",    8_500),
    ("6005", "Insurance",                  "PnL", "debit",    4_200),
    ("6006", "Marketing & Advertising",    "PnL", "debit",   18_000),
    ("6007", "Professional Fees",          "PnL", "debit",   12_000),
    ("6008", "IT & Software",              "PnL", "debit",    6_500),
    ("6009", "Travel & Entertainment",     "PnL", "debit",    5_000),
    ("6010", "Office Supplies",            "PnL", "debit",    1_800),
    ("6011", "Telephone & Internet",       "PnL", "debit",    2_200),
    # D&A
    ("7001", "Depreciation - Equipment",   "PnL", "debit",   28_000),
    ("7002", "Amortisation - IP",          "PnL", "debit",    6_000),
    # INTEREST / TAX
    ("8001", "Interest Expense",           "PnL", "debit",   14_000),
    ("8002", "Income Tax Provision",       "PnL", "debit",   35_000),
    # BALANCE SHEET — ASSETS
    ("1001", "Cash & Cash Equivalents",    "BalanceSheet", "debit",  250_000),
    ("1002", "Accounts Receivable",        "BalanceSheet", "debit",  320_000),
    ("1003", "Inventory - Finished Goods", "BalanceSheet", "debit",  185_000),
    ("1004", "Inventory - WIP",            "BalanceSheet", "debit",   42_000),
    ("1005", "Prepaid Expenses",           "BalanceSheet", "debit",   15_000),
    ("1006", "Property Plant & Equipment", "BalanceSheet", "debit",  850_000),
    ("1007", "Accumulated Depreciation",   "BalanceSheet", "credit", 400_000),
    ("1008", "Intangible Assets",          "BalanceSheet", "debit",  120_000),
    # BALANCE SHEET — LIABILITIES
    ("2001", "Accounts Payable",           "BalanceSheet", "credit", 145_000),
    ("2002", "Accrued Liabilities",        "BalanceSheet", "credit",  38_000),
    ("2003", "Deferred Revenue",           "BalanceSheet", "credit",  28_000),
    ("2004", "Current Portion LT Debt",    "BalanceSheet", "credit",  60_000),
    ("2005", "Long-Term Debt",             "BalanceSheet", "credit", 420_000),
    ("2006", "Deferred Tax Liability",     "BalanceSheet", "credit",  22_000),
    # EQUITY
    ("3001", "Common Stock",               "BalanceSheet", "credit",  50_000),
    ("3002", "Retained Earnings",          "BalanceSheet", "credit", 350_000),
    ("3003", "Distributions to Owner",     "BalanceSheet", "debit",   30_000),
]

rows: list[dict] = []
counter = 1


def add_row(period: date, code: str, desc: str, stmt: str,
            debit: float, credit: float, note: str = "") -> None:
    global counter
    rows.append({
        "line_id": f"GL-{counter:05d}",
        "period": period.strftime("%Y-%m-%d"),
        "account_code": code,
        "account_description": desc,
        "statement": stmt,
        "debit": f"{debit:.2f}",
        "credit": f"{credit:.2f}",
        "entity": "Acme Manufacturing Co.",
        "cost_center": "CORP",
        "note": note,
    })
    counter += 1


for month_idx in range(36):
    yr = 2022 + (month_idx) // 12
    mo = (month_idx) % 12 + 1
    period = date(yr, mo, 1)

    # Mild revenue growth: ~3% per year with noise
    year_num = month_idx // 12
    growth = 1 + year_num * 0.03 + random.uniform(-0.02, 0.02)
    q4_seasonal = 1.15 if mo in (10, 11, 12) else 1.0

    for code, desc, stmt, normal, base in COA:
        if stmt != "PnL":
            continue
        seasonal = q4_seasonal if code == "4001" else 1.0
        amount = round(base * growth * seasonal + random.uniform(-base * 0.03, base * 0.03), 2)
        amount = max(amount, 0.01)

        if normal == "credit":
            add_row(period, code, desc, stmt, 0.0, amount)
        else:
            add_row(period, code, desc, stmt, amount, 0.0)

    # ANOMALY 1 baked in: 6001 Management Salaries at $120k/mo (market ~$55k/mo)

    # ANOMALY 2: Legal settlement — February 2023 (month_idx == 13)
    if month_idx == 13:
        add_row(period, "6099", "Legal Settlement - Vendor Dispute", "PnL",
                285_000.0, 0.0, note="ONE_TIME: Settlement of patent dispute with Supplier XYZ")

    # ANOMALY 3: M&A advisory fees — July 2024 (month_idx == 29)
    if month_idx == 29:
        add_row(period, "6098", "M&A Advisory Fees - Project Falcon", "PnL",
                180_000.0, 0.0, note="ONE_TIME: Investment bank advisory fees for sale process")

    # ANOMALY 4: Related-party consulting — every month
    add_row(period, "6097", "Consulting - Acme Holdings LLC (related party)", "PnL",
            22_000.0, 0.0, note="RELATED_PARTY: Monthly consulting retainer to owner entity")


out = Path(__file__).parent / "sample_gl.csv"
fieldnames = ["line_id", "period", "account_code", "account_description",
              "statement", "debit", "credit", "entity", "cost_center", "note"]

with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

# Summary
total = len(rows)
pnl_rows = [r for r in rows if r["statement"] == "PnL"]
anomaly_rows = [r for r in rows if r["note"]]
print(f"Written {total:,} rows to {out}")
print(f"  P&L rows: {len(pnl_rows):,}")
print(f"  Anomaly rows: {len(anomaly_rows)} (2 one-time + 36 related-party)")
monthly_revenue = sum(float(r["credit"]) for r in rows if r["account_code"] == "4001") / 36
print(f"  Avg monthly domestic revenue: ${monthly_revenue:,.0f}")
monthly_mgmt = sum(float(r["debit"]) for r in rows if r["account_code"] == "6001") / 36
print(f"  Avg monthly mgmt salaries: ${monthly_mgmt:,.0f} (planted excess)")
