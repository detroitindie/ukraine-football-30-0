import { T } from "@/components/localized-text";
import type {
  FormationLine,
  FormationSlot,
  Lineup,
} from "@/lib/draft-types";
import {
  cleanPlayerName,
  safePlayerText,
} from "@/lib/player-display";

type FormationBoardProps = {
  slots: FormationSlot[];
  lineup: Lineup;
  validSlotIds: Set<string>;
  onSlotClick: (slotId: string) => void;
};

const lineOrder: FormationLine[] = [
  "attack",
  "midfield",
  "defense",
  "goalkeeper",
];

const visualSlotOrder: Record<string, number> = {
  lm: 1,
  cm: 2,
  am_cm: 3,
  rm: 4,
};

export function FormationBoard({
  slots,
  lineup,
  validSlotIds,
  onSlotClick,
}: FormationBoardProps) {
  return (
    <section className="formation-shell">
      <div className="formation-toolbar">
        <div>
          <span className="formation-label"><T id="draft.formation" /></span>
          <strong className="formation-value">4-4-2</strong>
        </div>
        <div>
          <span className="formation-label"><T id="draft.status" /></span>
          <strong className="formation-value">
            {Object.keys(lineup).length}/11
          </strong>
        </div>
      </div>
      <div className="pitch">
        {lineOrder.map((line) => (
          <div className="formation-row" key={line}>
            {slots
              .filter((slot) => slot.line === line)
              .sort(
                (left, right) =>
                  (visualSlotOrder[left.slot_id] ?? left.slot_order) -
                  (visualSlotOrder[right.slot_id] ?? right.slot_order),
              )
              .map((slot) => {
                const player = lineup[slot.slot_id];
                const valid = validSlotIds.has(slot.slot_id);

                return (
                  <button
                    className={`player-card${player ? " is-filled" : ""}${valid ? " is-valid" : ""}`}
                    disabled={!valid}
                    key={slot.slot_id}
                    type="button"
                    onClick={() => onSlotClick(slot.slot_id)}
                  >
                    <span className="player-number">{slot.slot_label}</span>
                    <strong>
                      {player ? cleanPlayerName(player.player_name) : <T id="draft.emptySlot" />}
                    </strong>
                    <span>
                      {player
                        ? safePlayerText(player.game_position, slot.slot_label)
                        : slot.allowed_positions.join("/")}
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
