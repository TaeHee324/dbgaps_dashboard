# ETF Investment OS Reference Repositories

이 문서는 PRD 기준으로 나중에 순서대로 확인할 GitHub 참고 저장소를 정리한 목록이다.

## 1. 전체 아키텍처

### OpenBB Terminal / Platform

- Repository: https://github.com/OpenBB-finance/OpenBB
- 참고 목적: 투자 리서치 플랫폼의 전체 구조 설계
- 중점 확인 영역:
  - 데이터 레이어
  - provider abstraction
  - portfolio module
  - metrics module
  - CLI 구조
  - report pipeline

검토 포인트:

```text
openbb_platform/
 ├── providers/
 ├── portfolio/
 ├── quantitative/
 ├── charts/
 ├── report/
 └── cli/
```

ETF DB, 백테스트, 규칙 체크, 보고서 생성을 서로 분리하는 방식 참고.

## 2. 백테스트 엔진 구조

### Backtrader

- Repository: https://github.com/mementum/backtrader
- 참고 목적: 백테스트 엔진의 생명주기와 분석 구조
- 중점 확인 영역:
  - Strategy abstraction
  - Broker model
  - Analyzer
  - Observer
  - rebalance logic
  - portfolio lifecycle

드리프트 리밸런싱, 회전율 계산, 거래비용 처리 설계 시 참고.

### bt Framework

- Repository: https://github.com/pmorissette/bt
- 참고 목적: ETF 포트폴리오 및 weight 기반 리밸런싱 구조
- 중점 확인 영역:
  - 월간 실행 로직
  - 종목 선택
  - 지정 비중 적용
  - 리밸런싱 실행

예시 구조:

```python
bt.algos.RunMonthly()
bt.algos.SelectAll()
bt.algos.WeighSpecified()
bt.algos.Rebalance()
```

ETF 대회형 포트폴리오 운용 구조와 가장 직접적으로 유사함.

## 3. 성과지표 계산

### QuantStats

- Repository: https://github.com/ranaroussi/quantstats
- 참고 목적: 성과지표 계산과 리포트 자동화
- 중점 확인 파일:
  - `metrics.py`
  - `reports.py`
  - `plots.py`

참고할 지표:

- CAGR
- Sharpe
- Sortino
- Calmar
- MDD
- rolling stats

지표 계산 방식, edge case 처리, 리포트 생성 방식을 확인.

### Pyfolio

- Repository: https://github.com/quantopian/pyfolio
- 참고 목적: tear sheet 기반 성과분석 리포트 구조
- 중점 확인 영역:
  - full tear sheet 생성
  - drawdown analysis
  - factor exposure
  - 성과분석 리포트 구성

핵심 개념:

```python
create_full_tear_sheet()
```

월간 보고서 자동화 구조 참고.

## 4. ETF 및 포트폴리오 분석

### Portfolio Analysis Projects

- Topic: https://github.com/topics/portfolio-analysis
- 참고 목적: 포트폴리오 비교, 벤치마크 비교, 자산배분 시각화 사례 조사
- 중점 확인 영역:
  - ETF allocation
  - efficient frontier
  - asset allocation
  - benchmark comparison
  - 월별 수익률 heatmap

후보 포트폴리오 비교 화면과 분석 기능 참고.

## 5. 월간 리포트 자동생성

### Jupyter nbconvert

- Repository: https://github.com/jupyter/nbconvert
- 참고 목적: 분석 결과를 Markdown, HTML, PDF 등으로 변환하는 파이프라인
- 추천 구조:

```text
Python 분석
 -> Jinja2 Template
 -> Markdown 생성
 -> PDF export
```

초기에는 PDF보다 Markdown 보고서 생성을 우선하는 것이 안정적.

### Jinja2

- Repository: https://github.com/pallets/jinja
- 참고 목적: 월간 보고서 템플릿 자동 생성
- 예시:

