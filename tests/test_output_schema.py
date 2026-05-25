"""Validate output/ CSV file schemas produced by run_sample_engine.py."""

from __future__ import annotations

import ast
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
DATA_LOADER = ROOT / "web" / "data_loader.py"

OUTPUT_SCHEMAS = {
    "portfolio_summary.csv": [
        "cumulative_return",
        "cagr",
        "mdd",
        "alpha",
        "beta",
        "annual_volatility",
        "win_rate",
        "sharpe",
        "calmar",
        "sortino",
        "information_ratio",
        "mdd_duration",
        "win_rate_monthly",
        "var_95",
        "tail_ratio",
    ],
    "current_holdings.csv": [
        "code",
        "name",
        "quantity",
        "avg_price",
        "cost_basis",
        "price_date",
        "current_price",
        "market_value",
        "unrealized_pnl",
        "unrealized_return",
        "current_weight",
        "risk_type",
        "asset_class",
    ],
    "backtest_nav.csv": [
        "date",
        "portfolio_value",
        "daily_return",
        "cumulative_return",
        "drawdown",
    ],
    "monthly_returns.csv": [
        "year",
        "month",
        "monthly_return",
    ],
    "rule_individual_etf.csv": [
        "code",
        "name",
        "current_weight",
        "limit",
        "excess",
        "passed",
    ],
    "rule_risk_asset.csv": [
        "rule",
        "risky_weight",
        "limit",
        "excess",
        "passed",
    ],
    "turnover_initial.csv": [
        "traded_value",
        "turnover",
        "turnover_source",
        "limit",
        "passed",
    ],
    "turnover_weekly.csv": [
        "date",
        "traded_value",
        "turnover",
        "turnover_source",
        "limit",
        "passed",
    ],
    "turnover_monthly.csv": [
        "date",
        "traded_value",
        "turnover",
        "turnover_source",
        "limit",
        "passed",
    ],
}


def _load(filename: str) -> pd.DataFrame:
    path = OUTPUT / filename
    if not OUTPUT.exists() or not path.exists():
        pytest.skip(f"output/{filename} not found — run src/run_sample_engine.py first")
    return pd.read_csv(path)


def _assert_columns(df: pd.DataFrame, required: list[str]) -> None:
    missing = set(required) - set(df.columns)
    assert not missing, f"Missing columns: {missing}"


def _data_loader_output_files() -> set[str]:
    tree = ast.parse(DATA_LOADER.read_text(encoding="utf-8"))
    filenames = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "_read"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            filenames.add(node.args[0].value)
    return filenames


@pytest.mark.skip(reason="web/data_loader.py removed in FastAPI migration")
def test_data_loader_files_are_schema_covered():
    assert _data_loader_output_files() == set(OUTPUT_SCHEMAS)


@pytest.mark.parametrize("filename,required_columns", OUTPUT_SCHEMAS.items())
def test_output_file_schema(filename: str, required_columns: list[str]):
    df = _load(filename)
    assert len(df) > 0
    _assert_columns(df, required_columns)


def test_no_sample_prefixed_output_files():
    if not OUTPUT.exists():
        pytest.skip("output/ not found - run src/run_sample_engine.py first")
    sample_files = sorted(path.name for path in OUTPUT.glob("sample_*.csv"))
    assert sample_files == []


@pytest.mark.parametrize(
    "filename",
    ["turnover_initial.csv", "turnover_weekly.csv", "turnover_monthly.csv"],
)
def test_turnover_outputs_are_actual_trade_source(filename: str):
    df = _load(filename)
    assert set(df["turnover_source"]) == {"actual_trades"}
