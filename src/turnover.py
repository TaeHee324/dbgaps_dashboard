"""Turnover calculations for initial, weekly, and monthly checks."""

from __future__ import annotations

import pandas as pd


def trade_values(trades: pd.DataFrame) -> pd.DataFrame:
    data = trades.copy()
    data["date"] = pd.to_datetime(data["date"])
    data["side"] = data["side"].str.lower()
    data["quantity"] = pd.to_numeric(data["quantity"], errors="coerce").fillna(0)
    data["price"] = pd.to_numeric(data["price"], errors="coerce").fillna(0)
    if "amount" not in data.columns:
        data["amount"] = data["quantity"] * data["price"]
    data["amount"] = pd.to_numeric(data["amount"], errors="coerce").fillna(data["quantity"] * data["price"])
    return data


def turnover_by_period(
    trades: pd.DataFrame,
    capital_base: float,
    freq: str,
) -> pd.DataFrame:
    if capital_base <= 0:
        raise ValueError("capital_base must be positive")

    data = trade_values(trades)
    grouped = data.groupby(pd.Grouper(key="date", freq=freq))["amount"].sum().reset_index()
    grouped = grouped[grouped["amount"] > 0].copy()
    grouped["turnover"] = grouped["amount"] / capital_base
    return grouped.rename(columns={"amount": "traded_value"})


def initial_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    start_date: str | pd.Timestamp | None = None,
    end_date: str | pd.Timestamp | None = None,
) -> dict[str, float]:
    if capital_base <= 0:
        raise ValueError("capital_base must be positive")
    data = trade_values(trades)
    if start_date is not None:
        data = data[data["date"] >= pd.to_datetime(start_date)]
    if end_date is not None:
        data = data[data["date"] <= pd.to_datetime(end_date)]
    traded_value = float(data["amount"].sum())
    return {"traded_value": traded_value, "turnover": traded_value / capital_base}


def weekly_turnover(trades: pd.DataFrame, capital_base: float) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "W-MON")


def monthly_turnover(trades: pd.DataFrame, capital_base: float) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "ME")


def check_turnover_limits(
    trades: pd.DataFrame,
    capital_base: float,
    initial_limit: float = 0.80,
    period_limit: float = 0.10,
    initial_end_date: str | pd.Timestamp | None = None,
) -> dict[str, object]:
    initial = initial_turnover(trades, capital_base, end_date=initial_end_date)
    weekly = weekly_turnover(trades, capital_base)
    monthly = monthly_turnover(trades, capital_base)
    weekly["limit"] = period_limit
    monthly["limit"] = period_limit
    weekly["passed"] = weekly["turnover"] <= period_limit
    monthly["passed"] = monthly["turnover"] <= period_limit

    return {
        "passed": bool(
            initial["turnover"] <= initial_limit
            and weekly["passed"].all()
            and monthly["passed"].all()
        ),
        "initial": {
            **initial,
            "limit": initial_limit,
            "passed": initial["turnover"] <= initial_limit,
        },
        "weekly": weekly,
        "monthly": monthly,
    }
