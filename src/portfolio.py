"""Trade-led current portfolio calculations."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


def load_trades(path: str | Path) -> pd.DataFrame:
    trades = pd.read_csv(path, dtype={"code": str})
    required = {"date", "code", "side", "quantity", "price"}
    missing = required - set(trades.columns)
    if missing:
        raise ValueError(f"trades file missing columns: {sorted(missing)}")
    trades["date"] = pd.to_datetime(trades["date"])
    trades["side"] = trades["side"].str.lower()
    trades["quantity"] = pd.to_numeric(trades["quantity"], errors="coerce").fillna(0)
    trades["price"] = pd.to_numeric(trades["price"], errors="coerce").fillna(0)
    if "fee" not in trades.columns:
        trades["fee"] = 0.0
    trades["fee"] = pd.to_numeric(trades["fee"], errors="coerce").fillna(0)
    if "amount" not in trades.columns:
        trades["amount"] = trades["quantity"] * trades["price"]
    trades["amount"] = pd.to_numeric(trades["amount"], errors="coerce").fillna(
        trades["quantity"] * trades["price"]
    )
    return trades.sort_values(["date", "code"])


def current_holdings(trades: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for code, group in trades.groupby("code", sort=True):
        quantity = 0.0
        cost_basis = 0.0
        name = group["name"].dropna().iloc[-1] if "name" in group.columns and group["name"].notna().any() else code

        for _, trade in group.sort_values("date").iterrows():
            side = trade["side"]
            qty = float(trade["quantity"])
            price = float(trade["price"])
            fee = float(trade.get("fee", 0.0))

            if side == "buy":
                quantity += qty
                cost_basis += qty * price + fee
            elif side == "sell":
                if qty > quantity:
                    raise ValueError(f"sell quantity exceeds holding for {code}")
                avg_price = cost_basis / quantity if quantity else 0.0
                quantity -= qty
                cost_basis -= avg_price * qty
                if quantity == 0:
                    cost_basis = 0.0
            else:
                raise ValueError(f"unsupported trade side: {side}")

        if quantity > 0:
            rows.append(
                {
                    "code": code,
                    "name": name,
                    "quantity": quantity,
                    "avg_price": cost_basis / quantity,
                    "cost_basis": cost_basis,
                }
            )

    return pd.DataFrame(rows, columns=["code", "name", "quantity", "avg_price", "cost_basis"])


def latest_prices(prices: pd.DataFrame, as_of: str | pd.Timestamp | None = None) -> pd.DataFrame:
    data = prices.copy()
    data["date"] = pd.to_datetime(data["date"])
    data["close"] = pd.to_numeric(data["close"], errors="coerce")
    if as_of is not None:
        data = data[data["date"] <= pd.to_datetime(as_of)]
    return data.sort_values("date").groupby("code", as_index=False).tail(1)[["code", "date", "close"]]


def evaluate_holdings(
    trades: pd.DataFrame,
    prices: pd.DataFrame,
    etf_master: pd.DataFrame | None = None,
    as_of: str | pd.Timestamp | None = None,
) -> pd.DataFrame:
    holdings = current_holdings(trades)
    if holdings.empty:
        return holdings

    latest = latest_prices(prices, as_of=as_of).rename(columns={"close": "current_price", "date": "price_date"})
    evaluated = holdings.merge(latest, on="code", how="left")
    evaluated["market_value"] = evaluated["quantity"] * evaluated["current_price"]
    evaluated["unrealized_pnl"] = evaluated["market_value"] - evaluated["cost_basis"]
    evaluated["unrealized_return"] = evaluated["unrealized_pnl"] / evaluated["cost_basis"]
    total_value = evaluated["market_value"].sum()
    evaluated["current_weight"] = evaluated["market_value"] / total_value if total_value else 0.0

    if etf_master is not None and not etf_master.empty:
        master_cols = [c for c in ["code", "risk_type", "asset_class"] if c in etf_master.columns]
        evaluated = evaluated.merge(etf_master[master_cols].drop_duplicates("code"), on="code", how="left")

    return evaluated.sort_values("market_value", ascending=False)
