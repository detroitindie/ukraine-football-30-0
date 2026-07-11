import type { DraftCompetition, DraftMode, DraftPlayer, Lineup } from "@/lib/draft-types";
import type { FormationId } from "@/lib/formations";
import type { CupSimulationResult, SeasonResult } from "@/lib/seasonSimulation";

export type AchievementId = string;

export type LocalizedAchievementText = {
  ua: string;
  en: string;
};

export type AchievementRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary";

export type Achievement = {
  id: AchievementId;
  numericId: number;
  title: LocalizedAchievementText;
  description: LocalizedAchievementText;
  rarity: AchievementRarity;
  competition: "Both" | "League" | "Cup";
};

export type AchievementRunInput = {
  competition: DraftCompetition;
  mode: DraftMode;
  formationId: FormationId;
  lineup: Lineup;
  result: SeasonResult | CupSimulationResult;
};

export type LineupPlayer = DraftPlayer & {
  slotId: string;
};
