"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { ResultSubmission } from "@/components/leaderboard/result-submission";
import { T } from "@/components/localized-text";
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
import { isValidNickname, sanitizeNickname } from "@/lib/leaderboard";
import { cleanPlayerName } from "@/lib/player-display";
import { selectSeasonDescription } from "@/lib/season-description";

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
    if (competition === "cup") {
      const result = isCupSimulationResult(saved.result) ? saved.result : null;
      return {
        competition,
        mode,
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

function cupStageRankLabel(result: CupSimulationResult) {
  if (result.wonCup) {
    return {
      en: "Won the Ukrainian Cup",
      ua: "Кубок України виграно",
    };
  }

  return {
    en: `Eliminated: ${result.stageLabelEn}`,
    ua: `Виліт: ${result.stageLabelUa}`,
  };
}

function cupVerdictKey(result: CupSimulationResult) {
  const options = cupVerdictKeys[result.stageRank];
  return options[(result.goalsFor + result.goalsAgainst) % options.length];
}

function cupMatchText(match: CupMatchResult, language: "en" | "ua") {
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
  const savedResult = useMemo(
    () => parseSavedResult(storedSeason),
    [storedSeason],
  );

  if (savedResult === null) {
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

  if (savedResult.competition === "cup") {
    return <CupResultView savedResult={savedResult} onPlayAgain={playAgain} />;
  }

  const savedSeason = savedResult;
  const { result } = savedSeason;
  const description = selectSeasonDescription(savedSeason.lineup, result);
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
      <p className="result-description">
        <span className="localized-text" data-language="en">{description.en}</span>
        <span className="localized-text" data-language="ua">{description.ua}</span>
      </p>
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
      <ResultSubmission season={savedSeason} />
      <LeaderboardBoard compact initialMode={savedSeason.mode} />
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

function CupResultView({
  savedResult,
  onPlayAgain,
}: {
  savedResult: Extract<SavedResult, { competition: "cup" }>;
  onPlayAgain: () => void;
}) {
  const [visibleMatches, setVisibleMatches] = useState(0);
  const [copied, setCopied] = useState(false);
  const result = savedResult.result;
  const groupedLineup = lineupGroups.map((group) => ({
    ...group,
    players: group.slots
      .map((slotId) => savedResult.lineup[slotId])
      .filter(Boolean)
      .map((player) => cleanPlayerName(player.player_name)),
  }));

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
          <h1><T id="result.cupPlaceholderTitle" /></h1>
          <p><T id="result.cupPlaceholderBody" /></p>
        </header>
        <CupLineup groupedLineup={groupedLineup} />
        <div className="result-actions">
          <button className="button button-secondary" type="button" onClick={onPlayAgain}>
            <T id="result.playAgain" />
          </button>
        </div>
      </div>
    );
  }

  const cupResult = result;
  const revealedMatches = cupResult.matches.slice(0, visibleMatches);
  const complete = visibleMatches >= cupResult.matches.length;
  const finalLabel = cupStageRankLabel(cupResult);

  async function shareCupResult() {
    const lineupText = groupedLineup
      .map((group) => group.players.join(", "))
      .join("\n-\n");
    const pathText = cupResult.matches
      .map((match) => cupMatchText(match, "en"))
      .join("\n");
    const shareText = [
      "30-0: Українська ліга",
      "Competition: Ukrainian Cup",
      `Mode: ${savedResult.mode === "hardcore" ? "Hardcore" : "Normal"}`,
      `Result: ${finalLabel.en}`,
      window.location.origin,
      "",
      "Cup path:",
      pathText,
      "",
      "My team:",
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
        <h1><T id="result.cupResult" /></h1>
      </header>
      <section className="cup-path" aria-live="polite">
        {revealedMatches.map((match) => (
          <article className={`cup-match cup-match-${match.result}`} key={match.stage}>
            <span className="localized-text" data-language="en">
              {cupMatchText(match, "en")}
            </span>
            <span className="localized-text" data-language="ua">
              {cupMatchText(match, "ua")}
            </span>
          </article>
        ))}
        {!complete && (
          <p className="cup-reveal-state"><T id="result.cupRevealing" /></p>
        )}
      </section>
      {complete && (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span><T id="result.cupFinish" /></span>
              <strong>
                <span className="localized-text" data-language="en">{finalLabel.en}</span>
                <span className="localized-text" data-language="ua">{finalLabel.ua}</span>
              </strong>
            </article>
            <article className="stat-card">
              <span><T id="result.goals" /></span>
              <strong>{cupResult.goalsFor}-{cupResult.goalsAgainst}</strong>
            </article>
            <article className="stat-card">
              <span><T id="result.goalDifference" /></span>
              <strong>{signedGoalDifference(cupResult.goalDifference)}</strong>
            </article>
            <article className="stat-card">
              <span><T id="result.cupRegularTimeWins" /></span>
              <strong>{cupResult.regularTimeWins}</strong>
            </article>
          </section>
          <p className="result-verdict"><T id={cupVerdictKey(cupResult)} /></p>
          <CupLineup groupedLineup={groupedLineup} />
          <CupResultSubmission result={cupResult} mode={savedResult.mode} />
          <div className="result-actions">
            <button className="button button-primary" type="button" onClick={shareCupResult}>
              <T id="result.share" />
            </button>
            <button className="button button-secondary" type="button" onClick={onPlayAgain}>
              <T id="result.playAgain" />
            </button>
            <span className={`copy-confirmation${copied ? " is-visible" : ""}`} aria-live="polite">
              {copied && <T id="result.copied" />}
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
  return (
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
  );
}

function CupResultSubmission({
  result,
  mode,
}: {
  result: CupSimulationResult;
  mode: SavedResult["mode"];
}) {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<"idle" | "invalid" | "success" | "skipped">("idle");
  const storageKey = [
    "uf30-cup-leaderboard-nickname",
    mode,
    result.stageRank,
    result.goalsFor,
    result.goalsAgainst,
    result.matches.map((match) => `${match.stage}:${match.result}`).join("|"),
  ].join(":");

  function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNickname = sanitizeNickname(nickname);
    if (!isValidNickname(cleanNickname)) {
      setStatus("invalid");
      return;
    }

    sessionStorage.setItem(storageKey, cleanNickname);
    setNickname(cleanNickname);
    setStatus("success");
  }

  if (status === "skipped") {
    return null;
  }

  return (
    <section className="leaderboard-submit">
      <div>
        <span className="eyebrow"><T id="leaderboard.optional" /></span>
        <h2><T id="leaderboard.submitPrompt" /></h2>
        <p><T id="result.cupSubmitBody" /></p>
      </div>
      {status === "success" ? (
        <p className="leaderboard-submit-message is-success" role="status">
          <T id="result.cupSubmitSuccess" />
        </p>
      ) : (
        <form onSubmit={submitResult}>
          <label htmlFor="cup-leaderboard-nickname">
            <T id="leaderboard.nicknameField" />
          </label>
          <div className="leaderboard-submit-row">
            <input
              autoComplete="nickname"
              id="cup-leaderboard-nickname"
              maxLength={20}
              minLength={2}
              onChange={(event) => {
                setNickname(event.target.value);
                if (status === "invalid") {
                  setStatus("idle");
                }
              }}
              placeholder="2-20"
              type="text"
              value={nickname}
            />
            <button className="button button-primary" type="submit">
              <T id="leaderboard.submit" />
            </button>
            <button
              className="button button-secondary"
              onClick={() => setStatus("skipped")}
              type="button"
            >
              <T id="leaderboard.skip" />
            </button>
          </div>
          {status === "invalid" && (
            <p className="leaderboard-submit-message is-error" role="alert">
              <T id="leaderboard.invalidNickname" />
            </p>
          )}
        </form>
      )}
    </section>
  );
}
