import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "lib", "formations.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const testModule = { exports: {} };
vm.runInNewContext(output.outputText, {
  exports: testModule.exports,
  module: testModule,
  require,
}, { filename: sourcePath });

const {
  DEFAULT_FORMATION_ID,
  FORMATION_IDS,
  FORMATIONS,
  formationSlots,
  matchingFormationForLineup,
} = testModule.exports;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

assert.deepEqual(plain(FORMATION_IDS), ["4-4-2", "3-5-2", "5-3-2"]);
assert.equal(DEFAULT_FORMATION_ID, "4-4-2");

for (const formationId of FORMATION_IDS) {
  const slots = formationSlots(formationId);
  const slotIds = slots.map((slot) => slot.slot_id);
  assert.equal(slots.length, 11, `${formationId} should have 11 slots`);
  assert.equal(
    new Set(slotIds).size,
    slotIds.length,
    `${formationId} should have unique slot IDs`,
  );
  assert.deepEqual(
    plain(FORMATIONS[formationId].rows.flat().map((slot) => slot.slot_id)),
    plain(slotIds),
    `${formationId} rows should be the slot source of truth`,
  );
}

assert.deepEqual(
  plain(FORMATIONS["4-4-2"].rows.map((row) => row.map((slot) => slot.slot_label))),
  [
    ["AM/FW", "FW"],
    ["LM", "CM", "AM/CM", "RM"],
    ["LB", "CB", "CB", "RB"],
    ["GK"],
  ],
);
assert.deepEqual(
  plain(FORMATIONS["3-5-2"].rows.map((row) => row.map((slot) => slot.slot_label))),
  [
    ["AM/FW", "FW"],
    ["LM", "CDM/CM", "CDM/CM/AM", "CM/AM", "RM"],
    ["CB", "CB", "CB"],
    ["GK"],
  ],
);
assert.deepEqual(
  plain(FORMATIONS["5-3-2"].rows.map((row) => row.map((slot) => slot.slot_label))),
  [
    ["AM/FW", "FW"],
    ["CDM/CM", "CDM/CM/AM", "CM/AM"],
    ["LB", "CB", "CB", "CB", "RB"],
    ["GK"],
  ],
);

function allowed(formationId, slotId) {
  return formationSlots(formationId).find((slot) => slot.slot_id === slotId)
    ?.allowed_positions;
}

assert.deepEqual(plain(allowed("3-5-2", "cdm_cm")), ["CM"]);
assert.deepEqual(plain(allowed("3-5-2", "cdm_cm_am")), ["CM", "AM"]);
assert.deepEqual(plain(allowed("3-5-2", "cm_am")), ["CM", "AM"]);
assert.deepEqual(plain(allowed("3-5-2", "am_fw")), ["AM", "FW"]);
assert.deepEqual(plain(allowed("5-3-2", "cdm_cm")), ["CM"]);
assert.deepEqual(plain(allowed("5-3-2", "cdm_cm_am")), ["CM", "AM"]);
assert.deepEqual(plain(allowed("5-3-2", "cm_am")), ["CM", "AM"]);
assert.deepEqual(plain(allowed("5-3-2", "am_fw")), ["AM", "FW"]);

const lineupFor = (formationId) => Object.fromEntries(
  formationSlots(formationId).map((slot) => [slot.slot_id, { player_id: slot.slot_order }]),
);
assert.equal(matchingFormationForLineup(lineupFor("4-4-2")), "4-4-2");
assert.equal(matchingFormationForLineup(lineupFor("3-5-2")), "3-5-2");
assert.equal(matchingFormationForLineup(lineupFor("5-3-2")), "5-3-2");

console.log("Formation validation passed");
