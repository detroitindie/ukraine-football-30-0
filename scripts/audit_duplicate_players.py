#!/usr/bin/env python3
"""Audit and conservatively merge transliteration duplicates in player data."""

from __future__ import annotations

import argparse
import csv
import math
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from itertools import combinations
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_CSV = ROOT / "exports" / "club_decade_players.csv"
AUDIT_DIR = ROOT / "data-audit" / "patch-1-2a"
CANDIDATES_CSV = AUDIT_DIR / "duplicate_players_candidates.csv"
AUTO_FIXED_CSV = AUDIT_DIR / "duplicate_players_auto_fixed.csv"
MANUAL_REVIEW_CSV = AUDIT_DIR / "duplicate_players_manual_review.csv"
SUMMARY_MD = AUDIT_DIR / "duplicate_players_summary.md"

PLAYER_ID_SUFFIX = re.compile(r"\s+\(\d+\)$")
FUZZY_THRESHOLD = 0.82

# Every automatic merge is explicitly reviewed. Detection can suggest new pairs,
# but a fuzzy match alone is never sufficient to delete a player row.
REVIEWED_IDENTITIES = {
    frozenset(("Sergiy Dolganskyi", "Serhiy Dolhanskyi")): "Serhiy Dolhanskyi",
    frozenset(("Igor Khudobyak", "Ihor Khudobyak")): "Ihor Khudobiak",
    frozenset(("Oleksandr Goryainov", "Oleksandr Horyainov")): "Oleksandr Horyainov",
    frozenset(("Igor Kogut", "Ihor Kohut")): "Ihor Kohut",
    frozenset(("Oleg Golodyuk", "Oleh Holodyuk")): "Oleh Holodyuk",
    frozenset(("Roman Litovchak", "Roman Lytovchak")): "Roman Lytovchak",
    frozenset(("Oleksiy Gay", "Oleksiy Hai")): "Oleksiy Hai",
    frozenset(("Sergiy Valyaev", "Serhiy Valyayev")): "Serhiy Valyayev",
}

SOURCE_STAT_FIELDS = (
    "seasons_count",
    "rows_count",
    "goals",
    "assists",
    "clean_sheets",
    "goals_conceded",
    "yellow_cards",
    "direct_red_cards",
    "penalty_goals",
    "minutes_played",
)
PRESERVABLE_FIELDS = SOURCE_STAT_FIELDS + (
    "citizenship",
    "raw_score",
    "local_rating",
    "global_rating",
    "global_percentile",
    "hidden_modifier",
    "effective_global_rating",
)
RATING_FIELDS = (
    "local_rating",
    "global_rating",
    "effective_global_rating",
)

CANDIDATE_FIELDS = [
    "decision",
    "confidence",
    "club_decade_id",
    "team_name",
    "decade",
    "name_a",
    "player_id_a",
    "position_a",
    "rating_a",
    "name_b",
    "player_id_b",
    "position_b",
    "rating_b",
    "normalized_a",
    "normalized_b",
    "transliteration_key_a",
    "transliteration_key_b",
    "similarity",
    "levenshtein_distance",
    "detection_reason",
]

AUTO_FIXED_FIELDS = [
    "club_decade_id",
    "team_name",
    "decade",
    "canonical_name",
    "kept_player_id",
    "kept_original_name",
    "removed_player_id",
    "removed_name",
    "kept_rating",
    "removed_rating",
    "rating_decision",
    "preserved_fields",
    "merge_reason",
]


def display_name(value: str) -> str:
    return PLAYER_ID_SUFFIX.sub("", (value or "").strip())


def normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character)
    )
    words = re.sub(r"[^a-z]+", " ", without_marks.casefold())
    return " ".join(words.split())


def transliteration_key(value: str) -> str:
    """Fold common Ukrainian/Russian English transliteration alternatives."""
    folded = normalize_name(value).replace(" ", "")
    replacements = (
        ("shch", "sc"),
        ("kh", "h"),
        ("skyi", "ski"),
        ("sky", "ski"),
        ("yi", "i"),
        ("iy", "i"),
        ("ii", "i"),
        ("g", "h"),
        ("y", "i"),
    )
    for source, target in replacements:
        folded = folded.replace(source, target)
    return folded


