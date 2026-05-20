# Step 1: data-validation

## 읽어야 할 파일

- `data/prices_daily.csv` — step 0에서 수집한 실제 가격 데이터
- `data/etf_master.csv` — ETF 마스터 (code 컬럼)
- `docs/data_schema.md` — 스키마 명세
- `tests/conftest.py` — 기존 픽스처

## 이전 step 산출물

- step 0: prices_daily.csv에 실제 ETF 가격 데이터 수집 완료

## 작업

`tests/test_data_quality.py`를 작성한다.

다음 항목을 검증한다:

```python
# 1. 스키마 검증
# prices_daily.csv에 date, code, close 컬럼이 있는지 확인
# date가 YYYY-MM-DD 형식인지 확인
# close가 양수인지 확인

# 2. etf_master.csv와 교차 검증
# prices_daily.csv의 code가 etf_master.csv의 code에 있는지 확인

# 3. 중복 검증
# (date, code) 조합이 중복되지 않는지 확인

# 4. 결측치 검증
# date, code, close에 NaN이 없는지 확인

# 5. 최소 행 수 검증
# 수집된 rows > 1000 확인
```

## Acceptance Criteria

```bash
python -m pytest tests/test_data_quality.py -v
```

모든 테스트 PASSED.

## 금지사항

- `prices_daily.csv`를 테스트에서 직접 수정하지 마라.
- `etf_master.csv`를 수정하지 마라.
- 테스트가 실패한다고 해서 `src/` 파일을 수정하지 마라.
  이유: 데이터 품질 문제는 update_prices.py 재실행으로 해결한다.
