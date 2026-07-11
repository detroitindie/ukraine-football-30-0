import type { FormationLine, FormationSlot, Lineup } from "@/lib/draft-types";

export const FORMATION_IDS = ["4-4-2", "3-5-2", "5-3-2"] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

export const DEFAULT_FORMATION_ID: FormationId = "4-4-2";

export type FormationConfig = {
  id: FormationId;
  name: FormationId;
  rows: FormationSlot[][];
};

function slot(
  slot_id: string,
  slot_label: string,
  line: FormationLine,
  allowed_positions: string[],
  slot_order: number,
  semantic_positions = allowed_positions,
): FormationSlot {
  return {
    slot_id,
    slot_label,
    line,
    allowed_positions,
    semantic_positions,
    slot_order,
  };
}

export const FORMATIONS: Record<FormationId, FormationConfig> = {
  "4-4-2": {
    id: "4-4-2",
    name: "4-4-2",
    rows: [
      [slot("am_fw", "AM/FW", "attack", ["AM", "FW"], 10), slot("fw", "FW", "attack", ["FW"], 11)],
      [
        slot("lm", "LM", "midfield", ["LM"], 8),
        slot("cm", "CM", "midfield", ["CM", "CDM"], 6),
        slot("am_cm", "AM/CM", "midfield", ["AM", "CM"], 7),
        slot("rm", "RM", "midfield", ["RM"], 9),
      ],
      [
        slot("lb", "LB", "defense", ["LB"], 2),
        slot("cb_1", "CB", "defense", ["CB"], 3),
        slot("cb_2", "CB", "defense", ["CB"], 4),
        slot("rb", "RB", "defense", ["RB"], 5),
      ],
      [slot("gk", "GK", "goalkeeper", ["GK"], 1)],
    ],
  },
  "3-5-2": {
    id: "3-5-2",
    name: "3-5-2",
    rows: [
      [slot("am_fw", "AM/FW", "attack", ["AM", "FW"], 10), slot("fw", "FW", "attack", ["FW"], 11)],
      [
        slot("lm", "LM", "midfield", ["LM"], 5),
        slot("cdm_cm", "CDM/CM", "midfield", ["CM"], 6, ["CDM", "CM"]),
        slot("cdm_cm_am", "CDM/CM/AM", "midfield", ["CM", "AM"], 7, ["CDM", "CM", "AM"]),
        slot("cm_am", "CM/AM", "midfield", ["CM", "AM"], 8),
        slot("rm", "RM", "midfield", ["RM"], 9),
      ],
      [
        slot("cb_left", "CB", "defense", ["CB"], 2),
        slot("cb_center", "CB", "defense", ["CB"], 3),
        slot("cb_right", "CB", "defense", ["CB"], 4),
      ],
      [slot("gk", "GK", "goalkeeper", ["GK"], 1)],
    ],
  },
  "5-3-2": {
    id: "5-3-2",
    name: "5-3-2",
    rows: [
      [slot("am_fw", "AM/FW", "attack", ["AM", "FW"], 10), slot("fw", "FW", "attack", ["FW"], 11)],
      [
        slot("cdm_cm", "CDM/CM", "midfield", ["CM"], 7, ["CDM", "CM"]),
        slot("cdm_cm_am", "CDM/CM/AM", "midfield", ["CM", "AM"], 8, ["CDM", "CM", "AM"]),
        slot("cm_am", "CM/AM", "midfield", ["CM", "AM"], 9),
      ],
      [
        slot("lb", "LB", "defense", ["LB"], 2),
        slot("cb_left", "CB", "defense", ["CB"], 3),
        slot("cb_center", "CB", "defense", ["CB"], 4),
        slot("cb_right", "CB", "defense", ["CB"], 5),
        slot("rb", "RB", "defense", ["RB"], 6),
      ],
      [slot("gk", "GK", "goalkeeper", ["GK"], 1)],
    ],
  },
} as const;

export function isFormationId(value: unknown): value is FormationId {
  return FORMATION_IDS.some((formationId) => formationId === value);
}

export function formationSlots(formationId: FormationId): FormationSlot[] {
  return FORMATIONS[formationId].rows.flat();
}

export function formationLineTotal(
  formationId: FormationId,
  line: FormationLine,
) {
  return formationSlots(formationId).filter((slot) => slot.line === line).length;
}

export function matchingFormationForLineup(lineup: Lineup) {
  const lineupSlotIds = Object.keys(lineup).sort().join("|");
  return FORMATION_IDS.find(
    (formationId) =>
      formationSlots(formationId)
        .map((slot) => slot.slot_id)
        .sort()
        .join("|") === lineupSlotIds,
  );
}
