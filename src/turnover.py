"""Turnover calculations for actual trades and theoretical rebalancing.

대회 룰 기준 공식:
  회전율 = 총 매매금액 / 평균 자산 × 100%
  평균 자산 = (기초자산 + 기말자산) / 2
"""

from __future__ import annotations

import pandas as pd


def trade_values(trades: pd.DataFrame) -> pd.DataFrame:
    data = trades.copy()
    data["date"] = pd.to_datetime(data["date"])
    data["side"] = data["side"].str.lower()
    data["quantity"] = pd.to_numeric(data["quantity"], errors="coerce").fillna(0)
    data["price"] = pd.to_numeric(data["price"], errors="coerce").fillna(0)
    if "amount" not in data.columns:
        data["amount"] = data["quantity"] * data["price"]
    data["amount"] = pd.to_numeric(data["amount"], errors="coerce").fillna(data["quantity"] * data["price"])
    return data


def _period_avg_capital(
    nav: pd.DataFrame | None,
    period_start: pd.Timestamp,
    period_end: pd.Timestamp,
    fallback_capital: float,
) -> float:
    """nav DataFrame(date, portfolio_value)에서 기간 기초·기말 자산의 평균을 반환.

    nav가 None이거나 해당 기간 데이터가 없으면 fallback_capital을 반환.
    """
    if nav is None or nav.empty:
        return fallback_capital
    if not {"date", "portfolio_value"}.issubset(nav.columns):
        return fallback_capital

    nav_sorted = nav.copy()
    nav_sorted["date"] = pd.to_datetime(nav_sorted["date"], errors="coerce")
    nav_sorted = nav_sorted.dropna(subset=["date"]).sort_values("date")

    in_period = nav_sorted[(nav_sorted["date"] >= period_start) & (nav_sorted["date"] <= period_end)]
    if in_period.empty:
        # 기간 시작 이전 마지막 값이 있으면 그것을 기초로 사용
        before = nav_sorted[nav_sorted["date"] < period_start]
        if not before.empty:
            start_val = float(before.iloc[-1]["portfolio_value"])
        else:
            start_val = fallback_capital
        return start_val  # 기간 내 거래 없으면 기초 = 기말 → 평균 = 기초
    else:
        start_val = float(in_period.iloc[0]["portfolio_value"])
        end_val = float(in_period.iloc[-1]["portfolio_value"])
        avg = (start_val + end_val) / 2
        return avg if avg > 0 else fallback_capital


def initial_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    start_date: str | pd.Timestamp | None = None,
    end_date: str | pd.Timestamp | None = None,
    nav: pd.DataFrame | None = None,
) -> dict[str, float | str]:
    """초기 누적 회전율.

    대회 룰: 회전율 = 총 매매금액 / 평균 자산
    평균 자산 = (기초자산 + 기말자산) / 2
    기간이 nav로 지정되지 않은 경우 capital_base를 평균 자산으로 사용.
    """
    if capital_base <= 0:
        raise ValueError("capital_base must be positive")
    data = trade_values(trades)
    if start_date is not None:
        data = data[data["date"] >= pd.to_datetime(start_date)]
    if end_date is not None:
        data = data[data["date"] <= pd.to_datetime(end_date)]
    traded_value = float(data["amount"].sum())

    # 평균 자산 계산
    ts = pd.to_datetime(start_date) if start_date is not None else (
        data["date"].min() if not data.empty else pd.Timestamp("2026-06-01")
    )
    te = pd.to_datetime(end_date) if end_date is not None else (
        data["date"].max() if not data.empty else pd.Timestamp("2026-06-08")
    )
    avg_capital = _period_avg_capital(nav, ts, te, capital_base)

    return {
        "traded_value": traded_value,
        "turnover": traded_value / avg_capital,
        "turnover_source": "actual_trades",
    }


