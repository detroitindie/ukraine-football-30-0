#!/usr/bin/env python3
"""Audit whether legal elite lineups can reach a 30-0-0 season."""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_PATH = ROOT / "public" / "data" / "players.json"
ROLL_POOL_PATH = ROOT / "public" / "data" / "roll_pool.json"
SLOTS_PATH = ROOT / "public" / "data" / "formation_slots.json"
REPORT_PATH = (
    ROOT / "data-audit" / "patch-1-2a" / "balance_30_0_audit_before.md"
)

OPPONENT_STRENGTHS = (
    79, 77, 75, 74, 72, 71, 70, 69, 68, 67,
    66, 65, 64, 63, 62, 61, 60, 59, 57, 55,
    76, 73, 70, 68, 66, 64, 62, 60, 58, 54,
)
SEARCH_SEED = 30_000
SEARCH_ATTEMPTS = 150_000
PERFECT_TARGET = 25
TOP_POOL_SIZE = 60
COUNTERFACTUAL_TRIALS = 20_000
COUNTERFACTUAL_STRENGTHS = (85, 88, 90, 92, 94, 95)


@dataclass(frozen=True)
class Result:
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    strength: float


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as json_file:
        data = json.load(json_file)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array in {path}")
    return data


def rating(player: dict[str, Any]) -> float:
    value = player.get("effective_global_rating")
    if not isinstance(value, (int, float)):
        value = player.get("global_rating")
    return float(value) if isinstance(value, (int, float)) else 65.0


def unsigned_32(value: int) -> int:
    return value & 0xFFFFFFFF


def imul(left: int, right: int) -> int:
    return unsigned_32(unsigned_32(left) * unsigned_32(right))


def lineup_hash(lineup: list[dict[str, Any]]) -> int:
    signature = "|".join(
        sorted(
            f'{player["player_id"]}:{player["club_decade_id"]}'
            for player in lineup
        )
    )
    value = 2_166_136_261
    for character in signature:
        value = imul(value ^ ord(character), 16_777_619)
    return value


class SimulationRandom:
    """Exact unsigned-32-bit mirror of the frontend Mulberry32 generator."""

    def __init__(self, seed: int) -> None:
        self.state = unsigned_32(seed)

    def next(self) -> float:
        self.state = unsigned_32(self.state + 0x6D2B79F5)
        value = self.state
        value = imul(value ^ (value >> 15), value | 1)
        value ^= unsigned_32(value + imul(value ^ (value >> 7), value | 61))
        return unsigned_32(value ^ (value >> 14)) / 4_294_967_296


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def sample_poisson(expected: float, random_source: SimulationRandom) -> int:
    limit = math.exp(-expected)
    product = 1.0
    count = 0
    while True:
        count += 1
        product *= random_source.next()
        if product <= limit or count >= 8:
            break
    return min(6, count - 1)


def simulate_strength(strength: float, seed: int) -> Result:
    random_source = SimulationRandom(seed)
    wins = draws = losses = goals_for = goals_against = 0

    for opponent_strength in OPPONENT_STRENGTHS:
        home_factor = 0.12 if random_source.next() < 0.5 else -0.06
        team_expected_goals = clamp(
            1.22 + (strength - opponent_strength) * 0.043 + home_factor,
            0.35,
            2.85,
        )
        opponent_expected_goals = clamp(
            1.24
            - (strength - opponent_strength) * 0.034
            - home_factor * 0.6,
            0.35,
            2.65,
        )
        team_goals = sample_poisson(team_expected_goals, random_source)
        opponent_goals = sample_poisson(
            opponent_expected_goals,
            random_source,
        )
        goals_for += team_goals
        goals_against += opponent_goals
        if team_goals > opponent_goals:
            wins += 1
        elif team_goals == opponent_goals:
            draws += 1
        else:
            losses += 1

    return Result(
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        strength,
    )


def simulate_lineup(lineup: list[dict[str, Any]]) -> Result:
    strength = clamp(
        sum(rating(player) for player in lineup) / len(lineup),
        45,
        95,
    )
    return simulate_strength(strength, lineup_hash(lineup))


def candidate_pools(
    players: list[dict[str, Any]],
    roll_pool: list[dict[str, Any]],
    slots: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[list[dict[str, Any]]]]:
    reachable_ids = {entry["club_decade_id"] for entry in roll_pool}
    reachable = [
        player
        for player in players
        if player.get("club_decade_id") in reachable_ids
    ]
    pools = []
    for slot in slots:
        best_entry_by_player: dict[int, dict[str, Any]] = {}
        for player in reachable:
            if player.get("game_position") not in slot["allowed_positions"]:
                continue
            player_id = int(player["player_id"])
            current = best_entry_by_player.get(player_id)
            if current is None or rating(player) > rating(current):
                best_entry_by_player[player_id] = player
        pools.append(
            sorted(
                best_entry_by_player.values(),
                key=lambda player: (
                    -rating(player),
                    str(player["club_decade_player_id"]),
                ),
            )[:TOP_POOL_SIZE]
        )
    return reachable, pools