```markdown
# 월간 성과보고

수익률: {{ return_pct }}
MDD: {{ mdd }}
샤프: {{ sharpe }}
```

성과지표, 규칙 위반 내역, 포트폴리오 변경사항을 템플릿에 주입하는 방식 참고.

## 6. 데이터 파이프라인

### yfinance

- Repository: https://github.com/ranaroussi/yfinance
- 참고 목적: 해외 ETF, 벤치마크, 금리, 환율 데이터 수집
- 중점 확인 영역:
  - price history
  - ticker metadata
  - benchmark data

### PyKRX

- Repository: https://github.com/sharebook-kr/pykrx
- 참고 목적: 국내 ETF 및 한국 시장 데이터 수집
- 중점 확인 영역:
  - ETF OHLCV
  - KOSPI
  - 거래대금
  - 시가총액

대회용 데이터 소스의 핵심 후보.

## 7. 웹 대시보드

### Streamlit

- Repository: https://github.com/streamlit/streamlit
- 참고 목적: 빠른 MVP 대시보드 구현
- 중점 확인 영역:
  - `st.metric()`
  - `st.line_chart()`
  - `st.dataframe()`

포트폴리오 비중, 리스크 규칙, 성과지표 카드 구현에 적합.

### Plotly Dash

- Repository: https://github.com/plotly/dash
- 참고 목적: 더 복잡한 대시보드와 상호작용 구현
- 고려사항:
  - Streamlit보다 구조가 복잡함
  - 고급 UI와 callback 중심 인터랙션에 유리함

## 핵심 추천 TOP 5

| 목적 | 추천 |
| --- | --- |
| 전체 구조 | OpenBB |
| ETF 리밸런싱 | bt |
| 성과지표 | QuantStats |
| 리포트 생성 | Pyfolio |
| 웹 MVP | Streamlit |

## PRD 기준 추천 구조

```text
data/
 ├── etf_master.csv
 ├── prices/
 ├── benchmark/
 └── trades/

core/
 ├── loader/
 ├── backtest/
 ├── metrics/
 ├── rules/
 ├── turnover/
 └── report/

dashboard/
 ├── streamlit_app.py
 └── charts/

reports/
 ├── templates/
 └── monthly/

tests/
```

## 설계 시 특히 주의할 점

### 1. 모듈 분리

초기부터 백테스트, metrics, 규칙 체크, 보고서 생성을 분리한다.
OpenBB 구조를 참고해 데이터 수집, 분석, 리포트, UI 계층을 섞지 않는다.

### 2. 회전율 정의

회전율은 초기에 정의를 분리한다.

- cumulative turnover
- rebalance turnover
- actual trade turnover

거래비용, 리밸런싱, 매매일지 회계 시스템과 직접 연결되므로 나중에 바꾸기 어렵다.

### 3. Markdown 기반 보고서

초기에는 PDF 생성보다 Markdown 보고서를 우선한다.

```text
Markdown
 -> GitHub preview
 -> PDF export
```

이 흐름이 자동화와 검증에 더 안정적이다.

## 현재 프로젝트와 가장 가까운 제품 이미지

이 프로젝트는 단순 백테스트 툴보다 다음 제품들을 ETF 대회 운영에 맞게 경량화한 형태에 가깝다.

- OpenBB
- QuantStats
- Ghostfolio
- PortfolioVisualizer

핵심은 백테스트 정확도뿐 아니라 구조 설계, 데이터 파이프라인, 규칙 검증, 성과분석, 보고서 자동화를 하나의 운영 흐름으로 묶는 것이다.

## 다음 설계 질문

1. PRD 기준으로 디렉토리 구조와 모듈 경계를 어떻게 설계하면 나중에 꼬이지 않을까?
2. ETF 리밸런싱과 회전율 계산 로직은 어떤 방식으로 설계해야 실전에서도 안정적으로 동작할까?
3. Streamlit과 FastAPI + React 구조 중 현재 단계에서는 어느 쪽이 더 적절할까?
