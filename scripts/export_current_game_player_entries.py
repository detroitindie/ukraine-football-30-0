#!/usr/bin/env python3
"""Export a read-only audit of the player entries loaded by the game."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_PATH = ROOT / "public" / "data" / "players.json"
ROLL_POOL_PATH = ROOT / "public" / "data" / "roll_pool.json"
SOURCE_CSV_PATH = ROOT / "exports" / "club_decade_players.csv"
OUTPUT_DIR = ROOT / "output" / "data-audit"
CSV_PATH = OUTPUT_DIR / "current_game_player_entries.csv"
SUMMARY_PATH = OUTPUT_DIR / "current_game_player_entries_summary.md"

CSV_FIELDS = [
    "player_name",
    "normalized_player_name",
    "club_name",
    "normalized_club_name",
    "decade",
    "position",
    "player_id",
    "club_id",
    "club_decade_id",
    "nationality",
    "effective_rating",
]


def display_player_name(value: Any) -> str:
    name = str(value or "").strip()
    return re.sub(r"\s+\(\d+\)$", "", name)


def normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character)
    )
    words = re.sub(r"[^\w]+", " ", without_marks.casefold(), flags=re.UNICODE)
    return " ".join(words.split())


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as json_file:
        data = json.load(json_file)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array in {path}")
    return data


def load_nationalities() -> dict[str, str]:
    nationalities: dict[str, str] = {}
    with SOURCE_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            entry_id = (row.get("club_decade_player_id") or "").strip()
            nationality = (row.get("citizenship") or "").strip()
            if entry_id and nationality:
                nationalities[entry_id] = nationality
    return nationalities


def audit_rows(
    players: list[dict[str, Any]],
    nationalities: dict[str, str],
) -> list[dict[str, Any]]:
    rows = []
    for player in players:
        player_name = display_player_name(player.get("player_name"))
        club_name = str(player.get("team_name") or "").strip()
        rows.append(
            {
                "player_name": player_name,
                "normalized_player_name": normalize_name(player_name),
                "club_name": club_name,
                "normalized_club_name": normalize_name(club_name),
                "decade": player.get("decade"),
                "position": player.get("position"),
                "player_id": player.get("player_id"),
                "club_id": player.get("team_id"),
                "club_decade_id": player.get("club_decade_id"),
                "nationality": nationalities.get(
                    str(player.get("club_decade_player_id") or ""),
                    "",
                ),
                "effective_rating": player.get("effective_global_rating"),
            }
        )
    return rows


def duplicate_examples(rows: list[dict[str, Any]], limit: int = 10) -> list[str]:
    entries_by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        entries_by_player[row["normalized_player_name"]].append(row)

    duplicate_groups = [
        entries
        for entries in entries_by_player.values()
        if len({(entry["club_decade_id"], entry["player_id"]) for entry in entries}) > 1
    ]
    duplicate_groups.sort(key=lambda entries: (-len(entries), entries[0]["player_name"]))

    examples = []
    for entries in duplicate_groups[:limit]:
        locations = sorted(
            {
                f'{entry["club_name"]} ({entry["decade"]})'
                for entry in entries
            }
        )
        examples.append(
            f'- {entries[0]["player_name"]}: {len(entries)} entries across '
            + "; ".join(locations)
        )
    return examples


def write_csv(rows: list[dict[str, Any]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def write_summary(
    rows: list[dict[str, Any]],
    players: list[dict[str, Any]],
    roll_pool: list[dict[str, Any]],
) -> None:
    unique_players = {row["normalized_player_name"] for row in rows}
    clubs = {row["club_id"] for row in rows}
    club_decades = {row["club_decade_id"] for row in rows}
    roll_ids = {entry.get("club_decade_id") for entry in roll_pool}
    reachable_rows = sum(
        1 for player in players if player.get("club_decade_id") in roll_ids
    )
    examples = duplicate_examples(rows)

    summary = f"""# Current Game Player Entries Audit

## Totals

- Total rows exported: {len(rows)}
- Total unique normalized players: {len(unique_players)}
- Total clubs: {len(clubs)}
- Total club-decade combinations: {len(club_decades)}
- Rows in a currently eligible roll-pool club-decade: {reachable_rows}
- Rows outside the currently eligible roll pool: {len(rows) - reachable_rows}

## Duplicate Player Examples

{chr(10).join(examples) if examples else "- No duplicate normalized player names found."}

## Assumptions

- The authoritative set for this audit is `public/data/players.json`, because the draft UI loads that file directly at runtime.
- Every row in `players.json` is exported, including rows whose club-decade is not currently present in `public/data/roll_pool.json`. The roll-pool counts above make that distinction explicit.
- `player_name` matches the in-game display name by removing the trailing numeric ID in parentheses. The original numeric value remains in `player_id`.
- Normalized names are Unicode-decomposed, stripped of combining marks, case-folded, converted from punctuation to spaces, and whitespace-collapsed.
- `nationality` is joined read-only from `exports/club_decade_players.csv` using `club_decade_player_id`; the runtime JSON does not contain nationality.
- `position` uses the detailed runtime `position` value. `effective_rating` uses `effective_global_rating`, the value used first by season simulation.
- Club and club-decade totals use `team_id` and `club_decade_id`, respectively.
"""
    SUMMARY_PATH.write_text(summary, encoding="utf-8", newline="\n")


def main() -> None:
    players = load_json(PLAYERS_PATH)
    roll_pool = load_json(ROLL_POOL_PATH)
    rows = audit_rows(players, load_nationalities())
    write_csv(rows)
    write_summary(rows, players, roll_pool)
    print(f"Wrote {CSV_PATH} ({len(rows)} rows)")
    print(f"Wrote {SUMMARY_PATH}")


if __name__ == "__main__":
    main()
