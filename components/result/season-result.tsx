"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { T } from "@/components/localized-text";
import {
  SEASON_RESULT_STORAGE_KEY,
  type SavedSeason,
  type SeasonResult,
  type SeasonVerdict,
} from "@/lib/seasonSimulation";
import { cleanPlayerName } from "@/lib/player-display";

const verdictKeys: Record<
  SeasonVerdict,
  | "result.verdictChampionship"
  | "result.verdictEurope"
  | "result.verdictMidTable"
  | "result.verdictRelegation"
> = {
  championship: "result.verdictChampionship",
  europe: "result.verdictEurope",
  midTable: "result.verdictMidTable",
  relegation: "result.verdictRelegation",
};

function isSeasonResult(value: unknown): value is SeasonResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<SeasonResult>;
  return (
    result.matches === 30 &&
    typeof result.wins === "number" &&
    typeof result.draws === "number" &&
    typeof result.losses === "number" &&
    result.wins + result.draws + result.losses === 30 &&
    typeof result.points === "number" &&
    typeof result.goalsFor === "number" &&
    typeof result.goalsAgainst === "number" &&
    typeof result.goalDifference === "number" &&
    typeof result.verdict === "string" &&
    result.verdict in verdictKeys
  );
}

function parseSavedSeason(rawValue: string | null): SavedSeason | null {
  try {
    if (!rawValue) {
      return null;
    }

    const saved = JSON.parse(rawValue) as Partial<SavedSeason>;
    if (!saved.lineup || !isSeasonResult(saved.result)) {
      return null;
    }

    return saved as SavedSeason;
  } catch {
    return null;
  }
}

function subscribeToStorage() {
  return () => {};
}

function getStoredSeason() {
  return sessionStorage.getItem(SEASON_RESULT_STORAGE_KEY);
}

function getServerSeason() {
  return null;
}

function signedGoalDifference(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

const lineupGroups = [
  {
    label: "result.goalkeeper" as const,
    slots: ["gk"],
  },
  {
    label: "result.defenders" as const,
    slots: ["lb", "cb_1", "cb_2", "rb"],
  },
  {
    label: "result.midfielders" as const,
    slots: ["lm", "cm", "am_cm", "rm"],
  },
  {
    label: "result.forwards" as const,
    slots: ["am_fw", "fw"],
  },
];

export function SeasonResultView() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const storedSeason = useSyncExternalStore(
    subscribeToStorage,
    getStoredSeason,
    getServerSeason,
  );
  const savedSeason = useMemo(
    () => parseSavedSeason(storedSeason),
    [storedSeason],
  );

  if (savedSeason === null) {
    return (
      <div className="compact-page result-page">
        <section className="result-empty">
          <h1><T id="result.emptyTitle" /></h1>
          <p><T id="result.emptyBody" /></p>
          <Link className="button button-primary" href="/draft">
            <T id="result.backToDraft" />
          </Link>
        </section>
      </div>
    );
  }

  const { result } = savedSeason;
  const groupedLineup = lineupGroups.map((group) => ({
    ...group,
    players: group.slots
      .map((slotId) => savedSeason.lineup[slotId])
      .filter(Boolean)
      .map((player) => cleanPlayerName(player.player_name)),
  }));
  const stats = [
    { label: "result.record" as const, value: `${result.wins}-${result.draws}-${result.losses}` },
    { label: "result.pointsLong" as const, value: String(result.points) },
    { label: "result.goals" as const, value: `${result.goalsFor}-${result.goalsAgainst}` },
    { label: "result.goalDifference" as const, value: signedGoalDifference(result.goalDifference) },
  ];

  async function shareResult() {
    const lineupText = groupedLineup
      .map((group) => group.players.join(", "))
      .join("\n-\n");
    const shareText = [
      "30-0: Українська ліга",
      window.location.origin,
      "",
      "My team:",
      `${result.wins}-${result.draws}-${result.losses}, ${result.points} pts`,
      "",
      lineupText,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  function playAgain() {
    sessionStorage.removeItem(SEASON_RESULT_STORAGE_KEY);
    router.push("/");
  }

  return (
    <div className="compact-page result-page">
      <header className="compact-heading">
        <h1><T id="result.seasonResult" /></h1>
      </header>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span><T id={stat.label} /></span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>
      <p className="result-verdict"><T id={verdictKeys[result.verdict]} /></p>
      <section className="result-lineup">
        <h2><T id="result.lineup" /></h2>
        <div className="result-lineup-groups">
          {groupedLineup.map((group) => (
            <div className="result-line" key={group.label}>
              <strong><T id={group.label} /></strong>
              <span>{group.players.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="result-actions">
        <button className="button button-primary" type="button" onClick={shareResult}>
          <T id="result.share" />
        </button>
        <button className="button button-secondary" type="button" onClick={playAgain}>
          <T id="result.playAgain" />
        </button>
        <span className={`copy-confirmation${copied ? " is-visible" : ""}`} aria-live="polite">
          {copied && <T id="result.copied" />}
        </span>
      </div>
    </div>
  );
}
