import spec from "@/docs/achievement-implementation-spec.json";
import raritySpec from "@/docs/achievement-rarity-final.json";
import type { Achievement, AchievementRarity } from "@/lib/achievements/types";

type SpecAchievement = {
  id: number;
  title_ua: string;
  title_en: string;
  description_ua: string;
  description_en: string;
  competition: Achievement["competition"];
};

type RaritySpecAchievement = {
  id: number;
  rarity: AchievementRarity;
};

const VALID_RARITIES = new Set<AchievementRarity>([
  "common",
  "rare",
  "epic",
  "legendary",
]);

const rarityById = new Map(
  (raritySpec.achievements as RaritySpecAchievement[]).map((achievement) => [
    achievement.id,
    achievement.rarity,
  ]),
);

function rarityForAchievement(id: number): AchievementRarity {
  const rarity = rarityById.get(id);
  if (!rarity || !VALID_RARITIES.has(rarity)) {
    throw new Error(`Achievement ${id} is missing a valid rarity.`);
  }
  return rarity;
}

export const ACHIEVEMENTS: Achievement[] = (
  spec.achievements as SpecAchievement[]
).map((achievement) => ({
  id: String(achievement.id),
  numericId: achievement.id,
  title: {
    ua: achievement.title_ua,
    en: achievement.title_en,
  },
  description: {
    ua: achievement.description_ua,
    en: achievement.description_en,
  },
  rarity: rarityForAchievement(achievement.id),
  competition: achievement.competition,
}));

export const ACHIEVEMENT_COUNT = spec.metadata.achievement_count;
