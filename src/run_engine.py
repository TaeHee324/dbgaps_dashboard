"""Run the DBGAPS calculation engine with real daily price data."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from backtest import benchmark_nav, load_prices, load_weights, run_backtest, summarize_backtest
from portfolio import evaluate_holdings, load_trades
from rules import check_portfolio_rules
from turnover import check_turnover_limits


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "output"
BENCHMARK_CODE = "069500"
INITIAL_VALUE = 100_000_000


def format_pct(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2%}"


def build_rules_check(rule_result: dict[str, object]) -> pd.DataFrame:
    individual = rule_result["individual"].copy()
    individual.insert(0, "rule", "individual_etf_limit")
    risk_asset = pd.DataFrame([rule_result["risk_asset"]])
    return pd.concat([individual, risk_asset], ignore_index=True, sort=False)


def build_turnover_check(turnover_result: dict[str, object]) -> pd.DataFrame:
    initial = pd.DataFrame([{**turnover_result["initial"], "period": "initial"}])
    weekly = turnover_result["weekly"].copy()
    weekly.insert(0, "period", "weekly")
    monthly = turnover_result["monthly"].copy()
    monthly.insert(0, "period", "monthly")
    return pd.concat([initial, weekly, monthly], ignore_index=True, sort=False)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    prices_path = DATA / "prices_daily.csv"
    if not prices_path.exists() or prices_path.stat().st_size == 0:
        raise FileNotFoundError("data/prices_daily.csv is missing or empty. Run `python src/update_prices.py` first.")

    prices = load_prices(prices_path)
    weights = load_weights(ROOT / "portfolios" / "base.csv")

    backtest = run_backtest(prices, weights, initial_value=INITIAL_VALUE)
    benchmark = benchmark_nav(prices, BENCHMARK_CODE, initial_value=INITIAL_VALUE)
    summary = summarize_backtest(backtest, benchmark)

    backtest.to_csv(OUTPUT / "backtest_nav.csv", index=False)
    pd.DataFrame([summary]).to_csv(OUTPUT / "portfolio_summary.csv", index=False)

    trades = load_trades(DATA / "trades.csv")
    etf_master = pd.read_csv(DATA / "etf_master.csv", dtype={"code": str})
    holdings = evaluate_holdings(trades, prices, etf_master)
    holdings.to_csv(OUTPUT / "portfolio_holdings.csv", index=False)

    rule_result = check_portfolio_rules(holdings)
    build_rules_check(rule_result).to_csv(OUTPUT / "rules_check.csv", index=False)

    turnover_result = check_turnover_limits(
        trades,
        capital_base=INITIAL_VALUE,
        initial_end_date="2026-01-02",
    )
    build_turnover_check(turnover_result).to_csv(OUTPUT / "turnover.csv", index=False)

    start_date = backtest["date"].min().date()
    end_date = backtest["date"].max().date()
    trading_days = len(backtest)
    sharpe = f"{summary['sharpe']:.2f}" if summary["sharpe"] is not None else "n/a"
    print(f"engine done: {trading_days} trading days, {start_date} to {end_date}")
    print(
        "summary: "
        f"cumulative_return={format_pct(summary['cumulative_return'])}, "
        f"cagr={format_pct(summary['cagr'])}, "
        f"mdd={format_pct(summary['mdd'])}, "
        f"annual_volatility={format_pct(summary['annual_volatility'])}, "
        f"sharpe={sharpe}"
    )
    print("outputs: backtest_nav.csv, portfolio_holdings.csv, rules_check.csv, turnover.csv")


if __name__ == "__main__":
    main()
