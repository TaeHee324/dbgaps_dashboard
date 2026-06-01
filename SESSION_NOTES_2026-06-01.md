# 세션 노트 — 2026-06-01

## 논의 주제: 리스크 관리 탭 MDD/낙폭 지표 개선

---

## 1. 현재 상태 (문제 진단)

`api/routers/risk.py` `etf_analysis()` 엔드포인트의 `/etf-analysis` 응답:

| 컬럼 | 계산식 | 문제 |
|------|--------|------|
| `individual_mdd` | `drawdowns.min()` — DB 전체 기간 고점 기준 | 매수 전 역사까지 포함, 노이즈 |
| `current_drawdown` | `drawdowns.iloc[-1]` — DB 전체 기간 고점 기준 현재 낙폭 | 매수 전 고점 기준이라 의미 없음 |

**핵심 문제:** 오늘 매수한 종목이 역사적으로 MDD -30%인 상태면, 매수 직후부터 현재 낙폭이 -30%로 표시되어 경고 기능 무의미.

코드 위치: `api/routers/risk.py:231~241`

```python
individual_mdd = 0.0
current_drawdown = 0.0

if not price_pivot.empty and code in price_pivot.columns:
    closes = price_pivot[code].dropna()
    if len(closes) >= 2:
        rolling_max = closes.cummax()
        drawdowns = (closes - rolling_max) / rolling_max
        individual_mdd = float(drawdowns.min())        # DB 전체 기간 MDD
        current_drawdown = float(drawdowns.iloc[-1])   # DB 전체 기간 고점 대비 현재 낙폭
```

`price_pivot`은 `db.load_prices_from_db()`로 DB 전체 가격 이력을 불러온 후, 보유 ETF 코드만 필터링한 pivot 테이블.

---

## 2. 합의된 개선 방향

**세 컬럼으로 재구성:**

| # | 컬럼명 | 계산식 | 의미 |
|---|--------|--------|------|
| 1 | **역사적 MDD** | DB 전체 기간 `min(drawdowns)` (현재와 동일) | 이 ETF의 위험 예산 상한 |
| 2 | **MDD 소진율** | `매수가 대비 현재 낙폭 ÷ 역사적 MDD × 100` | 위험 예산을 얼마나 썼는가 |
| 3 | **매수가 대비 등락률** | `(현재가 - 평균매수가) / 평균매수가` | 직접적인 손익 기준 |

### MDD 소진율 동작 예시
```
역사적 MDD: -30%, 평균매수가: 10,000원

매수 직후:       MDD 소진율 0%,  매수가 대비 0.0%
→ 9,000원:      MDD 소진율 33%, 매수가 대비 -10.0%  (주의)
→ 8,000원:      MDD 소진율 67%, 매수가 대비 -20.0%  (황색 경고)
→ 7,000원:      MDD 소진율 100%, 매수가 대비 -30.0% (적색 경고)
```

### 색상 임계값 (제안)
- MDD 소진율 < 50%: 정상
- 50% ~ 79%: 황색 경고
- 80% 이상: 적색 경고

### 실무 근거
헤지펀드 리서치에서 확인된 관행:
> *"portfolios reduce position sizes by 20–40% when approaching 75% of historical maximum drawdown"*
— The Hedge Fund Journal

---

## 3. 구현 시 필요한 작업

### 백엔드 (`api/routers/risk.py`)
- `etf_analysis()` 수정
- `trade_log` DB에서 ETF별 **최초 매수일**과 **평균 매수가(FIFO)** 조회
- `price_pivot`을 최초 매수일 이후로 슬라이싱하여 "보유기간 MDD" 계산 (현재는 전체 기간)
- `매수가 대비 현재 낙폭` = `(현재가 - 평균매수가) / 평균매수가`
- `MDD 소진율` = `매수가 대비 현재 낙폭 / 역사적 MDD`
- `api/schemas.py` `EtfRiskItem` 모델 필드 추가

### 프론트엔드 (`frontend/`)
- `lib/hooks/dashboard.ts` 타입 업데이트
- 리스크 탭 ETF 분석 테이블 컬럼 교체
- MDD 소진율에 색상 임계값 적용

### 주의사항
- 역사적 MDD 분모는 DB 전체 기간 기준 → ETF마다 DB 데이터 시작일이 다르면 비교 기준 불일치 가능
- 나중에 "N년 기간 기준 MDD"로 통일 고려

---

## 4. 미결 사항

- [ ] MDD 소진율 임계값 수치 확정 (50%/80% 제안, 조정 가능)
- [ ] 실제 구현 시작
