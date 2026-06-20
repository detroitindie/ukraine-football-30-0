"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LEADERBOARD_COMPETITIONS,
  LEADERBOARD_MODES,
  type CupLeaderboardEntry,
  type LeaderboardCompetition,
  type LeaderboardEntry,
  type LeaderboardMode,
  type LeaderboardPage,
} from "@/lib/leaderboard";
import { useLanguage, type Language } from "@/lib/language";
import { translations } from "@/lib/translations";

export const LEADERBOARD_UPDATED_EVENT = "uf30-leaderboard-updated";
const COMPACT_LIMIT = 10;
const FULL_PAGE_SIZE = 20;

type LeaderboardBoardProps = {
  compact?: boolean;
  initialCompetition?: LeaderboardCompetition;
  initialMode?: LeaderboardMode;
  language?: Language;
};

type LeaderboardDisplayEntry = {
  result: string;
  metric: string;
  goals: string;
};

function boardText(id: keyof typeof translations.en, language: Language) {
  return translations[language][id];
}

function isCupEntry(entry: LeaderboardEntry): entry is CupLeaderboardEntry {
  return "stage_rank" in entry;
}

function leaguePoints(entry: Exclude<LeaderboardEntry, CupLeaderboardEntry>) {
  if (typeof entry.points === "number") {
    return entry.points;
  }
  if (typeof entry.score_points === "number") {
    return entry.score_points;
  }
  return entry.wins * 3 + entry.draws;
}

function goalsText(entry: LeaderboardEntry) {
  if (
    typeof entry.goals_for === "number"
    && typeof entry.goals_against === "number"
  ) {
    return `${entry.goals_for}-${entry.goals_against}`;
  }
  return "";
}

function cupResultText(entry: CupLeaderboardEntry, language: Language) {
  if (entry.won_cup) {
    return language === "ua" ? "перемога в Кубку" : "won the Cup";
  }
  if (entry.stage_rank === 5) {
    return language === "ua" ? "виліт у фіналі" : "lost in the final";
  }
  return language === "ua"
    ? `виліт у ${entry.stage_label_ua}`
    : `eliminated in the ${entry.stage_label_en.toLocaleLowerCase("en")}`;
}

function displayEntry(entry: LeaderboardEntry, language: Language): LeaderboardDisplayEntry {
  if (isCupEntry(entry)) {
    return {
      result: cupResultText(entry, language),
      metric: String(entry.regular_time_wins),
      goals: goalsText(entry),
    };
  }

  return {
    result: `${entry.wins}-${entry.draws}-${entry.losses}`,
    metric: String(leaguePoints(entry)),
    goals: goalsText(entry),
  };
}

function metricLabel(competition: LeaderboardCompetition, language: Language) {
  return competition === "cup"
    ? boardText("leaderboard.regTimeWins", language)
    : boardText("leaderboard.points", language);
}

function resultLabel(language: Language) {
  return boardText("leaderboard.result", language);
}

function goalsLabel(language: Language) {
  return boardText("leaderboard.goals", language);
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      }).format(date);
}

