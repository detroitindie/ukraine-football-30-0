"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { ResultSubmission } from "@/components/leaderboard/result-submission";
import { useLanguage, type Language } from "@/lib/language";
import {
  DEFAULT_FORMATION_ID,
  FORMATIONS,
  formationSlots,
  isFormationId,
  type FormationId,
} from "@/lib/formations";
import {
  type CupDecision,
  type CupMatchResult,
  type CupSimulationResult,
  SEASON_RESULT_STORAGE_KEY,
  type SavedResult,
  type SavedSeason,
  type SeasonResult,
  type SeasonVerdict,
} from "@/lib/seasonSimulation";
import { cleanPlayerName } from "@/lib/player-display";
import { selectSeasonDescription } from "@/lib/season-description";
import { translations, type TranslationKey } from "@/lib/translations";

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

const CUP_REVEAL_DELAY_MS = 2300;

const cupStageLabels: Record<
  CupMatchResult["stage"],
  { en: string; ua: string }
> = {
  round_of_64: { en: "Round of 64", ua: "1/32" },
  round_of_32: { en: "Round of 32", ua: "1/16" },
  round_of_16: { en: "Round of 16", ua: "1/8" },
  quarter_final: { en: "Quarter-final", ua: "1/4" },
  semi_final: { en: "Semi-final", ua: "1/2" },
  final: { en: "Final", ua: "фінал" },
};

const cupDecisionLabels: Record<CupDecision, { en: string; ua: string }> = {
  regular_time: { en: "regular time", ua: "основний час" },
  extra_time: { en: "extra time", ua: "додатковий час" },
  penalties: { en: "penalties", ua: "пенальті" },
};

const cupVerdictKeys = [
  ["result.cupVerdictEarlyA", "result.cupVerdictEarlyB"],
  ["result.cupVerdictEarlyA", "result.cupVerdictEarlyB"],
  ["result.cupVerdictRoundOf16A", "result.cupVerdictRoundOf16B"],
  ["result.cupVerdictQuarterA", "result.cupVerdictQuarterB"],
  ["result.cupVerdictSemiA", "result.cupVerdictSemiB"],
  ["result.cupVerdictFinalLossA", "result.cupVerdictFinalLossB"],
  ["result.cupVerdictWinA", "result.cupVerdictWinB"],
] as const;

function text(language: Language, id: TranslationKey) {
  return translations[language][id];
}

function getActiveLanguage(): Language {
  return document.documentElement.dataset.language === "ua" ? "ua" : "en";
}

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

function isCupDecision(value: unknown): value is CupDecision {
  return (
    value === "regular_time" ||
    value === "extra_time" ||
    value === "penalties"
  );
}

function isCupMatchResult(value: unknown): value is CupMatchResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const match = value as Partial<CupMatchResult>;
  return (
    typeof match.stage === "string" &&
    match.stage in cupStageLabels &&
    (match.result === "win" || match.result === "loss") &&
    typeof match.goalsFor === "number" &&
    typeof match.goalsAgainst === "number" &&
    isCupDecision(match.decidedBy) &&
    typeof match.regularTimeWin === "boolean" &&
    (match.penaltiesFor === undefined || typeof match.penaltiesFor === "number") &&
    (match.penaltiesAgainst === undefined || typeof match.penaltiesAgainst === "number")
  );
}

function isCupSimulationResult(value: unknown): value is CupSimulationResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<CupSimulationResult>;
  return (
    result.competition === "cup" &&
    Array.isArray(result.matches) &&
    result.matches.length >= 1 &&
    result.matches.length <= 6 &&
    result.matches.every(isCupMatchResult) &&
    typeof result.stageRank === "number" &&
    Number.isInteger(result.stageRank) &&
    result.stageRank >= 0 &&
    result.stageRank <= 6 &&
    typeof result.stageLabelUa === "string" &&
    typeof result.stageLabelEn === "string" &&
    typeof result.wonCup === "boolean" &&
    typeof result.regularTimeWins === "number" &&
    typeof result.goalsFor === "number" &&
    typeof result.goalsAgainst === "number" &&
    typeof result.goalDifference === "number"
  );
}

