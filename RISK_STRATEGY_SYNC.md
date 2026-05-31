# 리스크 관리 전략 → 대시보드 동기화 작업 목록

`docs/strategy/리스크관리전략.md` 기준과 현재 구현 사이의 모든 불일치를 정리한 작업 목록.

> **진행 상황 표기**  
> - [ ] 미완료  
> - [x] 완료  

---

## 1. 백엔드 (`api/routers/risk.py`)

### 1-1. HHI 집중도 레이블 기준 변경

- **파일**: `api/routers/risk.py`
- **위치**: line 164
- **현재 코드**:
  ```python
  hhi_label = "분산양호" if hhi < 0.10 else ("보통" if hhi < 0.18 else "집중경고")
  ```
- **변경 후**:
  ```python
  hhi_label = "분산양호" if hhi < 0.18 else ("보통" if hhi < 0.25 else "집중경고")
  ```
- **근거**: 문서 기준 — 정상 0.18 이하 / 경고 0.25 초과
- **부수 효과**: 프론트 `risk/page.tsx`의 HHI 바 게이지 상한이 이미 `0.25`로 맞춰져 있으므로 백엔드 레이블만 수정하면 바 게이지와 일치됨

- [x] 완료

---

## 2. 리스크 탭 (`frontend/app/risk/page.tsx`)

### 2-1. 연환산 변동성 단계 기준 변경

- **파일**: `frontend/app/risk/page.tsx`
- **위치**: `volStage()` 함수 (line ~94)
- **현재 코드**:
  ```tsx
  if (v < 0.15) return { label: "안정", color: C.success, bg: C.successBg };
  if (v < 0.25) return { label: "보통", color: C.warning, bg: C.warningBg };
  return { label: "높음", color: C.danger, bg: C.dangerBg };
  ```
- **변경 후**:
  ```tsx
  if (v < 0.25) return { label: "안정", color: C.success, bg: C.successBg };
  if (v < 0.30) return { label: "주의", color: C.warning, bg: C.warningBg };
  return { label: "경고", color: C.danger, bg: C.dangerBg };
  ```
- **근거**: 문서 기준 — 정상 25% 이하 / 경고 30% 초과

- [x] 완료

---

### 2-2. MDD 카드 단계 기준 수정

- **파일**: `frontend/app/risk/page.tsx`
- **위치**: `mddStage()` 함수 (line ~86)
- **현재 코드**:
  ```tsx
  if (a < 0.10) return { label: "정상", ... };
  if (a < 0.15) return { label: "경고", ... };
  if (a < 0.20) return { label: "위험", ... };
  return { label: "재검토", ... };
  ```
- **변경 후**:
  ```tsx
  if (a < 0.10) return { label: "정상", ... };
  if (a < 0.20) return { label: "경고", ... };
  return { label: "위험", ... };
  ```
- **근거**: 문서 기준 — -10% 이상 1차 점검 / -20% 이상 비중 축소. 문서에 -15% 중간 단계 없음

- [x] 완료

---

### 2-3. ETF 현재낙폭 셀 하이라이팅 기준 수정

- **파일**: `frontend/app/risk/page.tsx`
- **위치**: `drawdownCellStyle()` 함수 (line ~235) + 행 배경 (line ~369)
- **현재 코드**:
  ```tsx
  // drawdownCellStyle
  if (dd < -0.15) return { background: C.dangerBg, color: C.danger };
  if (dd < -0.10) return { background: C.warningBg, color: C.warning };

  // 행 배경
  const rowBg = item.current_drawdown < -0.15 ? "#FFF1F2" : "transparent";
  ```
- **변경 후**:
  ```tsx
  // drawdownCellStyle
  if (dd < -0.20) return { background: C.dangerBg, color: C.danger };
  if (dd < -0.10) return { background: C.warningBg, color: C.warning };

  // 행 배경
  const rowBg = item.current_drawdown < -0.20 ? "#FFF1F2" : "transparent";
  ```
- **근거**: 문서 기준 — -10%~-20% 1차 점검(노랑) / -20% 이상 비중 축소(빨강)

