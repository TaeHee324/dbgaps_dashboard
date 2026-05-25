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
    sortino: float | None = None
    information_ratio: float | None = None
    mdd_duration: int | None = None
    win_rate_monthly: float | None = None
    var_95: float | None = None
    tail_ratio: float | None = None


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
    sortino: float | None = None
    annual_volatility: float | None = None
    win_rate: float | None = None


class ComparisonNavPoint(BaseModel):
    date: str
    portfolio_value: float
    cumulative_return: float
    drawdown: float | None = None


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
    risk_type: str = ""
    asset_class: str = ""


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
    id: int
    date: str
    action: str
    etf_code: str
    etf_name: str
    weight_before: float
    weight_after: float
    reason: str
    note: str
    strategy_checklist: list[str]
    quantity: float | None = None
    price: float | None = None
    amount: float | None = None


class AddTradeRequest(BaseModel):
    date: str
    action: str
    etf_code: str
    etf_name: str
    weight_before: float
    weight_after: float
    reason: str
    note: str
    strategy_checklist: list[str] = []
    quantity: float | None = None
    price: float | None = None
    amount: float | None = None


class AddTradeResponse(BaseModel):
    date: str
    action: str
    etf_code: str
    etf_name: str
    weight_before: float
    weight_after: float
    reason: str
    note: str
    strategy_checklist: list[str] = []


class UpdateTradeRequest(BaseModel):
    date: str
    action: str
    etf_code: str
    etf_name: str
    weight_before: float
    weight_after: float
    reason: str
    note: str
    strategy_checklist: list[str] = []
    quantity: float | None = None
    price: float | None = None
    amount: float | None = None


class ReportListItem(BaseModel):
    filename: str
    title: str
    period: str


class LiveHolding(BaseModel):
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
