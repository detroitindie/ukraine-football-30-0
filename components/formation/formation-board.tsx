import { T } from "@/components/localized-text";
import type {
  FormationLine,
  FormationSlot,
  Lineup,
} from "@/lib/draft-types";

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

function cleanPlayerName(name: string) {
  return name.replace(/\s+\(\d+\)$/, "");
}

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
              .sort((left, right) => left.slot_order - right.slot_order)
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
                    <span>{player ? player.game_position : slot.allowed_positions.join("/")}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
