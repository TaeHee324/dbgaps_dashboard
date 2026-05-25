"""Run the DBGAPS calculation engine with real daily price data."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backtest import benchmark_nav, load_prices, run_backtest, summarize_backtest  # noqa: E402
from metrics import monthly_returns  # noqa: E402
from portfolio import evaluate_holdings, load_trades  # noqa: E402
from report_builder import build_report  # noqa: E402
from rules import check_portfolio_rules  # noqa: E402
from turnover import check_turnover_limits  # noqa: E402
import db  # noqa: E402

DATA = ROOT / "data"
OUTPUT = ROOT / "output"
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


def _holdings_to_weights(holdings: list[dict]) -> pd.Series:
    return pd.Series({h["code"]: float(h["weight"]) for h in holdings})


def discover_portfolios() -> dict[str, list[dict]]:
    """Return {name: holdings} for all portfolios in DB."""
    db.init_db()
    portfolios = {}
    for p in db.list_portfolios():
        holdings = db.get_portfolio(p["name"])
        if holdings:
            portfolios[p["name"]] = holdings
    return portfolios


def run_comparison_backtests(prices: pd.DataFrame, portfolios: dict[str, list[dict]]) -> pd.DataFrame:
    COMPARISON_OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []

    for portfolio_name, holdings in portfolios.items():
        weights = _holdings_to_weights(holdings)
        backtest = run_backtest(prices, weights, initial_value=INITIAL_VALUE)
        try:
            benchmark = benchmark_nav(prices, BENCHMARK_CODE, initial_value=INITIAL_VALUE)
        except ValueError:
            benchmark = None
        summary = summarize_backtest(backtest, benchmark)

        backtest.loc[:, ["date", "portfolio_value", "cumulative_return", "drawdown"]].to_csv(
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
                "sortino": summary.get("sortino"),
                "annual_volatility": summary.get("annual_volatility"),
                "win_rate": summary.get("win_rate"),
            }
        )

    summary_df = pd.DataFrame(rows, columns=[
        "portfolio_name", "cagr", "mdd", "sharpe", "calmar",
        "sortino", "annual_volatility", "win_rate",
    ])
    summary_df.to_csv(COMPARISON_OUTPUT / "summary.csv", index=False)
    return summary_df


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    prices_path = DATA / "prices_daily.csv"
    if not prices_path.exists() or prices_path.stat().st_size == 0:
        raise FileNotFoundError("data/prices_daily.csv is missing or empty. Run `python src/update_prices.py` first.")

    prices = load_prices(prices_path)
    portfolios = discover_portfolios()
    if not portfolios:
        raise RuntimeError("DB에 포트폴리오가 없습니다. 먼저 portfolios/*.csv가 있는지 확인하세요.")

    base_holdings = portfolios.get("base")
    if base_holdings is None:
        raise RuntimeError("'base' 포트폴리오를 DB에서 찾을 수 없습니다.")
    weights = _holdings_to_weights(base_holdings)

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
    comparison_summary = run_comparison_backtests(prices, portfolios)
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
