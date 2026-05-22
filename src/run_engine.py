"""Run the DBGAPS calculation engine with real daily price data."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from backtest import benchmark_nav, load_prices, load_weights, run_backtest, summarize_backtest
from metrics import monthly_returns
from portfolio import evaluate_holdings, load_trades
from report_builder import build_report
from rules import check_portfolio_rules
from turnover import check_turnover_limits


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "output"
PORTFOLIOS = ROOT / "portfolios"
COMPARISON_OUTPUT = OUTPUT / "comparison"
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


def discover_portfolios(portfolio_dir: Path = PORTFOLIOS) -> list[Path]:
    return sorted(path for path in portfolio_dir.glob("*.csv") if path.is_file())


def run_comparison_backtests(prices: pd.DataFrame, portfolio_paths: list[Path]) -> pd.DataFrame:
    COMPARISON_OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []

    for portfolio_path in portfolio_paths:
        portfolio_name = portfolio_path.stem
        weights = load_weights(portfolio_path)
        backtest = run_backtest(prices, weights, initial_value=INITIAL_VALUE)
        try:
            benchmark = benchmark_nav(prices, BENCHMARK_CODE, initial_value=INITIAL_VALUE)
        except ValueError:
            benchmark = None
        summary = summarize_backtest(backtest, benchmark)

        backtest.loc[:, ["date", "portfolio_value", "cumulative_return"]].to_csv(
            COMPARISON_OUTPUT / f"{portfolio_name}_nav.csv",
            index=False,
        )
        rows.append(
            {
                "portfolio_name": portfolio_name,
                "cagr": summary["cagr"],
                "mdd": summary["mdd"],
                "sharpe": summary["sharpe"],
                "calmar": summary["calmar"],
            }
        )

    summary_df = pd.DataFrame(rows, columns=["portfolio_name", "cagr", "mdd", "sharpe", "calmar"])
    summary_df.to_csv(COMPARISON_OUTPUT / "summary.csv", index=False)
    return summary_df


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    prices_path = DATA / "prices_daily.csv"
    if not prices_path.exists() or prices_path.stat().st_size == 0:
        raise FileNotFoundError("data/prices_daily.csv is missing or empty. Run `python src/update_prices.py` first.")

    prices = load_prices(prices_path)
    portfolio_paths = discover_portfolios()
    if not portfolio_paths:
        raise FileNotFoundError("No portfolio CSV files found under portfolios/.")

    weights = load_weights(PORTFOLIOS / "base.csv")

    backtest = run_backtest(prices, weights, initial_value=INITIAL_VALUE)
    try:
        benchmark = benchmark_nav(prices, BENCHMARK_CODE, initial_value=INITIAL_VALUE)
    except ValueError:
        benchmark = None
    summary = summarize_backtest(backtest, benchmark)

    backtest.to_csv(OUTPUT / "backtest_nav.csv", index=False)
    monthly_returns(backtest).to_csv(OUTPUT / "monthly_returns.csv", index=False)
    pd.DataFrame([summary]).to_csv(OUTPUT / "portfolio_summary.csv", index=False)

    trades = load_trades(DATA / "trades.csv")
    etf_master = pd.read_csv(DATA / "etf_master.csv", dtype={"code": str})
    holdings = evaluate_holdings(trades, prices, etf_master)
    holdings.to_csv(OUTPUT / "portfolio_holdings.csv", index=False)
    holdings.to_csv(OUTPUT / "current_holdings.csv", index=False)

    rule_result = check_portfolio_rules(holdings)
    build_rules_check(rule_result).to_csv(OUTPUT / "rules_check.csv", index=False)
    rule_result["individual"].to_csv(OUTPUT / "rule_individual_etf.csv", index=False)
    pd.DataFrame([rule_result["risk_asset"]]).to_csv(OUTPUT / "rule_risk_asset.csv", index=False)

    turnover_result = check_turnover_limits(
        trades,
        capital_base=INITIAL_VALUE,
        initial_end_date="2026-01-02",
    )
    pd.DataFrame([turnover_result["initial"]]).to_csv(OUTPUT / "turnover_initial.csv", index=False)
    turnover_result["weekly"].to_csv(OUTPUT / "turnover_weekly.csv", index=False)
    turnover_result["monthly"].to_csv(OUTPUT / "turnover_monthly.csv", index=False)
    comparison_summary = run_comparison_backtests(prices, portfolio_paths)
    report_path = build_report(OUTPUT)

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
    print(
        "outputs: backtest_nav.csv, portfolio_holdings.csv, rules_check.csv, "
        "turnover_initial.csv, turnover_weekly.csv, turnover_monthly.csv, "
        f"monthly_returns.csv, {report_path.name}"
    )
    print(
        f"comparison outputs: {len(comparison_summary)} portfolios, "
        "output/comparison/summary.csv and *_nav.csv"
    )


if __name__ == "__main__":
    main()
