#!/usr/bin/env python3
"""Validate Patch 1.2B leaderboard implementation artifacts."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require(path: str, snippets: tuple[str, ...]) -> None:
    file_path = ROOT / path
    if not file_path.exists():
        raise SystemExit(f"Missing leaderboard file: {path}")
    source = file_path.read_text(encoding="utf-8")
    missing = [snippet for snippet in snippets if snippet not in source]
    if missing:
        raise SystemExit(f"{path} is missing: {', '.join(missing)}")


def main() -> None:
    require(
        "app/api/leaderboard/route.ts",
        (
            "simulateSeason(Object.values(verifiedLineup))",
            "canonicalLineup",
            "sanitizeNickname",
            "resultsMatch",
            "publicLineup(verifiedLineup)",
        ),
    )
    require(
        "lib/leaderboard.ts",
        (
            "NICKNAME_MIN_LENGTH = 2",
            "NICKNAME_MAX_LENGTH = 20",
            "playerIds.has",
            "club_decade_player_id",
        ),
    )
    require(
        "supabase/migrations/20260609_create_leaderboard_entries.sql",
        (
            "enable row level security",
            'create policy "Public leaderboard read"',
            'create policy "Public validated leaderboard insert"',
            "wins + draws + losses = 30",
            "score_points = wins * 3 + draws",
        ),
    )
    require(
        "supabase/migrations/20260609_remove_public_leaderboard_ratings.sql",
        (
            "create or replace function public.is_valid_leaderboard_lineup",
            "'rating'",
            "'global_rating'",
        ),
    )
    require(
        "data-audit/patch-1-2b/leaderboard_setup.md",
        (
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "Vercel",
            "Manual Test Plan",
        ),
    )
    require(
        "components/result/season-result.tsx",
        (
            "<ResultSubmission season={savedSeason} />",
            "<LeaderboardBoard compact initialMode={savedSeason.mode} />",
            "async function shareResult()",
        ),
    )
    require(
        "components/leaderboard/leaderboard-board.tsx",
        (
            "leaderboard-compact-rank",
            "leaderboard-col-lineup",
            "player.game_position !== player.position_label",
        ),
    )

    protected_sources = [
        ROOT / "app",
        ROOT / "components",
        ROOT / "lib",
    ]
    for directory in protected_sources:
        for path in directory.rglob("*"):
            if path.suffix not in {".ts", ".tsx"}:
                continue
            source = path.read_text(encoding="utf-8")
            if "SERVICE_ROLE" in source:
                raise SystemExit(f"Service-role key reference found in {path}")

    public_board = (
        ROOT / "components/leaderboard/leaderboard-board.tsx"
    ).read_text(encoding="utf-8")
    if "player.rating" in public_board:
        raise SystemExit("Public leaderboard UI must not render player ratings")
    if 'id="leaderboard.eyebrow"' in public_board:
        raise SystemExit("Public leaderboard UI must not render the old kicker")

    public_payload = (ROOT / "lib/leaderboard.ts").read_text(encoding="utf-8")
    if "rating:" in public_payload:
        raise SystemExit("New public lineup payloads must not include ratings")

    print("Leaderboard validation passed")


if __name__ == "__main__":
    main()