def turnover_by_period(
    trades: pd.DataFrame,
    capital_base: float,
    freq: str,
    nav: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """기간별 회전율 계산.

    대회 룰: 회전율 = 기간 총 매매금액 / 평균 자산
    평균 자산 = (기간 기초자산 + 기간 기말자산) / 2
    """
    if capital_base <= 0:
        raise ValueError("capital_base must be positive")

    data = trade_values(trades)
    grouped = data.groupby(pd.Grouper(key="date", freq=freq))["amount"].sum().reset_index()
    grouped = grouped[grouped["amount"] > 0].copy()

    if grouped.empty:
        grouped["turnover"] = pd.Series(dtype=float)
        grouped = grouped.rename(columns={"amount": "traded_value"})
        grouped["turnover_source"] = "actual_trades"
        return grouped

    rows = []
    for _, row in grouped.iterrows():
        period_end_dt = pd.to_datetime(row["date"])
        traded_val = float(row["amount"])

        # 주간(W-MON 기준): 해당 주의 월요일부터 일요일(or 집계 날짜)
        # 월간(ME 기준): 해당 월의 1일부터 말일
        if freq.startswith("W"):
            # W-MON: period_end_dt는 해당 주 월요일을 나타냄 (집계 기준일)
            # 실제 주간 범위: 그 주 월~일
            period_start_dt = period_end_dt - pd.offsets.Week(weekday=0)
            # period_end_dt가 이미 월요일이면 그 주의 월요일
            # W-MON grouper의 label은 해당 주 월요일
            # 실제 week 범위: label 월요일 ~ label+6일
            period_end_range = period_start_dt + pd.Timedelta(days=6)
        elif freq in ("ME", "M", "MS"):
            period_start_dt = period_end_dt.replace(day=1)
            period_end_range = period_end_dt
        else:
            period_start_dt = period_end_dt
            period_end_range = period_end_dt

        avg_capital = _period_avg_capital(nav, period_start_dt, period_end_range, capital_base)
        rows.append({
            "date": period_end_dt,
            "traded_value": traded_val,
            "turnover": traded_val / avg_capital,
            "turnover_source": "actual_trades",
        })

    return pd.DataFrame(rows)


def weekly_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    nav: pd.DataFrame | None = None,
) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "W-MON", nav=nav)


def monthly_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    nav: pd.DataFrame | None = None,
) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, "ME", nav=nav)


def actual_trade_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    freq: str,
    nav: pd.DataFrame | None = None,
) -> pd.DataFrame:
    return turnover_by_period(trades, capital_base, freq, nav=nav)


def actual_trade_initial_turnover(
    trades: pd.DataFrame,
    capital_base: float,
    start_date: str | pd.Timestamp | None = None,
    end_date: str | pd.Timestamp | None = None,
    nav: pd.DataFrame | None = None,
) -> dict[str, float | str]:
    return initial_turnover(trades, capital_base, start_date=start_date, end_date=end_date, nav=nav)


def rebalance_turnover(
    prices: pd.DataFrame,
    weights: pd.Series,
    rebalance: str,
) -> pd.DataFrame:
    """Calculate theoretical turnover needed to reset drifted weights.

    This is a target-weight backtest concept, not a competition rule check.
    The returned turnover is one-way traded value divided by portfolio value.
    """

    weights = weights.astype(float)
    total = weights.sum()
    if total <= 0:
        raise ValueError("weights must sum to a positive value")
    target_weights = weights / total

    matrix = prices.pivot(index="date", columns="code", values="close").sort_index()
    matrix = matrix.reindex(columns=target_weights.index).dropna()
    if matrix.empty:
        raise ValueError("no complete price history for requested portfolio")

    returns = matrix.pct_change().fillna(0)
    current_weights = target_weights.copy()
    periods = matrix.index.to_period(rebalance)
    rows: list[dict[str, object]] = []

    for i in range(1, len(matrix)):
        drifted = current_weights * (1 + returns.iloc[i])
        current_weights = drifted / drifted.sum()
        if periods[i] != periods[i - 1]:
            turnover = (target_weights - current_weights).abs().sum() / 2
            rows.append(
                {
                    "date": matrix.index[i],
                    "turnover": float(turnover),
                    "turnover_source": "rebalance",
                }
            )
            current_weights = target_weights.copy()

    return pd.DataFrame(rows, columns=["date", "turnover", "turnover_source"])


def check_turnover_limits(
    trades: pd.DataFrame,
    capital_base: float,
    initial_limit: float = 0.80,
    period_limit: float = 0.10,
    initial_start_date: str | pd.Timestamp | None = "2026-06-01",
    initial_end_date: str | pd.Timestamp | None = "2026-06-08",
    nav: pd.DataFrame | None = None,
) -> dict[str, object]:
    """대회 룰 기준 회전율 체크.

    초기 누적(80%): 2026-06-01 ~ 2026-06-08 기간 누적 거래금액 기반.
    주간(10%): 현재 주 월~일 범위.
    월간(10%): 현재 월 1일~말일 범위.

    nav: backtest 결과 DataFrame(date, portfolio_value). 있으면 평균 자산 계산에 사용.
    """
    initial = initial_turnover(
        trades,
        capital_base,
        start_date=initial_start_date,
        end_date=initial_end_date,
        nav=nav,
    )
    weekly = weekly_turnover(trades, capital_base, nav=nav)
    monthly = monthly_turnover(trades, capital_base, nav=nav)
    weekly["limit"] = period_limit
    monthly["limit"] = period_limit
    weekly["passed"] = weekly["turnover"] <= period_limit
    monthly["passed"] = monthly["turnover"] <= period_limit

    return {
        "passed": bool(
            initial["turnover"] <= initial_limit
            and (weekly.empty or weekly["passed"].all())
            and (monthly.empty or monthly["passed"].all())
        ),
        "initial": {
            **initial,
            "limit": initial_limit,
            "passed": initial["turnover"] <= initial_limit,
        },
        "weekly": weekly,
        "monthly": monthly,
    }
