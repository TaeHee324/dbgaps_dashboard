import os
from pathlib import Path

import pandas as pd
import streamlit as st

OUTPUT_DIR = Path(__file__).parent.parent / "output"


def _read(filename: str, **kwargs) -> pd.DataFrame:
    path = OUTPUT_DIR / filename
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, **kwargs)


@st.cache_data(ttl=300)
def load_portfolio_summary() -> pd.DataFrame:
    return _read("portfolio_summary.csv")


@st.cache_data(ttl=300)
def load_current_holdings() -> pd.DataFrame:
    df = _read("current_holdings.csv")
    if not df.empty and "code" in df.columns:
        df["code"] = df["code"].astype(str)
    return df


@st.cache_data(ttl=300)
def load_backtest_nav() -> pd.DataFrame:
    df = _read("backtest_nav.csv")
    if not df.empty and "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    return df


@st.cache_data(ttl=300)
def load_monthly_returns() -> pd.DataFrame:
    df = _read("monthly_returns.csv")
    if not df.empty:
        for column in ["year", "month"]:
            if column in df.columns:
                df[column] = df[column].astype(int)
    return df


@st.cache_data(ttl=300)
def load_comparison_summary() -> pd.DataFrame:
    path = OUTPUT_DIR / "comparison" / "summary.csv"
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


@st.cache_data(ttl=300)
def load_comparison_nav() -> dict[str, pd.DataFrame]:
    comparison_dir = OUTPUT_DIR / "comparison"
    if not comparison_dir.exists():
        return {}

    nav_by_portfolio = {}
    for path in sorted(comparison_dir.glob("*_nav.csv")):
        df = pd.read_csv(path)
        if not df.empty and "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
        nav_by_portfolio[path.name.removesuffix("_nav.csv")] = df
    return nav_by_portfolio


@st.cache_data(ttl=300)
def load_rule_results() -> dict[str, pd.DataFrame]:
    return {
        "individual": _read("rule_individual_etf.csv"),
        "risk_asset": _read("rule_risk_asset.csv"),
    }


@st.cache_data(ttl=300)
def load_turnover() -> dict[str, pd.DataFrame]:
    return {
        "initial": _read("turnover_initial.csv"),
        "weekly": _read("turnover_weekly.csv"),
        "monthly": _read("turnover_monthly.csv"),
    }


@st.cache_data(ttl=300)
def load_report() -> str | None:
    reports = sorted(OUTPUT_DIR.glob("report_*.md"))
    if not reports:
        return None
    return reports[-1].read_text(encoding="utf-8")


@st.cache_data(ttl=300)
def get_data_date() -> str:
    files = list(OUTPUT_DIR.glob("*.csv"))
    if not files:
        return "데이터 없음"
    latest = max(f.stat().st_mtime for f in files)
    return pd.Timestamp(latest, unit="s").strftime("%Y-%m-%d %H:%M")
