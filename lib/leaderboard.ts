import type { DraftMode, DraftPlayer, Lineup } from "@/lib/draft-types";
import type { SeasonResult } from "@/lib/seasonSimulation";
import { cleanPlayerName } from "@/lib/player-display";

export const LEADERBOARD_MODES = ["normal", "hardcore"] as const;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number];

export type PublicLineupPlayer = {
  player_name: string;
  game_position: string;
  slot_position: string;
  position_label: string;
};

export type LeaderboardEntry = {
  id: string;
  nickname: string;
  mode: LeaderboardMode;
  wins: number;
  draws: number;
  losses: number;
  score_points: number;
  lineup: PublicLineupPlayer[];
  created_at: string;
};

export type LeaderboardPage = {
  entries: LeaderboardEntry[];
  totalCount: number | null;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type LeaderboardSubmission = {
  nickname: string;
  mode: DraftMode;
  lineup: Lineup;
  result: SeasonResult;
};

export const FORMATION_SLOTS = [
  { slotId: "gk", label: "GK", allowed: ["GK"] },
  { slotId: "lb", label: "LB", allowed: ["LB"] },
  { slotId: "cb_1", label: "CB", allowed: ["CB"] },
  { slotId: "cb_2", label: "CB", allowed: ["CB"] },
  { slotId: "rb", label: "RB", allowed: ["RB"] },
  { slotId: "cm", label: "CM", allowed: ["CM", "CDM"] },
  { slotId: "am_cm", label: "AM/CM", allowed: ["AM", "CM"] },
  { slotId: "lm", label: "LM", allowed: ["LM"] },
  { slotId: "rm", label: "RM", allowed: ["RM"] },
  { slotId: "am_fw", label: "AM/FW", allowed: ["AM", "FW"] },
  { slotId: "fw", label: "FW", allowed: ["FW"] },
] as const;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const DISALLOWED_NICKNAME_CHARACTERS = /[<>{}[\]\\/"'`]/g;

export function sanitizeNickname(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(DISALLOWED_NICKNAME_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidNickname(value: string) {
  const length = Array.from(value).length;
  return length >= NICKNAME_MIN_LENGTH && length <= NICKNAME_MAX_LENGTH;
}

export function isLeaderboardMode(value: unknown): value is LeaderboardMode {
  return value === "normal" || value === "hardcore";
}

export function isValidSubmissionLineup(value: unknown): value is Lineup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const lineup = value as Record<string, Partial<DraftPlayer>>;
  const playerIds = new Set<number>();

  for (const slot of FORMATION_SLOTS) {
    const player = lineup[slot.slotId];
    if (
      !player
      || typeof player.club_decade_player_id !== "string"
      || typeof player.player_id !== "number"
      || typeof player.club_decade_id !== "string"
      || typeof player.player_name !== "string"
      || typeof player.game_position !== "string"
      || !slot.allowed.some((position) => position === player.game_position)
    ) {
      return false;
    }
    if (playerIds.has(player.player_id)) {
      return false;
    }
    playerIds.add(player.player_id);
  }

  return Object.keys(lineup).length === FORMATION_SLOTS.length;
}

export function publicLineup(lineup: Lineup): PublicLineupPlayer[] {
  return FORMATION_SLOTS.map((slot) => {
    const player = lineup[slot.slotId];
    return {
      player_name: cleanPlayerName(player.player_name).slice(0, 80),
      game_position: player.game_position.slice(0, 8),
      slot_position: slot.slotId,
      position_label: slot.label,
    };
  });
}

export function resultsMatch(left: SeasonResult, right: SeasonResult) {
  return (
    left.matches === right.matches
    && left.wins === right.wins
    && left.draws === right.draws
    && left.losses === right.losses
    && left.points === right.points
    && left.goalsFor === right.goalsFor
    && left.goalsAgainst === right.goalsAgainst
    && left.goalDifference === right.goalDifference
    && left.verdict === right.verdict
  );
}

export function resultFingerprint(submission: Omit<LeaderboardSubmission, "nickname">) {
  const lineupSignature = FORMATION_SLOTS.map((slot) => {
    const player = submission.lineup[slot.slotId];
    return `${slot.slotId}:${player.player_id}:${player.club_decade_id}`;
  }).join("|");

  return [
    submission.mode,
    submission.result.wins,
    submission.result.draws,
    submission.result.losses,
    submission.result.points,
    lineupSignature,
  ].join(":");
}
