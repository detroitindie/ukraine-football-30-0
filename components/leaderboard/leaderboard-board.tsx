"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "@/components/localized-text";
import {
  LEADERBOARD_COMPETITIONS,
  LEADERBOARD_MODES,
  type CupLeaderboardEntry,
  type LeaderboardEntry,
  type LeaderboardCompetition,
  type LeaderboardMode,
  type LeaderboardPage,
} from "@/lib/leaderboard";
import { type Language } from "@/lib/language";
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

function boardText(id: keyof typeof translations.en, language?: Language) {
  return language ? translations[language][id] : <T id={id} />;
}

function isCupEntry(entry: LeaderboardEntry): entry is CupLeaderboardEntry {
  return "stage_rank" in entry;
}

function record(entry: LeaderboardEntry, language?: Language) {
  if (isCupEntry(entry)) {
    if (entry.won_cup) {
      if (language) {
        return language === "ua" ? "перемога в Кубку" : "won the Cup";
      }
      return (
        <>
          <span className="localized-text" data-language="en">won the Cup</span>
          <span className="localized-text" data-language="ua">перемога в Кубку</span>
        </>
      );
    }
    if (entry.stage_rank === 5) {
      if (language) {
        return language === "ua" ? "виліт у фіналі" : "lost in the final";
      }
      return (
        <>
          <span className="localized-text" data-language="en">lost in the final</span>
          <span className="localized-text" data-language="ua">виліт у фіналі</span>
        </>
      );
    }
    if (language) {
      return language === "ua"
        ? `виліт у ${entry.stage_label_ua}`
        : `eliminated in the ${entry.stage_label_en.toLocaleLowerCase("en")}`;
    }
    return (
      <>
        <span className="localized-text" data-language="en">
          eliminated in the {entry.stage_label_en.toLocaleLowerCase("en")}
        </span>
        <span className="localized-text" data-language="ua">
          виліт в {entry.stage_label_ua}
        </span>
      </>
    );
  }

  return `${entry.wins}-${entry.draws}-${entry.losses}`;
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
      const response = await fetch(
        `/api/leaderboard?${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error("Leaderboard request failed");
      }
      const data = await response.json() as Partial<LeaderboardPage>;
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
          <h2>{boardText("leaderboard.title", language)}</h2>
        </div>
        {compact && (
          <Link className="leaderboard-link" href="/leaderboard">
            {boardText("leaderboard.viewAll", language)}
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
            {boardText(tabCompetition === "league"
              ? "leaderboard.league"
              : "leaderboard.cup", language)}
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
            {boardText(tabMode === "normal"
              ? "leaderboard.normal"
              : "leaderboard.hardcore", language)}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="leaderboard-content">
        {status === "loading" && (
          <p className="leaderboard-state">{boardText("leaderboard.loading", language)}</p>
        )}
        {status === "error" && (
          <div className="leaderboard-state">
            <p>{boardText("leaderboard.loadError", language)}</p>
            <button className="text-button" onClick={() => void loadEntries()} type="button">
              {boardText("leaderboard.retry", language)}
            </button>
          </div>
        )}
        {status === "ready" && entries.length === 0 && (
          <p className="leaderboard-state">{boardText("leaderboard.empty", language)}</p>
        )}
        {status === "ready" && entries.length > 0 && compact && (
          <ol className="leaderboard-compact-list">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <span className="leaderboard-compact-rank">{index + 1}</span>
                <span className="leaderboard-compact-name">{entry.nickname}</span>
                <strong>{record(entry, language)}</strong>
              </li>
            ))}
          </ol>
        )}
        {status === "ready" && entries.length > 0 && !compact && (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <colgroup>
                <col className="leaderboard-col-rank" />
                <col className="leaderboard-col-nickname" />
                <col className="leaderboard-col-result" />
                <col className="leaderboard-col-date" />
                <col className="leaderboard-col-lineup" />
              </colgroup>
              <thead>
                <tr>
                  <th>{boardText("leaderboard.rank", language)}</th>
                  <th>{boardText("leaderboard.nickname", language)}</th>
                  <th>{boardText("leaderboard.result", language)}</th>
                  <th>{boardText("leaderboard.date", language)}</th>
                  <th>{boardText("leaderboard.lineup", language)}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="leaderboard-rank">
                      {(page - 1) * FULL_PAGE_SIZE + index + 1}
                    </td>
                    <td>{entry.nickname}</td>
                    <td><strong>{record(entry, language)}</strong></td>
                    <td>{displayDate(entry.created_at)}</td>
                    <td>
                      <details className="leaderboard-lineup">
                        <summary>{boardText("leaderboard.showLineup", language)}</summary>
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
                ))}
              </tbody>
            </table>
          </div>
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
              {boardText("leaderboard.previous", language)}
            </button>
            <span>
              {boardText("leaderboard.page", language)} {page}
            </span>
            <button
              className="button button-secondary"
              disabled={!hasNextPage}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              {boardText("leaderboard.next", language)}
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
