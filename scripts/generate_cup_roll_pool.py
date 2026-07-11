#!/usr/bin/env python3
"""Generate the Cup roll pool from the checked-in runtime player dataset."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_PATH = ROOT / "public" / "data" / "players.json"
LEAGUE_ROLL_POOL_PATH = ROOT / "public" / "data" / "roll_pool.json"
CUP_ROLL_POOL_PATH = ROOT / "public" / "data" / "cup_roll_pool.json"

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
)

REQUIRED_ROLL_POOL_FIELDS = (
    "club_decade_id",
    "team_id",
    "team_name",
    "decade",
    "players_count",
)

EXPECTED_LEAGUE_PLAYER_ENTRY_COUNT = 4_136
EXPECTED_CUP_PLAYER_ENTRY_COUNT = 4_267
EXPECTED_CUP_ONLY_PLAYER_ENTRY_COUNT = 131
EXPECTED_CUP_CANDIDATE_GROUP_COUNT = 25
EXPECTED_CUP_ROLL_POOL_COUNT = 115


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array in {path}")
    return data


def is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def validate_required_fields(
    rows: list[dict[str, Any]],
    required_fields: tuple[str, ...],
    label: str,
) -> None:
    missing_counts = {
        field: sum(1 for row in rows if is_missing(row.get(field)))
        for field in required_fields
    }
    missing_counts = {
        field: count for field, count in missing_counts.items() if count > 0
    }
    if missing_counts:
        raise ValueError(f"{label} is missing required fields: {missing_counts}")


def validate_unique_field(
    rows: list[dict[str, Any]],
    field: str,
    label: str,
) -> None:
    counts = Counter(str(row.get(field)) for row in rows)
    duplicates = sorted(value for value, count in counts.items() if count > 1)
    if duplicates:
        raise ValueError(
            f"{label} contains duplicate {field} values: {duplicates[:10]}"
        )


def group_cup_candidates(
    players: list[dict[str, Any]],
    league_roll_pool: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    league_ids = {str(entry.get("club_decade_id")) for entry in league_roll_pool}
    grouped: dict[str, dict[str, Any]] = {}

    for index, player in enumerate(players):
        club_decade_id = str(player.get("club_decade_id"))
        if club_decade_id in league_ids:
            continue

        bucket = grouped.setdefault(
            club_decade_id,
            {
                "first_index": index,
                "team_id": player.get("team_id"),
                "team_name": player.get("team_name"),
                "decade": player.get("decade"),
                "players": [],
            },
        )
        bucket["players"].append(player)
        if bucket["first_index"] > index:
            bucket["first_index"] = index

        for field in ("team_id", "team_name", "decade"):
            if bucket[field] != player.get(field):
                raise ValueError(
                    f"Inconsistent {field} for {club_decade_id}: "
                    f"{bucket[field]!r} vs {player.get(field)!r}"
                )

    candidate_rows: list[dict[str, Any]] = []
    for club_decade_id, bucket in sorted(
        grouped.items(),
        key=lambda item: (
            item[1]["first_index"],
            str(item[1]["team_id"]),
            str(item[1]["decade"]),
            item[0],
        ),
    ):
        candidate_rows.append(
            {
                "club_decade_id": club_decade_id,
                "team_id": bucket["team_id"],
                "team_name": bucket["team_name"],
                "decade": bucket["decade"],
                "players_count": len(bucket["players"]),
            }
        )

    return candidate_rows


def build_cup_roll_pool(
    league_roll_pool: list[dict[str, Any]],
    cup_candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    cup_roll_pool = [dict(entry) for entry in league_roll_pool]
    league_ids = {str(entry.get("club_decade_id")) for entry in league_roll_pool}
    for entry in cup_candidates:
        club_decade_id = str(entry.get("club_decade_id"))
        if club_decade_id in league_ids:
            raise ValueError(f"Duplicate league club_decade_id in Cup pool: {club_decade_id}")
        cup_roll_pool.append(entry)
    return cup_roll_pool


def count_player_entries(
    players: list[dict[str, Any]],
    roll_pool: list[dict[str, Any]],
) -> int:
    reachable_ids = {str(entry.get("club_decade_id")) for entry in roll_pool}
    return sum(
        1 for player in players if str(player.get("club_decade_id")) in reachable_ids
    )


def main() -> None:
    players = load_json(PLAYERS_PATH)
    league_roll_pool = load_json(LEAGUE_ROLL_POOL_PATH)

    validate_required_fields(players, REQUIRED_PLAYER_FIELDS, "players.json")
    validate_required_fields(league_roll_pool, REQUIRED_ROLL_POOL_FIELDS, "roll_pool.json")
    validate_unique_field(players, "club_decade_player_id", "players.json")
    validate_unique_field(league_roll_pool, "club_decade_id", "roll_pool.json")

    cup_candidates = group_cup_candidates(players, league_roll_pool)
    cup_roll_pool = build_cup_roll_pool(league_roll_pool, cup_candidates)

    league_player_entries = count_player_entries(players, league_roll_pool)
    cup_player_entries = count_player_entries(players, cup_roll_pool)
    cup_only_player_entries = cup_player_entries - league_player_entries

    if league_player_entries != EXPECTED_LEAGUE_PLAYER_ENTRY_COUNT:
        raise ValueError(
            f"League player entry count mismatch: {league_player_entries} "
            f"(expected {EXPECTED_LEAGUE_PLAYER_ENTRY_COUNT})"
        )
    if cup_player_entries != EXPECTED_CUP_PLAYER_ENTRY_COUNT:
        raise ValueError(
            f"Cup player entry count mismatch: {cup_player_entries} "
            f"(expected {EXPECTED_CUP_PLAYER_ENTRY_COUNT})"
        )
    if cup_only_player_entries != EXPECTED_CUP_ONLY_PLAYER_ENTRY_COUNT:
        raise ValueError(
            f"Cup-only player entry count mismatch: {cup_only_player_entries} "
            f"(expected {EXPECTED_CUP_ONLY_PLAYER_ENTRY_COUNT})"
        )
    if len(cup_candidates) != EXPECTED_CUP_CANDIDATE_GROUP_COUNT:
        raise ValueError(
            f"Cup candidate club-decade group count mismatch: {len(cup_candidates)} "
            f"(expected {EXPECTED_CUP_CANDIDATE_GROUP_COUNT})"
        )
    if len(cup_roll_pool) != EXPECTED_CUP_ROLL_POOL_COUNT:
        raise ValueError(
            f"Cup roll pool row count mismatch: {len(cup_roll_pool)} "
            f"(expected {EXPECTED_CUP_ROLL_POOL_COUNT})"
        )

    cup_id_counts = Counter(entry["club_decade_id"] for entry in cup_roll_pool)
    duplicate_cup_ids = [
        club_decade_id
        for club_decade_id, count in cup_id_counts.items()
        if count > 1
    ]
    if duplicate_cup_ids:
        raise ValueError(
            "Cup roll pool contains duplicate club_decade_id values: "
            f"{sorted(set(duplicate_cup_ids))[:10]}"
        )

    CUP_ROLL_POOL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CUP_ROLL_POOL_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(cup_roll_pool, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")

    print(f"Wrote {CUP_ROLL_POOL_PATH} ({len(cup_roll_pool)} club-decade rows)")
    print(f"League player entries: {league_player_entries}")
    print(f"Cup player entries: {cup_player_entries}")
    print(f"Cup-only player entries: {cup_only_player_entries}")
    print(f"Cup candidate club-decade groups added: {len(cup_candidates)}")


if __name__ == "__main__":
    main()
