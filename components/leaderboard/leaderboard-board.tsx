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

export const LEADERBOARD_UPDATED_EVENT = "uf30-leaderboard-updated";
const COMPACT_LIMIT = 10;
const FULL_PAGE_SIZE = 20;

type LeaderboardBoardProps = {
  compact?: boolean;
  initialCompetition?: LeaderboardCompetition;
  initialMode?: LeaderboardMode;
};

function isCupEntry(entry: LeaderboardEntry): entry is CupLeaderboardEntry {
  return "stage_rank" in entry;
}

function record(entry: LeaderboardEntry) {
  if (isCupEntry(entry)) {
    if (entry.won_cup) {
      return (
        <>
          <span className="localized-text" data-language="en">won the Cup</span>
          <span className="localized-text" data-language="ua">перемога в Кубку</span>
        </>
      );
    }
    if (entry.stage_rank === 5) {
      return (
        <>
          <span className="localized-text" data-language="en">lost in the final</span>
          <span className="localized-text" data-language="ua">виліт у фіналі</span>
        </>
      );
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
          <h2><T id="leaderboard.title" /></h2>
        </div>
        {compact && (
          <Link className="leaderboard-link" href="/leaderboard">
            <T id="leaderboard.viewAll" />
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
            <T
              id={tabCompetition === "league"
                ? "leaderboard.league"
                : "leaderboard.cup"}
            />
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
            <T
              id={tabMode === "normal"
                ? "leaderboard.normal"
                : "leaderboard.hardcore"}
            />
          </button>
        ))}
      </div>

      <div aria-live="polite" className="leaderboard-content">
        {status === "loading" && (
          <p className="leaderboard-state"><T id="leaderboard.loading" /></p>
        )}
        {status === "error" && (
          <div className="leaderboard-state">
            <p><T id="leaderboard.loadError" /></p>
            <button className="text-button" onClick={() => void loadEntries()} type="button">
              <T id="leaderboard.retry" />
            </button>
          </div>
        )}
        {status === "ready" && entries.length === 0 && (
          <p className="leaderboard-state"><T id="leaderboard.empty" /></p>
        )}
        {status === "ready" && entries.length > 0 && compact && (
          <ol className="leaderboard-compact-list">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <span className="leaderboard-compact-rank">{index + 1}</span>
                <span className="leaderboard-compact-name">{entry.nickname}</span>
                <strong>{record(entry)}</strong>
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
                  <th><T id="leaderboard.rank" /></th>
                  <th><T id="leaderboard.nickname" /></th>
                  <th><T id="leaderboard.result" /></th>
                  <th><T id="leaderboard.date" /></th>
                  <th><T id="leaderboard.lineup" /></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="leaderboard-rank">
                      {(page - 1) * FULL_PAGE_SIZE + index + 1}
                    </td>
                    <td>{entry.nickname}</td>
                    <td><strong>{record(entry)}</strong></td>
                    <td>{displayDate(entry.created_at)}</td>
                    <td>
                      <details className="leaderboard-lineup">
                        <summary><T id="leaderboard.showLineup" /></summary>
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
              <T id="leaderboard.previous" />
            </button>
            <span>
              <T id="leaderboard.page" /> {page}
            </span>
            <button
              className="button button-secondary"
              disabled={!hasNextPage}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              <T id="leaderboard.next" />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