export function LeaderboardBoard({
  compact = false,
  initialCompetition = "league",
  initialMode = "normal",
  language,
}: LeaderboardBoardProps) {
  const activeLanguage = useLanguage();
  const uiLanguage = language ?? activeLanguage;
  const [competition, setCompetition] =
    useState<LeaderboardCompetition>(initialCompetition);
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const requestId = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadEntries = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setStatus("loading");
    try {
      const query = compact
        ? `competition=${competition}&mode=${mode}&limit=${COMPACT_LIMIT}`
        : `competition=${competition}&mode=${mode}&page=${page}&pageSize=${FULL_PAGE_SIZE}`;
      const response = await fetch(`/api/leaderboard?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Leaderboard request failed");
      }
      const data = (await response.json()) as Partial<LeaderboardPage>;
      if (currentRequestId !== requestId.current) {
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setHasNextPage(data.hasNextPage === true);
      setStatus("ready");
    } catch {
      if (currentRequestId !== requestId.current) {
        return;
      }
      setEntries([]);
      setHasNextPage(false);
      setStatus("error");
    }
  }, [compact, competition, mode, page]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEntries(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadEntries]);

  useEffect(() => {
    const refresh = () => void loadEntries();
    window.addEventListener(LEADERBOARD_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(LEADERBOARD_UPDATED_EVENT, refresh);
  }, [loadEntries]);

  return (
    <section className={`leaderboard${compact ? " leaderboard-compact" : ""}`}>
      <div className="leaderboard-heading">
        <div>
          <h2>{boardText("leaderboard.title", uiLanguage)}</h2>
        </div>
        {compact && (
          <Link className="leaderboard-link" href="/leaderboard">
            {boardText("leaderboard.viewAll", uiLanguage)}
          </Link>
        )}
      </div>

      <div className="leaderboard-tabs" role="tablist">
        {LEADERBOARD_COMPETITIONS.map((tabCompetition) => (
          <button
            aria-selected={competition === tabCompetition}
            className={competition === tabCompetition ? "is-active" : ""}
            key={tabCompetition}
            onClick={() => {
              setPage(1);
              setCompetition(tabCompetition);
            }}
            role="tab"
            type="button"
          >
            {boardText(
              tabCompetition === "league" ? "leaderboard.league" : "leaderboard.cup",
              uiLanguage,
            )}
          </button>
        ))}
      </div>

      <div className="leaderboard-tabs leaderboard-mode-tabs" role="tablist">
        {LEADERBOARD_MODES.map((tabMode) => (
          <button
            aria-selected={mode === tabMode}
            className={mode === tabMode ? "is-active" : ""}
            key={tabMode}
            onClick={() => {
              setPage(1);
              setMode(tabMode);
            }}
            role="tab"
            type="button"
          >
            {boardText(
              tabMode === "normal" ? "leaderboard.normal" : "leaderboard.hardcore",
              uiLanguage,
            )}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="leaderboard-content">
        {status === "loading" && (
          <p className="leaderboard-state">{boardText("leaderboard.loading", uiLanguage)}</p>
        )}
        {status === "error" && (
          <div className="leaderboard-state">
            <p>{boardText("leaderboard.loadError", uiLanguage)}</p>
            <button className="text-button" onClick={() => void loadEntries()} type="button">
              {boardText("leaderboard.retry", uiLanguage)}
            </button>
          </div>
        )}
        {status === "ready" && entries.length === 0 && (
          <p className="leaderboard-state">{boardText("leaderboard.empty", uiLanguage)}</p>
        )}
        {status === "ready" && entries.length > 0 && compact && (
          <ol className="leaderboard-compact-list">
            {entries.map((entry, index) => {
              const display = displayEntry(entry, uiLanguage);
              const metricText = metricLabel(competition, uiLanguage);
              const resultText = resultLabel(uiLanguage);
              const goals = display.goals;
              return (
                <li key={entry.id}>
                  <span className="leaderboard-compact-rank">{index + 1}</span>
                  <div className="leaderboard-compact-body">
                    <strong className="leaderboard-compact-name">{entry.nickname}</strong>
                    <span className="leaderboard-compact-summary">
                      <span>
                        <strong>{resultText}:</strong> {display.result}
                      </span>
                      <span>
                        <strong>{metricText}:</strong> {display.metric}
                      </span>
                      {goals && (
                        <span>
                          <strong>{goalsLabel(uiLanguage)}:</strong> {goals}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {status === "ready" && entries.length > 0 && !compact && (
          <>
            <div className="leaderboard-table-wrap leaderboard-desktop-table-wrap">
              <table className="leaderboard-table">
                <colgroup>
                  <col className="leaderboard-col-rank" />
                  <col className="leaderboard-col-nickname" />
                  <col className="leaderboard-col-result" />
                  <col className="leaderboard-col-metric" />
                  <col className="leaderboard-col-goals" />
                  <col className="leaderboard-col-date" />
                  <col className="leaderboard-col-lineup" />
                </colgroup>
                <thead>
                  <tr>
                    <th>{boardText("leaderboard.rank", uiLanguage)}</th>
                    <th>{boardText("leaderboard.nickname", uiLanguage)}</th>
                    <th>{resultLabel(uiLanguage)}</th>
                    <th>{metricLabel(competition, uiLanguage)}</th>
                    <th>{goalsLabel(uiLanguage)}</th>
                    <th>{boardText("leaderboard.date", uiLanguage)}</th>
                    <th>{boardText("leaderboard.lineup", uiLanguage)}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => {
                    const display = displayEntry(entry, uiLanguage);
                    return (
                      <tr key={entry.id}>
                        <td className="leaderboard-rank">
                          {(page - 1) * FULL_PAGE_SIZE + index + 1}
                        </td>
                        <td>{entry.nickname}</td>
                        <td><strong>{display.result}</strong></td>
                        <td><strong>{display.metric}</strong></td>
                        <td>{display.goals || ""}</td>
                        <td>{displayDate(entry.created_at)}</td>
                        <td>
                          <details className="leaderboard-lineup">
                            <summary>{boardText("leaderboard.showLineup", uiLanguage)}</summary>
                            <ul>
                              {entry.lineup.map((player) => (
                                <li key={`${player.slot_position}:${player.player_name}`}>
                                  <strong>{player.position_label}</strong>
                                  <span>{player.player_name}</span>
                                  {player.game_position !== player.position_label && (
                                    <small>{player.game_position}</small>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="leaderboard-mobile-list">
              {entries.map((entry, index) => {
                const display = displayEntry(entry, uiLanguage);
                return (
                  <article className="leaderboard-mobile-card" key={entry.id}>
                    <div className="leaderboard-mobile-head">
                      <span className="leaderboard-rank">
                        {(page - 1) * FULL_PAGE_SIZE + index + 1}
                      </span>
                      <strong>{entry.nickname}</strong>
                    </div>
                    <div className="leaderboard-mobile-meta">
                      <span>
                        <strong>{resultLabel(uiLanguage)}:</strong> {display.result}
                      </span>
                      <span>
                        <strong>{metricLabel(competition, uiLanguage)}:</strong> {display.metric}
                      </span>
                      <span>
                        <strong>{goalsLabel(uiLanguage)}:</strong> {display.goals || ""}
                      </span>
                    </div>
                    <div className="leaderboard-mobile-date">{displayDate(entry.created_at)}</div>
                    <details className="leaderboard-lineup">
                      <summary>{boardText("leaderboard.showLineup", uiLanguage)}</summary>
                      <ul>
                        {entry.lineup.map((player) => (
                          <li key={`${player.slot_position}:${player.player_name}`}>
                            <strong>{player.position_label}</strong>
                            <span>{player.player_name}</span>
                            {player.game_position !== player.position_label && (
                              <small>{player.game_position}</small>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {!compact && status === "ready" && entries.length > 0 && (
          <nav
            aria-label="Leaderboard pagination"
            className="leaderboard-pagination"
          >
            <button
              className="button button-secondary"
              disabled={page === 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
              type="button"
            >
              {boardText("leaderboard.previous", uiLanguage)}
            </button>
            <span>
              {boardText("leaderboard.page", uiLanguage)} {page}
            </span>
            <button
              className="button button-secondary"
              disabled={!hasNextPage}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              {boardText("leaderboard.next", uiLanguage)}
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
