# Data Schema

This document defines the CSV contracts used by the DBGAPS pipeline.

Core boundary: `web/` reads only files under `output/`. It must not import `src/`.

## Input Files

### data/etf_master.csv

ETF master table used for production price collection and metadata joins.

| column | type | description |
|---|---|---|
| raw_ticker | string | Original GAPS ticker from the source workbook, for example `A411060`. |
| code | string | Normalized ETF code used for price lookup. Six-character numeric codes and alphanumeric KRX codes are preserved as text. |
| name | string | ETF display name. |
| aum_억원 | number | AUM in KRW 100M units. |
| benchmark | string | Underlying benchmark or index. |
| risk_type | string | GAPS risk bucket. |
| asset_class | string | GAPS asset class. |

### data/prices_daily.csv

Long-format daily close price table. Keep one row per trading date and ETF code.

| column | type | description |
|---|---|---|
| date | date | Trading date in `YYYY-MM-DD` format. |
| code | string | ETF code matching `etf_master.csv.code`. |
| close | number | Daily closing price. |

Primary key: `(date, code)`.
Sort order: `code`, then `date`.

### data/trades.csv

Trade ledger used to calculate current holdings and turnover.

| column | type | description |
|---|---|---|
| date | date | Trade date in `YYYY-MM-DD` format. |
| code | string | ETF code. |
| side | string | Trade side, for example `BUY` or `SELL`. |
| quantity | number | Traded quantity. |
| price | number | Trade price. |
| amount | number | Gross trade amount. |
| fee | number | Transaction fee. |
| memo | string | Optional note. |

### portfolios/base.csv

Target portfolio weights used by the sample engine.

| column | type | description |
|---|---|---|
| code | string | ETF code. |
| weight | number | Target weight as a decimal fraction. |

## Output Files

`src/run_sample_engine.py` currently uses sample input data, but it writes production-neutral output filenames. No output CSV should use a `sample_` prefix.

### output/portfolio_summary.csv

One-row performance summary for the portfolio backtest.

| column | type | description |
|---|---|---|
| cumulative_return | number | Total cumulative portfolio return over the backtest window. |
| cagr | number | Annualized compound growth rate. |
| mdd | number | Maximum drawdown. |
| alpha | number | Annualized alpha versus the benchmark NAV. |
| beta | number | Beta versus the benchmark NAV. |
| annual_volatility | number | Annualized volatility of daily returns. |
| win_rate | number | Fraction of positive daily return observations. |
| sharpe | number | Annualized Sharpe ratio using the configured risk-free rate. |
| calmar | number | CAGR divided by absolute maximum drawdown. |

### output/backtest_nav.csv

Daily NAV series for the portfolio backtest. This replaces the old `output/sample_backtest.csv` filename.

| column | type | description |
|---|---|---|
| date | date | Backtest trading date in `YYYY-MM-DD` format. |
| portfolio_value | number | Portfolio NAV value for the date. |
| daily_return | number | Daily portfolio return as a decimal fraction. |
| cumulative_return | number | Cumulative portfolio return as a decimal fraction. |
| drawdown | number | Drawdown from the running NAV peak as a decimal fraction. |

### output/current_holdings.csv

Current portfolio holdings derived from the trade ledger, latest prices, and ETF master metadata.

| column | type | description |
|---|---|---|
| code | string | ETF code. |
| name | string | ETF display name. |
| quantity | number | Current held quantity. |
| avg_price | number | Average acquisition price. |
| cost_basis | number | Total acquisition cost basis. |
| price_date | date | Latest price date used for valuation. |
| current_price | number | Latest close price. |
| market_value | number | Current market value. |
| unrealized_pnl | number | Unrealized profit or loss. |
| unrealized_return | number | Unrealized return as a decimal fraction. |
| current_weight | number | Holding weight within current market value. |
| risk_type | string | GAPS risk bucket from ETF metadata. |
| asset_class | string | GAPS asset class from ETF metadata. |

### output/rule_individual_etf.csv

Per-holding rule check for individual ETF weight limits.

| column | type | description |
|---|---|---|
| code | string | ETF code. |
| name | string | ETF display name. |
| current_weight | number | Current holding weight as a decimal fraction. |
| limit | number | Maximum allowed individual ETF weight. |
| excess | number | Amount above the limit. Zero means no breach. |
| passed | boolean | Whether the holding passed the rule. |

### output/rule_risk_asset.csv

Portfolio-level rule check for risky asset exposure.

| column | type | description |
|---|---|---|
| rule | string | Rule identifier. |
| risky_weight | number | Current aggregate risky asset weight. |
| limit | number | Maximum allowed risky asset weight. |
| excess | number | Amount above the limit. Zero means no breach. |
| passed | boolean | Whether the portfolio passed the rule. |

### output/turnover_initial.csv

One-row initial turnover limit check.

| column | type | description |
|---|---|---|
| traded_value | number | Total traded value during the initial period. |
| turnover | number | Traded value divided by capital base. |
| limit | number | Initial turnover limit. |
| passed | boolean | Whether the turnover check passed. |

### output/turnover_weekly.csv

Weekly turnover limit checks.

| column | type | description |
|---|---|---|
| date | date | Period end date in `YYYY-MM-DD` format. |
| traded_value | number | Total traded value in the period. |
| turnover | number | Traded value divided by capital base. |
| limit | number | Weekly turnover limit. |
| passed | boolean | Whether the period passed the turnover rule. |

### output/turnover_monthly.csv

Monthly turnover limit checks.

| column | type | description |
|---|---|---|
| date | date | Period end date in `YYYY-MM-DD` format. |
| traded_value | number | Total traded value in the period. |
| turnover | number | Traded value divided by capital base. |
| limit | number | Monthly turnover limit. |
| passed | boolean | Whether the period passed the turnover rule. |
