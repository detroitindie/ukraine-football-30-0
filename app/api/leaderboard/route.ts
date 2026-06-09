import {
  FORMATION_SLOTS,
  isLeaderboardMode,
  isValidNickname,
  isValidSubmissionLineup,
  publicLineup,
  resultsMatch,
  sanitizeNickname,
  type LeaderboardSubmission,
} from "@/lib/leaderboard";
import type { DraftPlayer, Lineup } from "@/lib/draft-types";
import { simulateSeason } from "@/lib/seasonSimulation";
import {
  insertLeaderboardEntry,
  LeaderboardConfigurationError,
  LeaderboardStorageError,
  readLeaderboard,
} from "@/lib/supabase-leaderboard";
import runtimePlayers from "@/public/data/players.json";
import runtimeRollPool from "@/public/data/roll_pool.json";

export const dynamic = "force-dynamic";

const playersByEntryId = new Map(
  (runtimePlayers as DraftPlayer[]).map((player) => [
    player.club_decade_player_id,
    player,
  ]),
);
const reachableClubDecades = new Set(
  runtimeRollPool.map((entry) => entry.club_decade_id),
);

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function canonicalLineup(submitted: Lineup): Lineup | null {
  const canonical: Lineup = {};
  const playerIds = new Set<number>();

  for (const slot of FORMATION_SLOTS) {
    const submittedPlayer = submitted[slot.slotId];
    const player = playersByEntryId.get(submittedPlayer.club_decade_player_id);
    if (
      !player
      || player.player_id !== submittedPlayer.player_id
      || !reachableClubDecades.has(player.club_decade_id)
      || !slot.allowed.some((position) => position === player.game_position)
      || playerIds.has(player.player_id)
    ) {
      return null;
    }
    canonical[slot.slotId] = player;
    playerIds.add(player.player_id);
  }

  return canonical;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (!isLeaderboardMode(mode)) {
    return errorResponse("Invalid leaderboard mode", 400);
  }
  const requestedLimit = Number(url.searchParams.get("limit") ?? 10);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 10;

  try {
    return Response.json({ entries: await readLeaderboard(mode, limit) });
  } catch (error) {
    if (error instanceof LeaderboardConfigurationError) {
      return errorResponse("Leaderboard is not configured", 503);
    }
    if (error instanceof LeaderboardStorageError) {
      return errorResponse("Leaderboard could not be loaded", 502);
    }
    return errorResponse("Leaderboard could not be loaded", 500);
  }
}

export async function POST(request: Request) {
  let body: Partial<LeaderboardSubmission>;
  try {
    body = await request.json() as Partial<LeaderboardSubmission>;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const nickname = sanitizeNickname(body.nickname);
  if (!isValidNickname(nickname)) {
    return errorResponse("Invalid nickname", 400);
  }
  if (!isLeaderboardMode(body.mode)) {
    return errorResponse("Invalid mode", 400);
  }
  if (!isValidSubmissionLineup(body.lineup) || !body.result) {
    return errorResponse("Invalid lineup or result", 400);
  }
  const verifiedLineup = canonicalLineup(body.lineup);
  if (!verifiedLineup) {
    return errorResponse("Lineup contains unavailable players", 400);
  }

  const recomputedResult = simulateSeason(Object.values(verifiedLineup));
  if (!resultsMatch(body.result, recomputedResult)) {
    return errorResponse("Submitted result could not be verified", 400);
  }

  try {
    const entry = await insertLeaderboardEntry({
      nickname,
      mode: body.mode,
      wins: recomputedResult.wins,
      draws: recomputedResult.draws,
      losses: recomputedResult.losses,
      score_points: recomputedResult.points,
      lineup: publicLineup(verifiedLineup),
    });
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof LeaderboardConfigurationError) {
      return errorResponse("Leaderboard is not configured", 503);
    }
    if (error instanceof LeaderboardStorageError) {
      return errorResponse("Result could not be submitted", 502);
    }
    return errorResponse("Result could not be submitted", 500);
  }
}