def levenshtein(left: str, right: str) -> int:
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for left_index, left_character in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_character in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[right_index] + 1,
                    previous[right_index - 1]
                    + (left_character != right_character),
                )
            )
        previous = current
    return previous[-1]


def read_players() -> tuple[list[dict[str, str]], list[str]]:
    with PLAYERS_CSV.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        return list(reader), list(reader.fieldnames or [])


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def has_value(value: str | None) -> bool:
    return bool((value or "").strip()) and (value or "").strip().casefold() not in {
        "nan",
        "null",
        "none",
    }


def numeric_value(value: str | None) -> float | None:
    try:
        number = float((value or "").strip())
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def positions_compatible(left: dict[str, str], right: dict[str, str]) -> bool:
    if left.get("game_position") == right.get("game_position"):
        return True
    return bool(
        left.get("main_position")
        and left.get("main_position") == right.get("main_position")
    )


def support_score(row: dict[str, str]) -> tuple[int, float, int]:
    populated_stats = sum(has_value(row.get(field)) for field in SOURCE_STAT_FIELDS)
    minutes = numeric_value(row.get("minutes_played")) or 0
    has_citizenship = int(has_value(row.get("citizenship")))
    return populated_stats, minutes, has_citizenship


def rating(row: dict[str, str]) -> str:
    return (row.get("effective_global_rating") or "").strip()


def candidate_row(
    left: dict[str, str],
    right: dict[str, str],
) -> dict[str, Any] | None:
    if not positions_compatible(left, right):
        return None

    left_name = display_name(left.get("player_name", ""))
    right_name = display_name(right.get("player_name", ""))
    if not left_name or not right_name or left_name == right_name:
        return None

    left_key = transliteration_key(left_name)
    right_key = transliteration_key(right_name)
    similarity = SequenceMatcher(None, left_key, right_key).ratio()
    distance = levenshtein(left_key, right_key)
    reviewed_key = frozenset((left_name, right_name))
    canonical_name = REVIEWED_IDENTITIES.get(reviewed_key)

    if left_key == right_key:
        detection_reason = "same transliteration key"
    elif similarity >= FUZZY_THRESHOLD:
        detection_reason = f"fuzzy similarity >= {FUZZY_THRESHOLD:.2f}"
    elif canonical_name:
        detection_reason = "explicitly reviewed transliteration pair"
    else:
        return None

    if canonical_name:
        decision = "auto_fix"
        confidence = "high"
    else:
        decision = "manual_review"
        confidence = "medium" if similarity >= 0.90 else "low"

    return {
        "decision": decision,
        "confidence": confidence,
        "club_decade_id": left["club_decade_id"],
        "team_name": left["team_name"],
        "decade": left["decade"],
        "name_a": left_name,
        "player_id_a": left["player_id"],
        "position_a": left["position"],
        "rating_a": rating(left),
        "name_b": right_name,
        "player_id_b": right["player_id"],
        "position_b": right["position"],
        "rating_b": rating(right),
        "normalized_a": normalize_name(left_name),
        "normalized_b": normalize_name(right_name),
        "transliteration_key_a": left_key,
        "transliteration_key_b": right_key,
        "similarity": f"{similarity:.3f}",
        "levenshtein_distance": distance,
        "detection_reason": detection_reason,
        "_left": left,
        "_right": right,
        "_canonical_name": canonical_name,
    }


def find_candidates(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["club_decade_id"]].append(row)

    candidates = []
    for club_decade_rows in grouped.values():
        for left, right in combinations(club_decade_rows, 2):
            candidate = candidate_row(left, right)
            if candidate:
                candidates.append(candidate)

    return sorted(
        candidates,
        key=lambda row: (
            row["decision"] != "auto_fix",
            row["club_decade_id"],
            row["name_a"],
            row["name_b"],
        ),
    )


