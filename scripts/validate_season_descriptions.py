#!/usr/bin/env python3
"""Validate the bilingual season conclusion catalog."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESCRIPTION_PATH = ROOT / "lib" / "season-description.ts"
MINIMUM_CONCLUSIONS_PER_LANGUAGE = 38
REMOVED_UA_TEXT = (
    "Були хороші матчі й надто багато таких, які хочеться забути. "
    "Середина таблиці справедлива для команди без тривалої серії форми."
)
REPLACEMENT_UA_TEXT = (
    "Команда зависла між амбіціями й реальністю: місцями було цікаво, "
    "але таблиця не пробачає пауз у грі."
)
REPLACEMENT_EN_TEXT = (
    "A season caught between ambition and reality: bright spells were there, "
    "but the table rarely rewards inconsistency."
)


def main() -> None:
    source = DESCRIPTION_PATH.read_text(encoding="utf-8")
    defaults_source = source.split("const ukrainianSpecials", maxsplit=1)[0]
    pairs = re.findall(
        r'en:\s*"([^"]+)",\s+ua:\s*"([^"]+)",',
        defaults_source,
        flags=re.DOTALL,
    )
    english = [pair[0] for pair in pairs]
    ukrainian = [pair[1] for pair in pairs]

    if len(pairs) < MINIMUM_CONCLUSIONS_PER_LANGUAGE:
        raise SystemExit(
            f"Expected at least {MINIMUM_CONCLUSIONS_PER_LANGUAGE} bilingual "
            f"conclusions, found {len(pairs)}"
        )
    if len(english) != len(set(english)) or len(ukrainian) != len(set(ukrainian)):
        raise SystemExit("Season conclusion catalog contains duplicate text")
    if any(re.search(r"[А-Яа-яІіЇїЄєҐґ]", text) for text in english):
        raise SystemExit("English conclusion catalog contains Ukrainian text")
    if any(not re.search(r"[А-Яа-яІіЇїЄєҐґ]", text) for text in ukrainian):
        raise SystemExit("Ukrainian conclusion catalog contains non-Ukrainian text")
    if REMOVED_UA_TEXT in source:
        raise SystemExit("Weak Ukrainian mid-table conclusion still exists")
    if REPLACEMENT_UA_TEXT not in source or REPLACEMENT_EN_TEXT not in source:
        raise SystemExit("Required mid-table replacement is missing")

    print(
        f"Season description validation passed: {len(pairs)} English and "
        f"{len(pairs)} Ukrainian conclusions"
    )


if __name__ == "__main__":
    main()
