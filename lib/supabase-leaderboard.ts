import type {
  LeaderboardEntry,
  LeaderboardMode,
  PublicLineupPlayer,
} from "@/lib/leaderboard";

const TABLE_NAME = "leaderboard_entries";

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return { url, key };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export class LeaderboardConfigurationError extends Error {}
export class LeaderboardStorageError extends Error {}

function isPublicLineupPlayer(value: unknown): value is PublicLineupPlayer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const player = value as Partial<PublicLineupPlayer>;
  return (
    typeof player.player_name === "string"
    && typeof player.game_position === "string"
    && typeof player.slot_position === "string"
    && typeof player.position_label === "string"
  );
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<LeaderboardEntry>;
  return (
    typeof entry.id === "string"
    && typeof entry.nickname === "string"
    && (entry.mode === "normal" || entry.mode === "hardcore")
    && typeof entry.wins === "number"
    && typeof entry.draws === "number"
    && typeof entry.losses === "number"
    && typeof entry.score_points === "number"
    && typeof entry.created_at === "string"
    && Array.isArray(entry.lineup)
    && entry.lineup.length === 11
    && entry.lineup.every(isPublicLineupPlayer)
  );
}

export async function readLeaderboard(
  mode: LeaderboardMode,
  limit: number,
): Promise<LeaderboardEntry[]> {
  const config = configuration();
  if (!config) {
    throw new LeaderboardConfigurationError("Supabase is not configured");
  }

  const query = new URLSearchParams({
    select: "id,nickname,mode,wins,draws,losses,score_points,lineup,created_at",
    mode: `eq.${mode}`,
    order: "wins.desc,draws.desc,losses.asc,score_points.desc,created_at.asc",
    limit: String(limit),
  });
  const response = await fetch(
    `${config.url}/rest/v1/${TABLE_NAME}?${query.toString()}`,
    {
      headers: headers(config.key),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new LeaderboardStorageError(`Supabase read failed: ${response.status}`);
  }
  const rows = await response.json() as unknown;
  return Array.isArray(rows) ? rows.filter(isLeaderboardEntry) : [];
}

type InsertEntry = {
  nickname: string;
  mode: LeaderboardMode;
  wins: number;
  draws: number;
  losses: number;
  score_points: number;
  lineup: PublicLineupPlayer[];
};

export async function insertLeaderboardEntry(entry: InsertEntry) {
  const config = configuration();
  if (!config) {
    throw new LeaderboardConfigurationError("Supabase is not configured");
  }

  const response = await fetch(`${config.url}/rest/v1/${TABLE_NAME}`, {
    method: "POST",
    headers: {
      ...headers(config.key),
      Prefer: "return=representation",
    },
    body: JSON.stringify(entry),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new LeaderboardStorageError(
      `Supabase insert failed: ${response.status}`,
    );
  }
  const rows = await response.json() as LeaderboardEntry[];
  return rows[0];
}
