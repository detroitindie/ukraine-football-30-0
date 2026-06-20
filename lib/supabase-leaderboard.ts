import type {
  CupLeaderboardEntry,
  LeagueLeaderboardEntry,
  LeaderboardMode,
  PublicLineupPlayer,
} from "@/lib/leaderboard";
import type { CupMatchResult } from "@/lib/seasonSimulation";

const TABLE_NAME = "leaderboard_entries";
const CUP_TABLE_NAME = "cup_leaderboard";

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

function isLeaderboardEntry(value: unknown): value is LeagueLeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<LeagueLeaderboardEntry>;
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

function isCupPathItem(value: unknown): value is CupMatchResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const match = value as Partial<CupMatchResult>;
  return (
    typeof match.stage === "string"
    && (match.result === "win" || match.result === "loss")
    && typeof match.goalsFor === "number"
    && typeof match.goalsAgainst === "number"
    && (
      match.decidedBy === "regular_time"
      || match.decidedBy === "extra_time"
      || match.decidedBy === "penalties"
    )
    && typeof match.regularTimeWin === "boolean"
    && (match.penaltiesFor === undefined || typeof match.penaltiesFor === "number")
    && (match.penaltiesAgainst === undefined || typeof match.penaltiesAgainst === "number")
  );
}

function isCupLeaderboardEntry(value: unknown): value is CupLeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<CupLeaderboardEntry>;
  return (
    typeof entry.id === "string"
    && typeof entry.nickname === "string"
    && (entry.mode === "normal" || entry.mode === "hardcore")
    && typeof entry.stage_rank === "number"
    && typeof entry.stage_label_ua === "string"
    && typeof entry.stage_label_en === "string"
    && typeof entry.won_cup === "boolean"
    && typeof entry.regular_time_wins === "number"
    && typeof entry.goals_for === "number"
    && typeof entry.goals_against === "number"
    && typeof entry.goal_difference === "number"
    && Array.isArray(entry.cup_path)
    && entry.cup_path.every(isCupPathItem)
    && Array.isArray(entry.lineup)
    && entry.lineup.length === 11
    && entry.lineup.every(isPublicLineupPlayer)
    && (entry.language === "en" || entry.language === "ua")
    && typeof entry.created_at === "string"
  );
}

export async function readLeaderboard(
  mode: LeaderboardMode,
  limit: number,
  offset: number,
): Promise<{ entries: LeagueLeaderboardEntry[]; totalCount: number | null }> {
  const config = configuration();
  if (!config) {
    throw new LeaderboardConfigurationError("Supabase is not configured");
  }

  const query = new URLSearchParams({
    select: "id,nickname,mode,wins,draws,losses,score_points,lineup,created_at",
    mode: `eq.${mode}`,
    order: "wins.desc,draws.desc,losses.asc,score_points.desc,created_at.asc",
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(
    `${config.url}/rest/v1/${TABLE_NAME}?${query.toString()}`,
    {
      headers: {
        ...headers(config.key),
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  );
  const contentRange = response.headers.get("content-range");
  const totalText = contentRange?.split("/")[1];
  const totalCount = totalText && totalText !== "*"
    ? Number.parseInt(totalText, 10)
    : null;

  if (!response.ok && response.status !== 416) {
    throw new LeaderboardStorageError(`Supabase read failed: ${response.status}`);
  }
  const rows = response.ok ? await response.json() as unknown : [];
  const entries = Array.isArray(rows) ? rows.filter(isLeaderboardEntry) : [];

  return {
    entries,
    totalCount: Number.isInteger(totalCount) ? totalCount : null,
  };
}

export async function readCupLeaderboard(
  mode: LeaderboardMode,
  limit: number,
  offset: number,
): Promise<{ entries: CupLeaderboardEntry[]; totalCount: number | null }> {
  const config = configuration();
  if (!config) {
    throw new LeaderboardConfigurationError("Supabase is not configured");
  }

  const query = new URLSearchParams({
    select: "id,nickname,mode,stage_rank,stage_label_ua,stage_label_en,won_cup,regular_time_wins,goals_for,goals_against,goal_difference,cup_path,lineup,language,created_at",
    mode: `eq.${mode}`,
    order: "stage_rank.desc,regular_time_wins.desc,goals_for.desc,goal_difference.desc,created_at.desc",
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(
    `${config.url}/rest/v1/${CUP_TABLE_NAME}?${query.toString()}`,
    {
      headers: {
        ...headers(config.key),
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  );
  const contentRange = response.headers.get("content-range");
  const totalText = contentRange?.split("/")[1];
  const totalCount = totalText && totalText !== "*"
    ? Number.parseInt(totalText, 10)
    : null;

  if (!response.ok && response.status !== 416) {
    throw new LeaderboardStorageError(`Supabase cup read failed: ${response.status}`);
  }
  const rows = response.ok ? await response.json() as unknown : [];
  const entries = Array.isArray(rows) ? rows.filter(isCupLeaderboardEntry) : [];

  return {
    entries,
    totalCount: Number.isInteger(totalCount) ? totalCount : null,
  };
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
  const rows = await response.json() as LeagueLeaderboardEntry[];
  return rows[0];
}

type InsertCupEntry = {
  nickname: string;
  mode: LeaderboardMode;
  stage_rank: number;
  stage_label_ua: string;
  stage_label_en: string;
  won_cup: boolean;
  regular_time_wins: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  cup_path: CupMatchResult[];
  lineup: PublicLineupPlayer[];
  language: "en" | "ua";
};

export async function insertCupLeaderboardEntry(entry: InsertCupEntry) {
  const config = configuration();
  if (!config) {
    throw new LeaderboardConfigurationError("Supabase is not configured");
  }

  const response = await fetch(`${config.url}/rest/v1/${CUP_TABLE_NAME}`, {
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
      `Supabase cup insert failed: ${response.status}`,
    );
  }
  const rows = await response.json() as CupLeaderboardEntry[];
  return rows[0];
}
