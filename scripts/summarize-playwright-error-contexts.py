#!/usr/bin/env python3
"""Append Playwright error-context summary to GitHub step summary."""

from __future__ import annotations

import argparse
import glob
import os
from pathlib import Path
from typing import Iterable


def discover_context_files() -> list[Path]:
    patterns = [
        "dist/.playwright/apps/frontend-e2e/test-output/**/error-context.md",
        "test-results/**/error-context.md",
    ]
    matches: set[Path] = set()
    for pattern in patterns:
        for match in glob.glob(pattern, recursive=True):
            matches.add(Path(match))
    return sorted(matches)


def sanitize_markdown_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()


def infer_case_name(file_path: Path) -> str:
    parent_name = file_path.parent.name
    return parent_name or "unknown"


def first_failure_line(lines: Iterable[str]) -> str:
    cleaned = [line.strip() for line in lines if line.strip()]

    priority_prefixes = ("Error:", "TimeoutError:", "AssertionError:")
    for line in cleaned:
        if line.startswith(priority_prefixes):
            return line

    for line in cleaned:
        if "timed out" in line.lower() or "expected" in line.lower():
            return line

    return cleaned[0] if cleaned else "No content"


def append_summary(label: str, context_files: list[Path]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write(f"## Playwright error contexts ({label})\n\n")
        if not context_files:
            handle.write("- No `error-context.md` files were found.\n")
            return

        handle.write(f"- Found **{len(context_files)}** error-context file(s).\n\n")
        handle.write("| Context file | Inferred case | First failure line |\n")
        handle.write("|---|---|---|\n")

        for context_file in context_files:
            try:
                content = context_file.read_text(encoding="utf-8")
            except Exception as exc:  # noqa: BLE001
                failure = f"Unable to read file: {exc}"
            else:
                failure = first_failure_line(content.splitlines())

            context_cell = sanitize_markdown_cell(context_file.as_posix())
            case_cell = sanitize_markdown_cell(infer_case_name(context_file))
            failure_cell = sanitize_markdown_cell(failure)
            handle.write(
                f"| `{context_cell}` | `{case_cell}` | {failure_cell} |\n"
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="run", help="Label in summary header")
    args = parser.parse_args()

    context_files = discover_context_files()
    append_summary(args.label, context_files)


if __name__ == "__main__":
    main()
