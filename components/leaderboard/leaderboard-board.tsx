"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/components/localized-text";
import {
  LEADERBOARD_MODES,
  type LeaderboardEntry,
  type LeaderboardMode,
} from "@/lib/leaderboard";

export const LEADERBOARD_UPDATED_EVENT = "uf30-leaderboard-updated";

type LeaderboardBoardProps = {
  compact?: boolean;
  initialMode?: LeaderboardMode;
};

function record(entry: LeaderboardEntry) {
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
  initialMode = "normal",
}: LeaderboardBoardProps) {
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadEntries = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/leaderboard?mode=${mode}&limit=${compact ? 5 : 100}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error("Leaderboard request failed");
      }
      const data = await response.json() as { entries?: LeaderboardEntry[] };
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setStatus("ready");
    } catch {
      setEntries([]);
      setStatus("error");
    }
  }, [compact, mode]);

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
        {LEADERBOARD_MODES.map((tabMode) => (
          <button
            aria-selected={mode === tabMode}
            className={mode === tabMode ? "is-active" : ""}
            key={tabMode}
            onClick={() => setMode(tabMode)}
            role="tab"
            type="button"
          >
            <T
              id={tabMode === "normal"
                ? "leaderboard.normalMode"
                : "leaderboard.hardcoreMode"}
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
                    <td className="leaderboard-rank">{index + 1}</td>
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
      </div>
    </section>
  );
}
