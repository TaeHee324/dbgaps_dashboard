# Step 0: price-fetch

## 읽어야 할 파일

- `src/update_prices.py` — pykrx 기반 증분 업데이트 스크립트
- `data/etf_master.csv` — 188개 ETF 코드 목록
- `data/prices_daily.csv` — 현재 거의 비어있음 (17바이트)
- `docs/data_schema.md` — prices_daily.csv 스키마 (date, code, close)

## 작업

다음 순서로 실제 ETF 가격 데이터를 수집한다.

### 1. pykrx 설치 확인

```bash
python -c "from pykrx import stock; print('pykrx ok')"
```

### 2. 소규모 테스트 수집 (10개 ETF, 최근 1년)

```bash
python src/update_prices.py --start 2024-01-01 \
  --code 069500 --code 360750 --code 148070 --code 411060 \
  --code 122630 --code 251340 --code 133690 --code 273130 \
  --code 091160 --code 114800
```

수집 결과를 확인한 후 문제없으면 전체 수집으로 진행한다.

### 3. 전체 수집 (188개 ETF)

```bash
python src/update_prices.py --start 2020-01-01
```

188개 ETF 전체를 한 번에 수집한다. pykrx 서버 부하를 고려해
실패한 코드가 있으면 에러 메시지를 기록하고 `blocked` 상태로 표시한다.

## Acceptance Criteria

```bash
python -c "
import pandas as pd
df = pd.read_csv('data/prices_daily.csv')
print(f'rows: {len(df)}, codes: {df.code.nunique()}')
assert len(df) > 1000, 'too few rows'
assert df.code.nunique() > 10, 'too few codes'
print('ok')
"
```

1000행 초과, 코드 10개 초과여야 한다.

## 금지사항

- `data/etf_master.csv`를 수정하지 마라. 이유: 원본 ETF 마스터는 읽기 전용 입력이다.
- pykrx 수집이 실패하는 코드가 있으면 무시하고 넘어가라.
  이유: KRX 서버에 없는 ETF가 있을 수 있다.
- `src/update_prices.py` 로직을 수정하지 마라.
  이유: 이 step은 데이터 수집 실행이지 코드 수정이 아니다.

## 주의

pykrx 대량 수집 시 KRX 서버에서 차단될 수 있다.
수집 중 `ConnectionError`나 `HTTPError`가 발생하면 `blocked` 상태로 표시하고
사용자에게 잠시 후 재시도하도록 안내하라.
