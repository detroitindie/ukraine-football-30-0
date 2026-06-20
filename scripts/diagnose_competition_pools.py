#!/usr/bin/env python3
"""Report League and Cup draft-pool sizes from checked-in data artifacts."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_JSON = ROOT / "public" / "data" / "players.json"
LEAGUE_ROLL_POOL_JSON = ROOT / "public" / "data" / "roll_pool.json"
ROLL_POOL_CSV = ROOT / "exports" / "mvp_roll_pool.csv"


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as json_file:
        data = json.load(json_file)
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array: {path}")
    return data


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


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


def main() -> None:
    players = load_json(PLAYERS_JSON)
    league_roll_pool = load_json(LEAGUE_ROLL_POOL_JSON)
    roll_pool_csv = load_csv(ROLL_POOL_CSV)
    csv_eligible_values = sorted({row.get("is_mvp_eligible", "") for row in roll_pool_csv})
    league_clubs, league_entries = count_entries(players, league_roll_pool)

    # TODO(v2 cup data): replace this with a regenerated Cup roll pool once the
    # existing upstream aggregate source exposes the top-division club filter.
    cup_roll_pool = league_roll_pool
    cup_clubs, cup_entries = count_entries(players, cup_roll_pool)

    print("Competition pool diagnostic")
    print(f"Full raw source before aggregation available: no")
    print(f"Roll-pool CSV rows: {len(roll_pool_csv)}")
    print(f"Roll-pool CSV is_mvp_eligible values: {', '.join(csv_eligible_values)}")
    print(f"Runtime player entries: {len(players)}")
    print(f"League clubs: {league_clubs}")
    print(f"League player entries: {league_entries}")
    print(f"Cup clubs: {cup_clubs}")
    print(f"Cup player entries: {cup_entries}")
    print(
        "Cup expanded now: no; Cup currently uses the League roll pool until "
        "the existing source data can be regenerated without the top-division "
        "club requirement."
    )


if __name__ == "__main__":
    main()
