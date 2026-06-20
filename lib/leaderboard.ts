import type { DraftMode, DraftPlayer, Lineup } from "@/lib/draft-types";
import type {
  CupMatchResult,
  CupSimulationResult,
  SeasonResult,
} from "@/lib/seasonSimulation";
import { cleanPlayerName } from "@/lib/player-display";

export const LEADERBOARD_MODES = ["normal", "hardcore"] as const;
export const LEADERBOARD_COMPETITIONS = ["league", "cup"] as const;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number];
export type LeaderboardCompetition = (typeof LEADERBOARD_COMPETITIONS)[number];

export type PublicLineupPlayer = {
  player_name: string;
  game_position: string;
  slot_position: string;
  position_label: string;
};

export type LeagueLeaderboardEntry = {
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

export type CupLeaderboardEntry = {
  id: string;
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
  created_at: string;
};

export type LeaderboardEntry = LeagueLeaderboardEntry | CupLeaderboardEntry;

export type LeaderboardPage = {
  entries: LeaderboardEntry[];
  totalCount: number | null;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type LeaderboardSubmission = {
  competition: "league";
  nickname: string;
  mode: DraftMode;
  lineup: Lineup;
  result: SeasonResult;
};

export type CupLeaderboardSubmission = {
  competition: "cup";
  nickname: string;
  mode: DraftMode;
  lineup: Lineup;
  result: CupSimulationResult;
  language: "en" | "ua";
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

export function isLeaderboardCompetition(
  value: unknown,
): value is LeaderboardCompetition {
  return value === "league" || value === "cup";
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

export function cupResultsMatch(
  left: CupSimulationResult,
  right: CupSimulationResult,
) {
  return (
    left.competition === right.competition
    && left.stageRank === right.stageRank
    && left.stageLabelUa === right.stageLabelUa
    && left.stageLabelEn === right.stageLabelEn
    && left.wonCup === right.wonCup
    && left.regularTimeWins === right.regularTimeWins
    && left.goalsFor === right.goalsFor
    && left.goalsAgainst === right.goalsAgainst
    && left.goalDifference === right.goalDifference
    && left.matches.length === right.matches.length
    && left.matches.every((match, index) => {
      const other = right.matches[index];
      return (
        match.stage === other.stage
        && match.result === other.result
        && match.goalsFor === other.goalsFor
        && match.goalsAgainst === other.goalsAgainst
        && match.decidedBy === other.decidedBy
        && match.penaltiesFor === other.penaltiesFor
        && match.penaltiesAgainst === other.penaltiesAgainst
        && match.regularTimeWin === other.regularTimeWin
      );
    })
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

export function cupResultFingerprint(
  submission: Omit<CupLeaderboardSubmission, "nickname" | "language">,
) {
  const lineupSignature = FORMATION_SLOTS.map((slot) => {
    const player = submission.lineup[slot.slotId];
    return `${slot.slotId}:${player.player_id}:${player.club_decade_id}`;
  }).join("|");
  const pathSignature = submission.result.matches.map((match) => [
    match.stage,
    match.result,
    match.goalsFor,
    match.goalsAgainst,
    match.decidedBy,
    match.penaltiesFor ?? "",
    match.penaltiesAgainst ?? "",
  ].join(":")).join("|");

  return [
    submission.competition,
    submission.mode,
    submission.result.stageRank,
    submission.result.wonCup ? "1" : "0",
    submission.result.goalsFor,
    submission.result.goalsAgainst,
    pathSignature,
    lineupSignature,
  ].join(":");
}