- [x] 완료

---

### 2-4. 목표비중 이탈폭 3단계 확장

- **파일**: `frontend/app/risk/page.tsx`
- **위치**: `driftCell()` 함수 (line ~241)
- **현재 코드** (2단계):
  ```tsx
  if (drift >= 0.05) return { text: `▲ ${pctP(drift)}`, color: C.danger };
  if (drift <= -0.05) return { text: `▼ ${pctP(drift)}`, color: C.warning };
  return { text: pctP(drift), color: C.inkSecondary };
  ```
- **변경 후** (3단계):
  ```tsx
  if (drift >= 0.05)  return { text: `▲ ${pctP(drift)}`, color: C.danger };   // 리밸런싱 후보
  if (drift <= -0.05) return { text: `▼ ${pctP(drift)}`, color: C.danger };
  if (Math.abs(drift) >= 0.03) return { text: pctP(drift), color: C.warning }; // 관찰 대상
  return { text: pctP(drift), color: C.inkSecondary };
  ```
- **근거**: 문서 기준 — ±3%p 이내 정상 / ±3~5%p 관찰 대상 / ±5%p 초과 리밸런싱 후보

- [x] 완료

---

### 2-5. 리밸런싱 배너 2단계 구분

- **파일**: `frontend/app/risk/page.tsx`
- **위치**: `RebalancingBanner` 컴포넌트 (line ~196)
- **현재 동작**: `Math.abs(weight_drift) >= 0.05` 조건 하나만 있음 — ±5%p 초과 시 단일 배너
- **변경 후**: ±3%p 이상이면 "관찰 대상", ±5%p 이상이면 "리밸런싱 후보"로 두 그룹 분리 표시
  ```tsx
  const rebalance = items.filter(x => x.weight_drift !== null && Math.abs(x.weight_drift!) >= 0.05);
  const observe  = items.filter(x => x.weight_drift !== null && Math.abs(x.weight_drift!) >= 0.03
                                    && Math.abs(x.weight_drift!) < 0.05);
  ```
- **근거**: 문서 기준 — ±3%p 관찰 대상 지정 / ±5%p 리밸런싱 후보

- [x] 완료

---

### 2-6. 위험기여도 기준 절대값으로 교체 (3단계)

- **파일**: `frontend/app/risk/page.tsx`
- **위치 A**: `RiskContributionBars` 컴포넌트 (line ~272)
- **위치 B**: ETF 리스크 테이블 `rcOverweight` 변수 (line ~373)
- **현재 코드** (상대 기준):
  ```tsx
  // A
  const over = item.current_weight > 0 && value > item.current_weight * 2;
  // B
  const rcOverweight = item.risk_contribution_pct !== null
    && item.current_weight > 0
    && item.risk_contribution_pct > item.current_weight * 2;
  ```
- **변경 후** (절대 기준 3단계):
  ```tsx
  // rc = risk_contribution_pct * 100 (퍼센트값)
  // A, B 공통 로직
  function rcStage(rc: number | null): "normal" | "watch" | "reduce" | "force" {
    if (rc === null) return "normal";
    if (rc > 0.55) return "force";   // 55% 초과: 원칙적 일부 축소
    if (rc > 0.45) return "reduce";  // 45% 초과: 비중 축소 검토
    if (rc > 0.35) return "watch";   // 35% 초과: 주의
    return "normal";
  }
  ```
- **근거**: 문서 기준 — 35% 이하 정상 / 45% 초과 비중 축소 검토 / 55% 초과 원칙적 일부 축소
- **주의**: 현재 "현재비중×2 초과" 방식은 절대 기준과 결과가 전혀 달라질 수 있음 (예: 비중 5%, RC 30% → 현재는 경고, 변경 후는 정상)

- [x] 완료

---

## 3. 비교 탭 (`frontend/app/comparison/page.tsx`)

### 3-1. 산점도 기본 축을 칼마-샤프 평면으로 변경

