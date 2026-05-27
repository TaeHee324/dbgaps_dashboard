# 가격 데이터 영속성 수정 계획

> 이 문서는 새로운 세션에서 코드 작성 시 참고하기 위해 작성된 구현 가이드입니다.  
> **코드를 작성하기 전에 이 문서 전체를 읽어야 합니다.**

---

## 문제 요약

Railway 컨테이너는 **임시(ephemeral) 파일시스템**을 사용한다.  
"현재가 갱신" 버튼 클릭 시 런타임에 갱신된 `data/prices_daily.csv`와 `output/*.csv`는  
**GitHub push → Railway 리디플로이 시 git 커밋 상태로 리셋**된다.

```
갱신 버튼 클릭 → prices_daily.csv 갱신 (컨테이너 메모리 내) ✓
새 코드 push → Railway 리디플로이 → 파일 소멸 → 20일까지 데이터로 리셋 ✗
```

---

## 선택한 해결 전략

**PostgreSQL에 `prices_daily` 테이블 추가** (Railway Volume 방식 미채택)

이유:
- Railway Hobby Plan(5GB)은 Volume 지원하지만, `/app/data` 마운트 시 **볼륨이 빈 상태로 시작**되어 `etf_master.csv` 등 기존 파일이 가려지는 초기화 문제 발생
- 이미 PostgreSQL 운영 중이므로 아키텍처 일관성 유지
- 코드 변경 범위가 명확하고 테스트 가능

---

## 최종 변경 범위 (파일별)

### 1. Railway PostgreSQL — 테이블 생성 (코드 없음, SQL 직접 실행)

**Railway 콘솔 → PostgreSQL 서비스 → Query 탭에서 실행:**

```sql
CREATE TABLE prices_daily (
    date DATE        NOT NULL,
    code VARCHAR(6)  NOT NULL,
    close NUMERIC    NOT NULL,
    PRIMARY KEY (date, code)
);
```

**기존 CSV 데이터 마이그레이션 (1회성 스크립트 실행):**  
`scripts/migrate_prices_to_db.py` 파일을 새로 작성하여 1회 실행.  
역할: `data/prices_daily.csv` → `prices_daily` DB 테이블 일괄 upsert.

---

### 2. `db.py` — 가격 데이터 DB 함수 추가

**추가할 함수:**

```
load_prices_from_db() -> pd.DataFrame
    - SELECT date, code, close FROM prices_daily ORDER BY date, code
    - 반환: date(datetime), code(str, zfill 6), close(float) 컬럼을 가진 DataFrame
    - 빈 결과면 빈 DataFrame 반환 (예외 X)

get_max_date_by_code() -> dict[str, str]
    - SELECT code, MAX(date) FROM prices_daily GROUP BY code
    - 반환: {code: "YYYY-MM-DD"} 딕셔너리
    - update_prices.py의 증분 fetch를 위해 필요

upsert_prices(rows: list[dict]) -> None
    - rows: [{"date": "YYYY-MM-DD", "code": "xxxxxx", "close": float}, ...]
    - INSERT INTO prices_daily ON CONFLICT (date, code) DO UPDATE SET close = EXCLUDED.close
```

**주의:** `db.py`는 pykrx import 금지 (test_boundaries.py가 검사함).

---

### 3. `src/update_prices.py` — 저장 대상을 CSV→DB로 변경 + 병렬화

**변경 사항:**

1. `load_existing_prices(path)` 함수 → **제거 또는 유지(sample 용도 보존)**  
2. `next_start_date(existing, code, default_start)` → DB 기반 버전으로 교체  
   - `db.get_max_date_by_code()`를 호출해 각 code의 최신 날짜 조회  
3. `update_prices()` 함수 내 저장 부분  
   - 기존: `combined.to_csv(prices_path, ...)`  
   - 변경: `db.upsert_prices(fetched_rows)`  
4. **병렬화 추가:**  
   - `concurrent.futures.ThreadPoolExecutor(max_workers=5)` 사용  
   - KRX rate limit 고려해 max_workers=5 고정 (더 높이면 fetch 실패 가능)  
   - 각 코드별 fetch를 병렬 실행 후 결과를 모아 한 번에 upsert

