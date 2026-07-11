import type { Ref } from "react";
import { T } from "@/components/localized-text";
import type {
  Lineup,
} from "@/lib/draft-types";
import type { FormationConfig } from "@/lib/formations";
import {
  cleanPlayerName,
  safePlayerText,
} from "@/lib/player-display";

type FormationBoardProps = {
  formation: FormationConfig;
  lineup: Lineup;
  validSlotIds: Set<string>;
  onSlotClick: (slotId: string) => void;
  sectionRef?: Ref<HTMLElement>;
};

export function FormationBoard({
  formation,
  lineup,
  validSlotIds,
  onSlotClick,
  sectionRef,
}: FormationBoardProps) {
  return (
    <section className="formation-shell" ref={sectionRef}>
      <div className="formation-toolbar">
        <div>
          <span className="formation-label"><T id="draft.formation" /></span>
          <strong className="formation-value">{formation.name}</strong>
        </div>
        <div>
          <span className="formation-label"><T id="draft.status" /></span>
          <strong className="formation-value">
            {Object.keys(lineup).length}/11
          </strong>
        </div>
      </div>
      <div className="pitch">
        {formation.rows.map((row, rowIndex) => (
          <div
            className="formation-row"
            data-formation={formation.id}
            data-line={row[0]?.line}
            key={`${formation.id}-${rowIndex}`}
          >
            {row.map((slot) => {
                const player = lineup[slot.slot_id];
                const valid = validSlotIds.has(slot.slot_id);
                const longLabel = slot.slot_label.length >= 8;

                return (
                  <button
                    className={`player-card${player ? " is-filled" : ""}${valid ? " is-valid" : ""}`}
                    disabled={!valid}
                    key={slot.slot_id}
                    type="button"
                    onClick={() => onSlotClick(slot.slot_id)}
                  >
                    <span className={`player-number${longLabel ? " player-number-long" : ""}`}>
                      {slot.slot_label}
                    </span>
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
