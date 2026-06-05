"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormationBoard } from "@/components/formation/formation-board";
import { T } from "@/components/localized-text";
import type {
  DraftData,
  DraftMode,
  DraftPlayer,
  FormationLine,
  FormationSlot,
  Lineup,
  RollPoolEntry,
} from "@/lib/draft-types";
import {
  SEASON_RESULT_STORAGE_KEY,
  simulateSeason,
  type SavedSeason,
} from "@/lib/seasonSimulation";

type DraftGameProps = {
  mode: DraftMode;
};

const EMPTY_DATA: DraftData = {
  players: [],
  rollPool: [],
  slots: [],
};

const lineSummary: Array<{
  key: "draft.goalkeepersShort" | "draft.defendersShort" | "draft.midfieldersShort" | "draft.forwardsShort";
  line: FormationLine;
  total: number;
}> = [
  { key: "draft.goalkeepersShort", line: "goalkeeper", total: 1 },
  { key: "draft.defendersShort", line: "defense", total: 4 },
  { key: "draft.midfieldersShort", line: "midfield", total: 4 },
  { key: "draft.forwardsShort", line: "attack", total: 2 },
];

function cleanPlayerName(name: string) {
  return name.replace(/\s+\(\d+\)$/, "");
}

function playerFitsSlot(player: DraftPlayer, slot: FormationSlot) {
  return slot.allowed_positions.includes(player.game_position);
}

