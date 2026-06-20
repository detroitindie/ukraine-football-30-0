#!/usr/bin/env python3
"""Report League and Cup draft-pool sizes from checked-in data artifacts."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_JSON = ROOT / "public" / "data" / "players.json"
LEAGUE_ROLL_POOL_JSON = ROOT / "public" / "data" / "roll_pool.json"
CUP_ROLL_POOL_JSON = ROOT / "public" / "data" / "cup_roll_pool.json"
ROLL_POOL_CSV = ROOT / "exports" / "mvp_roll_pool.csv"

REQUIRED_PLAYER_FIELDS = (
    "club_decade_player_id",
    "club_decade_id",
    "team_id",
    "team_name",
    "decade",
    "player_id",
    "player_name",
    "position",
    "main_position",
    "game_position",
    "effective_global_rating",
    "global_rating",
)


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as json_file:
        data = json.load(json_file)
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array: {path}")
    return data


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def count_entries(
    players: list[dict[str, Any]],
    roll_pool: list[dict[str, Any]],
) -> tuple[int, int]:
    roll_ids = {str(entry.get("club_decade_id")) for entry in roll_pool}
    club_ids = {str(entry.get("team_id")) for entry in roll_pool}
    player_entries = sum(
        1 for player in players if str(player.get("club_decade_id")) in roll_ids
    )
    return len(club_ids), player_entries


def missing_field_counts(
    players: list[dict[str, Any]],
) -> dict[str, int]:
    return {
        field: sum(1 for player in players if is_missing(player.get(field)))
        for field in REQUIRED_PLAYER_FIELDS
    }


def duplicate_club_decade_player_id_count(
    players: list[dict[str, Any]],
) -> int:
    counts = Counter(
        str(player.get("club_decade_player_id")) for player in players
    )
    return sum(1 for count in counts.values() if count > 1)


def main() -> None:
    players = load_json(PLAYERS_JSON)
    league_roll_pool = load_json(LEAGUE_ROLL_POOL_JSON)
    cup_roll_pool = load_json(CUP_ROLL_POOL_JSON)
    roll_pool_csv = load_csv(ROLL_POOL_CSV)
    csv_eligible_values = sorted({row.get("is_mvp_eligible", "") for row in roll_pool_csv})

    league_clubs, league_entries = count_entries(players, league_roll_pool)
    cup_clubs, cup_entries = count_entries(players, cup_roll_pool)

    league_team_ids = {str(entry.get("team_id")) for entry in league_roll_pool}
    cup_team_ids = {str(entry.get("team_id")) for entry in cup_roll_pool}
    cup_only_team_ids = sorted(cup_team_ids - league_team_ids)
    cup_only_team_id_names: list[str] = []
    for team_id in cup_only_team_ids:
        names = sorted(
            {
                str(entry.get("team_name"))
                for entry in cup_roll_pool
                if str(entry.get("team_id")) == team_id
            }
        )
        cup_only_team_id_names.append(f"{team_id}: {' / '.join(names)}")

    print("Competition pool diagnostic")
    print(f"Full raw source before aggregation available: no")
    print(f"Roll-pool CSV rows: {len(roll_pool_csv)}")
    print(f"Roll-pool CSV is_mvp_eligible values: {', '.join(csv_eligible_values)}")
    print(f"Runtime player entries: {len(players)}")
    print(f"League roll-pool rows: {len(league_roll_pool)}")
    print(f"Cup roll-pool rows: {len(cup_roll_pool)}")
    print(f"League clubs: {league_clubs}")
    print(f"League player entries: {league_entries}")
    print(f"Cup clubs: {cup_clubs}")
    print(f"Cup player entries: {cup_entries}")
    print(f"Cup-only club/team ids added: {len(cup_only_team_ids)}")
    if cup_only_team_ids:
        print("Cup-only club/team ids:")
        for item in cup_only_team_id_names:
            print(f"  - {item}")
    print(
        "Cup-only player entries: "
        f"{cup_entries - league_entries}"
    )
    print(
        "Duplicate club_decade_player_id count: "
        f"{duplicate_club_decade_player_id_count(players)}"
    )
    counts = missing_field_counts(players)
    print(
        "Missing required field counts: "
        + ", ".join(f"{field}={count}" for field, count in counts.items())
    )
    print(
        "Cup expanded now: yes; Cup uses the dedicated Cup roll pool from "
        "public/data/cup_roll_pool.json."
    )


if __name__ == "__main__":
    main()