def merge_candidate(candidate: dict[str, Any]) -> tuple[dict[str, str], dict[str, Any]]:
    left = candidate["_left"]
    right = candidate["_right"]
    if support_score(right) > support_score(left):
        keeper, duplicate = right, left
    else:
        keeper, duplicate = left, right

    merged = dict(keeper)
    preserved_fields = []
    for field in PRESERVABLE_FIELDS:
        if not has_value(merged.get(field)) and has_value(duplicate.get(field)):
            merged[field] = duplicate[field]
            preserved_fields.append(field)

    canonical_name = candidate["_canonical_name"]
    merged["player_name"] = f'{canonical_name} ({merged["player_id"]})'

    ratings_differ = any(
        has_value(keeper.get(field))
        and has_value(duplicate.get(field))
        and keeper.get(field) != duplicate.get(field)
        for field in RATING_FIELDS
    )
    if ratings_differ:
        rating_decision = (
            "Kept the better-supported record rating; it has more populated "
            "source statistics."
        )
    else:
        rating_decision = "Ratings matched or only one record supplied a rating."

    audit_row = {
        "club_decade_id": keeper["club_decade_id"],
        "team_name": keeper["team_name"],
        "decade": keeper["decade"],
        "canonical_name": canonical_name,
        "kept_player_id": keeper["player_id"],
        "kept_original_name": display_name(keeper["player_name"]),
        "removed_player_id": duplicate["player_id"],
        "removed_name": display_name(duplicate["player_name"]),
        "kept_rating": rating(keeper),
        "removed_rating": rating(duplicate),
        "rating_decision": rating_decision,
        "preserved_fields": ";".join(preserved_fields),
        "merge_reason": (
            "Explicitly reviewed transliteration identity in the same "
            "club-decade with compatible positions."
        ),
    }
    return merged, audit_row


def apply_merges(
    rows: list[dict[str, str]],
    candidates: list[dict[str, Any]],
) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    replacements: dict[str, dict[str, str]] = {}
    removed_ids: set[str] = set()
    auto_fixed = []

    for candidate in candidates:
        if candidate["decision"] != "auto_fix":
            continue
        merged, audit_row = merge_candidate(candidate)
        left_id = candidate["_left"]["club_decade_player_id"]
        right_id = candidate["_right"]["club_decade_player_id"]
        kept_id = merged["club_decade_player_id"]
        removed_id = right_id if kept_id == left_id else left_id
        replacements[kept_id] = merged
        removed_ids.add(removed_id)
        auto_fixed.append(audit_row)

    merged_rows = []
    for row in rows:
        entry_id = row["club_decade_player_id"]
        if entry_id in removed_ids:
            continue
        merged_rows.append(replacements.get(entry_id, row))
    return merged_rows, auto_fixed


def write_players(rows: list[dict[str, str]], fields: list[str]) -> None:
    with PLAYERS_CSV.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def public_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    return {field: candidate.get(field, "") for field in CANDIDATE_FIELDS}


def write_summary(
    candidates: list[dict[str, Any]],
    auto_fixed: list[dict[str, Any]],
    original_count: int,
    final_count: int,
    applied: bool,
) -> None:
    manual = [row for row in candidates if row["decision"] == "manual_review"]
    identities = {
        frozenset((row["name_a"], row["name_b"]))
        for row in candidates
        if row["decision"] == "auto_fix"
    }
    summary = f"""# Patch 1.2A Duplicate Player Audit

## Results

- Source rows audited: {original_count}
- Candidate pairs found: {len(candidates)}
- High-confidence duplicate pairs: {len(auto_fixed)}
- Distinct high-confidence identities: {len(identities)}
- Manual-review pairs: {len(manual)}
- Source rows after cleanup: {final_count}
- Cleanup applied: {"yes" if applied else "no"}

## Method

- Candidates are compared only within the same `club_decade_id`.
- Positions must share `game_position` or `main_position`.
- Names are Unicode/case normalized and folded for common Ukrainian/Russian
  transliteration variants including `g/h`, `kh/h`, `i/y/yi/iy`, and
  `skyi/sky`.
- A dependency-free Levenshtein distance and sequence similarity identify
  broader candidates.
- Automatic deletion is restricted to the explicit reviewed identity map in
  `scripts/audit_duplicate_players.py`; fuzzy similarity alone is manual-only.

## Merge Policy

- The record with more populated source statistics is retained.
- Missing values are filled from the removed record where available.
- Goals, assists, and clean sheets from the better-supported record are never
  replaced by blanks.
- When ratings differ, the rating attached to the better-supported statistical
  record is retained. No rating is averaged or recomputed.
- Canonical names use modern Ukrainian-style English transliteration only on
  rows involved in a duplicate merge.

## Risks

- Fuzzy matching can surface legitimate different players; all non-reviewed
  pairs remain unchanged in `duplicate_players_manual_review.csv`.
- Source statistics may still be incomplete even after preserving all
  non-null values.
- The explicit identity map should be reviewed when future data imports add
  new transliteration conventions.
"""
    SUMMARY_MD.write_text(summary, encoding="utf-8", newline="\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Apply reviewed high-confidence merges to the source CSV.",
    )
    mode.add_argument(
        "--check",
        action="store_true",
        help="Validate the applied cleanup and existing report artifacts.",
    )
    return parser.parse_args()