- **파일**: `frontend/app/comparison/page.tsx`
- **위치**: line 131~132
- **현재 코드**:
  ```tsx
  const [xKey, setXKey] = useState<MetricKey>("annual_volatility");
  const [yKey, setYKey] = useState<MetricKey>("cagr");
  ```
- **변경 후**:
  ```tsx
  const [xKey, setXKey] = useState<MetricKey>("sharpe");
  const [yKey, setYKey] = useState<MetricKey>("calmar");
  ```
- **근거**: 문서 섹션 5 — "위험-수익 분포 화면은 각 포트폴리오가 **칼마-샤프 평면**에서 어느 위치에 있는지를 한눈에 보여준다"

- [x] 완료

---

## 4. 매매일지 (`frontend/app/trades/page.tsx`)

### 4-1. 리스크 체크리스트 항목 기준 수정

- **파일**: `frontend/app/trades/page.tsx`
- **위치**: `RISK_OPTIONS` 상수 (line ~17)
- **현재 코드**:
  ```tsx
  const RISK_OPTIONS = [
    "개별 ETF 비중 20% 이내 확인",
    "위험자산 비중 70% 이내 확인",
    "단일 ETF 위험기여도 45% 이하",   // ← 경고 기준, 정상 기준은 35%
    "목표비중 이탈폭 ±5%p 이내",       // ← 리밸런싱 기준만, 관찰 기준 ±3%p 없음
    "분할매수·분할매도 원칙 준수",
  ] as const;
  ```
- **변경 후**:
  ```tsx
  const RISK_OPTIONS = [
    "개별 ETF 비중 20% 이내 확인",
    "위험자산 비중 70% 이내 확인",
    "단일 ETF 위험기여도 35% 이하 확인",   // 정상 기준(35%) 적용
    "단일 ETF 위험기여도 45% 이하 확인 (초과 시 비중 축소 검토)",  // 경고 기준 별도 항목
    "목표비중 이탈폭 ±3%p 이내 (초과 시 관찰 대상)",
    "목표비중 이탈폭 ±5%p 이내 (초과 시 리밸런싱 후보)",
    "분할매수·분할매도 원칙 준수",
  ] as const;
  ```
  > **대안**: 35%/45% 두 항목으로 분리하는 대신 단일 항목 텍스트만 "35% 이하(정상) / 45% 이하(검토)"로 수정하는 방식도 가능 — 팀과 협의 후 결정
- **근거**: 문서 기준 — 위험기여도 정상 35% / 이탈폭 ±3%p 관찰 / ±5%p 리밸런싱

- [x] 완료

---

## 5. 운용 대시보드 메인 (`frontend/components/ui/ActualOpsKpiStrip.tsx`)

### 5-1. MDD KPI 색상 단계별 반영

- **파일**: `frontend/components/ui/ActualOpsKpiStrip.tsx`
- **위치**: `valueColor()` 함수 (line ~31)
- **현재 코드**:
  ```tsx
  if (key === "mdd") return "#A4232B";  // 값에 무관하게 항상 빨강
  ```
- **변경 후**: MDD 절댓값에 따라 단계별 색상 적용
  ```tsx
  if (key === "mdd") {
    if (value === null || value === undefined) return "#46586B";
    const abs = Math.abs(value);
    if (abs < 0.10) return "#0F5132";  // 정상 — 초록
    if (abs < 0.20) return "#D97706";  // 경고 — 앰버
    return "#A4232B";                  // 위험 — 빨강
  }
  ```
- **근거**: MDD 0%에도 빨간색이 표시되는 것은 오해를 유발. 리스크 탭의 `mddStage()` 단계와 일관성 맞춤

- [x] 완료

### 5-2. 연환산 변동성 KPI 색상 단계별 반영

- **파일**: `frontend/components/ui/ActualOpsKpiStrip.tsx`
- **위치**: `valueColor()` 함수 (line ~31)
- **현재 코드**:
  ```tsx
  // annual_volatility는 else 분기 → 항상 고정 검정 반환
  return "#0B1B2C";
  ```
