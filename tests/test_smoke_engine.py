"""Smoke tests: each engine module returns the expected type."""

import pandas as pd

from src.backtest import load_weights, run_backtest
from src.portfolio import evaluate_holdings
from src.rules import check_portfolio_rules
from src.turnover import check_turnover_limits


def test_backtest_returns_dataframe(sample_prices, base_weights_path):
    weights = load_weights(base_weights_path)
    result = run_backtest(sample_prices, weights)
    assert isinstance(result, pd.DataFrame)


def test_portfolio_returns_dataframe(sample_trades, sample_prices, sample_etf_master):
    result = evaluate_holdings(sample_trades, sample_prices, sample_etf_master)
    assert isinstance(result, pd.DataFrame)


def test_rules_returns_dict(sample_trades, sample_prices, sample_etf_master):
    portfolio = evaluate_holdings(sample_trades, sample_prices, sample_etf_master)
    result = check_portfolio_rules(portfolio)
    assert isinstance(result, dict)


def test_turnover_returns_dict(sample_trades):
    result = check_turnover_limits(sample_trades, capital_base=100_000_000)
    assert isinstance(result, dict)
