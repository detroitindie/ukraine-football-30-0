import type { Metadata } from "next";

export const siteDescriptions = {
  en: "Draft your starting 11 from various teams and years. See if this team can go 30-0 in the Ukrainian League.",
  ua: "Збери XI з історії українського клубного футболу та спробуй виграти симуляцію 30-0.",
} as const;

export const pageTitles = {
  "/": {
    en: "30-0: Ukrainian League",
    ua: "30-0: Українська ліга",
  },
  "/draft": {
    en: "Your 4-4-2 formation | 30-0: Ukrainian League",
    ua: "Твоя схема 4-4-2 | 30-0: Українська ліга",
  },
  "/result": {
    en: "Season Result | 30-0: Ukrainian League",
    ua: "Результат сезону | 30-0: Українська ліга",
  },
  "/leaderboard": {
    en: "Global Leaderboard | 30-0: Ukrainian League",
    ua: "Глобальна таблиця лідерів | 30-0: Українська ліга",
  },
  "/rules": {
    en: "Rules of the challenge | 30-0: Ukrainian League",
    ua: "Правила випробування | 30-0: Українська ліга",
  },
  "/about": {
    en: "Simple fantasy game about Ukrainian football | 30-0: Ukrainian League",
    ua: "Мінімалістична фентезі-гра про український футбол | 30-0: Українська ліга",
  },
  "/privacy": {
    en: "Privacy Policy | 30-0: Ukrainian League",
    ua: "Політика конфіденційності | 30-0: Українська ліга",
  },
  "/cookies": {
    en: "Cookie Policy | 30-0: Ukrainian League",
    ua: "Політика файлів cookie | 30-0: Українська ліга",
  },
} as const;

export type PagePath = keyof typeof pageTitles;

export function createPageMetadata(path: PagePath): Metadata {
  return {
    title: pageTitles[path].en,
    description: siteDescriptions.en,
  };
}
