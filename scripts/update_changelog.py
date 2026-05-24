"""Parse git log and write to data/CHANGELOG.json. Run before git push."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "CHANGELOG.json"
COMMIT_LIMIT = 50
SEPARATOR = "---COMMIT_END---"


def _parse_type(subject: str) -> str:
    match = re.match(r"^(feat|fix|chore|docs|refactor|style|test|perf)\b", subject)
    return match.group(1) if match else "update"


def _run_git_log() -> list[dict]:
    fmt = f"%H|%as|%s|%b{SEPARATOR}"
    result = subprocess.run(
        ["git", "log", f"--pretty=format:{fmt}", f"-{COMMIT_LIMIT}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        return []

    entries = []
    for block in result.stdout.split(SEPARATOR):
        block = block.strip()
        if not block:
            continue
        parts = block.split("|", 3)
        if len(parts) < 3:
            continue
        commit_hash, date, subject = parts[0], parts[1], parts[2]
        body = parts[3].strip() if len(parts) > 3 else ""
        entries.append({
            "hash": commit_hash[:8],
            "date": date,
            "subject": subject.strip(),
            "body": body,
            "type": _parse_type(subject.strip()),
        })
    return entries


def main() -> None:
    entries = _run_git_log()
    OUTPUT_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} entries to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