- **변경 후**: 연환산 변동성 값에 따라 단계별 색상 적용 (리스크 탭 `volStage()` 기준과 동일)
  ```tsx
  if (key === "annual_volatility" && value !== null && value !== undefined) {
    if (value < 0.25) return "#0B1B2C";  // 정상 — 기본 검정
    if (value < 0.30) return "#D97706";  // 주의 — 앰버
    return "#A4232B";                    // 경고 — 빨강
  }
  ```
- **근거**: 문서 기준 — 정상 25% 이하 / 경고 30% 초과. 리스크 탭 `volStage()` (2-1 항목) 기준과 일관성 맞춤. 현재 변동성이 30% 초과해도 메인 페이지에서 아무 시각 신호가 없음.

- [x] 완료

---

## 6. ETF 드로다운 차트 (`frontend/components/charts/EtfRiskLineChart.tsx`)

### 6-1. 드로다운 모드에서 손절 기준선 표시

- **파일**: `frontend/components/charts/EtfRiskLineChart.tsx`
- **변경 내용**: 드로다운 모드일 때 -10%, -20% 수평 점선 추가
  ```tsx
  if (isDrawdown) {
    const { LineStyle } = await import("lightweight-charts");
    series.createPriceLine({ price: -10, color: "#D97706", lineWidth: 1,
      lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "1차 점검" });
    series.createPriceLine({ price: -20, color: "#DC2626", lineWidth: 1,
      lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "비중 축소" });
  }
  ```
- **근거**: 문서 섹션 4 — -10%~-20% 1차 점검 / -20% 이상 비중 축소 집행

- [x] **완료** (2026-05-31)

---

## 변경 범위 요약

| # | 파일 | 항목 | 상태 |
|---|------|------|------|
| 1-1 | `api/routers/risk.py` | HHI 레이블 기준 `0.10/0.18` → `0.18/0.25` | [x] |
| 2-1 | `risk/page.tsx` | `volStage()` 임계값 `0.15/0.25` → `0.25/0.30` | [x] |
| 2-2 | `risk/page.tsx` | `mddStage()` 중간 단계 `-0.15` → `-0.20` 제거 | [x] |
| 2-3 | `risk/page.tsx` | `drawdownCellStyle()` + 행 배경 `-0.15` → `-0.20` | [x] |
| 2-4 | `risk/page.tsx` | `driftCell()` 2단계 → 3단계 (±3%p 관찰 추가) | [x] |
| 2-5 | `risk/page.tsx` | `RebalancingBanner` 관찰/리밸런싱 2단계 구분 | [x] |
| 2-6 | `risk/page.tsx` | 위험기여도 기준 상대값 → 절대값 35%/45%/55% | [x] |
| 3-1 | `comparison/page.tsx` | 산점도 기본 축 → `sharpe` / `calmar` | [x] |
| 4-1 | `trades/page.tsx` | `RISK_OPTIONS` 위험기여도·이탈폭 기준 수정 | [x] |
| 5-1 | `ActualOpsKpiStrip.tsx` | MDD 색상 고정 빨강 → 단계별 색상 | [x] |
| 5-2 | `ActualOpsKpiStrip.tsx` | 연환산 변동성 색상 고정 검정 → 단계별 색상 | [x] |
| 6-1 | `EtfRiskLineChart.tsx` | 드로다운 차트 -10%/-20% 기준선 추가 | [x] |

---

## 작업 시 주의사항

- **2-6 위험기여도 기준 변경**: 상대 기준(현재비중×2)에서 절대 기준(35%/45%/55%)으로 바뀌므로, 기존에 경고 표시되던 ETF가 정상으로 바뀌거나 반대의 결과가 나올 수 있음. 변경 후 실데이터로 시각 확인 필요.
- **4-1 체크리스트 항목 분리**: `as const`로 선언된 `RISK_OPTIONS`를 변경하면 기존에 저장된 `strategy_checklist` DB 레코드의 문자열과 불일치 발생. 기존 데이터는 히스토리로 유지되며 새 항목 체크에만 영향. 마이그레이션 불필요.
- **수정 순서 권장**: `risk/page.tsx` 항목(2-1~2-6)을 묶어서 처리하면 한 파일을 한 번만 열면 됨.
