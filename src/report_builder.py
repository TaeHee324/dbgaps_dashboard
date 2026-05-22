"""Build a Markdown monthly report from generated output CSV files."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"


def _read_csv(filename: str) -> pd.DataFrame:
    path = OUTPUT / filename
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def _first_row(df: pd.DataFrame) -> pd.Series:
    if df.empty:
        return pd.Series(dtype=object)
    return df.iloc[0]


def _value(row: pd.Series, key: str):
    if key not in row or pd.isna(row[key]):
        return None
    return row[key]


def _pct(value, digits: int = 2, signed: bool = False) -> str:
    if value is None or pd.isna(value):
        return "N/A"
    sign = "+" if signed else ""
    return f"{float(value):{sign}.{digits}%}"


def _number(value, digits: int = 2) -> str:
    if value is None or pd.isna(value):
        return "N/A"
    return f"{float(value):.{digits}f}"


def _money(value) -> str:
    if value is None or pd.isna(value):
        return "N/A"
    return f"{float(value):,.0f}"


def _status(value) -> str:
    if pd.isna(value):
        return "failed"
    if isinstance(value, str):
        passed = value.strip().lower() == "true"
    else:
        passed = bool(value)
    return "passed" if passed else "failed"


def _latest_report_month(backtest: pd.DataFrame) -> pd.Timestamp:
    if backtest.empty or "date" not in backtest.columns:
        raise FileNotFoundError("output/backtest_nav.csv is missing or has no date column.")
    dates = pd.to_datetime(backtest["date"], errors="coerce").dropna()
    if dates.empty:
        raise ValueError("output/backtest_nav.csv has no valid dates.")
    return dates.max()


def _monthly_section(monthly: pd.DataFrame) -> tuple[str, list[str]]:
    if monthly.empty or not {"year", "month", "monthly_return"}.issubset(monthly.columns):
        return "N/A", ["| 연월 | 수익률 |", "|---|---:|", "| N/A | N/A |"]

    ordered = monthly.copy()
    ordered["year"] = ordered["year"].astype(int)
    ordered["month"] = ordered["month"].astype(int)
    ordered = ordered.sort_values(["year", "month"])

    latest = ordered.iloc[-1]
    latest_label = f"{int(latest['year']):04d}-{int(latest['month']):02d} {_pct(latest['monthly_return'], signed=True)}"

    rows = ["| 연월 | 수익률 |", "|---|---:|"]
    for _, row in ordered.tail(12).iterrows():
        period = f"{int(row['year']):04d}-{int(row['month']):02d}"
        rows.append(f"| {period} | {_pct(row['monthly_return'], signed=True)} |")
    return latest_label, rows


def _risk_rule_lines(individual: pd.DataFrame, risk_asset: pd.DataFrame) -> list[str]:
    lines = []
    if individual.empty:
        lines.append("- 개별 ETF 상한: 데이터 없음")
    else:
        failed = individual[individual["passed"].map(_status) == "failed"] if "passed" in individual.columns else individual
        overall = "passed" if failed.empty else "failed"
        lines.append(f"- 개별 ETF 상한: {overall} ({len(failed)}개 위반)")
        for _, row in failed.iterrows():
            name = row.get("name", row.get("code", "N/A"))
            lines.append(
                f"  - {name}: 비중 {_pct(row.get('current_weight'))}, "
                f"한도 {_pct(row.get('limit'))}, 초과 {_pct(row.get('excess'))}"
            )

    if risk_asset.empty:
        lines.append("- 위험자산 상한: 데이터 없음")
    else:
        row = risk_asset.iloc[0]
        lines.append(
            "- 위험자산 상한: "
            f"{_status(row.get('passed'))} "
            f"(비중 {_pct(row.get('risky_weight'))}, 한도 {_pct(row.get('limit'))}, 초과 {_pct(row.get('excess'))})"
        )
    return lines


def _turnover_line(label: str, df: pd.DataFrame) -> str:
    if df.empty:
        return f"- {label}: 데이터 없음"
    row = df.iloc[-1]
    date = f"{row.get('date')} " if "date" in df.columns and pd.notna(row.get("date")) else ""
    return (
        f"- {label}: {date}{_pct(row.get('turnover'))} "
        f"(거래금액 {_money(row.get('traded_value'))}, 한도 {_pct(row.get('limit'))}, "
        f"{_status(row.get('passed'))})"
    )


def _holdings_lines(holdings: pd.DataFrame) -> list[str]:
    if holdings.empty:
        return ["| 종목명 | 비중 | 수익률 |", "|---|---:|---:|", "| N/A | N/A | N/A |"]

    rows = ["| 종목명 | 비중 | 수익률 |", "|---|---:|---:|"]
    sort_col = "unrealized_return" if "unrealized_return" in holdings.columns else "current_weight"
    for _, row in holdings.sort_values(sort_col, ascending=False).head(5).iterrows():
        name = row.get("name", row.get("code", "N/A"))
        rows.append(f"| {name} | {_pct(row.get('current_weight'))} | {_pct(row.get('unrealized_return'), signed=True)} |")
    return rows


def build_report(output_dir: Path | str = OUTPUT) -> Path:
    """Create output/report_YYYYMM.md and return its path."""
    global OUTPUT
    OUTPUT = Path(output_dir)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    summary = _first_row(_read_csv("portfolio_summary.csv"))
    monthly = _read_csv("monthly_returns.csv")
    holdings = _read_csv("current_holdings.csv")
    individual = _read_csv("rule_individual_etf.csv")
    risk_asset = _read_csv("rule_risk_asset.csv")
    backtest = _read_csv("backtest_nav.csv")

    report_month = _latest_report_month(backtest)
    yyyymm = report_month.strftime("%Y%m")
    title_month = report_month.strftime("%Y년 %m월")
    latest_monthly, monthly_rows = _monthly_section(monthly)

    lines = [
        f"# DBGAPS 포트폴리오 월간보고서 {title_month}",
        "",
        "## 성과 요약",
        f"- CAGR: {_pct(_value(summary, 'cagr'))}",
        f"- 누적수익률: {_pct(_value(summary, 'cumulative_return'), signed=True)}",
        f"- MDD: {_pct(_value(summary, 'mdd'))}",
        f"- 샤프: {_number(_value(summary, 'sharpe'))}",
        f"- 칼마: {_number(_value(summary, 'calmar'))}",
        f"- 연간변동성: {_pct(_value(summary, 'annual_volatility'))}",
        f"- 승률: {_pct(_value(summary, 'win_rate'))}",
        f"- Alpha: {_pct(_value(summary, 'alpha'), signed=True)}",
        f"- Beta: {_number(_value(summary, 'beta'))}",
        "",
        "## 당월 수익률",
        f"- {latest_monthly}",
        "",
        "## 월별 수익률 테이블",
        *monthly_rows,
        "",
        "## 리스크 규칙 체크",
        *_risk_rule_lines(individual, risk_asset),
        "",
        "## 회전율",
        _turnover_line("초기", _read_csv("turnover_initial.csv")),
        _turnover_line("주간", _read_csv("turnover_weekly.csv")),
        _turnover_line("월간", _read_csv("turnover_monthly.csv")),
        "",
        "## 보유현황",
        *_holdings_lines(holdings),
        "",
    ]

    report_path = OUTPUT / f"report_{yyyymm}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


if __name__ == "__main__":
    path = build_report()
    print(f"report written: {path}")