function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined;
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function DraftGame({ mode }: DraftGameProps) {
  const router = useRouter();
  const [data, setData] = useState<DraftData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lineup, setLineup] = useState<Lineup>({});
  const [currentRoll, setCurrentRoll] = useState<RollPoolEntry | null>(null);
  const [candidate, setCandidate] = useState<DraftPlayer | null>(null);
  const [pickLockedForRoll, setPickLockedForRoll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDraftData() {
      try {
        const [playersResponse, rollPoolResponse, slotsResponse] = await Promise.all([
          fetch("/data/players.json"),
          fetch("/data/roll_pool.json"),
          fetch("/data/formation_slots.json"),
        ]);

        if (!playersResponse.ok || !rollPoolResponse.ok || !slotsResponse.ok) {
          throw new Error("Draft data request failed");
        }

        const [players, rollPool, slots] = await Promise.all([
          playersResponse.json() as Promise<DraftPlayer[]>,
          rollPoolResponse.json() as Promise<RollPoolEntry[]>,
          slotsResponse.json() as Promise<FormationSlot[]>,
        ]);

        if (!cancelled) {
          setData({ players, rollPool, slots });
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDraftData();
    return () => {
      cancelled = true;
    };
  }, []);

  const playersByRoll = useMemo(() => {
    const grouped = new Map<string, DraftPlayer[]>();
    for (const player of data.players) {
      const players = grouped.get(player.club_decade_id) ?? [];
      players.push(player);
      grouped.set(player.club_decade_id, players);
    }
    return grouped;
  }, [data.players]);

  const selectedPlayerIds = useMemo(
    () => new Set(Object.values(lineup).map((player) => player.player_id)),
    [lineup],
  );

  const remainingSlots = useMemo(
    () => data.slots.filter((slot) => !lineup[slot.slot_id]),
    [data.slots, lineup],
  );

  const availablePlayers = useMemo(() => {
    if (!currentRoll || pickLockedForRoll) {
      return [];
    }

    return (playersByRoll.get(currentRoll.club_decade_id) ?? []).filter(
      (player) =>
        !selectedPlayerIds.has(player.player_id) &&
        remainingSlots.some((slot) => playerFitsSlot(player, slot)),
    );
  }, [
    currentRoll,
    pickLockedForRoll,
    playersByRoll,
    remainingSlots,
    selectedPlayerIds,
  ]);

  const validSlotIds = useMemo(() => {
    if (!candidate) {
      return new Set<string>();
    }

    return new Set(
      remainingSlots
        .filter((slot) => playerFitsSlot(candidate, slot))
        .map((slot) => slot.slot_id),
    );
  }, [candidate, remainingSlots]);

  const filled = Object.keys(lineup).length;
  const draftComplete = data.slots.length > 0 && filled === data.slots.length;
  const canUsePrimaryAction =
    !loading &&
    !loadFailed &&
    (draftComplete || currentRoll === null || pickLockedForRoll);

  function rollNext() {
    const validRolls = data.rollPool.filter((roll) =>
      (playersByRoll.get(roll.club_decade_id) ?? []).some(
        (player) =>
          !selectedPlayerIds.has(player.player_id) &&
          remainingSlots.some((slot) => playerFitsSlot(player, slot)),
      ),
    );

    if (validRolls.length === 0) {
      return;
    }

    setCurrentRoll(randomItem(validRolls));
    setCandidate(null);
    setPickLockedForRoll(false);
  }

  function usePrimaryAction() {
    if (draftComplete) {
      const savedSeason: SavedSeason = {
        lineup,
        result: simulateSeason(Object.values(lineup)),
      };
      sessionStorage.setItem(
        SEASON_RESULT_STORAGE_KEY,
        JSON.stringify(savedSeason),
      );
      router.push("/result");
      return;
    }

    rollNext();
  }

  function lockCandidate(slotId: string) {
    if (!candidate || !validSlotIds.has(slotId) || lineup[slotId]) {
      return;
    }

    setLineup((currentLineup) => ({
      ...currentLineup,
      [slotId]: candidate,
    }));
    setCandidate(null);
    setPickLockedForRoll(true);
  }

  function filledForLine(line: FormationLine) {
    return data.slots.filter(
      (slot) => slot.line === line && lineup[slot.slot_id],
    ).length;
  }

  return (
    <div className="draft-workspace">
      <header className="draft-heading">
        <div>
          <p className="eyebrow"><T id="draft.eyebrow" /></p>
          <h1><T id="draft.title" /></h1>
        </div>
        <div className="draft-mode">
          <span><T id="draft.mode" /></span>
          <strong>
            <T id={mode === "hardcore" ? "draft.modeHardcore" : "draft.modeNormal"} />
          </strong>
        </div>
      </header>

      <div className="draft-layout">
        <aside className="draft-status-column">
          <div className="summary-card">
            <div className="summary-heading">
              <span><T id="draft.filled" /></span>
              <strong>{filled}/11</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${(filled / 11) * 100}%` }} />
            </div>
            <ul className="summary-list">
              {lineSummary.map((summary) => (
                <li key={summary.line}>
                  <span><T id={summary.key} /></span>
                  <strong>{filledForLine(summary.line)}/{summary.total}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="draft-context">
            <div>
              <span><T id="draft.currentClub" /></span>
              <strong>
                {currentRoll ? currentRoll.team_name : <T id="draft.awaitingRoll" />}
              </strong>
            </div>
            <div>
              <span><T id="draft.currentDecade" /></span>
              <strong>
                {currentRoll ? currentRoll.decade : <T id="draft.awaitingRoll" />}
              </strong>
            </div>
          </div>

          <p className="draft-note">
            {loading && <T id="draft.loading" />}
            {loadFailed && <T id="draft.loadFailed" />}
            {!loading && !loadFailed && draftComplete && <T id="draft.complete" />}
            {!loading && !loadFailed && !draftComplete && candidate && (
              <T id="draft.chooseSlot" />
            )}
            {!loading &&
              !loadFailed &&
              !draftComplete &&
              !candidate &&
              pickLockedForRoll && <T id="draft.rollNext" />}
            {!loading &&
              !loadFailed &&
              !draftComplete &&
              !candidate &&
              !pickLockedForRoll &&
              currentRoll && <T id="draft.choosePlayer" />}
            {!loading &&
              !loadFailed &&
              !draftComplete &&
              !candidate &&
              !currentRoll && <T id="draft.startRoll" />}
          </p>
        </aside>

        <FormationBoard
          lineup={lineup}
          slots={data.slots}
          validSlotIds={validSlotIds}
          onSlotClick={lockCandidate}
        />

        <aside className="available-panel">
          <div className="available-heading">
            <div>
              <span><T id="draft.available" /></span>
              <strong>{availablePlayers.length}</strong>
            </div>
            <button
              className="draft-primary-action"
              disabled={!canUsePrimaryAction}
              type="button"
              onClick={usePrimaryAction}
            >
              <T id={draftComplete ? "draft.seeResult" : "draft.reroll"} />
            </button>
          </div>

          <div className="available-list">
            {availablePlayers.map((player) => {
              const selected = candidate?.club_decade_player_id === player.club_decade_player_id;
              const showCleanSheets =
                player.game_position === "GK" && hasValue(player.clean_sheets);

              return (
                <button
                  className={`available-player${selected ? " is-selected" : ""}`}
                  key={player.club_decade_player_id}
                  type="button"
                  onClick={() => setCandidate(player)}
                >
                  <span className="available-position">{player.game_position}</span>
                  <span className="available-player-copy">
                    <strong>{cleanPlayerName(player.player_name)}</strong>
                    <span>{player.team_name} / {player.decade}</span>
                    {mode === "normal" && (
                      <small>
                        {hasValue(player.goals) && (
                          <span><T id="draft.statGoals" /> {player.goals}</span>
                        )}
                        {hasValue(player.assists) && (
                          <span><T id="draft.statAssists" /> {player.assists}</span>
                        )}
                        {showCleanSheets && (
                          <span><T id="draft.statCleanSheets" /> {player.clean_sheets}</span>
                        )}
                      </small>
                    )}
                  </span>
                  <span className="available-select" aria-hidden="true">+</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
