#!/usr/bin/env python3
"""Validate Patch 1.1 review artifacts and applied player data."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT_DIR = ROOT / "data-audit" / "patch-1-1"
REVIEW_PATH = AUDIT_DIR / "generated_patch_1_1_import_review.csv"
SKIPPED_PATH = AUDIT_DIR / "generated_patch_1_1_skipped_duplicates.csv"
MANUAL_PATH = AUDIT_DIR / "generated_patch_1_1_manual_review.csv"
SUMMARY_PATH = AUDIT_DIR / "generated_patch_1_1_summary.md"
PLAYERS_CSV = ROOT / "exports" / "club_decade_players.csv"
PLAYERS_JSON = ROOT / "public" / "data" / "players.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def key(row: dict[str, object]) -> str:
    return str(row["club_decade_player_id"])


def main() -> None:
    required_paths = [
        REVIEW_PATH,
        SKIPPED_PATH,
        MANUAL_PATH,
        SUMMARY_PATH,
    ]
    missing_paths = [str(path) for path in required_paths if not path.exists()]
    if missing_paths:
        raise SystemExit(f"Missing generated files: {', '.join(missing_paths)}")

    review_rows = read_csv(REVIEW_PATH)
    manual_rows = read_csv(MANUAL_PATH)
    production_rows = read_csv(PLAYERS_CSV)
    runtime_rows = json.loads(PLAYERS_JSON.read_text(encoding="utf-8"))
    production_by_id = {key(row): row for row in production_rows}
    runtime_by_id = {key(row): row for row in runtime_rows}

    review_ids = [key(row) for row in review_rows]
    if len(review_ids) != len(set(review_ids)):
        raise SystemExit("Duplicate club_decade_player_id values in import review")

    missing_production = [
        entry_id for entry_id in review_ids if entry_id not in production_by_id
    ]
    missing_runtime = [
        entry_id for entry_id in review_ids if entry_id not in runtime_by_id
    ]
    if missing_production or missing_runtime:
        raise SystemExit(
            f"Review rows missing from production CSV={len(missing_production)}, "
            f"runtime JSON={len(missing_runtime)}"
        )

    ids_by_name: dict[str, set[str]] = {}
    for row in review_rows:
        ids_by_name.setdefault(row["normalized_player_name"], set()).add(row["player_id"])
        rating = float(row["provisional_rating"])
        if not 48 <= rating <= 92:
            raise SystemExit(f"Out-of-range rating for {row['player_name']}: {rating}")
        production = production_by_id[key(row)]
        for stat in ("goals", "assists", "clean_sheets"):
            if row[stat] == "" and production[stat] != "":
                raise SystemExit(
                    f"Unavailable {stat} was not preserved as blank for {row['player_name']}"
                )

    unstable_ids = [name for name, ids in ids_by_name.items() if len(ids) != 1]
    if unstable_ids:
        raise SystemExit(f"Players with inconsistent IDs: {', '.join(unstable_ids)}")

    production_locations = {
        (
            row["player_name"].rsplit(" (", 1)[0].casefold(),
            row["team_name"].casefold(),
            row["decade"],
        )
        for row in production_rows
    }
    wrongly_imported_manual = [
        row["player_name"]
        for row in manual_rows
        if (
            row["player_name"].casefold(),
            row["club_name"].casefold(),
            row["decade"],
        ) in production_locations
    ]
    if wrongly_imported_manual:
        raise SystemExit(
            "Manual-review players found in production: "
            + ", ".join(sorted(set(wrongly_imported_manual)))
        )

    print(
        f"Patch 1.1 validation passed: {len(review_rows)} imported entries, "
        f"{len(manual_rows)} manual-review entries"
    )


if __name__ == "__main__":
    main()