**주의:** `run_sample_engine.py`는 `sample_prices_daily.csv`(CSV)를 계속 사용함.  
`update_prices.py`에서 CSV 경로 관련 인자를 제거하면 `--dry-run` CLI 옵션도 영향받으므로 확인 필요.

---

### 4. `src/backtest.py` — `load_prices()` 함수 보존

**변경 없음.** 이유:
- `run_sample_engine.py`가 `load_prices(DATA / "sample_prices_daily.csv")` 호출
- `export_backtest_summary()` 유틸 함수도 `load_prices()` 사용
- 테스트 픽스처(`conftest.py`의 `sample_prices`)도 CSV 기반

`load_prices(path)`는 CSV 읽기 용도로 그대로 유지.

---

### 5. `src/run_engine.py` — 가격 로드 경로 변경

**변경 대상 (main() 함수 내):**

```python
# 기존 (제거)
prices_path = DATA / "prices_daily.csv"
if not prices_path.exists() or prices_path.stat().st_size == 0:
    raise FileNotFoundError(...)
prices = load_prices(prices_path)

# 변경 후
prices = db.load_prices_from_db()
if prices.empty:
    print("prices_daily DB가 비어 있습니다. 먼저 migrate_prices_to_db.py를 실행하세요.")
    return  # 엔진 실행 중단 (Railway 시작 시 graceful skip)
```

**주의:** `import db` 는 이미 있음 (line 20). 추가 import 불필요.  
`load_prices` import는 `run_sample_engine.py`와 달리 제거 가능하지만,  
`benchmark_nav()`가 prices DataFrame을 직접 받으므로 경로 파라미터는 사용 안 함.

---

### 6. `api/routers/portfolios.py` — 두 군데 `load_prices()` 호출 변경

**호출 지점 1 (create_portfolio, line ~88~94):**

```python
# 기존
if PRICES_PATH.exists():
    _prices = load_prices(str(PRICES_PATH))

# 변경 후
import db as _db
_prices = _db.load_prices_from_db()
if not _prices.empty:
    # 이하 동일
```

**호출 지점 2 (POST /api/backtest, line ~241~248):**

```python
# 기존
from backtest import ..., load_prices, ...
prices = load_prices(PRICES_PATH)

# 변경 후
import db as _db
prices = _db.load_prices_from_db()
if prices.empty:
    raise HTTPException(status_code=503, detail="가격 데이터가 없습니다.")
```

**주의:** `portfolios.py`에서 `load_prices` import를 제거해도  
다른 backtest 함수들(`run_backtest`, `summarize_backtest` 등)은 여전히 import해야 함.  
`load_prices`만 제거하거나 import 라인을 수정할 것.

---

### 7. `railway.toml` — startCommand 수정

**변경 전:**
```toml
startCommand = "uvicorn api.main:app --host 0.0.0.0 --port $PORT"
```

**변경 후:**
```toml
startCommand = "python src/run_engine.py; uvicorn api.main:app --host 0.0.0.0 --port $PORT"
```

**`;` 사용 이유:** `&&` 대신 `;`를 쓰는 이유는, prices DB가 비어있는 경우 `run_engine.py`가  
조기 return(exit 0)하거나 exit 1을 낼 수 있으므로, uvicorn 시작이 차단되지 않도록 하기 위함.  
실제로 run_engine.py가 빈 DB에서 graceful return(exit 0)하도록 구현하면 `&&`도 가능.

**CLAUDE.md 경고 관련:** `run_sample_engine.py` 금지 경고는 `prices_daily.csv`(11행 샘플)로  
output/을 덮어쓰는 문제 때문이었음. `run_engine.py`는 DB에서 실제 데이터를 읽으므로 무관.

---

### 8. UI 피드백 개선 (`api/routers/dashboard.py` + `frontend/app/page.tsx`)

**백엔드 (`dashboard.py`):**

`_refresh_state` 딕셔너리에 `step` 필드 추가:

```python
# 기존
_refresh_state: dict = {"status": "idle", "updated_at": ""}

# 변경 후
_refresh_state: dict = {"status": "idle", "step": "", "updated_at": ""}
```

`_run_refresh()` 내부에서 각 subprocess 전후로 step 업데이트:

```python
_refresh_state = {"status": "running", "step": "fetching_prices", "updated_at": ""}
# ... subprocess update_prices.py 실행 ...
_refresh_state["step"] = "running_engine"
# ... subprocess run_engine.py 실행 ...
```

