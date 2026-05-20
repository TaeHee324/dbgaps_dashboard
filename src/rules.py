"""DBGAPS competition rule checks."""

from __future__ import annotations

import pandas as pd


def _resolve_weight_col(portfolio: pd.DataFrame, weight_col: str | None) -> str:
    if weight_col is not None:
        if weight_col not in portfolio.columns:
            raise ValueError(f"portfolio missing {weight_col} column")
        return weight_col
    for candidate in ("current_weight", "weight"):
        if candidate in portfolio.columns:
            return candidate
    raise ValueError("portfolio missing weight column; expected current_weight or weight")


def check_individual_etf_limit(
    portfolio: pd.DataFrame,
    limit: float = 0.20,
    weight_col: str | None = None,
) -> pd.DataFrame:
    weight_col = _resolve_weight_col(portfolio, weight_col)
    result = portfolio[["code", weight_col]].copy()
    if "name" in portfolio.columns:
        result.insert(1, "name", portfolio["name"])
    result["limit"] = limit
    result["excess"] = result[weight_col] - limit
    result["passed"] = result[weight_col] <= limit
    return result


def check_risk_asset_limit(
    portfolio: pd.DataFrame,
    limit: float = 0.70,
    weight_col: str | None = None,
    risk_col: str = "risk_type",
    risky_labels: tuple[str, ...] = ("위험", "위험자산", "risk", "risky"),
) -> dict[str, object]:
    weight_col = _resolve_weight_col(portfolio, weight_col)
    if risk_col not in portfolio.columns:
        raise ValueError(f"portfolio missing {risk_col} column")

    normalized_labels = {label.lower() for label in risky_labels}
    risk_values = portfolio[risk_col].astype(str).str.lower()
    risky_weight = float(portfolio.loc[risk_values.isin(normalized_labels), weight_col].sum())
    return {
        "rule": "risk_asset_limit",
        "risky_weight": risky_weight,
        "limit": limit,
        "excess": risky_weight - limit,
        "passed": risky_weight <= limit,
    }


def check_portfolio_rules(
    portfolio: pd.DataFrame,
    individual_limit: float = 0.20,
    risk_limit: float = 0.70,
) -> dict[str, object]:
    individual = check_individual_etf_limit(portfolio, individual_limit)
    risk = check_risk_asset_limit(portfolio, risk_limit)
    return {
        "passed": bool(individual["passed"].all() and risk["passed"]),
        "individual": individual,
        "risk_asset": risk,
    }