def validate_applied_cleanup(rows: list[dict[str, str]]) -> None:
    required_reports = (
        CANDIDATES_CSV,
        AUTO_FIXED_CSV,
        MANUAL_REVIEW_CSV,
        SUMMARY_MD,
    )
    missing_reports = [str(path) for path in required_reports if not path.exists()]
    if missing_reports:
        raise SystemExit(f"Missing duplicate audit reports: {', '.join(missing_reports)}")

    remaining_candidates = find_candidates(rows)
    remaining_reviewed = [
        row for row in remaining_candidates if row["decision"] == "auto_fix"
    ]
    if remaining_reviewed:
        raise SystemExit(
            f"Reviewed duplicate pairs remain in source data: {len(remaining_reviewed)}"
        )

    rows_by_id = {row["club_decade_player_id"]: row for row in rows}
    with AUTO_FIXED_CSV.open(
        "r", encoding="utf-8-sig", newline=""
    ) as csv_file:
        fixed_rows = list(csv.DictReader(csv_file))
    if not fixed_rows:
        raise SystemExit("Auto-fixed report contains no applied merge rows")

    for fixed in fixed_rows:
        kept_entry_id = (
            f'{fixed["club_decade_id"]}_{fixed["kept_player_id"]}'
        )
        removed_entry_id = (
            f'{fixed["club_decade_id"]}_{fixed["removed_player_id"]}'
        )
        kept = rows_by_id.get(kept_entry_id)
        if kept is None:
            raise SystemExit(f"Kept player row is missing: {kept_entry_id}")
        if removed_entry_id in rows_by_id:
            raise SystemExit(f"Removed duplicate row still exists: {removed_entry_id}")
        if display_name(kept["player_name"]) != fixed["canonical_name"]:
            raise SystemExit(
                f"Canonical name mismatch for {kept_entry_id}: "
                f'{kept["player_name"]}'
            )

    print(
        f"Duplicate cleanup validation passed: {len(fixed_rows)} merged pairs, "
        f"{len(remaining_candidates)} manual candidates remain"
    )


def main() -> None:
    args = parse_args()
    rows, fields = read_players()
    if args.check:
        validate_applied_cleanup(rows)
        return

    candidates = find_candidates(rows)
    merged_rows, proposed_fixes = apply_merges(rows, candidates)

    if args.apply:
        write_players(merged_rows, fields)
        auto_fixed = proposed_fixes
        final_count = len(merged_rows)
    else:
        auto_fixed = proposed_fixes
        final_count = len(rows)

    public_candidates = [public_candidate(row) for row in candidates]
    manual_review = [
        public_candidate(row)
        for row in candidates
        if row["decision"] == "manual_review"
    ]
    write_csv(CANDIDATES_CSV, public_candidates, CANDIDATE_FIELDS)
    write_csv(AUTO_FIXED_CSV, auto_fixed, AUTO_FIXED_FIELDS)
    write_csv(MANUAL_REVIEW_CSV, manual_review, CANDIDATE_FIELDS)
    write_summary(
        candidates,
        auto_fixed,
        original_count=len(rows),
        final_count=final_count,
        applied=args.apply,
    )

    print(
        f"Candidates={len(candidates)}, auto-fixed={len(auto_fixed)}, "
        f"manual-review={len(manual_review)}, applied={args.apply}"
    )


if __name__ == "__main__":
    main()
