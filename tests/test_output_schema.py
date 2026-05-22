"""Validate output/ CSV file schemas produced by run_sample_engine.py."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

OUTPUT = Path(__file__).resolve().parents[1] / "output"


def _load(filename: str) -> pd.DataFrame:
    path = OUTPUT / filename
    if not OUTPUT.exists() or not path.exists():
        pytest.skip(f"output/{filename} not found — run src/run_sample_engine.py first")
    return pd.read_csv(path)


def _assert_columns(df: pd.DataFrame, required: list[str]) -> None:
    missing = set(required) - set(df.columns)
    assert not missing, f"Missing columns: {missing}"


def test_portfolio_summary_schema():
    df = _load("portfolio_summary.csv")
    assert len(df) > 0
    _assert_columns(df, ["cumulative_return", "cagr", "mdd", "alpha", "beta",
                         "annual_volatility", "win_rate", "sharpe", "calmar"])


def test_sample_backtest_schema():
    df = _load("sample_backtest.csv")
    assert len(df) > 0
    _assert_columns(df, ["date", "portfolio_value", "daily_return", "cumulative_return", "drawdown"])


def test_current_holdings_schema():
    df = _load("current_holdings.csv")
    assert len(df) > 0
    _assert_columns(df, ["code", "name", "quantity", "avg_price", "cost_basis",
                         "price_date", "current_price", "market_value",
                         "unrealized_pnl", "unrealized_return", "current_weight",
                         "risk_type", "asset_class"])


def test_rule_individual_etf_schema():
    df = _load("rule_individual_etf.csv")
    assert len(df) > 0
    _assert_columns(df, ["code", "name", "current_weight", "limit", "excess", "passed"])


def test_rule_risk_asset_schema():
    df = _load("rule_risk_asset.csv")
    assert len(df) > 0
    _assert_columns(df, ["rule", "risky_weight", "limit", "excess", "passed"])


def test_turnover_initial_schema():
    df = _load("turnover_initial.csv")
    assert len(df) > 0
    _assert_columns(df, ["traded_value", "turnover", "limit", "passed"])


def test_turnover_weekly_schema():
    df = _load("turnover_weekly.csv")
    assert len(df) > 0
    _assert_columns(df, ["date", "traded_value", "turnover", "limit", "passed"])


def test_turnover_monthly_schema():
    df = _load("turnover_monthly.csv")
    assert len(df) > 0
    _assert_columns(df, ["date", "traded_value", "turnover", "limit", "passed"])
