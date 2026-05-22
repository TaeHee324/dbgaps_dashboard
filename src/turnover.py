"""Turnover calculations for actual trades and theoretical rebalancing."""

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
    grouped = grouped.rename(columns={"amount": "traded_value"})
    grouped["turnover_source"] = "actual_trades"
    return grouped


def initial_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    start_date: str | pd.Timestamp | None = None,
    end_date: str | pd.Timestamp | None = None,
) -> dict[str, float | str]:
    if capital_base <= 0:
        raise ValueError("capital_base must be positive")
    data = trade_values(trades)
    if start_date is not None:
        data = data[data["date"] >= pd.to_datetime(start_date)]
    if end_date is not None:
        data = data[data["date"] <= pd.to_datetime(end_date)]
    traded_value = float(data["amount"].sum())
    return {
        "traded_value": traded_value,
        "turnover": traded_value / capital_base,
        "turnover_source": "actual_trades",
    }


def actual_trade_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    freq: str,
) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, freq)


def actual_trade_initial_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    start_date: str | pd.Timestamp | None = None,
    end_date: str | pd.Timestamp | None = None,
) -> dict[str, float | str]:
    return initial_turnover(trades, capital_base, start_date=start_date, end_date=end_date)


def weekly_turnover(trades: pd.DataFrame, capital_base: float) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "W-MON")


def monthly_turnover(trades: pd.DataFrame, capital_base: float) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "ME")


def rebalance_turnover(
    prices: pd.DataFrame,
    weights: pd.Series,
    rebalance: str,
) -> pd.DataFrame:
    """Calculate theoretical turnover needed to reset drifted weights.

    This is a target-weight backtest concept, not a competition rule check.
    The returned turnover is one-way traded value divided by portfolio value.
    """

    weights = weights.astype(float)
    total = weights.sum()
    if total <= 0:
        raise ValueError("weights must sum to a positive value")
    target_weights = weights / total

    matrix = prices.pivot(index="date", columns="code", values="close").sort_index()
    matrix = matrix.reindex(columns=target_weights.index).dropna()
    if matrix.empty:
        raise ValueError("no complete price history for requested portfolio")

    returns = matrix.pct_change().fillna(0)
    current_weights = target_weights.copy()
    periods = matrix.index.to_period(rebalance)
    rows: list[dict[str, object]] = []

    for i in range(1, len(matrix)):
        drifted = current_weights * (1 + returns.iloc[i])
        current_weights = drifted / drifted.sum()
        if periods[i] != periods[i - 1]:
            turnover = (target_weights - current_weights).abs().sum() / 2
            rows.append(
                {
                    "date": matrix.index[i],
                    "turnover": float(turnover),
                    "turnover_source": "rebalance",
                }
            )
            current_weights = target_weights.copy()

    return pd.DataFrame(rows, columns=["date", "turnover", "turnover_source"])


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
