"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormationBoard } from "@/components/formation/formation-board";
import { T } from "@/components/localized-text";
import { rollPoolPathForCompetition } from "@/lib/competition-pools";
import {
  DEFAULT_FORMATION_ID,
  FORMATION_IDS,
  FORMATIONS,
  formationLineTotal,
  formationSlots,
  type FormationId,
} from "@/lib/formations";
import type {
  DraftData,
  DraftCompetition,
  DraftMode,
  DraftSort,
  DraftPlayer,
  FormationLine,
  FormationSlot,
  Lineup,
  RollPoolEntry,
} from "@/lib/draft-types";
import {
  SEASON_RESULT_STORAGE_KEY,
  simulateCup,
  simulateSeason,
  type SavedResult,
} from "@/lib/seasonSimulation";
import {
  cleanPlayerName,
  safePlayerStat,
  safePlayerText,
} from "@/lib/player-display";
import { compareDraftPlayers } from "@/lib/player-sorting";

type DraftGameProps = {
  competition: DraftCompetition;
  mode: DraftMode;
};

const EMPTY_DATA: DraftData = {
  players: [],
  rollPool: [],
};

const lineSummaryLines: Array<{
  key: "draft.goalkeepersShort" | "draft.defendersShort" | "draft.midfieldersShort" | "draft.forwardsShort";
  line: FormationLine;
}> = [
  { key: "draft.goalkeepersShort", line: "goalkeeper" },
  { key: "draft.defendersShort", line: "defense" },
  { key: "draft.midfieldersShort", line: "midfield" },
  { key: "draft.forwardsShort", line: "attack" },
];

