#!/usr/bin/env python3
"""Prepare and optionally apply the Patch 1.1 player import."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import statistics
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
AUDIT_DIR = ROOT / "data-audit" / "patch-1-1"
PLAYERS_CSV = ROOT / "exports" / "club_decade_players.csv"
ROLL_POOL_CSV = ROOT / "exports" / "mvp_roll_pool.csv"
PLAYERS_JSON = ROOT / "public" / "data" / "players.json"

PASS_FILES = {
    "legends": AUDIT_DIR / "missing_player_candidates_legends_pass.csv",
    "core_squad": AUDIT_DIR / "missing_player_candidates_core_squad_pass.csv",
    "first_pass": AUDIT_DIR / "missing_player_candidates_first_pass.csv",
}
AGGREGATED_STATS = AUDIT_DIR / "missing_players_club_decade_aggregated_stats.csv"

REVIEW_CSV = AUDIT_DIR / "generated_patch_1_1_import_review.csv"
SKIPPED_CSV = AUDIT_DIR / "generated_patch_1_1_skipped_duplicates.csv"
MANUAL_CSV = AUDIT_DIR / "generated_patch_1_1_manual_review.csv"
SUMMARY_MD = AUDIT_DIR / "generated_patch_1_1_summary.md"

PLAYER_FIELDS = [
    "club_decade_player_id",
    "club_decade_id",
    "team_id",
    "team_name",
    "decade",
    "player_id",
    "player_name",
    "citizenship",
    "position",
    "main_position",
    "game_position",
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
    "raw_score",
    "local_rating",
    "global_rating",
    "global_percentile",
    "hidden_modifier",
    "effective_global_rating",
]

REVIEW_FIELDS = [
    "player_name",
    "normalized_player_name",
    "club_name",
    "decade",
    "source_pass",
    "confidence",
    "input_position",
    "game_position",
    "goals",
    "assists",
    "clean_sheets",
    "seasons_count",
    "raw_score",
    "provisional_rating",
    "rating_reason",
    "player_id",
    "club_decade_player_id",
]

DECISION_FIELDS = [
    "player_name",
    "normalized_player_name",
    "club_name",
    "decade",
    "source_pass",
    "confidence",
    "input_position",
    "reason",
    "notes",
]

POSITION_DETAILS = {
    "GK": ("Goalkeeper", "Goalkeeper"),
    "LB": ("Defender - Left-Back", "Defender"),
    "CB": ("Defender - Centre-Back", "Defender"),
    "RB": ("Defender - Right-Back", "Defender"),
    "CDM": ("Midfield - Defensive Midfield", "Midfield"),
    "LM": ("Midfield - Left Midfield", "Midfield"),
    "CM": ("Midfield - Central Midfield", "Midfield"),
    "RM": ("Midfield - Right Midfield", "Midfield"),
    "AM": ("Midfield - Attacking Midfield", "Midfield"),
    "FW": ("Attack - Centre-Forward", "Attack"),
}

POSITION_ALIASES = {
    "Goalkeeper": "GK",
    "Defender": "CB",
    "DF": "CB",
    "Midfielder": "CM",
    "MF": "CM",
    "Forward": "FW",
    "DM": "CDM",
    "LW": "LM",
    "RW": "RM",
}

AMBIGUOUS_POSITION_VALUES = {"Midfielder / Defender", "MF/DF", "FW/MF"}
NAME_RISK_PATTERNS = (
    "transliter",
    "spelling",
    "full name",
    "multiple serhiy",
    "already represented",
    "normalized duplicate",
    "club entity should",
    "may appear as",
    "may be volodymyr",
    "could be transliterated",
    "exact normalized name",
)


def normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character)
    )
    words = re.sub(r"[^\w]+", " ", without_marks.casefold(), flags=re.UNICODE)
    return " ".join(words.split())


def display_name(value: str) -> str:
    return re.sub(r"\s+\(\d+\)$", "", (value or "").strip())


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def optional_number(value: str | None) -> int | float | None:
    raw_value = (value or "").strip()
    if not raw_value:
        return None
    number = float(raw_value)
    return int(number) if number.is_integer() else number


def numeric_value(value: str | None) -> float | None:
    try:
        number = float((value or "").strip())
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def quantile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 65.0
    if len(ordered) == 1:
        return ordered[0]
    index = (len(ordered) - 1) * percentile
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    weight = index - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def stable_player_id(normalized_name: str, used_ids: set[int]) -> int:
    digest = hashlib.sha256(normalized_name.encode("utf-8")).hexdigest()
    player_id = 8_000_000 + int(digest[:8], 16) % 1_000_000
    while player_id in used_ids:
        player_id += 1
    used_ids.add(player_id)
    return player_id


def map_position(input_position: str) -> str | None:
    value = input_position.strip()
    if value in AMBIGUOUS_POSITION_VALUES:
        return None
    preferred = value.split("/")[0].strip()
    mapped = POSITION_ALIASES.get(preferred, preferred)
    return mapped if mapped in POSITION_DETAILS else None


def has_name_risk(candidate: dict[str, str]) -> bool:
    text = f"{candidate.get('notes', '')} {candidate.get('reason_for_inclusion', '')}".casefold()
    return any(pattern in text for pattern in NAME_RISK_PATTERNS)


def club_decade_index(
    existing_rows: list[dict[str, str]],
) -> tuple[dict[tuple[str, str], dict[str, str]], dict[str, list[dict[str, str]]]]:
    identities: dict[tuple[str, str], dict[str, str]] = {}
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in existing_rows:
        key = (normalize_name(row["team_name"]), row["decade"])
        identities.setdefault(key, row)
        grouped[row["club_decade_id"]].append(row)
    return identities, grouped


def relative_rating(
    source_pass: str,
    confidence: str,
    game_position: str,
    pool: list[dict[str, str]],
    notes: str,
) -> tuple[float, str]:
    same_position = [
        rating
        for row in pool
        if row.get("game_position") == game_position
        if (rating := numeric_value(row.get("effective_global_rating"))) is not None
    ]
    overall = [
        rating
        for row in pool
        if (rating := numeric_value(row.get("effective_global_rating"))) is not None
    ]
    distribution = same_position if len(same_position) >= 3 else overall
    base_percentile = {
        "legends": 0.84,
        "core_squad": 0.67,
        "first_pass": 0.48,
    }[source_pass]
    confidence_adjustment = 0.03 if confidence == "High" else 0
    status_text = notes.casefold()
    status_adjustment = 0.03 if any(
        marker in status_text
        for marker in ("legend", "record", "captain", "best scorer", "top-")
    ) else 0
    percentile = min(0.9, base_percentile + confidence_adjustment + status_adjustment)
    rating = round(max(48.0, min(92.0, quantile(distribution, percentile))), 1)
    group_label = (
        f"same-position group ({len(same_position)} players)"
        if len(same_position) >= 3
        else f"overall club-decade pool ({len(overall)} players)"
    )
    reason = (
        f"Relative {source_pass} rating at the {percentile:.0%} percentile of the "
        f"{group_label}; confidence={confidence}"
    )
    return rating, reason


def raw_score_for(stats: dict[str, str]) -> float | None:
    values = {
        field: optional_number(stats.get(field))
        for field in ("goals", "assists", "clean_sheets", "seasons_count")
    }
    if all(value is None for value in values.values()):
        return None
    return round(
        5 * float(values["goals"] or 0)
        + 4 * float(values["assists"] or 0)
        + 1.5 * float(values["clean_sheets"] or 0)
        + 3 * float(values["seasons_count"] or 0),
        1,
    )


def enough_stats_for_score(stats: dict[str, str]) -> bool:
    seasons = optional_number(stats.get("seasons_count"))
    performance_values = [
        optional_number(stats.get(field))
        for field in ("goals", "assists", "clean_sheets")
    ]
    return seasons is not None and any(
        value is not None and value > 0 for value in performance_values
    )


def score_based_rating(
    raw_score: float,
    game_position: str,
    pool: list[dict[str, str]],
) -> tuple[float, str]:
    comparable = [
        (
            abs(existing_raw_score - raw_score),
            rating,
            existing_raw_score,
        )
        for row in pool
        if row.get("game_position") == game_position
        if (existing_raw_score := numeric_value(row.get("raw_score"))) is not None
        if (rating := numeric_value(row.get("effective_global_rating"))) is not None
    ]
    if not comparable:
        return 65.0, "Raw score calculated; no same-position comparison was available"
    _, nearest_rating, nearest_raw_score = min(comparable)
    rating = round(max(48.0, min(92.0, nearest_rating)), 1)
    return (
        rating,
        f"Raw score {raw_score:g}; nearest same-position existing raw score "
        f"{nearest_raw_score:g} maps to rating {rating:g}",
    )


def write_csv(
    path: Path,
    rows: list[dict[str, Any]],
    fields: list[str],
    encoding: str = "utf-8-sig",
) -> None:
    with path.open("w", encoding=encoding, newline="") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=fields,
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def build_plan() -> tuple[
    list[dict[str, Any]],
    list[dict[str, str]],
    list[dict[str, str]],
    list[dict[str, str]],
]:
    existing_rows = read_csv(PLAYERS_CSV)
    existing_names = {
        normalize_name(display_name(row["player_name"])) for row in existing_rows
    }
    existing_entry_keys = {
        (
            normalize_name(display_name(row["player_name"])),
            normalize_name(row["team_name"]),
            row["decade"],
        )
        for row in existing_rows
    }
    used_ids = {
        int(row["player_id"])
        for row in existing_rows
        if row.get("player_id", "").isdigit()
    }
    player_ids: dict[str, int] = {}
    identities, grouped_existing = club_decade_index(existing_rows)
    stats_by_key = {
        (
            normalize_name(row["player_name"]),
            normalize_name(row["club_name"]),
            row["decade"],
        ): row
        for row in read_csv(AGGREGATED_STATS)
    }

    candidates: list[dict[str, str]] = []
    for source_pass, path in PASS_FILES.items():
        for row in read_csv(path):
            candidates.append({**row, "source_pass": source_pass})

    imports: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    manual: list[dict[str, str]] = []
    planned_keys: set[tuple[str, str, str]] = set()

    for candidate in candidates:
        normalized_name = normalize_name(candidate["missing_player_name"])
        normalized_club = normalize_name(candidate["club_name"])
        key = (normalized_name, normalized_club, candidate["decade"])
        decision_base = {
            "player_name": candidate["missing_player_name"],
            "normalized_player_name": normalized_name,
            "club_name": candidate["club_name"],
            "decade": candidate["decade"],
            "source_pass": candidate["source_pass"],
            "confidence": candidate["confidence"],
            "input_position": candidate["position"],
            "notes": candidate.get("notes", ""),
        }

        if normalized_name in existing_names or key in existing_entry_keys or key in planned_keys:
            skipped.append(
                {
                    **decision_base,
                    "reason": "Normalized player name already exists in the current database",
                }
            )
            continue

        game_position = map_position(candidate["position"])
        manual_reason = ""
        if candidate["confidence"] == "Low":
            manual_reason = "Low-confidence candidate requires confirmation"
        elif has_name_risk(candidate):
            manual_reason = "Spelling, transliteration, identity, or club-name ambiguity"
        elif game_position is None:
            manual_reason = "Position cannot be mapped to one formation position safely"
        elif (normalized_club, candidate["decade"]) not in identities:
            manual_reason = "Club-decade is not present in the current database"

        if manual_reason:
            manual.append({**decision_base, "reason": manual_reason})
            continue

        identity = identities[(normalized_club, candidate["decade"])]
        stats = stats_by_key.get(key, {})
        raw_score = raw_score_for(stats)
        if enough_stats_for_score(stats) and raw_score is not None:
            rating, rating_reason = score_based_rating(
                raw_score,
                game_position,
                grouped_existing[identity["club_decade_id"]],
            )
        else:
            rating, rating_reason = relative_rating(
                candidate["source_pass"],
                candidate["confidence"],
                game_position,
                grouped_existing[identity["club_decade_id"]],
                f"{candidate.get('reason_for_inclusion', '')} {candidate.get('notes', '')}",
            )
            if raw_score is not None:
                rating_reason += "; reconstructed statistics were too incomplete for rating"

        if normalized_name not in player_ids:
            player_ids[normalized_name] = stable_player_id(normalized_name, used_ids)
        player_id = player_ids[normalized_name]
        position_detail, main_position = POSITION_DETAILS[game_position]
        club_decade_player_id = f"{identity['club_decade_id']}_{player_id}"
        imports.append(
            {
                **decision_base,
                "game_position": game_position,
                "goals": optional_number(stats.get("goals")),
                "assists": optional_number(stats.get("assists")),
                "clean_sheets": optional_number(stats.get("clean_sheets")),
                "seasons_count": optional_number(stats.get("seasons_count")),
                "raw_score": raw_score,
                "provisional_rating": rating,
                "rating_reason": rating_reason,
                "player_id": player_id,
                "club_decade_player_id": club_decade_player_id,
                "_player_row": {
                    "club_decade_player_id": club_decade_player_id,
                    "club_decade_id": identity["club_decade_id"],
                    "team_id": identity["team_id"],
                    "team_name": identity["team_name"],
                    "decade": candidate["decade"],
                    "player_id": player_id,
                    "player_name": f"{candidate['missing_player_name']} ({player_id})",
                    "citizenship": "",
                    "position": position_detail,
                    "main_position": main_position,
                    "game_position": game_position,
                    "seasons_count": optional_number(stats.get("seasons_count")),
                    "rows_count": optional_number(stats.get("seasons_count")),
                    "goals": optional_number(stats.get("goals")),
                    "assists": optional_number(stats.get("assists")),
                    "clean_sheets": optional_number(stats.get("clean_sheets")),
                    "goals_conceded": None,
                    "yellow_cards": None,
                    "direct_red_cards": None,
                    "penalty_goals": None,
                    "minutes_played": optional_number(stats.get("minutes_played")),
                    "raw_score": raw_score,
                    "local_rating": rating,
                    "global_rating": rating,
                    "global_percentile": None,
                    "hidden_modifier": 1,
                    "effective_global_rating": rating,
                },
            }
        )
        planned_keys.add(key)

    return imports, skipped, manual, existing_rows


def write_review_files(
    imports: list[dict[str, Any]],
    skipped: list[dict[str, str]],
    manual: list[dict[str, str]],
    applied: bool,
) -> None:
    write_csv(REVIEW_CSV, imports, REVIEW_FIELDS)
    write_csv(SKIPPED_CSV, skipped, DECISION_FIELDS)
    write_csv(MANUAL_CSV, manual, DECISION_FIELDS)
    source_counts = {
        source: sum(row["source_pass"] == source for row in imports)
        for source in PASS_FILES
    }
    stats_counts = {
        field: sum(row[field] is not None for row in imports)
        for field in ("goals", "assists", "clean_sheets", "seasons_count")
    }
    summary = f"""# Patch 1.1 Import Summary

