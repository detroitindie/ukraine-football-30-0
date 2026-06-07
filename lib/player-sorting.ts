import type { DraftMode, DraftPlayer } from "@/lib/draft-types";
import { cleanPlayerName, safePlayerStat } from "@/lib/player-display";

const POSITION_ORDER = [
  "GK",
  "LB",
  "CB",
  "RB",
  "CDM",
  "LM",
  "CM",
  "RM",
  "AM",
  "FW",
] as const;

const positionRanks = new Map<string, number>(
  POSITION_ORDER.map((position, index) => [position, index]),
);

export function normalizedPlayerName(player: DraftPlayer) {
  return cleanPlayerName(player.player_name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function positionRank(player: DraftPlayer) {
  return positionRanks.get(player.game_position) ?? POSITION_ORDER.length;
}

function availableStatScore(player: DraftPlayer) {
  const goals = safePlayerStat(player.goals);
  const assists = safePlayerStat(player.assists);
  const cleanSheets = safePlayerStat(player.clean_sheets);
  const availableCount = [goals, assists, cleanSheets].filter(
    (value) => value !== null,
  ).length;

  return {
    availableCount,
    score: (goals ?? 0) * 5 + (assists ?? 0) * 4 + (cleanSheets ?? 0) * 1.5,
  };
}

export function compareDraftPlayers(mode: DraftMode) {
  return (left: DraftPlayer, right: DraftPlayer) => {
    if (mode === "normal") {
      const leftStats = availableStatScore(left);
      const rightStats = availableStatScore(right);

      if (
        leftStats.availableCount > 0
        && rightStats.availableCount > 0
        && leftStats.score !== rightStats.score
      ) {
        return rightStats.score - leftStats.score;
      }
      if ((leftStats.availableCount > 0) !== (rightStats.availableCount > 0)) {
        return rightStats.availableCount > 0 ? 1 : -1;
      }
    }

    const positionDifference = positionRank(left) - positionRank(right);
    if (positionDifference !== 0) {
      return positionDifference;
    }

    return normalizedPlayerName(left).localeCompare(normalizedPlayerName(right));
  };
}
