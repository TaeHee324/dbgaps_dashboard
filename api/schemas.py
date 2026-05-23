from __future__ import annotations

from pydantic import BaseModel


class PortfolioSummary(BaseModel):
    cumulative_return: float
    cagr: float
    mdd: float
    alpha: float
    beta: float
    annual_volatility: float
    win_rate: float
    sharpe: float
    calmar: float


class Holding(BaseModel):
    code: str
    name: str
    quantity: float
    avg_price: float
    cost_basis: float
    price_date: str
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_return: float
    current_weight: float
    risk_type: str
    asset_class: str


class NavPoint(BaseModel):
    date: str
    portfolio_value: float
    daily_return: float
    cumulative_return: float
    drawdown: float


class MonthlyReturn(BaseModel):
    year: int
    month: int
    monthly_return: float


class ComparisonSummaryItem(BaseModel):
    portfolio_name: str
    cagr: float
    mdd: float
    sharpe: float
    calmar: float


class ComparisonNavPoint(BaseModel):
    date: str
    portfolio_value: float
    cumulative_return: float


class IndividualRule(BaseModel):
    code: str
    name: str
    current_weight: float
    limit: float
    excess: float
    passed: bool


class RiskAssetRule(BaseModel):
    rule: str
    risky_weight: float
    limit: float
    excess: float
    passed: bool


class RulesResponse(BaseModel):
    individual: list[IndividualRule]
    risk_asset: RiskAssetRule


class TurnoverBase(BaseModel):
    traded_value: float
    turnover: float
    turnover_source: str
    limit: float
    passed: bool


class TurnoverWithDate(TurnoverBase):
    date: str


class TurnoverResponse(BaseModel):
    initial: TurnoverBase
    weekly: list[TurnoverWithDate]
    monthly: list[TurnoverWithDate]


class DataDateResponse(BaseModel):
    date: str


class EtfItem(BaseModel):
    code: str
    name: str


class EtfPricePoint(BaseModel):
    date: str
    close: float


class ReportResponse(BaseModel):
    content: str
    filename: str


class Portfolio(BaseModel):
    name: str


class PortfolioHolding(BaseModel):
    code: str
    weight: float


class PortfolioUpsertRequest(BaseModel):
    name: str
    holdings: list[PortfolioHolding]


class PortfolioUpsertResponse(BaseModel):
    name: str
    holdings: list[PortfolioHolding]


class BacktestRequest(BaseModel):
    holdings: list[PortfolioHolding]
    start_date: str | None = None
    end_date: str | None = None


class BacktestResponse(BaseModel):
    nav: list[NavPoint]
    summary: PortfolioSummary
    monthly: list[MonthlyReturn]
    rules: RulesResponse


class TradeLogEntry(BaseModel):
    date: str
    action: str
    etf_code: str
    etf_name: str
    weight_before: float
    weight_after: float
    reason: str
    note: str


class AddTradeRequest(TradeLogEntry):
    pass


class AddTradeResponse(TradeLogEntry):
    pass
