import type { Achievement } from "@/lib/achievements/types";
import type { Language } from "@/lib/language";

const SHARE_HEADER = {
  en: "Achievements:",
  ua: "Досягнення:",
} as const;

export function achievementShareLines(
  achievements: Achievement[],
  language: Language,
) {
  if (achievements.length === 0) {
    return [];
  }

  return [
    "",
    SHARE_HEADER[language],
    ...achievements.map((achievement) => `- ${achievement.title[language]}`),
  ];
}