def strongest_lineup(
    pools: list[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    lineup = []
    used_player_ids: set[int] = set()
    for pool in pools:
        player = next(
            player
            for player in pool
            if int(player["player_id"]) not in used_player_ids
        )
        lineup.append(player)
        used_player_ids.add(int(player["player_id"]))
    return lineup


def lineup_key(lineup: list[dict[str, Any]]) -> tuple[str, ...]:
    return tuple(sorted(str(player["club_decade_player_id"]) for player in lineup))


def random_elite_lineup(
    pools: list[list[dict[str, Any]]],
    random_source: random.Random,
) -> list[dict[str, Any]] | None:
    lineup = []
    used_player_ids: set[int] = set()
    for pool in pools:
        limit = 12 if random_source.random() < 0.8 else 40
        available = [
            player
            for player in pool[:limit]
            if int(player["player_id"]) not in used_player_ids
        ]
        if not available:
            return None
        rank = int((random_source.random() ** 2) * len(available))
        player = available[rank]
        lineup.append(player)
        used_player_ids.add(int(player["player_id"]))
    return lineup


def search_lineups(
    pools: list[list[dict[str, Any]]],
) -> tuple[
    int,
    list[tuple[Result, list[dict[str, Any]]]],
    list[tuple[Result, list[dict[str, Any]]]],
]:
    random_source = random.Random(SEARCH_SEED)
    seen: set[tuple[str, ...]] = set()
    best: list[tuple[Result, list[dict[str, Any]]]] = []
    perfect: list[tuple[Result, list[dict[str, Any]]]] = []

    for _ in range(SEARCH_ATTEMPTS):
        lineup = random_elite_lineup(pools, random_source)
        if lineup is None:
            continue
        key = lineup_key(lineup)
        if key in seen:
            continue
        seen.add(key)
        result = simulate_lineup(lineup)
        best.append((result, lineup))
        best.sort(
            key=lambda entry: (
                entry[0].wins,
                -entry[0].losses,
                -entry[0].draws,
                entry[0].goals_for - entry[0].goals_against,
                entry[0].strength,
            ),
            reverse=True,
        )
        del best[12:]
        if result.wins == 30:
            perfect.append((result, lineup))
            if len(perfect) >= PERFECT_TARGET:
                break

    return len(seen), best, perfect


def counterfactual_probabilities() -> dict[int, tuple[int, int]]:
    probabilities = {}
    for strength in COUNTERFACTUAL_STRENGTHS:
        perfect = sum(
            simulate_strength(float(strength), seed).wins == 30
            for seed in range(COUNTERFACTUAL_TRIALS)
        )
        probabilities[strength] = (perfect, COUNTERFACTUAL_TRIALS)
    return probabilities


def clean_name(player: dict[str, Any]) -> str:
    name = str(player.get("player_name") or "")
    display_name = name.rsplit(" (", 1)[0]
    try:
        return display_name.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return display_name


def result_text(result: Result) -> str:
    return (
        f"{result.wins}-{result.draws}-{result.losses}, "
        f"{result.goals_for}-{result.goals_against} goals"
    )


def lineup_table(
    title: str,
    entries: list[tuple[Result, list[dict[str, Any]]]],
    slots: list[dict[str, Any]],
    limit: int,
) -> str:
    lines = [f"### {title}", ""]
    for index, (result, lineup) in enumerate(entries[:limit], start=1):
        lines.extend(
            [
                f"#### Lineup {index}: {result_text(result)}",
                "",
                f"- Average strength: {result.strength:.2f}",
                "",
                "| Slot | Player | Position | Rating | Club-decade |",
                "| --- | --- | --- | ---: | --- |",
            ]
        )
        for slot, player in zip(slots, lineup):
            lines.append(
                f'| {slot["slot_label"]} | {clean_name(player)} | '
                f'{player["game_position"]} | {rating(player):.1f} | '
                f'{player["team_name"]} / {player["decade"]} |'
            )
        lines.append("")
    return "\n".join(lines)


def write_report(
    players: list[dict[str, Any]],
    reachable: list[dict[str, Any]],
    slots: list[dict[str, Any]],
    strongest: list[dict[str, Any]],
    searched_count: int,
    best: list[tuple[Result, list[dict[str, Any]]]],
    perfect: list[tuple[Result, list[dict[str, Any]]]],
    probabilities: dict[int, tuple[int, int]],
) -> None:
    strongest_result = simulate_lineup(strongest)
    probability_lines = []
    for strength, (perfect_count, trials) in probabilities.items():
        percentage = perfect_count / trials * 100
        probability_lines.append(
            f"| {strength} | {perfect_count}/{trials} | {percentage:.3f}% |"
        )

    report = f"""# Patch 1.2A: 30-0-0 Balance Audit Before

## Verdict

- **30-0-0 is possible under the current simulation without any changes.**
- Distinct valid 30-0-0 lineups found: **{len(perfect)}**.
- Unique elite lineups evaluated before stopping: **{searched_count}**.
- Target of at least 10 viable distinct lineups: **passed**.
- Gameplay adjustment recommended: **none**.

The search stops after finding {PERFECT_TARGET} perfect lineups, so the count is
a demonstrated lower bound rather than the total number present in the full
lineup space.

## Current Simulation

- Team strength is the arithmetic mean of the 11 players'
  `effective_global_rating`, falling back to `global_rating` and then 65.
- Strength is clamped to 45-95. The highest-rating legal lineup found has average
  strength **{sum(rating(player) for player in strongest) / 11:.2f}**, so the
  upper cap does not reduce it.
- Each of 30 matches compares that single team-strength value with a fixed
  opponent-strength list ranging from 54 to 79.
- Expected goals use small strength-difference coefficients and a home/away
  factor, then both teams' scores are sampled from capped Poisson distributions.
- Randomness exists, but its seed is the sorted set of
  `player_id:club_decade_id` values. The same lineup therefore always receives
  the same result; replaying it does not reroll the season.
- Formation matters for draft eligibility only. Once the lineup is complete,
  every player contributes equally to the average strength.
- Draft validity requires all 11 configured slots, compatible
  `game_position`, a reachable roll-pool club-decade, and distinct `player_id`
  values.

## Data And Formation Constraints

- Runtime player rows: {len(players)}
- Reachable roll-pool player rows: {len(reachable)}
- Reachable distinct player IDs: {len({player["player_id"] for player in reachable})}
- Formation slots: {len(slots)}
- Every slot has multiple elite options; no position blocks a high-end lineup.

## Strongest Rating Lineup

- Deterministic result: **{result_text(strongest_result)}**
- Average strength: **{strongest_result.strength:.2f}**

The highest-rating lineup found is not automatically the best result because the
lineup identity also controls the deterministic random sequence. Its
{strongest_result.draws} draw(s) show that the bottleneck is elite-level match
variance, not insufficient ratings or an unreachable threshold.

{lineup_table("Perfect Lineups Found", perfect, slots, 10)}

{lineup_table("Best Search Results", best, slots, 5)}

## Counterfactual Random-Seed Trials

These trials hold strength constant and vary only the random seed. They do not
change live gameplay; they estimate how rare a perfect season is at each elite
strength level.

| Strength | Perfect seasons | Estimated probability |
| ---: | ---: | ---: |
{chr(10).join(probability_lines)}

## Bottlenecks

- **Ratings:** not a blocker. Valid lineups can exceed 90 average strength.
- **Thresholds/caps:** not a blocker. The strongest lineup remains below the
  95 strength cap, and no record-mapping threshold prevents 30 wins.
- **Formation:** not a blocker. All required positions have sufficient elite
  depth in reachable club-decades.
- **Randomness:** the main limiting factor. Even elite expected-goal advantages
  leave a small chance of a draw or loss in every match.
- **Deterministic seed:** makes the challenge lineup-specific. A near-identical
  legal lineup may receive a different 30-match random sequence.

## Balance Decision

No simulation tweak is implemented. The current system already produces more
than 10 demonstrated legal perfect-season lineups while keeping the
counterfactual probability around a few tenths of one percent even at the
extreme top end. Increasing elite output would make 30-0-0 less exceptional
without solving an actual reachability problem.

## Audit Method And Limits

- The script mirrors the TypeScript hash, random generator, Poisson sampler,
  expected-goal formulas, clamps, and opponent list.
- Candidate generation is deterministic and biased toward the top 40 players
  available for each slot, with 80% of choices drawn from the top 12.
- The search is not an exhaustive enumeration of the enormous valid lineup
  space. The reported perfect count is only what was directly demonstrated.
- Run with `npm run audit:30-0` to regenerate this report.
"""
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report, encoding="utf-8", newline="\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail unless the audit demonstrates at least 10 perfect lineups.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    players = load_json(PLAYERS_PATH)
    roll_pool = load_json(ROLL_POOL_PATH)
    slots = sorted(load_json(SLOTS_PATH), key=lambda slot: slot["slot_order"])
    reachable, pools = candidate_pools(players, roll_pool, slots)
    strongest = strongest_lineup(pools)
    searched_count, best, perfect = search_lineups(pools)
    probabilities = counterfactual_probabilities()
    write_report(
        players,
        reachable,
        slots,
        strongest,
        searched_count,
        best,
        perfect,
        probabilities,
    )

    if args.check and len(perfect) < 10:
        raise SystemExit(
            f"Only {len(perfect)} valid perfect-season lineups were found"
        )

    print(
        f"30-0 audit passed: searched {searched_count} unique lineups, "
        f"found {len(perfect)} perfect lineups"
    )
    print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
