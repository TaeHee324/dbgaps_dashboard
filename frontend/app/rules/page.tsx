"use client";

import { useLiveRules, type RulesResponse } from "@/lib/hooks/dashboard";

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function PassBadge({ passed }: { passed: boolean }) {
  const cls = passed
    ? "bg-successSoft text-success border-success/20"
    : "bg-dangerSoft text-danger border-danger/20";
  return (
    <span className={`inline-flex items-center rounded-pill border px-sm py-xxs text-xs font-semibold ${cls}`}>
      {passed ? "통과" : "위반"}
    </span>
  );
}

function WeightTable({ rules, isLoading }: { rules: RulesResponse; isLoading: boolean }) {
  if (isLoading) {
    return <div className="px-4 py-6 text-sm text-inkSecondary">불러오는 중...</div>;
  }
  if (!rules) {
    return <div className="px-4 py-6 text-sm text-inkSecondary">보유 종목 없음</div>;
  }

  const groupRows = rules.individual.filter((r) => r.code.startsWith("["));
  const etfRows = rules.individual.filter((r) => !r.code.startsWith("["));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surfaceMuted text-xs text-inkSecondary">
          <tr>
            {["구분", "자산군 / ETF", "비중 상한", "현재 비중", "상태"].map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr className="even:bg-surfaceMuted/40">
            <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">위험자산</td>
            <td className="px-3 py-2 text-ink">{rules.risk_asset.rule || "위험자산 합계"}</td>
            <td className="px-3 py-2 tabular-nums text-ink">{formatPct(rules.risk_asset.limit)}</td>
            <td className="px-3 py-2 tabular-nums text-ink">{formatPct(rules.risk_asset.risky_weight)}</td>
            <td className="px-3 py-2"><PassBadge passed={rules.risk_asset.passed} /></td>
          </tr>
          {groupRows.map((row) => (
            <tr key={row.code} className="even:bg-surfaceMuted/40">
              <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">자산군</td>
              <td className="px-3 py-2 text-ink">{row.code.replace(/[\[\]]/g, "")}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.limit)}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.current_weight)}</td>
              <td className="px-3 py-2"><PassBadge passed={row.passed} /></td>
            </tr>
          ))}
          {etfRows.length === 0 && groupRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-sm text-inkSecondary">
                보유 종목 없음
              </td>
            </tr>
          ) : null}
          {etfRows.map((row) => (
            <tr key={row.code} className="even:bg-surfaceMuted/40">
              <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">개별 ETF</td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs font-semibold text-primary mr-1">{row.code}</span>
                <span className="text-ink">{row.name}</span>
              </td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.limit)}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.current_weight)}</td>
              <td className="px-3 py-2"><PassBadge passed={row.passed} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RulesPage() {
  const { data: rules, isLoading } = useLiveRules();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">대회 룰</h1>

      {/* 1. 평가 구조 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">평가 구조</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">구분</th>
                <th className="px-3 py-2 text-left font-medium">비중</th>
                <th className="px-3 py-2 text-left font-medium">핵심 평가 관점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2 font-medium text-ink">수익률</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-ink">30점</td>
                <td className="px-3 py-2 text-ink">3개월 운용 결과, 상위권 진입 여부</td>
              </tr>
              <tr className="bg-surfaceMuted/40">
                <td className="px-3 py-2 font-medium text-ink">운용철학·과정 평가</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-ink">70점</td>
                <td className="px-3 py-2 text-ink">투자계획서, 월간 운용보고서, 최종 PT에서 드러나는 일관성·논리성·리스크 관리</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-border bg-surfaceMuted/30 px-4 py-3 text-xs text-inkSecondary">
          핵심은 단순히 높은 수익률이 아니라 <span className="font-semibold text-ink">왜 그렇게 투자했는지</span>, <span className="font-semibold text-ink">계획과 실제 운용이 일치했는지</span>, <span className="font-semibold text-ink">전망이 틀렸을 때 어떻게 분석하고 대응했는지</span>를 설명하는 것이다.
        </div>
      </div>

      {/* 2. 주요 일정 및 제출물 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">주요 일정 및 제출물</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">항목</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">일정 / 요건</th>
                <th className="px-3 py-2 text-left font-medium">체크 포인트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {([
                ["투자계획서 제출", "2026.5.11 ~ 2026.5.28", "DB GAPS 홈페이지 업로드"],
                ["대회 운용기간", "2026.6.1 ~ 2026.8.31", "MTS 기반 3개월 실전 운용"],
                ["초기 포트폴리오 설정", "2026.6.1 포함 5영업일 이내 (~2026.6.8)", "초기 누적 회전율 80% 이상 충족 필수"],
                ["운용보고서 제출", "6월·7월·8월 총 3회", "Word 4장 이상, 미제출·불성실 시 컷오프/감점"],
                ["PT 자료 제출", "2026.9.7", "계획서·운용보고서·실제 운용의 일관성 정리"],
                ["PT·토론", "2026.10.2 예정", "질의응답에서 투자 논리와 리스크 대응 설명"],
              ] as const).map(([item, date, note], i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surfaceMuted/40" : ""}>
                  <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{item}</td>
                  <td className="px-3 py-2 tabular-nums text-ink whitespace-nowrap">{date}</td>
                  <td className="px-3 py-2 text-ink">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 컷오프 및 주의 규칙 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">컷오프 및 주의 규칙</span>
        </div>
        <ul className="divide-y divide-border">
          {[
            "투자계획서를 기한 내 제출하지 않으면 대회 시작이 불가하다.",
            "포트폴리오는 팀장 계정으로만 설정할 수 있다.",
            "팀원은 팀장 계정으로 로그인 가능하나 동시접속은 불가하다.",
            "매매 결정은 팀 내 합의 후 팀장 계정을 통해 대표 실행하는 구조로 운영해야 한다.",
            "초기 포트폴리오 설정 기간(~2026.6.8) 내 누적 회전율 80% 이상 충족 필수.",
            "초기 설정 이후 매월 회전율 10% 이상 유지 필수.",
            "회전율 미충족, 운용보고서 미제출·불성실 보고는 컷오프 또는 감점 사유.",
            "개별 ETF 및 종목 티커별 편입 비중 상한 20%.",
            "위험자산 총합 편입 비중 상한 70%.",
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex-shrink-0 rounded border border-warning/30 bg-warningSoft px-1.5 py-0.5 text-xs font-semibold text-warning">
                주의
              </span>
              <span className="text-sm text-ink">{rule}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border bg-surfaceMuted/30 px-4 py-4">
          <div className="mb-2 text-xs font-semibold text-inkSecondary">회전율 정의</div>
          <div className="space-y-0.5 font-mono text-xs text-ink">
            <div>회전율 = (총 매매금액 / 평균 자산) × 100%</div>
            <div>평균 자산 = (기초자산 + 기말자산) / 2</div>
          </div>
          <div className="mt-2 text-xs text-inkSecondary">
            예: 평균 자산 10억, 매수 금액 8억 → 회전율 80%
          </div>
        </div>
      </div>

      {/* 4. 편입비중 상한 (정적 규정) */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">편입비중 상한</span>
        </div>
        <div className="border-b border-border px-4 py-4">
          <div className="mb-2 text-xs font-semibold text-inkSecondary">기본 원칙</div>
          <ul className="space-y-1.5 text-sm text-ink">
            <li>· 편입비중 상한은 초기 예수금 10억 기준이 아닌 <span className="font-semibold">전일 전체 NAV 기준</span>으로 계산한다.</li>
            <li>· 세부 자산별 합산 비중은 상위 자산군 상한을 넘을 수 없다.</li>
            <li>· 가격 변동으로 비중 상한 초과 시 컷오프는 없으나, 해당 비중을 낮추기 전까지 추가 매수가 제한되고 매도만 가능하다.</li>
            <li>· 개별 상품과 세부 자산군 상한이 동시에 적용될 경우 더 낮은 한도가 먼저 걸린다.</li>
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">구분</th>
                <th className="px-3 py-2 text-left font-medium">자산군</th>
                <th className="px-3 py-2 text-right font-medium">비중 상한</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {([
                ["개별 상품", "ETF / 종목 티커별", "20%"],
                ["상위 자산", "위험자산 총합", "70%"],
                ["상위 자산", "안전자산 총합", "100%"],
                ["위험자산", "국내주식_지수", "30%"],
                ["위험자산", "국내주식_섹터", "15%"],
                ["위험자산", "해외주식_지수", "30%"],
                ["위험자산", "해외주식_섹터", "10%"],
                ["위험자산", "FX 및 원자재", "20%"],
                ["안전자산", "국내채권_종합", "50%"],
                ["안전자산", "국내채권_회사채", "30%"],
                ["안전자산", "해외채권_종합", "50%"],
                ["안전자산", "해외채권_회사채", "30%"],
                ["안전자산", "금리연계형/초단기채권", "50%"],
              ] as const).map(([cat, asset, limit], i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surfaceMuted/40" : ""}>
                  <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">{cat}</td>
                  <td className="px-3 py-2 text-ink">{asset}</td>
                  <td className="px-3 py-2 tabular-nums text-right font-semibold text-ink">{limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border bg-surfaceMuted/30 px-4 py-3 text-xs text-inkSecondary">
          위험자산이 45% 편입된 상태라면, 해외주식_지수의 자체 상한(30%)이 남아 있어도 위험자산 총합 70% 한도 때문에 최대 25%까지만 추가 편입 가능.
        </div>
      </div>

      {/* 5. 편입비중 실시간 준수 현황 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">편입비중 — 실시간 준수 현황</span>
        </div>
        <WeightTable rules={rules ?? null} isLoading={isLoading} />
      </div>

      {/* 6. 위험배분 체크포인트 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">위험배분 체크포인트</span>
        </div>
        <div className="border-b border-border px-4 py-3 text-xs text-inkSecondary">
          자산배분(돈의 비중)과 위험배분(손실 가능성의 원천)은 다르다. 겉으로 분산된 것처럼 보여도 같은 위험 요인에 묶일 수 있다. 상품 이름보다 실제 손익을 움직이는 공통 위험 요인을 기준으로 비중을 점검한다.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">위험 요인</th>
                <th className="px-3 py-2 text-left font-medium">의미</th>
                <th className="px-3 py-2 text-left font-medium">점검 질문</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {([
                ["금리 리스크", "금리 상승·하락이 채권, 성장주, 환율에 미치는 영향", "금리 상승 시 손실이 한쪽으로 몰리는가?"],
                ["경기 리스크", "경기 둔화 또는 회복에 따른 주식·크레딧 민감도", "경기 침체 시 위험자산 비중이 과도한가?"],
                ["달러/환율 리스크", "해외자산, FX, 원자재 가격의 환율 민감도", "달러 강세·약세 중 어느 쪽에 베팅하고 있는가?"],
                ["인플레이션 리스크", "원자재, 금리, 실질소득, 기업마진 변화", "물가 재상승 시 방어 자산이 있는가?"],
                ["AI/기술주 집중 리스크", "반도체, 클라우드, 빅테크, 관련 회사채의 공통 노출", "상품은 달라도 같은 AI 테마에 묶여 있지 않은가?"],
                ["지정학 리스크", "중동 전쟁, 공급망 충격, 유가 변동 등", "유가·달러·위험회피 국면에 대한 대응이 있는가?"],
                ["상관관계 변화", "주식과 채권이 동시에 하락할 가능성", "기존 60/40식 분산이 실제로 작동한다고 가정하고 있지 않은가?"],
              ] as const).map(([factor, meaning, question], i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surfaceMuted/40" : ""}>
                  <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{factor}</td>
                  <td className="px-3 py-2 text-ink">{meaning}</td>
                  <td className="px-3 py-2 text-inkSecondary">{question}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. 운용 시 주의사항 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">운용 시 주의사항</span>
        </div>
        <ul className="divide-y divide-border">
          {[
            {
              title: "수익률보다 설명 가능한 운용을 우선할 것",
              body: "매수·매도할 때마다 ① 어떤 가설에 근거한 거래인가 ② 기존 투자계획서와 일치하는가 ③ 다음 운용보고서에서 설명할 수 있는가를 기록한다. 대회는 수익률 30점·과정 70점 구조이므로 설명 없는 고수익보다 설명 있는 중수익이 평가에서 유리하다.",
            },
            {
              title: "전망이 틀렸을 때의 대응 기준을 미리 정해 둘 것",
              body: "심사위원은 전망이 항상 맞기를 기대하기보다 틀렸을 때의 분석 능력을 본다. 투자계획서에 '어떤 조건에서 가설을 수정할지'를 명시해야 한다. 예: 금리 전망이 틀리면 채권 듀레이션·성장주 비중 조정 / 경기 둔화가 예상보다 빠르면 위험자산 비중 축소 / AI·반도체 쏠림이 과도해지면 관련 ETF·채권을 함께 점검.",
            },
            {
              title: "월간 운용보고서를 운용의 중심에 둘 것",
              body: "보고서에는 계획서 전망이 맞았는지·틀렸는지, 성과 차이가 자산배분·상품선택·시장변수 중 어디서 나왔는지, 포트폴리오를 바꿨다면 왜 바꿨는지, 다음 달 위험과 기회를 어떻게 설정할지가 포함되어야 한다. 6월 보고서에서 말한 위험을 7월 운용에서 무시하면 일관성 평가가 약해진다.",
            },
            {
              title: "회전율 규정을 억지 매매로 채우지 않을 것",
              body: "초기 회전율(80%)은 목표 포트폴리오 구성으로 자연스럽게 충족하고, 월 10%는 리밸런싱·위험 조정·전망 변화 대응으로 설명할 수 있어야 한다. '규정을 맞추기 위해 거래했다'는 설명은 보고서 평가에서 불리하다.",
            },
            {
              title: "편입비중 제한을 전략 설계 단계에서 먼저 반영할 것",
              body: "매수 전 ① 개별 ETF 20% 초과 여부 → ② 세부 자산군 상한 초과 여부 → ③ 위험자산 총합 70% 초과 여부 → ④ 안전자산이 실제 위험 완충 역할을 하는지 → ⑤ 서로 다른 상품이 같은 위험 요인에 묶여 있지 않은지 순서로 점검한다.",
            },
          ].map((item, i) => (
            <li key={i} className="px-4 py-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 text-xs font-semibold text-inkSecondary">{i + 1}.</span>
                <span className="text-sm font-semibold text-ink">{item.title}</span>
              </div>
              <p className="mt-1.5 pl-4 text-xs leading-relaxed text-inkSecondary">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* 8. 투자계획서·운용보고서·PT 평가 포인트 */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">투자계획서·운용보고서·PT 평가 포인트</span>
        </div>
        <div className="divide-y divide-border">
          <div className="px-4 py-4">
            <div className="mb-2 text-xs font-semibold text-inkSecondary">투자계획서</div>
            <ul className="space-y-1.5">
              {[
                "투자철학: 3개월 운용 원칙을 분명하게 제시한다.",
                "자산군별 전망: 각 자산군의 방향성뿐 아니라 주요 변수와 틀릴 가능성을 함께 쓴다.",
                "상품별 전략: 선택한 ETF가 전망·자산배분·위험배분과 어떻게 연결되는지 설명한다.",
                "리스크 관리: 손실 한도, 리밸런싱 기준, 위험 요인별 대응 계획을 포함한다.",
              ].map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink">
                  <span className="flex-shrink-0 text-inkSecondary">·</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 py-4">
            <div className="mb-2 text-xs font-semibold text-inkSecondary">운용보고서 (6·7·8월 각 1회)</div>
            <ul className="space-y-1.5">
              {[
                "수익률 자체 평가: 어떤 결과가 나왔고 왜 그렇게 되었는지 설명한다.",
                "전망 대비 차이 분석: 계획서의 예상과 실제 시장이 어떻게 달랐는지 쓴다.",
                "포트폴리오 변경 사유: 변경의 논리적 근거와 기대 효과를 남긴다.",
                "다음 달 전략: 어떤 위험은 줄이고 어떤 기회는 유지할지 제시한다.",
              ].map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink">
                  <span className="flex-shrink-0 text-inkSecondary">·</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 py-4">
            <div className="mb-2 text-xs font-semibold text-inkSecondary">PT·토론 (2026.10.2 예정)</div>
            <ul className="space-y-1.5">
              {[
                "투자계획서, 운용보고서, 실제 매매 내역이 하나의 논리로 연결되어야 한다.",
                "수익률을 만든 과정, 리스크를 인식한 방식, 대응의 타당성을 설명할 수 있어야 한다.",
                "전망이 맞은 경우뿐 아니라 틀린 경우의 원인 분석과 수정 과정을 보여줘야 한다.",
                "다른 리포트를 그대로 옮기기보다 팀의 판단으로 재구성한 근거와 차트를 제시해야 한다.",
              ].map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink">
                  <span className="flex-shrink-0 text-inkSecondary">·</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