function parseSavedResult(rawValue: string | null): SavedResult | null {
  try {
    if (!rawValue) {
      return null;
    }

    const saved = JSON.parse(rawValue) as Partial<SavedResult>;
    if (!saved.lineup) {
      return null;
    }

    const mode = saved.mode === "hardcore" ? "hardcore" : "normal";
    const competition = saved.competition === "cup" ? "cup" : "league";
    const formationId = isFormationId(saved.formationId)
      ? saved.formationId
      : DEFAULT_FORMATION_ID;
    if (competition === "cup") {
      const result = isCupSimulationResult(saved.result) ? saved.result : null;
      return {
        competition,
        mode,
        formationId,
        lineup: saved.lineup,
        result,
      };
    }
    if (!isSeasonResult(saved.result)) {
      return null;
    }
    return {
      competition,
      mode,
      formationId,
      lineup: saved.lineup,
      result: saved.result,
    } as SavedSeason;
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

function cupVerdictKey(result: CupSimulationResult) {
  const options = cupVerdictKeys[result.stageRank];
  return options[(result.goalsFor + result.goalsAgainst) % options.length];
}

function cupStageRankLabelText(result: CupSimulationResult, language: Language) {
  if (result.wonCup) {
    return language === "ua"
      ? "Кубок України взято"
      : "Won the Ukrainian Cup";
  }

  return language === "ua"
    ? `Виліт: ${result.stageLabelUa}`
    : `Eliminated: ${result.stageLabelEn}`;
}

function cupMatchTextSingle(match: CupMatchResult, language: Language) {
  const stage = cupStageLabels[match.stage][language];
  const resultText = language === "ua"
    ? match.result === "win" ? "перемога" : "поразка"
    : match.result;
  const score = `${match.goalsFor}-${match.goalsAgainst}`;
  const decision = cupDecisionLabels[match.decidedBy][language];
  const suffix =
    match.decidedBy === "regular_time"
      ? ""
      : match.decidedBy === "penalties"
        ? ` (${decision}: ${match.penaltiesFor}-${match.penaltiesAgainst})`
        : ` (${decision})`;

  return `${stage}: ${resultText}, ${score}${suffix}`;
}

const lineupGroups = [
  {
    label: "result.goalkeeper" as const,
    line: "goalkeeper" as const,
    slots: ["gk"],
  },
  {
    label: "result.defenders" as const,
    line: "defense" as const,
    slots: ["lb", "cb_1", "cb_2", "rb"],
  },
  {
    label: "result.midfielders" as const,
    line: "midfield" as const,
    slots: ["lm", "cm", "am_cm", "rm"],
  },
  {
    label: "result.forwards" as const,
    line: "attack" as const,
    slots: ["am_fw", "fw"],
  },
];

function groupedLineupForFormation(lineup: SavedResult["lineup"], formationId: FormationId) {
  return lineupGroups.map((group) => ({
    ...group,
    players: formationSlots(formationId)
      .filter((slot) => slot.line === group.line)
      .map((slot) => lineup[slot.slot_id])
      .filter(Boolean)
      .map((player) => cleanPlayerName(player.player_name)),
  }));
}

export function SeasonResultView() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const language = useLanguage();
  const storedSeason = useSyncExternalStore(
    subscribeToStorage,
    getStoredSeason,
    getServerSeason,
  );
  const savedResult = useMemo(
    () => parseSavedResult(storedSeason),
    [storedSeason],
  );

  if (savedResult === null) {
    return (
      <div className="compact-page result-page">
        <section className="result-empty">
          <h1>{text(language, "result.emptyTitle")}</h1>
          <p>{text(language, "result.emptyBody")}</p>
          <Link className="button button-primary" href="/draft">
            {text(language, "result.backToDraft")}
          </Link>
        </section>
      </div>
    );
  }

  if (savedResult.competition === "cup") {
    return <CupResultView savedResult={savedResult} onPlayAgain={playAgain} />;
  }

  const savedSeason = savedResult;
  const { result } = savedSeason;
  const description = selectSeasonDescription(savedSeason.lineup, result);
  const groupedLineup = groupedLineupForFormation(
    savedSeason.lineup,
    savedSeason.formationId,
  );
  const stats = [
    { label: "result.record" as const, value: `${result.wins}-${result.draws}-${result.losses}` },
    { label: "result.pointsLong" as const, value: String(result.points) },
    { label: "result.goals" as const, value: `${result.goalsFor}-${result.goalsAgainst}` },
    { label: "result.goalDifference" as const, value: signedGoalDifference(result.goalDifference) },
  ];

  async function shareResult() {
    const shareLanguage = getActiveLanguage();
    const lineupText = groupedLineup
      .map((group) => group.players.join(", "))
      .join("\n-\n");
    const shareText = [
      `30-0: ${text(shareLanguage, "home.competitionLeague")}`,
      `${text(shareLanguage, "draft.formation")}: ${FORMATIONS[savedSeason.formationId].name}`,
      window.location.origin,
      "",
      text(shareLanguage, "result.lineup"),
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
        <h1>{text(language, "result.seasonResult")}</h1>
        <p className="result-meta">
          <strong>{text(language, "draft.formation")}:</strong>{" "}
          {FORMATIONS[savedSeason.formationId].name}
        </p>
      </header>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span>{text(language, stat.label)}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>
      <p className="result-verdict">{text(language, verdictKeys[result.verdict])}</p>
      <p className="result-description">
        {description[language]}
      </p>
      <section className="result-lineup">
        <h2>{text(language, "result.lineup")}</h2>
        <div className="result-lineup-groups">
          {groupedLineup.map((group) => (
            <div className="result-line" key={group.label}>
              <strong>{text(language, group.label)}</strong>
              <span>{group.players.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>
      <ResultSubmission season={savedSeason} language={language} />
      <LeaderboardBoard
        compact
        initialCompetition="league"
        initialMode={savedSeason.mode}
        language={language}
      />
      <div className="result-actions">
        <button className="button button-primary" type="button" onClick={shareResult}>
          {text(language, "result.share")}
        </button>
        <button className="button button-secondary" type="button" onClick={playAgain}>
          {text(language, "result.playAgain")}
        </button>
        <span className={`copy-confirmation${copied ? " is-visible" : ""}`} aria-live="polite">
          {copied && text(language, "result.copied")}
        </span>
      </div>
    </div>
  );
}

function CupResultView({
  savedResult,
  onPlayAgain,
}: {
  savedResult: Extract<SavedResult, { competition: "cup" }>;
  onPlayAgain: () => void;
}) {
  const [visibleMatches, setVisibleMatches] = useState(0);
  const [copied, setCopied] = useState(false);
  const language = useLanguage();
  const result = savedResult.result;
  const groupedLineup = groupedLineupForFormation(
    savedResult.lineup,
    savedResult.formationId,
  );

  useEffect(() => {
    if (!result || visibleMatches >= result.matches.length) {
      return;
    }

    const timeout = window.setTimeout(
      () => setVisibleMatches((current) => current + 1),
      CUP_REVEAL_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [result, visibleMatches]);

  if (!result) {
    return (
      <div className="compact-page result-page">
        <header className="compact-heading">
          <h1>{text(language, "result.cupPlaceholderTitle")}</h1>
          <p className="result-meta">
            <strong>{text(language, "draft.formation")}:</strong>{" "}
            {FORMATIONS[savedResult.formationId].name}
          </p>
          <p>{text(language, "result.cupPlaceholderBody")}</p>
        </header>
        <CupLineup groupedLineup={groupedLineup} />
        <div className="result-actions">
          <button className="button button-secondary" type="button" onClick={onPlayAgain}>
            {text(language, "result.playAgain")}
          </button>
        </div>
      </div>
    );
  }

  const cupResult = result;
  const revealedMatches = cupResult.matches.slice(0, visibleMatches);
  const complete = visibleMatches >= cupResult.matches.length;
  const finalLabel = cupStageRankLabelText(cupResult, language);

  async function shareCupResult() {
    const shareLanguage = getActiveLanguage();
    const lineupText = groupedLineup
      .map((group) => group.players.join(", "))
      .join("\n-\n");
    const pathText = cupResult.matches
      .map((match) => cupMatchTextSingle(match, shareLanguage))
      .join("\n");
    const shareText = [
      `30-0: ${text(shareLanguage, "home.competitionCup")}`,
      `${shareLanguage === "ua" ? "Турнір" : "Competition"}: ${text(shareLanguage, "leaderboard.cup")}`,
      `${shareLanguage === "ua" ? "Режим" : "Mode"}: ${
        savedResult.mode === "hardcore"
          ? text(shareLanguage, "leaderboard.hardcore")
          : text(shareLanguage, "leaderboard.normal")
      }`,
      `${text(shareLanguage, "draft.formation")}: ${FORMATIONS[savedResult.formationId].name}`,
      `${text(shareLanguage, "result.cupFinish")}: ${cupStageRankLabelText(cupResult, shareLanguage)}`,
      window.location.origin,
      "",
      `${text(shareLanguage, "result.cupResult")}:`,
      pathText,
      "",
      text(shareLanguage, "result.lineup"),
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
  return (
    <div className="compact-page result-page">
      <header className="compact-heading">
        <h1>{text(language, "result.cupResult")}</h1>
        <p className="result-meta">
          <strong>{text(language, "draft.formation")}:</strong>{" "}
          {FORMATIONS[savedResult.formationId].name}
        </p>
      </header>
      <section className="cup-path" aria-live="polite">
        {revealedMatches.map((match) => (
          <article className={`cup-match cup-match-${match.result}`} key={match.stage}>
            {cupMatchTextSingle(match, language)}
          </article>
        ))}
        {!complete && (
          <p className="cup-reveal-state">{text(language, "result.cupRevealing")}</p>
        )}
      </section>
      {complete && (
        <>
          <section className="cup-result-summary">
            <article className="stat-card cup-result-card">
              <span>{text(language, "result.cupFinish")}</span>
              <strong>{finalLabel}</strong>
            </article>
          </section>
          <section className="stats-grid cup-stats-grid">
            <article className="stat-card">
              <span>{text(language, "result.goals")}</span>
              <strong>{cupResult.goalsFor}-{cupResult.goalsAgainst}</strong>
            </article>
            <article className="stat-card">
              <span>{text(language, "result.goalDifference")}</span>
              <strong>{signedGoalDifference(cupResult.goalDifference)}</strong>
            </article>
            <article className="stat-card">
              <span>{text(language, "result.cupRegularTimeWins")}</span>
              <strong>{cupResult.regularTimeWins}</strong>
            </article>
          </section>
          <p className="result-verdict">{text(language, cupVerdictKey(cupResult))}</p>
          <CupLineup groupedLineup={groupedLineup} />
          <ResultSubmission season={savedResult} language={language} />
          <LeaderboardBoard
            compact
            initialCompetition="cup"
            initialMode={savedResult.mode}
            language={language}
          />
          <div className="result-actions">
            <button className="button button-primary" type="button" onClick={shareCupResult}>
              {text(language, "result.share")}
            </button>
            <button className="button button-secondary" type="button" onClick={onPlayAgain}>
              {text(language, "result.playAgain")}
            </button>
            <span className={`copy-confirmation${copied ? " is-visible" : ""}`} aria-live="polite">
              {copied && text(language, "result.copied")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function CupLineup({
  groupedLineup,
}: {
  groupedLineup: Array<{
    label: (typeof lineupGroups)[number]["label"];
    players: string[];
  }>;
}) {
  const language = useLanguage();
  return (
    <section className="result-lineup">
      <h2>{text(language, "result.lineup")}</h2>
      <div className="result-lineup-groups">
        {groupedLineup.map((group) => (
          <div className="result-line" key={group.label}>
            <strong>{text(language, group.label)}</strong>
            <span>{group.players.join(", ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
