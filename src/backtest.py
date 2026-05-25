"""Portfolio backtesting engine using local CSV price inputs."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

try:
    from .metrics import drawdown_series, summarize_performance
except ImportError:  # pragma: no cover - supports direct script execution from src/
    from metrics import drawdown_series, summarize_performance


def load_prices(path: str | Path) -> pd.DataFrame:
    prices = pd.read_csv(path, dtype={"code": str})
    required = {"date", "code", "close"}
    missing = required - set(prices.columns)
    if missing:
        raise ValueError(f"prices file missing columns: {sorted(missing)}")
    prices["date"] = pd.to_datetime(prices["date"])
    prices["close"] = pd.to_numeric(prices["close"], errors="coerce")
    return prices.dropna(subset=["date", "code", "close"]).sort_values(["date", "code"])


def load_weights(path: str | Path) -> pd.Series:
    weights = pd.read_csv(path, dtype={"code": str})
    required = {"code", "weight"}
    missing = required - set(weights.columns)
    if missing:
        raise ValueError(f"portfolio file missing columns: {sorted(missing)}")
    series = weights.set_index("code")["weight"].astype(float)
    total = series.sum()
    if total <= 0:
        raise ValueError("portfolio weights must sum to a positive value")
    return series / total


def price_matrix(prices: pd.DataFrame, codes: list[str] | None = None) -> pd.DataFrame:
    selected = prices if codes is None else prices[prices["code"].isin(codes)]
    matrix = selected.pivot(index="date", columns="code", values="close").sort_index()
    return matrix.dropna(how="all")


def run_backtest(
    prices: pd.DataFrame,
    weights: pd.Series,
    initial_value: float = 100_000_000,
    rebalance: str | None = None,
) -> pd.DataFrame:
    """Run a close-to-close portfolio backtest.

    If ``rebalance`` is None, the portfolio drifts after initial allocation.
    Use pandas offset aliases such as "W" or "M" for periodic rebalancing.
    """

    weights = weights.astype(float)
    matrix = price_matrix(prices, list(weights.index)).dropna()
    if matrix.empty:
        raise ValueError("no complete price history for requested portfolio")

    missing = set(weights.index) - set(matrix.columns)
    if missing:
        raise ValueError(f"missing prices for codes: {sorted(missing)}")

    weights = weights.reindex(matrix.columns)
    normalized = matrix / matrix.iloc[0]

    if rebalance is None:
        portfolio_nav = normalized.mul(weights, axis=1).sum(axis=1) * initial_value
    else:
        returns = matrix.pct_change().fillna(0)
        nav = pd.Series(index=matrix.index, dtype=float)
        current_weights = weights.copy()
        nav.iloc[0] = initial_value
        periods = matrix.index.to_period(rebalance)
        for i in range(1, len(matrix)):
            nav.iloc[i] = nav.iloc[i - 1] * (1 + (current_weights * returns.iloc[i]).sum())
            drifted = current_weights * (1 + returns.iloc[i])
            current_weights = drifted / drifted.sum()
            if periods[i] != periods[i - 1]:
                current_weights = weights.copy()
        portfolio_nav = nav

    result = pd.DataFrame(
        {
            "date": portfolio_nav.index,
            "portfolio_value": portfolio_nav.values,
            "daily_return": portfolio_nav.pct_change().fillna(0).values,
        }
    )
    result["cumulative_return"] = result["portfolio_value"] / initial_value - 1
    result["drawdown"] = drawdown_series(result.set_index("date")["portfolio_value"]).values
    return result


def benchmark_nav(prices: pd.DataFrame, benchmark_code: str, initial_value: float = 100_000_000) -> pd.Series:
    matrix = price_matrix(prices, [benchmark_code]).dropna()
    if benchmark_code not in matrix.columns or matrix.empty:
        raise ValueError(f"missing benchmark prices for code: {benchmark_code}")
    return matrix[benchmark_code] / matrix[benchmark_code].iloc[0] * initial_value


def summarize_backtest(
    backtest_result: pd.DataFrame,
    benchmark: pd.Series | None = None,
    risk_free_rate: float = 0.0,
) -> dict[str, float | None]:
    nav = backtest_result.set_index("date")["portfolio_value"]
    nav.index = pd.to_datetime(nav.index, errors="coerce")
    return summarize_performance(nav, benchmark_nav=benchmark, risk_free_rate=risk_free_rate).as_dict()


def export_backtest_summary(
    prices_path: str | Path,
    portfolio_path: str | Path,
    output_path: str | Path,
    benchmark_code: str | None = None,
    initial_value: float = 100_000_000,
    risk_free_rate: float = 0.0,
) -> pd.DataFrame:
    prices = load_prices(prices_path)
    weights = load_weights(portfolio_path)
    result = run_backtest(prices, weights, initial_value=initial_value)
    benchmark = benchmark_nav(prices, benchmark_code, initial_value) if benchmark_code else None
    summary = pd.DataFrame([summarize_backtest(result, benchmark, risk_free_rate)])
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    summary.to_csv(output_path, index=False)
    return summary
