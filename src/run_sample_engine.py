"""Run the sample DBGAPS calculation engine and export CSV outputs."""

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


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    prices = load_prices(DATA / "sample_prices_daily.csv")
    weights = load_weights(ROOT / "portfolios" / "base.csv")
    backtest = run_backtest(prices, weights)
    benchmark = benchmark_nav(prices, "069500")
    summary = summarize_backtest(backtest, benchmark)

    pd.DataFrame([summary]).to_csv(OUTPUT / "portfolio_summary.csv", index=False)
    backtest.to_csv(OUTPUT / "sample_backtest.csv", index=False)

    trades = load_trades(DATA / "trades.csv")
    etf_master = pd.read_csv(DATA / "sample_etf_master.csv", dtype={"code": str})
    holdings = evaluate_holdings(trades, prices, etf_master)
    holdings.to_csv(OUTPUT / "current_holdings.csv", index=False)

    rule_result = check_portfolio_rules(holdings)
    rule_result["individual"].to_csv(OUTPUT / "rule_individual_etf.csv", index=False)
    pd.DataFrame([rule_result["risk_asset"]]).to_csv(OUTPUT / "rule_risk_asset.csv", index=False)

    turnover = check_turnover_limits(
        trades,
        capital_base=100_000_000,
        initial_end_date="2026-01-02",
    )
    pd.DataFrame([turnover["initial"]]).to_csv(OUTPUT / "turnover_initial.csv", index=False)
    turnover["weekly"].to_csv(OUTPUT / "turnover_weekly.csv", index=False)
    turnover["monthly"].to_csv(OUTPUT / "turnover_monthly.csv", index=False)


if __name__ == "__main__":
    main()
