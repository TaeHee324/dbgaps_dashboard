"""Performance metrics for DBGAPS portfolio backtests."""

from __future__ import annotations

import math
from dataclasses import dataclass

import pandas as pd


TRADING_DAYS_PER_YEAR = 252


@dataclass(frozen=True)
class MetricsSummary:
    cumulative_return: float
    cagr: float
    mdd: float
    alpha: float | None
    beta: float | None
    annual_volatility: float
    win_rate: float
    sharpe: float | None
    calmar: float | None

    def as_dict(self) -> dict[str, float | None]:
        return {
            "cumulative_return": self.cumulative_return,
            "cagr": self.cagr,
            "mdd": self.mdd,
            "alpha": self.alpha,
            "beta": self.beta,
            "annual_volatility": self.annual_volatility,
            "win_rate": self.win_rate,
            "sharpe": self.sharpe,
            "calmar": self.calmar,
        }


def _as_returns(values: pd.Series, *, input_type: str = "nav") -> pd.Series:
    series = pd.to_numeric(values, errors="coerce").dropna()
    if input_type == "returns":
        return series
    if input_type != "nav":
        raise ValueError("input_type must be 'nav' or 'returns'")
    return series.pct_change().dropna()


def cumulative_return(nav: pd.Series) -> float:
    clean = pd.to_numeric(nav, errors="coerce").dropna()
    if clean.empty:
        return 0.0
    first = clean.iloc[0]
    if first == 0:
        return 0.0
    return float(clean.iloc[-1] / first - 1)


def cagr(nav: pd.Series, periods_per_year: int = TRADING_DAYS_PER_YEAR) -> float:
    clean = pd.to_numeric(nav, errors="coerce").dropna()
    if len(clean) < 2 or clean.iloc[0] <= 0 or clean.iloc[-1] <= 0:
        return 0.0
    years = (len(clean) - 1) / periods_per_year
    if years <= 0:
        return 0.0
    return float((clean.iloc[-1] / clean.iloc[0]) ** (1 / years) - 1)


def mdd(nav: pd.Series) -> float:
    clean = pd.to_numeric(nav, errors="coerce").dropna()
    if clean.empty:
        return 0.0
    drawdown = clean / clean.cummax() - 1
    return float(drawdown.min())


def drawdown_series(nav: pd.Series) -> pd.Series:
    clean = pd.to_numeric(nav, errors="coerce").dropna()
    if clean.empty:
        return pd.Series(dtype=float)
    return clean / clean.cummax() - 1


def annual_volatility(
    values: pd.Series,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
    *,
    input_type: str = "nav",
) -> float:
    returns = _as_returns(values, input_type=input_type)
    if len(returns) < 2:
        return 0.0
    return float(returns.std(ddof=1) * math.sqrt(periods_per_year))


def win_rate(values: pd.Series, *, input_type: str = "nav") -> float:
    returns = _as_returns(values, input_type=input_type)
    if returns.empty:
        return 0.0
    return float((returns > 0).mean())


def beta(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
) -> float | None:
    if portfolio_returns is None or benchmark_returns is None:
        return None
    aligned = pd.concat(
        [
            pd.to_numeric(portfolio_returns, errors="coerce").rename("portfolio"),
            pd.to_numeric(benchmark_returns, errors="coerce").rename("benchmark"),
        ],
        axis=1,
    ).dropna()
    if len(aligned) < 2:
        return None
    benchmark_variance = aligned["benchmark"].var(ddof=1)
    if pd.isna(benchmark_variance) or benchmark_variance == 0:
        return None
    covariance = aligned["portfolio"].cov(aligned["benchmark"])
    if pd.isna(covariance):
        return None
    return float(covariance / benchmark_variance)


def alpha(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> float | None:
    b = beta(portfolio_returns, benchmark_returns)
    if b is None:
        return None

    aligned = pd.concat(
        [
            pd.to_numeric(portfolio_returns, errors="coerce").rename("portfolio"),
            pd.to_numeric(benchmark_returns, errors="coerce").rename("benchmark"),
        ],
        axis=1,
    ).dropna()
    if len(aligned) < 2:
        return None

    rf_period = risk_free_rate / periods_per_year
    period_alpha = (aligned["portfolio"].mean() - rf_period) - b * (
        aligned["benchmark"].mean() - rf_period
    )
    if pd.isna(period_alpha):
        return None
    return float(period_alpha * periods_per_year)


def sharpe_ratio(
    values: pd.Series,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
    *,
    input_type: str = "nav",
) -> float | None:
    returns = _as_returns(values, input_type=input_type)
    if len(returns) < 2:
        return None
    rf_period = risk_free_rate / periods_per_year
    excess = returns - rf_period
    volatility = excess.std(ddof=1)
    if volatility == 0:
        return None
    return float(excess.mean() / volatility * math.sqrt(periods_per_year))


def calmar_ratio(nav: pd.Series, periods_per_year: int = TRADING_DAYS_PER_YEAR) -> float | None:
    max_drawdown = abs(mdd(nav))
    if max_drawdown == 0:
        return None
    return float(cagr(nav, periods_per_year=periods_per_year) / max_drawdown)


def monthly_returns(backtest_result: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily returns into calendar-month compounded returns."""

    required = {"date", "daily_return"}
    missing = required - set(backtest_result.columns)
    if missing:
        raise ValueError(f"backtest result missing columns: {sorted(missing)}")

    data = backtest_result.loc[:, ["date", "daily_return"]].copy()
    data["date"] = pd.to_datetime(data["date"], errors="coerce")
    data["daily_return"] = pd.to_numeric(data["daily_return"], errors="coerce")
    data = data.dropna(subset=["date", "daily_return"])
    if data.empty:
        return pd.DataFrame(columns=["year", "month", "monthly_return"])

    data["year"] = data["date"].dt.year.astype(int)
    data["month"] = data["date"].dt.month.astype(int)
    result = (
        data.groupby(["year", "month"], as_index=False)["daily_return"]
        .agg(lambda returns: float((1 + returns).prod() - 1))
        .rename(columns={"daily_return": "monthly_return"})
    )
    return result[["year", "month", "monthly_return"]]


def summarize_performance(
    nav: pd.Series,
    benchmark_nav: pd.Series | None = None,
    risk_free_rate: float = 0.0,
    periods_per_year: int = TRADING_DAYS_PER_YEAR,
) -> MetricsSummary:
    returns = _as_returns(nav, input_type="nav")
    benchmark_returns = _as_returns(benchmark_nav, input_type="nav") if benchmark_nav is not None else None

    return MetricsSummary(
        cumulative_return=cumulative_return(nav),
        cagr=cagr(nav, periods_per_year=periods_per_year),
        mdd=mdd(nav),
        alpha=alpha(returns, benchmark_returns, risk_free_rate, periods_per_year)
        if benchmark_returns is not None
        else None,
        beta=beta(returns, benchmark_returns) if benchmark_returns is not None else None,
        annual_volatility=annual_volatility(returns, periods_per_year, input_type="returns"),
        win_rate=win_rate(returns, input_type="returns"),
        sharpe=sharpe_ratio(
            returns,
            risk_free_rate=risk_free_rate,
            periods_per_year=periods_per_year,
            input_type="returns",
        ),
        calmar=calmar_ratio(nav, periods_per_year=periods_per_year),
    )
