"""Parse git log and write to data/CHANGELOG.json."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "CHANGELOG.json"
COMMIT_LIMIT = 50
FIELD_SEPARATOR = "\x1f"
RECORD_SEPARATOR = "\x1e"
AUTO_CHANGELOG_SUBJECT = "chore: update changelog"


def _parse_type(subject: str) -> str:
    match = re.match(r"^(feat|fix|chore|docs|refactor|style|test|perf)\b", subject)
    return match.group(1) if match else "update"


def _run_git_log() -> list[dict]:
    fmt = f"%H%x1f%as%x1f%s%x1f%b%x1e"
    env = os.environ.copy()
    env.update({
        "LC_ALL": "C.UTF-8",
        "LANG": "C.UTF-8",
    })
    result = subprocess.run(
        [
            "git",
            "-c",
            "i18n.logOutputEncoding=UTF-8",
            "log",
            "--encoding=UTF-8",
            f"--pretty=format:{fmt}",
            f"-{COMMIT_LIMIT}",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    if result.returncode != 0:
        return []

    entries = []
    for block in result.stdout.split(RECORD_SEPARATOR):
        block = block.strip()
        if not block:
            continue
        parts = block.split(FIELD_SEPARATOR, 3)
        if len(parts) < 3:
            continue
        commit_hash, date, subject = parts[0], parts[1], parts[2]
        subject = subject.strip()
        if subject == AUTO_CHANGELOG_SUBJECT:
            continue
        body = parts[3].strip() if len(parts) > 3 else ""
        entries.append({
            "hash": commit_hash[:8],
            "date": date,
            "subject": subject,
            "body": body,
            "type": _parse_type(subject),
        })
    return entries


def _render(entries: list[dict]) -> str:
    return json.dumps(entries, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate data/CHANGELOG.json from git log.")
    parser.add_argument("--check", action="store_true", help="Return non-zero when CHANGELOG.json is stale.")
    parser.add_argument("--quiet", action="store_true", help="Suppress success output.")
    args = parser.parse_args()

    entries = _run_git_log()
    rendered = _render(entries)

    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
        if current == rendered:
            if not args.quiet:
                print(f"{OUTPUT_PATH} is up to date")
            return 0
        if not args.quiet:
            print(f"{OUTPUT_PATH} is stale")
        return 1

    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    if not args.quiet:
        print(f"Wrote {len(entries)} entries to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
