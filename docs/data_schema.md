# Data Schema

## data/etf_master.csv

Source: `제12회 GAPS ETF 리스트 (v260509).xlsx`, sheet `ETF`, rows 6-193.
The source workbook is read-only input and must not be modified by the pipeline.

Columns:

| column | description |
|---|---|
| raw_ticker | Original GAPS ticker from the workbook, e.g. `A411060` |
| code | Normalized six-character ETF code for price lookup, e.g. `411060`; alphanumeric KRX codes such as `0061Z0` are preserved |
| name | ETF display name |
| aum_억원 | AUM in KRW 100M units, rounded to 2 decimals |
| benchmark | Underlying benchmark/index from the workbook |
| risk_type | GAPS risk bucket from `구분1` |
| asset_class | GAPS asset class from `구분2` |

## data/prices_daily.csv

Long-format daily close price table. Keep one row per trading date and ETF code.

Columns:

| column | type | description |
|---|---|---|
| date | YYYY-MM-DD | Trading date |
| code | string | Six-character ETF code matching `etf_master.csv.code` |
| close | number | Daily closing price |

Primary key: `(date, code)`.
Sort order: `code`, then `date`.

