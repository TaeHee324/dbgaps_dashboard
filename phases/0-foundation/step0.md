# Step 0: requirements-setup

## 읽어야 할 파일

- `requirements.txt` — 현재 `pandas>=2.0`만 있음
- `src/update_prices.py` — pykrx를 사용하는 유일한 모듈
- `src/backtest.py`, `src/metrics.py` — pandas만 사용함을 확인

## 작업

`requirements.txt`에 다음 의존성을 추가한다:

```
pykrx>=1.0.0
pytest>=8.0
matplotlib>=3.8
```

추가 후 `pip install -r requirements.txt`를 실행해 설치를 확인한다.

## Acceptance Criteria

```bash
pip install -r requirements.txt
python -c "import pandas, pykrx, pytest, matplotlib; print('all ok')"
```

두 커맨드가 에러 없이 통과하면 완료.

## 금지사항

- `src/` 파일을 수정하지 마라. 이 step은 의존성 설정만 다룬다.
- pykrx를 `src/metrics.py`, `src/backtest.py` 등 계산 모듈에 import하지 마라.
  이유: CRITICAL-2 위반 — 계산 모듈은 pandas만 의존해야 한다.