**프론트엔드 (`app/page.tsx`):**

현재 폴링 로직에서 `data.step`에 따라 메시지 분기:

| step | 표시 메시지 |
|------|-------------|
| `fetching_prices` | "1/2 가격 수집 중... (약 30~45초 소요)" |
| `running_engine` | "2/2 엔진 재계산 중..." |
| `done` | "갱신 완료" |
| `error` | "갱신 중 오류 발생" |

버튼 클릭 즉시(POST 전) 소요시간 안내 텍스트 표시:  
`"현재가 갱신은 약 30~45초 소요됩니다"`

---

## 작업 순서 (반드시 이 순서대로)

```
1. Railway 콘솔에서 prices_daily 테이블 생성 (SQL 직접)
2. scripts/migrate_prices_to_db.py 작성 → 로컬에서 실행 (기존 CSV → DB)
3. db.py — load_prices_from_db, get_max_date_by_code, upsert_prices 추가
4. src/update_prices.py — DB 저장 + 병렬화
5. src/run_engine.py — load_prices_from_db 사용
6. api/routers/portfolios.py — 두 군데 load_prices 교체
7. railway.toml — startCommand 수정
8. python -m pytest tests/ -q 로 테스트 통과 확인
9. api/routers/dashboard.py — step 필드 추가
10. frontend/app/page.tsx — 단계 메시지 + 소요시간 안내
11. output/ 재생성 (python src/run_engine.py 로컬 실행) → git add output/ → commit
12. git push → Railway 리디플로이 확인
```

---

## 주의사항 / 함정 목록

### ❌ 하지 말 것

- `load_prices(path)` 함수를 `backtest.py`에서 **제거하지 말 것**  
  → `run_sample_engine.py`, `export_backtest_summary()`, 테스트 픽스처가 사용 중

- `api/` 파일에서 pykrx import 추가하지 말 것  
  → `test_boundaries.py`가 AST로 감지해 테스트 실패

- `api/routers/dashboard.py`에서 `src/` import 추가하지 말 것  
  → CRITICAL-1 위반 (portfolios.py만 예외)

- `run_engine.py` 오류 시 exit 1로 내면 `&&` 체인에서 uvicorn 시작 안 됨  
  → prices 없을 때 graceful return (exit 0) 처리 필수

- `src/update_prices.py`에서 CSV 쓰기 코드를 완전히 제거하면  
  `--dry-run` CLI 옵션 동작 변경됨 → dry_run 처리 별도 확인

### ✅ 반드시 확인할 것

- `db.py`의 `load_prices_from_db()` 반환 DataFrame은 `date` 컬럼이  
  `pd.to_datetime` 변환된 상태여야 함 (backtest 엔진이 DatetimeIndex 가정)

- `get_max_date_by_code()`에서 날짜는 `date.isoformat()` 문자열로 반환  
  → `update_prices.py`의 `next_start_date` 비교 로직과 타입 맞출 것

- `portfolios.py`의 두 번째 호출 지점(POST /api/backtest)에서  
  prices가 비어있을 때 `HTTPException(503)` 처리 (현재는 파일 없으면 조용히 실패)

- `test_output_schema.py` 확인: 엔진 output CSV 컬럼 변경이 없으므로 통과 예상이나 확인 필수

- 병렬 fetch 후 DB upsert는 thread-safe하게 각 thread가 독립 DB 연결 사용할 것  
  (psycopg2 연결은 thread 간 공유 불가)

---

## 변경 후 데이터 흐름

```
pykrx → src/update_prices.py → PostgreSQL prices_daily  ← (영구 보존)
PostgreSQL prices_daily + PostgreSQL portfolios/trade_log + data/trades.csv
    → src/run_engine.py → output/*.csv  ← (배포마다 자동 재생성)
output/*.csv → api/ → frontend/
```

---

## 관련 CLAUDE.md SYNC 규칙 업데이트 필요

구현 완료 후 `CLAUDE.md`의 다음 항목 수정:
- **SYNC-8**: `src/update_prices.py → data/prices_daily.csv` → `src/update_prices.py → PostgreSQL prices_daily`
- `src/update_prices.py` 역할 설명에서 CSV 저장 부분 제거
- `run_engine.py` 역할 설명에서 `prices_daily.csv is missing` 체크 부분 제거
