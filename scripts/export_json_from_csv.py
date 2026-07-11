#!/usr/bin/env python3
"""Export the Milestone 3 frontend JSON files from the source CSV files."""

from __future__ import annotations

import csv
import json
import math
import re
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
EXPORTS_DIR = ROOT / "exports"
OUTPUT_DIR = ROOT / "public" / "data"

PLAYER_FIELDS: dict[str, Callable[[str], Any]] = {
    "club_decade_player_id": str,
    "club_decade_id": str,
    "team_id": int,
    "team_name": str,
    "decade": str,
    "player_id": int,
    "player_name": str,
    "citizenships": str,
    "primary_citizenship": str,
    "position": str,
    "main_position": str,
    "game_position": str,
    "goals": float,
    "assists": int,
    "clean_sheets": int,
    # Internal simulation fields. The frontend draft UI must not render these.
    "raw_score": float,
    "local_rating": float,
    "global_rating": float,
    "global_percentile": float,
    "hidden_modifier": float,
    "effective_global_rating": float,
}

ROLL_POOL_FIELDS: dict[str, Callable[[str], Any]] = {
    "club_decade_id": str,
    "team_id": int,
    "team_name": str,
    "decade": str,
    "players_count": int,
}


def normalize_value(raw_value: str | None, converter: Callable[[str], Any]) -> Any:
    if raw_value is None:
        return None

    value = raw_value.strip()
    if not value or value.lower() in {"nan", "null", "none"}:
        return None

    try:
        converted = converter(value)
    except (TypeError, ValueError):
        return None

    if isinstance(converted, float) and (math.isnan(converted) or math.isinf(converted)):
        return None

    if isinstance(converted, float) and converted.is_integer():
        return int(converted)

    return converted


def read_csv(filename: str) -> list[dict[str, str]]:
    path = EXPORTS_DIR / filename
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def select_fields(
    row: dict[str, str],
    fields: dict[str, Callable[[str], Any]],
) -> dict[str, Any]:
    return {
        field: normalize_value(row.get(field), converter)
        for field, converter in fields.items()
    }


COUNTRY_ALIASES = {
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
}


def normalize_citizenships(raw_value: str | None) -> list[str]:
    if raw_value is None:
        return []

    value = raw_value.strip()
    if not value or value.lower() in {"nan", "null", "none"}:
        return []

    countries: list[str] = []
    seen: set[str] = set()
    for country in re.split(r"\s{2,}", value):
        normalized = COUNTRY_ALIASES.get(country.strip(), country.strip())
        if normalized and normalized not in seen:
            countries.append(normalized)
            seen.add(normalized)
    return countries


def select_player_fields(row: dict[str, str]) -> dict[str, Any]:
    citizenships = normalize_citizenships(row.get("citizenship"))
    selected = select_fields(row, PLAYER_FIELDS)
    selected["citizenships"] = citizenships
    selected["primary_citizenship"] = citizenships[0] if citizenships else None
    return selected


def has_player_name(row: dict[str, str]) -> bool:
    player_name = row.get("player_name")
    return (
        isinstance(player_name, str)
        and bool(player_name.strip())
        and player_name.strip().lower() not in {"nan", "null", "none"}
    )


def export_players() -> tuple[list[dict[str, Any]], int]:
    rows = read_csv("club_decade_players.csv")
    valid_rows = [row for row in rows if has_player_name(row)]
    return (
        [select_player_fields(row) for row in valid_rows],
        len(rows) - len(valid_rows),
    )


def export_roll_pool() -> list[dict[str, Any]]:
    rows = read_csv("mvp_roll_pool.csv")
    return [
        select_fields(row, ROLL_POOL_FIELDS)
        for row in rows
        if row.get("is_mvp_eligible", "").strip().lower() == "true"
    ]


def export_formation_slots() -> list[dict[str, Any]]:
    slots = []
    for row in read_csv("formation_slots.csv"):
        allowed_positions = [
            position.strip()
            for position in row.get("allowed_positions", "").split(",")
            if position.strip()
        ]
        slots.append(
            {
                "slot_id": normalize_value(row.get("slot_id"), str),
                "slot_label": normalize_value(row.get("slot_label"), str),
                "line": normalize_value(row.get("line"), str),
                "allowed_positions": allowed_positions,
                "slot_order": normalize_value(row.get("slot_order"), int),
            }
        )

    return sorted(slots, key=lambda slot: slot["slot_order"] or 0)


def write_json(filename: str, data: list[dict[str, Any]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / filename
    with path.open("w", encoding="utf-8", newline="\n") as json_file:
        json.dump(data, json_file, ensure_ascii=False, indent=2, allow_nan=False)
        json_file.write("\n")


def main() -> None:
    players, removed_players = export_players()
    exports = {
        "players.json": players,
        "roll_pool.json": export_roll_pool(),
        "formation_slots.json": export_formation_slots(),
    }

    for filename, data in exports.items():
        write_json(filename, data)
        print(f"Wrote {OUTPUT_DIR / filename} ({len(data)} records)")

    print(f"Removed {removed_players} player records with missing names")


if __name__ == "__main__":
    main()