function playerFitsSlot(player: DraftPlayer, slot: FormationSlot) {
  return (
    typeof player.game_position === "string" &&
    slot.allowed_positions.includes(player.game_position)
  );
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function DraftGame({ competition, mode }: DraftGameProps) {
  const router = useRouter();
  const [data, setData] = useState<DraftData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lineup, setLineup] = useState<Lineup>({});
  const [currentRoll, setCurrentRoll] = useState<RollPoolEntry | null>(null);
  const [candidate, setCandidate] = useState<DraftPlayer | null>(null);
  const [pickLockedForRoll, setPickLockedForRoll] = useState(false);
  const [normalSort, setNormalSort] = useState<DraftSort>("stats");
  const [formationId, setFormationId] =
    useState<FormationId>(DEFAULT_FORMATION_ID);
  const [formationDialogOpen, setFormationDialogOpen] = useState(true);
  const formationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDraftData() {
      try {
        const [playersResponse, rollPoolResponse] = await Promise.all([
          fetch("/data/players.json"),
          fetch(rollPoolPathForCompetition(competition)),
        ]);

        if (!playersResponse.ok || !rollPoolResponse.ok) {
          throw new Error("Draft data request failed");
        }

        const [players, rollPool] = await Promise.all([
          playersResponse.json() as Promise<DraftPlayer[]>,
          rollPoolResponse.json() as Promise<RollPoolEntry[]>,
        ]);

        if (!cancelled) {
          setData({ players, rollPool });
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
  }, [competition]);

  const selectedFormation = FORMATIONS[formationId];
  const slots = useMemo(() => formationSlots(formationId), [formationId]);

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
    () => slots.filter((slot) => !lineup[slot.slot_id]),
    [lineup, slots],
  );

  const availablePlayers = useMemo(() => {
    if (!currentRoll || pickLockedForRoll) {
      return [];
    }

    return (playersByRoll.get(currentRoll.club_decade_id) ?? [])
      .filter(
        (player) =>
          !selectedPlayerIds.has(player.player_id) &&
          remainingSlots.some((slot) => playerFitsSlot(player, slot)),
      )
      .sort(compareDraftPlayers(mode, mode === "normal" ? normalSort : "position"));
  }, [
    currentRoll,
    mode,
    normalSort,
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
  const draftComplete = slots.length > 0 && filled === slots.length;
  const formationLocked = currentRoll !== null || filled > 0;
  const showFormationDialog = formationDialogOpen && !formationLocked;
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
      const savedSeason: SavedResult =
        competition === "league"
          ? {
              competition,
              mode,
              formationId,
              lineup,
              result: simulateSeason(Object.values(lineup)),
            }
          : {
              competition,
              mode,
              formationId,
              lineup,
              result: simulateCup(Object.values(lineup)),
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

  function selectCandidate(player: DraftPlayer) {
    const hasValidSlot = remainingSlots.some((slot) => playerFitsSlot(player, slot));
    setCandidate(player);

    if (
      !hasValidSlot
      || !window.matchMedia("(max-width: 900px)").matches
      || !formationRef.current
    ) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.requestAnimationFrame(() => {
      formationRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function filledForLine(line: FormationLine) {
    return slots.filter(
      (slot) => slot.line === line && lineup[slot.slot_id],
    ).length;
  }

  return (
    <div className="draft-workspace">
      {showFormationDialog && (
        <div className="formation-dialog-backdrop">
          <section
            aria-labelledby="formation-dialog-title"
            aria-modal="true"
            className="formation-dialog"
            role="dialog"
          >
            <h2 id="formation-dialog-title"><T id="draft.chooseFormation" /></h2>
            <div className="formation-dialog-options" role="group">
              {FORMATION_IDS.map((optionId) => (
                <button
                  aria-pressed={formationId === optionId}
                  className={formationId === optionId ? "is-active" : ""}
                  key={optionId}
                  type="button"
                  onClick={() => setFormationId(optionId)}
                >
                  {FORMATIONS[optionId].name}
                </button>
              ))}
            </div>
            <button
              className="button button-primary formation-dialog-confirm"
              type="button"
              onClick={() => setFormationDialogOpen(false)}
            >
              <T id="draft.confirmFormation" />
            </button>
          </section>
        </div>
      )}

      <header className="draft-heading">
        <div>
          <h1><T id="draft.title" /></h1>
        </div>
        <div className="draft-mode">
          <span className="draft-mode-prefix"><T id="draft.mode" /></span>
          <strong>
            <T
              id={competition === "cup"
                ? "draft.competitionCup"
                : "draft.competitionLeague"}
            />
            {" / "}
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
              {lineSummaryLines.map((summary) => (
                <li key={summary.line}>
                  <span><T id={summary.key} /></span>
                  <strong>
                    {filledForLine(summary.line)}/{formationLineTotal(formationId, summary.line)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="formation-selector" aria-labelledby="formation-selector-label">
            <span id="formation-selector-label"><T id="draft.formation" /></span>
            <div role="group">
              {FORMATION_IDS.map((optionId) => (
                <button
                  aria-pressed={formationId === optionId}
                  className={formationId === optionId ? "is-active" : ""}
                  disabled={formationLocked}
                  key={optionId}
                  type="button"
                  onClick={() => setFormationId(optionId)}
                >
                  {FORMATIONS[optionId].name}
                </button>
              ))}
            </div>
          </div>

          <div className="draft-context">
            <div>
              <span><T id="draft.currentClub" /></span>
              <strong>
                {currentRoll
                  ? safePlayerText(currentRoll.team_name, "Unknown club")
                  : <T id="draft.awaitingRoll" />}
              </strong>
            </div>
            <div>
              <span><T id="draft.currentDecade" /></span>
              <strong>
                {currentRoll
                  ? safePlayerText(currentRoll.decade, "Unknown decade")
                  : <T id="draft.awaitingRoll" />}
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
          formation={selectedFormation}
          lineup={lineup}
          sectionRef={formationRef}
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
          {mode === "normal" && (
            <div className="draft-sort-toggle" role="group" aria-label="Player sorting">
              <button
                className={normalSort === "stats" ? "is-active" : ""}
                type="button"
                onClick={() => setNormalSort("stats")}
              >
                <T id="draft.sortStats" />
              </button>
              <button
                className={normalSort === "position" ? "is-active" : ""}
                type="button"
                onClick={() => setNormalSort("position")}
              >
                <T id="draft.sortPositions" />
              </button>
            </div>
          )}

          <div className="available-list">
            {availablePlayers.map((player) => {
              const selected = candidate?.club_decade_player_id === player.club_decade_player_id;
              const goals = safePlayerStat(player.goals);
              const assists = safePlayerStat(player.assists);
              const cleanSheets = safePlayerStat(player.clean_sheets);
              const position = safePlayerText(player.game_position, "POS");
              const club = safePlayerText(player.team_name, "Unknown club");
              const decade = safePlayerText(player.decade, "Unknown decade");
              const isGoalkeeper = position === "GK";
              const relevantStats = isGoalkeeper
                ? [goals, assists, cleanSheets]
                : [goals, assists];
              const hasAnyStats = relevantStats.some((value) => value !== null);

              return (
                <button
                  className={`available-player${selected ? " is-selected" : ""}`}
                  key={safePlayerText(
                    player.club_decade_player_id,
                    `player-${player.player_id}`,
                  )}
                  type="button"
                  onClick={() => selectCandidate(player)}
                >
                  <span className="available-position">{position}</span>
                  <span className="available-player-copy">
                    <strong>{cleanPlayerName(player.player_name)}</strong>
                    <span>{club} / {decade}</span>
                    {mode === "normal" && hasAnyStats && (
                      <small>
                        <span>
                          <T id="draft.statGoals" />{" "}
                          {goals ?? <T id="draft.statUnavailable" />}
                        </span>
                        <span>
                          <T id="draft.statAssists" />{" "}
                          {assists ?? <T id="draft.statUnavailable" />}
                        </span>
                        {isGoalkeeper && (
                          <span>
                            <T id="draft.statCleanSheets" />{" "}
                            {cleanSheets ?? <T id="draft.statUnavailable" />}
                          </span>
                        )}
                      </small>
                    )}
                    {mode === "normal" && !hasAnyStats && (
                      <small className="available-stats-missing">
                        <T id="draft.statsNotReconstructed" />
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
