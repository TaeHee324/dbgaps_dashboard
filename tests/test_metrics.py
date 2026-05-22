import pandas as pd
import pytest

from src.metrics import alpha, beta, cagr, calmar_ratio, monthly_returns, sharpe_ratio


def test_cagr_with_one_row_returns_zero():
    assert cagr(pd.Series([100.0])) == 0.0


def test_sharpe_with_all_zero_returns_returns_none():
    returns = pd.Series([0.0, 0.0, 0.0])
    assert sharpe_ratio(returns, input_type="returns") is None


def test_alpha_beta_without_benchmark_overlap_return_none():
    portfolio = pd.Series([0.01, 0.02], index=pd.to_datetime(["2026-01-01", "2026-01-02"]))
    benchmark = pd.Series([0.01, 0.02], index=pd.to_datetime(["2026-02-01", "2026-02-02"]))

    assert beta(portfolio, benchmark) is None
    assert alpha(portfolio, benchmark) is None


def test_calmar_with_zero_mdd_returns_none():
    nav = pd.Series([100.0, 101.0, 102.0])
    assert calmar_ratio(nav) is None


def test_monthly_returns_compounds_daily_returns():
    backtest = pd.DataFrame(
        {
            "date": pd.to_datetime(["2026-01-30", "2026-01-31", "2026-02-01"]),
            "daily_return": [0.1, -0.1, 0.05],
        }
    )

    result = monthly_returns(backtest)

    assert result["year"].tolist() == [2026, 2026]
    assert result["month"].tolist() == [1, 2]
    assert result["monthly_return"].tolist() == [pytest.approx(-0.01), pytest.approx(0.05)]
