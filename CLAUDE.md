# DBGAPS 포트폴리오 자동화 대시보드

DB GAPS 대회용 ETF 포트폴리오 자동화 시스템. 팀이 선택한 ETF 조합과 운용 내역에 대해 성과 검증, 규칙 체크, 월간보고서 자료를 자동 생성한다.

## 기술 스택

- Python 3.12, pandas >= 2.0
- pykrx (ETF 일별 가격 수집 — update_prices.py 전용)
- matplotlib (정적 그래프 PNG 출력)
- 저장소: CSV 파일 (Git 관리)
- 배포: Railway (웹 대시보드, 기술스택 미결정)

## 디렉토리 구조

```
dbgaps_dashboard/
├── data/                   # 입력 데이터 (Git 관리)
│   ├── etf_master.csv      # ETF 188개 마스터 (raw_ticker, code, name, risk_type, asset_class)
│   ├── prices_daily.csv    # 일별 종가 (date, code, close) — pykrx로 업데이트
│   ├── trades.csv          # 매매일지 (date, code, side, quantity, price, amount, fee, memo)
│   └── sample_*.csv        # 테스트용 샘플 데이터
├── portfolios/             # 포트폴리오 비중 정의 (code, weight)
├── src/                    # 계산 엔진 — pandas만 있으면 동작
│   ├── metrics.py          # CAGR, MDD, Alpha, Beta, 연간변동성, 승률, 샤프, 칼마
│   ├── backtest.py         # 포트폴리오 백테스트 (드리프트 / 주기적 리밸런싱)
│   ├── portfolio.py        # 매매일지 기반 현재 보유 평가 (평가금액, 비중, 미실현손익)
│   ├── rules.py            # 대회 규칙 체크 (개별 ETF 20%, 위험자산 70%)
│   ├── turnover.py         # 회전율 (초기 누적 80%, 주간/월간 10%)
│   ├── update_prices.py    # pykrx → prices_daily.csv 증분 업데이트 (수집 전용)
│   ├── charts.py           # 그래프 생성 — phase-2에서 추가 예정
│   └── report_builder.py   # 월간보고서 Markdown 생성 — phase-3에서 추가 예정
├── output/                 # 계산 결과물 (Git 제외, 실행 시 자동 생성)
├── tests/                  # pytest 테스트
├── docs/                   # 설계 문서
├── phases/                 # Harness 실행 단계
└── scripts/                # execute.py 등 자동화 도구
```

## 데이터 흐름

```
pykrx → src/update_prices.py → data/prices_daily.csv
data/*.csv + portfolios/*.csv → src/ 계산 → output/
output/*.csv → 웹 대시보드 (읽기 전용)
```

## 개발 명령어

```bash
# 의존성 설치
pip install -r requirements.txt

# 가격 데이터 증분 업데이트
python src/update_prices.py

# 샘플 계산 엔진 전체 실행
cd src && python run_sample_engine.py

# 테스트 실행
python -m pytest tests/ -q

# Harness phase 실행 (ANTHROPIC_API_KEY 필요)
python scripts/execute.py <phase-dir>
# 예: python scripts/execute.py 0-foundation
```

## CRITICAL 규칙

### CRITICAL-1: 웹 대시보드는 src/를 직접 import하지 않는다

`web/` 또는 대시보드 코드는 `src/` 모듈을 절대 import하지 않는다.
반드시 `output/` 폴더의 CSV/JSON 파일을 읽는 방식으로만 데이터를 가져온다.

**이유**: 계산 엔진과 UI를 분리해야 Railway 배포 환경에서 계산 코드 없이 UI만 경량 동작할 수 있다.

### CRITICAL-2: 데이터 수집과 계산을 섞지 않는다

`update_prices.py`는 데이터 수집 전용이다.
`metrics.py`, `backtest.py`, `portfolio.py`, `rules.py`, `turnover.py`, `charts.py`에서
pykrx import나 네트워크 요청을 하면 안 된다.

**이유**: 가격 데이터가 없는 CI 환경 및 테스트에서도 계산 엔진이 독립 동작해야 한다.

## 일반 규칙

- `src/` 계산 모듈은 pandas만으로 동작해야 한다 (pykrx, requests 등 외부 의존성 없음)
- `output/` 폴더는 Git 제외 (실행할 때마다 재생성)
- 데이터 스키마는 `docs/data_schema.md` 참고
- 벤치마크 기본값: `069500` (KODEX 200)
- 무위험수익률 기본값: `0.0` (샤프지수 계산 시)
- 초기 투자금 기본값: `100_000_000` (1억원)
- 대회 규칙: 개별 ETF 20% 상한, 위험자산 70% 상한, 초기 회전율 80%, 주간/월간 회전율 10%
