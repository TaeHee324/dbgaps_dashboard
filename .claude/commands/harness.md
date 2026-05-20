# Harness Framework 워크플로우 가이드

이 문서는 Harness 프레임워크를 사용한 프로젝트 관리의 5단계 워크플로우를 설명합니다.

## 핵심 단계

**A. 탐색** — `/docs/` 하위의 PRD, ARCHITECTURE, ADR 등을 읽어 기획과 아키텍처를 파악합니다.

**B. 논의** — 구현 결정사항이 필요하면 사용자와 협의합니다.

**C. Step 설계** — 여러 단계로 나뉜 구현 계획 초안을 작성하고 피드백을 받습니다. 설계 원칙은 다음과 같습니다:

- 각 step은 하나의 레이어만 다룸 (scope 최소화)
- 각 step은 독립적으로 실행 가능해야 함 (자기완결성)
- 관련 문서와 파일 경로를 명시 (사전 준비)
- 함수 인터페이스만 제시, 구현은 에이전트 재량 (시그니처 수준)
- "실행 가능한 커맨드"로 검증 (AC)
- 금지사항은 "X를 하지 마라. 이유: Y" 형식 (구체성)

**D. 파일 생성** — 승인 후 다음 파일들을 생성합니다:

- `phases/index.json` — 전체 phase 현황
- `phases/{phase-dir}/index.json` — phase별 상세 및 step 목록
- `phases/{phase-dir}/step{N}.md` — 각 step의 구체적 지시사항

**E. 실행** — `execute.py`가 브랜치 생성, 가드레일 주입, 컨텍스트 누적, 자가 교정, 타임스탬프 기록을 자동으로 처리합니다.

```bash
# ANTHROPIC_API_KEY 환경변수 설정 후 실행
python scripts/execute.py <phase-dir>
python scripts/execute.py <phase-dir> --push
```