## Status

- Production data applied: {"yes" if applied else "no (review-only run)"}
- Candidate passes included: legends, core_squad, first_pass
- Long Tail pass included: no

## Decisions

- Planned/imported club-decade entries: {len(imports)}
- Unique planned/imported players: {len({row["normalized_player_name"] for row in imports})}
- Skipped duplicate entries: {len(skipped)}
- Manual review entries: {len(manual)}
- Legends entries: {source_counts["legends"]}
- Core squad entries: {source_counts["core_squad"]}
- First pass entries: {source_counts["first_pass"]}

## Reconstructed Statistics

- Entries with goals: {stats_counts["goals"]}
- Entries with assists: {stats_counts["assists"]}
- Entries with clean sheets: {stats_counts["clean_sheets"]}
- Entries with seasons count: {stats_counts["seasons_count"]}

## Policy

- Blank source statistics remain blank/null; zero is retained only when explicitly present in the enrichment CSV.
- Low-confidence and spelling/transliteration/identity-risk rows are held for manual review.
- A stable synthetic player ID is shared by all imported club-decade entries for the same normalized player.
- Ratings are bounded to 48-92 and use reconstructed raw score only when sufficient performance data exists. Otherwise they use the source-pass priority and the existing same-position or overall club-decade rating distribution.
"""
    SUMMARY_MD.write_text(summary, encoding="utf-8", newline="\n")


def apply_import(
    imports: list[dict[str, Any]],
    existing_rows: list[dict[str, str]],
) -> None:
    player_rows = [row["_player_row"] for row in imports]
    with PLAYERS_CSV.open("w", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=PLAYER_FIELDS)
        writer.writeheader()
        writer.writerows(existing_rows)
        writer.writerows(player_rows)

    roll_rows = read_csv(ROLL_POOL_CSV)
    added_by_club_decade: dict[str, int] = defaultdict(int)
    for row in player_rows:
        added_by_club_decade[row["club_decade_id"]] += 1
    if roll_rows:
        fields = list(roll_rows[0])
        for row in roll_rows:
            added = added_by_club_decade.get(row["club_decade_id"], 0)
            if added:
                row["players_count"] = str(int(row["players_count"]) + added)
        write_csv(ROLL_POOL_CSV, roll_rows, fields, encoding="utf-8")

    runtime_players = json.loads(PLAYERS_JSON.read_text(encoding="utf-8"))
    runtime_fields = {
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
        "goals",
        "assists",
        "clean_sheets",
        "raw_score",
        "local_rating",
        "global_rating",
        "global_percentile",
        "hidden_modifier",
        "effective_global_rating",
    }
    runtime_players.extend(
        {
            field: value
            for field, value in row.items()
            if field in runtime_fields
        }
        for row in player_rows
    )
    PLAYERS_JSON.write_text(
        json.dumps(runtime_players, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Append the reviewed rows to production CSV/JSON data.",
    )
    args = parser.parse_args()

    imports, skipped, manual, existing_rows = build_plan()
    write_review_files(imports, skipped, manual, applied=False)
    print(
        f"Review prepared: {len(imports)} imports, {len(skipped)} duplicates, "
        f"{len(manual)} manual-review rows"
    )
    if args.apply:
        apply_import(imports, existing_rows)
        write_review_files(imports, skipped, manual, applied=True)
        print("Production player data updated")


if __name__ == "__main__":
    main()
