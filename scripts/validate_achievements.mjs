import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleCache = new Map();
const failures = [];
const positiveFixtureIds = new Set();
const outputArgIndex = process.argv.indexOf("--output");
const outputDir = outputArgIndex === -1
  ? null
  : path.resolve(root, process.argv[outputArgIndex + 1]);

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function resolveAlias(specifier, fromFile) {
  if (specifier.startsWith("@/")) {
    return path.join(root, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }
  return null;
}

function loadTsModule(filename) {
  let resolved = filename;
  if (!path.extname(resolved)) {
    if (fs.existsSync(`${resolved}.ts`)) {
      resolved = `${resolved}.ts`;
    } else if (fs.existsSync(`${resolved}.tsx`)) {
      resolved = `${resolved}.tsx`;
    } else if (fs.existsSync(`${resolved}.json`)) {
      resolved = `${resolved}.json`;
    }
  }
  resolved = path.normalize(resolved);
  if (resolved.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  }
  if (moduleCache.has(resolved)) {
    return moduleCache.get(resolved).exports;
  }

  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: resolved,
  }).outputText;

  const loadedModule = { exports: {} };
  moduleCache.set(resolved, loadedModule);
  const localRequire = (specifier) => {
    const aliased = resolveAlias(specifier, resolved);
    if (aliased) {
      return loadTsModule(aliased);
    }
    return require(specifier);
  };
  const wrapper = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) { ${output}\n})`,
    { filename: resolved },
  );
  wrapper(loadedModule.exports, localRequire, loadedModule, resolved, path.dirname(resolved));
  return loadedModule.exports;
}

const spec = JSON.parse(
  fs.readFileSync(path.join(root, "docs/achievement-implementation-spec.json"), "utf8"),
);
const raritySpec = JSON.parse(
  fs.readFileSync(path.join(root, "docs/achievement-rarity-final.json"), "utf8"),
);
const players = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/players.json"), "utf8"),
);
const rollPool = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/roll_pool.json"), "utf8"),
);
const cupRollPool = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/cup_roll_pool.json"), "utf8"),
);
const {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
} = loadTsModule(path.join(root, "lib/achievements/registry.ts"));
const { evaluateAchievements } = loadTsModule(
  path.join(root, "lib/achievements/evaluate.ts"),
);
const { achievementShareLines } = loadTsModule(
  path.join(root, "lib/achievements/share.ts"),
);
const { translations } = loadTsModule(
  path.join(root, "lib/translations.ts"),
);
const {
  GERMANY_2006_PLAYER_IDS,
  NAMED_PLAYER_IDS,
  TEAM_SETS,
} = loadTsModule(path.join(root, "lib/achievements/constants.ts"));
const { formationSlots } = loadTsModule(path.join(root, "lib/formations.ts"));

const namedIds = spec.named_player_ids;
const teamSets = spec.team_id_sets;
const validRarities = new Set(["common", "rare", "epic", "legendary"]);
const expectedRarityDistribution = {
  common: 12,
  rare: 8,
  epic: 22,
  legendary: 53,
};
const finalRarityById = new Map(
  raritySpec.achievements.map((achievement) => [String(achievement.id), achievement.rarity]),
);

function normalized(raw) {
  return raw
    .split(/\s{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value === "Bosnia-Herzegovina" ? "Bosnia and Herzegovina" : value);
}

function league(overrides = {}) {
  const wins = overrides.wins ?? 20;
  const draws = overrides.draws ?? 5;
  const losses = overrides.losses ?? 5;
  const goalsFor = overrides.goalsFor ?? 70;
  const goalsAgainst = overrides.goalsAgainst ?? 25;
  return {
    matches: 30,
    wins,
    draws,
    losses,
    points: overrides.points ?? wins * 3 + draws,
    goalsFor,
    goalsAgainst,
    goalDifference: overrides.goalDifference ?? goalsFor - goalsAgainst,
    verdict: overrides.verdict ?? "championship",
  };
}

const cupStages = [
  "round_of_64",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "final",
];

function cupMatch(stage, overrides = {}) {
  const result = overrides.result ?? "win";
  const goalsFor = overrides.goalsFor ?? (result === "win" ? 2 : 0);
  const goalsAgainst = overrides.goalsAgainst ?? (result === "win" ? 1 : 1);
  const decidedBy = overrides.decidedBy ?? "regular_time";
  return {
    stage,
    result,
    goalsFor,
    goalsAgainst,
    decidedBy,
    penaltiesFor: decidedBy === "penalties" ? (overrides.penaltiesFor ?? (result === "win" ? 5 : 3)) : undefined,
    penaltiesAgainst: decidedBy === "penalties" ? (overrides.penaltiesAgainst ?? (result === "win" ? 3 : 5)) : undefined,
    regularTimeWin: result === "win" && decidedBy === "regular_time",
  };
}

function cupWin(matchOverrides = []) {
  const matches = cupStages.map((stage, index) => cupMatch(stage, matchOverrides[index] ?? {}));
  return cupResult(matches, 6, true);
}

function cupFinalLoss() {
  const matches = cupStages.map((stage, index) =>
    cupMatch(stage, index === 5 ? { result: "loss", goalsFor: 0, goalsAgainst: 1 } : {}),
  );
  return cupResult(matches, 5, false);
}

function cupSemiLoss() {
  const matches = cupStages.slice(0, 5).map((stage, index) =>
    cupMatch(stage, index === 4 ? { result: "loss", goalsFor: 0, goalsAgainst: 1 } : {}),
  );
  return cupResult(matches, 4, false);
}

function cupFirstLoss() {
  return cupResult([cupMatch("round_of_64", { result: "loss", goalsFor: 0, goalsAgainst: 1 })], 0, false);
}

function cupResult(matches, stageRank, wonCup) {
  const goalsFor = matches.reduce((total, match) => total + match.goalsFor, 0);
  const goalsAgainst = matches.reduce((total, match) => total + match.goalsAgainst, 0);
  return {
    competition: "cup",
    matches,
    stageRank,
    stageLabelUa: "final",
    stageLabelEn: "Final",
    wonCup,
    regularTimeWins: matches.filter((match) => match.regularTimeWin).length,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  };
}

function player(overrides = {}) {
  const id = overrides.player_id ?? nextPlayerId++;
  const citizenships = overrides.citizenships ?? [];
  return {
    club_decade_player_id: `${overrides.team_id ?? 900000}_${overrides.decade ?? "2000s"}_${id}`,
    club_decade_id: `${overrides.team_id ?? 900000}_${overrides.decade ?? "2000s"}`,
    team_id: overrides.team_id ?? nextTeamId++,
    team_name: overrides.team_name ?? "Fixture FC",
    decade: overrides.decade ?? "2000s",
    player_id: id,
    player_name: overrides.player_name ?? `Fixture Player ${id}`,
    citizenships,
    primary_citizenship: overrides.primary_citizenship ?? citizenships[0] ?? null,
    position: overrides.position ?? "CM",
    main_position: overrides.main_position ?? "Midfield",
    game_position: overrides.game_position ?? "CM",
    goals: null,
    assists: null,
    clean_sheets: null,
    raw_score: null,
    local_rating: null,
    global_rating: null,
    global_percentile: null,
    hidden_modifier: null,
    effective_global_rating: null,
  };
}

let nextPlayerId = 1_000_000;
let nextTeamId = 800_000;

function lineup(playersForSlots, formationId = "4-4-2") {
  const slots = formationSlots(formationId);
  const result = {};
  slots.forEach((slot, index) => {
    result[slot.slot_id] = playersForSlots[index] ?? player();
  });
  return result;
}

function assignedLineup(assignments, formationId = "4-4-2") {
  const result = lineup([], formationId);
  for (const [slotId, assignedPlayer] of Object.entries(assignments)) {
    result[slotId] = assignedPlayer;
  }
  return result;
}

function input({
  competition = "league",
  mode = "normal",
  formationId = "4-4-2",
  playersForSlots = [],
  slotAssignments = null,
  result = null,
} = {}) {
  return {
    competition,
    mode,
    formationId,
    lineup: slotAssignments ?? lineup(playersForSlots, formationId),
    result: result ?? (competition === "cup" ? cupWin() : league()),
  };
}

function teamPlayers(teamIds, count, options = {}) {
  const ids = Array.isArray(teamIds) ? teamIds : [...teamIds];
  return Array.from({ length: count }, (_, index) =>
    player({
      ...options,
      team_id: ids[index % ids.length],
      player_id: options.player_id ? options.player_id + index : undefined,
    }),
  );
}

function idPlayer(player_id, options = {}) {
  return player({ ...options, player_id });
}

function expectAchievement(id, fixture) {
  positiveFixtureIds.add(String(id));
  const earned = evaluateAchievements(fixture).map((achievement) => achievement.id);
  assert(earned.includes(String(id)), `positive fixture for achievement ${id} did not fire; got ${earned.join(", ") || "none"}`);
}

function expectNoAchievement(id, fixture, label) {
  const earned = evaluateAchievements(fixture).map((achievement) => achievement.id);
  assert(!earned.includes(String(id)), `${label}: achievement ${id} unexpectedly fired`);
}

function runPositiveFixtures() {
  expectAchievement(1, input({ playersForSlots: [idPlayer(namedIds.artem_milevskyi), idPlayer(namedIds.oleksandr_aliev)] }));
  expectAchievement(2, input({ playersForSlots: teamPlayers(teamSets.nyva_ternopil, 2) }));
  expectAchievement(3, input());
  expectAchievement(4, input({ playersForSlots: Array.from({ length: 9 }, () => player({ citizenships: ["Brazil"] })) }));
  expectAchievement(5, input({ playersForSlots: Array.from({ length: 11 }, (_, i) => player({ citizenships: [`Foreign ${i}`] })) }));
  expectAchievement(6, input({ playersForSlots: Array.from({ length: 11 }, () => player({ citizenships: ["Ukraine"] })) }));
  expectAchievement(7, input({ playersForSlots: teamPlayers(teamSets.donbas, 8) }));
  expectAchievement(8, input({ playersForSlots: teamPlayers(teamSets.crimea, 3) }));
  expectAchievement(9, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.karpaty_lviv, 1), result: cupWin() }));
  expectAchievement(10, input({ playersForSlots: [player({ citizenships: ["Russia"] })] }));
  expectAchievement(11, input({ playersForSlots: [player({ citizenships: ["Russia"] }), idPlayer(spec.flagged_zrada_player_ids[0])] }));
  expectAchievement(12, input({ result: league({ wins: 5, draws: 5, losses: 20, verdict: "relegation" }) }));
  expectAchievement(13, input({ competition: "cup", result: cupFirstLoss() }));
  expectAchievement(14, input({ playersForSlots: teamPlayers(teamSets.tavriya, 2) }));
  expectAchievement(15, input({ playersForSlots: teamPlayers(teamSets.dynamo_kyiv, 2, { decade: "1990s" }) }));
  expectAchievement(16, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.shakhtar_donetsk, 2, { decade: "2000s" }), result: cupWin() }));
  expectAchievement(17, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.dnipro, 2, { decade: "2010s" }), result: cupFinalLoss() }));
  expectAchievement(18, input({ playersForSlots: [idPlayer(namedIds.andriy_shevchenko), idPlayer(namedIds.serhiy_rebrov)] }));
  expectAchievement(19, input({ playersForSlots: [idPlayer(namedIds.andriy_shevchenko)] }));
  expectAchievement(20, input({ competition: "cup", playersForSlots: [idPlayer(namedIds.oleksandr_shovkovskyi)], result: cupWin([{ decidedBy: "penalties", goalsFor: 1, goalsAgainst: 1 }]) }));
  expectAchievement(21, input({ playersForSlots: [...GERMANY_2006_PLAYER_IDS].slice(0, 5).map((player_id) => idPlayer(player_id)) }));
  expectAchievement(22, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.chornomorets_odesa, 3), result: cupWin() }));
  expectAchievement(23, input({ result: league({ wins: 20, draws: 10, losses: 0 }) }));
  expectAchievement(24, input({ result: league({ wins: 20, draws: 0, losses: 10 }) }));
  expectAchievement(25, input({ result: league({ wins: 10, draws: 10, losses: 10, verdict: "midTable" }) }));
  expectAchievement(26, input({ result: league({ wins: 30, draws: 0, losses: 0 }) }));
  expectAchievement(27, input({ result: league({ goalsAgainst: 15 }) }));
  expectAchievement(28, input({ competition: "cup", result: cupWin() }));
  expectAchievement(29, input({ competition: "cup", result: cupWin([{ decidedBy: "extra_time" }, { decidedBy: "penalties", goalsFor: 1, goalsAgainst: 1 }, { decidedBy: "extra_time" }]) }));
  expectAchievement(30, input({ competition: "cup", result: cupWin(cupStages.map(() => ({ decidedBy: "penalties", goalsFor: 1, goalsAgainst: 1 }))) }));
  expectAchievement(31, input({ mode: "hardcore" }));
  expectAchievement(32, input({ playersForSlots: teamPlayers([338], 6) }));
  expectAchievement(33, input({ playersForSlots: Array.from({ length: 11 }, () => player()) }));
  expectAchievement(34, input({ formationId: "3-5-2", slotAssignments: assignedLineup({ cb_left: player({ team_id: 338 }), cb_center: player({ team_id: 338 }), cb_right: player({ team_id: 338 }) }, "3-5-2") }));
  expectAchievement(35, input({ formationId: "5-3-2", result: league({ goalsAgainst: 20 }) }));
  expectAchievement(36, input({ playersForSlots: [idPlayer(namedIds.jadson)] }));
  expectAchievement(37, input({ playersForSlots: teamPlayers(teamSets.metalist_kharkiv, 2, { decade: "2010s" }) }));
  expectAchievement(38, input({ playersForSlots: teamPlayers(teamSets.volyn_lutsk, 3), result: league({ wins: 1, draws: 10, losses: 19, verdict: "relegation" }) }));
  expectAchievement(39, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.vorskla_poltava, 2), result: cupWin() }));
  expectAchievement(40, input({ playersForSlots: [idPlayer(namedIds.ruslan_rotan), idPlayer(namedIds.sergiy_nazarenko)] }));
  expectAchievement(41, input({ playersForSlots: [idPlayer(namedIds.darijo_srna)] }));
  expectAchievement(42, input({ playersForSlots: [idPlayer(namedIds.jadson), idPlayer(namedIds.fernandinho), idPlayer(namedIds.willian_shakhtar)] }));
  expectAchievement(43, input({ mode: "hardcore", playersForSlots: Array.from({ length: 11 }, () => player({ citizenships: ["Ukraine"] })) }));
  expectAchievement(44, input({ playersForSlots: Array.from({ length: 8 }, (_, i) => player({ citizenships: [`Country ${i}`] })) }));
  expectAchievement(45, input({ playersForSlots: ["Albania", "Croatia", "Serbia", "Romania", "Greece"].map((country) => player({ citizenships: [country] })) }));
  expectAchievement(46, input({ playersForSlots: ["Brazil", "Argentina", "Chile", "Colombia", "Uruguay", "Peru"].map((country) => player({ citizenships: [country] })) }));
  expectAchievement(47, input({ playersForSlots: [
    ...["1990s", "1990s", "2000s", "2000s", "2010s", "2010s", "2020s", "2020s"].map((decade) => player({ decade })),
    player({ decade: "2000s" }),
    player({ decade: "2010s" }),
    player({ decade: "2020s" }),
  ] }));
  expectAchievement(48, input({ playersForSlots: Array.from({ length: 6 }, () => player({ decade: "2020s" })) }));
  expectAchievement(49, input({ playersForSlots: Array.from({ length: 6 }, () => player({ decade: "1990s" })) }));
  expectAchievement(50, input({ result: league({ wins: 0, draws: 10, losses: 20, verdict: "relegation" }) }));
  expectAchievement(51, input({ result: league({ wins: 5, draws: 15, losses: 10, verdict: "midTable" }) }));
  expectAchievement(52, input({ result: league({ wins: 10, draws: 10, losses: 10, goalsFor: 30, goalsAgainst: 30, goalDifference: 0, verdict: "midTable" }) }));
  expectAchievement(53, input({ result: league({ goalsFor: 60, goalsAgainst: 52, goalDifference: 8, verdict: "championship" }) }));
  expectAchievement(54, input({ result: league({ goalsFor: 75 }) }));
  expectAchievement(55, input({ result: league({ goalsFor: 55, goalsAgainst: 40 }) }));
  expectAchievement(56, input({ competition: "cup", result: cupWin([{}, {}, {}, {}, {}, { decidedBy: "penalties", goalsFor: 1, goalsAgainst: 1 }]) }));
  expectAchievement(57, input({ competition: "cup", result: cupWin([{}, {}, {}, {}, {}, { decidedBy: "extra_time" }]) }));
  expectAchievement(58, input({ competition: "cup", result: cupFinalLoss() }));
  expectAchievement(59, input({ playersForSlots: [idPlayer(namedIds.nikola_vasilj)] }));
  expectAchievement(60, input({ competition: "cup", result: cupWin(cupStages.map(() => ({ goalsFor: 1, goalsAgainst: 0 }))) }));
  expectAchievement(61, input({ playersForSlots: teamPlayers(teamSets.dynamo_kyiv, 4, { citizenships: ["Ukraine"] }) }));
  expectAchievement(62, input({ competition: "cup", playersForSlots: teamPlayers(teamSets.metalurh_zaporizhzhia, 2, { decade: "2000s" }), result: cupFinalLoss() }));
  expectAchievement(63, input({ playersForSlots: [idPlayer(namedIds.yaya_toure)] }));
  expectAchievement(64, input({ playersForSlots: [player({ team_id: teamSets.metalurh_zaporizhzhia[0] }), player({ team_id: teamSets.metalurh_donetsk[0] }), player({ team_id: teamSets.mariupol_line[0] })] }));
  expectAchievement(65, input({ playersForSlots: [idPlayer(namedIds.andriy_yarmolenko), idPlayer(namedIds.yevhen_konoplyanka)] }));
  expectAchievement(66, input({ playersForSlots: ["1990s", "2000s", "2010s", "2020s"].map((decade) => player({ team_id: 338, decade })) }));
  expectAchievement(67, input({ playersForSlots: [91714, 80312, namedIds.andriy_shevchenko].map((player_id) => idPlayer(player_id)) }));
  expectAchievement(68, input({ playersForSlots: [...teamPlayers(teamSets.donbas, 2), ...teamPlayers(teamSets.lviv, 2)] }));
  expectAchievement(69, input({ playersForSlots: [player({ team_id: teamSets.crimea[0] }), player({ team_id: teamSets.donbas[0] })] }));
  expectAchievement(70, input({ playersForSlots: [player({ team_id: teamSets.karpaty_lviv[0] }), player({ team_id: 48726 }), player({ team_id: 18105 })] }));
  expectAchievement(71, input({ playersForSlots: [338, 9007, 2744, 338, 9007].map((team_id) => player({ team_id })) }));
  expectAchievement(72, input({ playersForSlots: Array.from({ length: 11 }, (_, i) => player({ citizenships: [`Country ${i}`] })) }));
  expectAchievement(73, input({ playersForSlots: ["Nigeria", "Ghana", "Senegal", "Morocco", "Cameroon"].map((country) => player({ citizenships: [country] })) }));
  expectAchievement(74, input({ competition: "cup", result: cupWin([{ goalsFor: 2, goalsAgainst: 1 }, { goalsFor: 2, goalsAgainst: 1 }, { goalsFor: 2, goalsAgainst: 1 }]) }));
  expectAchievement(75, input({ mode: "hardcore", formationId: "4-4-2" }));
  expectAchievement(76, input({ playersForSlots: Array.from({ length: 6 }, () => player({ decade: "2000s" })) }));
  expectAchievement(77, input({ playersForSlots: Array.from({ length: 6 }, () => player({ decade: "2010s" })) }));
  expectAchievement(78, input({ slotAssignments: assignedLineup({ cm: idPlayer(namedIds.taras_stepanenko) }) }));
  expectAchievement(79, input({ playersForSlots: teamPlayers(teamSets.zorya_luhansk, 3) }));
  expectAchievement(80, input({ playersForSlots: teamPlayers(teamSets.kryvbas_kryvyi_rih, 3) }));
  expectAchievement(81, input({ playersForSlots: teamPlayers(teamSets.oleksandriya, 2, { decade: "2010s" }), result: league({ verdict: "europe" }) }));
  expectAchievement(82, input({ playersForSlots: teamPlayers(teamSets.kolos_kovalivka, 2), result: league({ verdict: "europe" }) }));
  expectAchievement(83, input({ playersForSlots: teamPlayers(teamSets.obolon, 3), result: league({ wins: 1, draws: 10, losses: 19, verdict: "relegation" }) }));
  expectAchievement(84, input({ playersForSlots: [...teamPlayers(teamSets.dynamo_kyiv, 2), ...teamPlayers(teamSets.shakhtar_donetsk, 2)] }));
  expectAchievement(85, input({ playersForSlots: Array.from({ length: 11 }, () => player({ citizenships: ["Ukraine"] })) }));
  expectAchievement(86, input({ playersForSlots: Array.from({ length: 3 }, () => player({ citizenships: ["Georgia"] })) }));
  expectAchievement(87, input({ playersForSlots: Array.from({ length: 3 }, () => player({ citizenships: ["Nigeria"] })) }));
  expectAchievement(88, input({ formationId: "5-3-2", slotAssignments: assignedLineup({ lb: player({ team_id: 338 }), cb_left: player({ team_id: 338 }), cb_center: player({ team_id: 338 }), cb_right: player({ team_id: 338 }), rb: player({ team_id: 338 }) }, "5-3-2") }));
  expectAchievement(89, input({ formationId: "5-3-2", slotAssignments: assignedLineup({ lb: player({ team_id: 1 }), cb_left: player({ team_id: 2 }), cb_center: player({ team_id: 3 }), cb_right: player({ team_id: 4 }), rb: player({ team_id: 5 }) }, "5-3-2") }));
  expectAchievement(90, input({ formationId: "3-5-2", slotAssignments: assignedLineup({ lm: player({ citizenships: ["A"] }), cdm_cm: player({ citizenships: ["B"] }), cdm_cm_am: player({ citizenships: ["C"] }), cm_am: player({ citizenships: ["D"] }), rm: player({ citizenships: ["E"] }) }, "3-5-2") }));
  expectAchievement(91, input({ formationId: "3-5-2", slotAssignments: assignedLineup({ cb_left: player({ team_id: 1, citizenships: ["Ukraine"] }), cb_center: player({ team_id: 2, citizenships: ["Ukraine"] }), cb_right: player({ team_id: 3, citizenships: ["Ukraine"] }) }, "3-5-2") }));
  expectAchievement(92, input({ slotAssignments: assignedLineup({ am_fw: player({ team_id: 338 }), fw: player({ team_id: 338 }) }), result: league({ wins: 1, draws: 10, losses: 19, verdict: "relegation" }) }));
  expectAchievement(93, input({ result: league({ goalsAgainst: 60, verdict: "midTable" }) }));
  expectAchievement(94, input({ playersForSlots: [player({ team_id: teamSets.uzhhorod[0] })] }));
  expectAchievement(95, input({ playersForSlots: Array.from({ length: 2 }, () => player({ citizenships: ["Albania"] })) }));
}

function runNegativeFixtures() {
  expectNoAchievement(5, input({ playersForSlots: Array.from({ length: 11 }, () => player({ citizenships: [] })) }), "missing citizenship does not count as legionnaire");
  expectNoAchievement(6, input({ playersForSlots: [player({ citizenships: ["Ukraine"] }), ...Array.from({ length: 10 }, () => player({ citizenships: [] }))] }), "Slava Ukraini requires Ukraine for all 11");
  expectNoAchievement(11, input({ playersForSlots: [idPlayer(spec.flagged_zrada_player_ids[0], { citizenships: ["Russia"] })] }), "zrada flagged plus citizenship deduplicates same player");
  expectNoAchievement(78, input({ slotAssignments: assignedLineup({ fw: idPlayer(namedIds.taras_stepanenko) }) }), "CDM achievement uses assigned slot semantics");
  expectNoAchievement(21, input({ playersForSlots: [idPlayer(namedIds.oleksandr_aliev), ...[...GERMANY_2006_PLAYER_IDS].slice(0, 4).map((player_id) => idPlayer(player_id))] }), "Aliev does not count for Germany 2006");
  expectNoAchievement(47, input({ playersForSlots: [
    player({ decade: "1990s" }),
    player({ decade: "2000s" }),
    player({ decade: "2000s" }),
    player({ decade: "2010s" }),
    player({ decade: "2010s" }),
    player({ decade: "2020s" }),
    player({ decade: "2020s" }),
  ] }), "Different Eras requires at least two players from every decade");
  expectNoAchievement(47, input({ playersForSlots: [
    player({ decade: "1990s" }),
    player({ decade: "1990s" }),
    player({ decade: "2000s" }),
    player({ decade: "2000s" }),
    player({ decade: "2010s" }),
    player({ decade: "2010s" }),
    player({ decade: "2020s" }),
  ] }), "Different Eras rejects one represented decade with only one player");
  expectNoAchievement(54, input({ result: league({ goalsFor: 74 }) }), "Bavovna requires 75 league goals");
  expectNoAchievement(55, input({ result: league({ goalsFor: 54, goalsAgainst: 40 }) }), "Defense Optional requires 55 league goals");
  expectNoAchievement(55, input({ result: league({ goalsFor: 55, goalsAgainst: 39 }) }), "Defense Optional requires 40 conceded league goals");

  for (const formationId of ["4-4-2", "3-5-2", "5-3-2"]) {
    const slotId = formationId === "4-4-2" ? "cm" : "cdm_cm";
    const earned = evaluateAchievements(input({
      formationId,
      slotAssignments: assignedLineup({ [slotId]: idPlayer(namedIds.sergiy_sydorchuk) }, formationId),
    })).map((achievement) => achievement.id);
    assert(earned.includes("78"), `CDM from Zaporizhzhia did not fire in ${formationId}`);
  }

  const kovalivkaCup = evaluateAchievements(input({
    competition: "cup",
    playersForSlots: teamPlayers(teamSets.kolos_kovalivka, 2),
    result: cupSemiLoss(),
  })).map((achievement) => achievement.id);
  assert(kovalivkaCup.includes("82"), "Kovalivka in Europe did not fire for Cup semi-final");
}

function runStaticChecks() {
  assert(ACHIEVEMENT_COUNT === 95, `metadata count is ${ACHIEVEMENT_COUNT}, expected 95`);
  assert(ACHIEVEMENTS.length === 95, `runtime registry has ${ACHIEVEMENTS.length}, expected 95`);
  assert(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size === 95, "achievement IDs are not unique");
  assert(new Set(ACHIEVEMENTS.map((achievement) => achievement.title.ua)).size === 95, "UA titles are not unique");
  assert(new Set(ACHIEVEMENTS.map((achievement) => achievement.title.en)).size === 95, "EN titles are not unique");
  const rarityDistribution = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const achievement of ACHIEVEMENTS) {
    assert(achievement.title.ua.trim().length > 0, `${achievement.id} has empty UA title`);
    assert(achievement.title.en.trim().length > 0, `${achievement.id} has empty EN title`);
    assert(achievement.description.ua.trim().length > 0, `${achievement.id} has empty UA description`);
    assert(achievement.description.en.trim().length > 0, `${achievement.id} has empty EN description`);
    assert(validRarities.has(achievement.rarity), `${achievement.id} has invalid rarity ${achievement.rarity}`);
    assert(finalRarityById.get(achievement.id) === achievement.rarity, `${achievement.id} rarity does not match docs/achievement-rarity-final.json`);
    rarityDistribution[achievement.rarity] += 1;
  }
  assert(raritySpec.achievements.length === 95, `final rarity spec has ${raritySpec.achievements.length}, expected 95`);
  assert(new Set(raritySpec.achievements.map((achievement) => achievement.id)).size === 95, "final rarity spec IDs are not unique");
  for (const [rarity, expected] of Object.entries(expectedRarityDistribution)) {
    assert(rarityDistribution[rarity] === expected, `rarity distribution ${rarity} is ${rarityDistribution[rarity]}, expected ${expected}`);
  }
  for (const language of ["ua", "en"]) {
    for (const rarity of validRarities) {
      const key = `achievement.rarity.${rarity}`;
      assert(typeof translations[language][key] === "string" && translations[language][key].trim().length > 0, `missing ${language} rarity label ${key}`);
    }
  }

  assert(JSON.stringify(normalized("Ukraine")) === JSON.stringify(["Ukraine"]), "citizenship parse: Ukraine only");
  assert(JSON.stringify(normalized("Brazil")) === JSON.stringify(["Brazil"]), "citizenship parse: foreign only");
  assert(JSON.stringify(normalized("Ukraine  Russia")) === JSON.stringify(["Ukraine", "Russia"]), "citizenship parse: Ukraine plus foreign");
  assert(JSON.stringify(normalized("Brazil  Italy")) === JSON.stringify(["Brazil", "Italy"]), "citizenship parse: multiple foreign");
  assert(JSON.stringify(normalized("")) === JSON.stringify([]), "citizenship parse: empty");

  const playerIds = new Set(players.map((row) => row.player_id));
  const teamIds = new Set(players.map((row) => row.team_id));
  const unresolvedNamed = Object.entries(NAMED_PLAYER_IDS).filter(([, id]) => !playerIds.has(id));
  const unresolvedTeams = Object.entries(TEAM_SETS).flatMap(([name, ids]) =>
    ids.filter((id) => !teamIds.has(id)).map((id) => `${name}:${id}`),
  );
  assert(unresolvedNamed.length === 0, `unresolved named-player IDs: ${unresolvedNamed.map(([name, id]) => `${name}:${id}`).join(", ")}`);
  assert(unresolvedTeams.length === 0, `unresolved team IDs: ${unresolvedTeams.join(", ")}`);
  assert(players.every((row) => Array.isArray(row.citizenships)), "some generated player rows lack citizenships array");
  assert(players.every((row) => "primary_citizenship" in row), "some generated player rows lack primary_citizenship");

  const alievRows = players.filter((row) => row.player_id === namedIds.oleksandr_aliev);
  const shustRows = players.filter((row) => row.player_id === namedIds.bohdan_shust);
  assert(alievRows.some((row) => row.team_id === 338 && row.decade === "2000s" && row.game_position === "AM"), "missing Aliev Dynamo Kyiv 2000s AM row");
  assert(alievRows.some((row) => row.team_id === 338 && row.decade === "2010s" && row.game_position === "AM"), "missing Aliev Dynamo Kyiv 2010s AM row");
  assert(shustRows.some((row) => row.team_id === 660 && row.decade === "2000s" && row.game_position === "GK"), "missing Shust Shakhtar 2000s GK row");

  const rollPoolIds = new Set(rollPool.map((row) => row.club_decade_id));
  const cupRollPoolIds = new Set(cupRollPool.map((row) => row.club_decade_id));
  for (const row of [...alievRows, ...shustRows]) {
    assert(rollPoolIds.has(row.club_decade_id), `${row.club_decade_player_id} missing from league roll pool`);
    assert(cupRollPoolIds.has(row.club_decade_id), `${row.club_decade_player_id} missing from cup roll pool`);
  }

  assert(GERMANY_2006_PLAYER_IDS.has(namedIds.bohdan_shust), "Bohdan Shust is not in Germany 2006 set");
  assert(!GERMANY_2006_PLAYER_IDS.has(namedIds.oleksandr_aliev), "Oleksandr Aliev is incorrectly in Germany 2006 set");

  const uaShare = achievementShareLines([ACHIEVEMENTS[0], ACHIEVEMENTS[1]], "ua");
  const enShare = achievementShareLines([ACHIEVEMENTS[0], ACHIEVEMENTS[1]], "en");
  assert(uaShare[1] === "Досягнення:", "UA share header is wrong");
  assert(enShare[1] === "Achievements:", "EN share header is wrong");
  assert(uaShare.length === 4 && enShare.length === 4, "multiple achievement share lines are wrong");
  assert(achievementShareLines([], "en").length === 0, "empty share section should be omitted");
  const allShareText = [
    ...achievementShareLines([ACHIEVEMENTS[0], ACHIEVEMENTS[1]], "en"),
    ...achievementShareLines([ACHIEVEMENTS[0], ACHIEVEMENTS[1]], "ua"),
  ].join("\n");
  for (const rarityLabel of ["Common", "Rare", "Epic", "Legendary", "Звичайне", "Рідкісне", "Епічне", "Легендарне"]) {
    assert(!allShareText.includes(rarityLabel), `share text unexpectedly contains rarity label ${rarityLabel}`);
  }

  const resultSource = fs.readFileSync(path.join(root, "components/result/season-result.tsx"), "utf8");
  assert(
    resultSource.includes("const achievements = complete") &&
      resultSource.includes("evaluateAchievements({ ...savedResult, result: cupResult })"),
    "cup achievements are not gated by full reveal completion",
  );
  assert(
    resultSource.includes("achievement-rarity") &&
      resultSource.includes("rarityLabelKey(achievement.rarity)"),
    "result UI does not render a localized rarity badge",
  );
}

runStaticChecks();
runPositiveFixtures();
runNegativeFixtures();

for (const achievement of ACHIEVEMENTS) {
  assert(positiveFixtureIds.has(achievement.id), `achievement ${achievement.id} has no positive automated fixture`);
}

const orderFixture = input({
  playersForSlots: [idPlayer(namedIds.artem_milevskyi), idPlayer(namedIds.oleksandr_aliev), ...teamPlayers(teamSets.nyva_ternopil, 2)],
});
const orderIds = evaluateAchievements(orderFixture).map((achievement) => Number(achievement.id));
assert(orderIds.includes(1) && orderIds.includes(2), "multiple achievements did not fire together");
assert(orderIds.join(",") === [...orderIds].sort((a, b) => a - b).join(","), "achievement result order does not follow registry order");

const rarityDistribution = ACHIEVEMENTS.reduce((counts, achievement) => {
  counts[achievement.rarity] = (counts[achievement.rarity] ?? 0) + 1;
  return counts;
}, {});

console.log(`Achievement count: ${ACHIEVEMENTS.length}`);
console.log(`Rarity distribution: common ${rarityDistribution.common ?? 0}, rare ${rarityDistribution.rare ?? 0}, epic ${rarityDistribution.epic ?? 0}, legendary ${rarityDistribution.legendary ?? 0}`);
console.log("Missing or invalid rarity values: none");
console.log("Duplicate IDs/titles: none");
console.log("Unresolved named-player IDs: none");
console.log("Unresolved team IDs: none");
console.log("Missing citizenship fields: none");
console.log("Aliev rows:", players.filter((row) => row.player_id === namedIds.oleksandr_aliev).map((row) => `${row.team_name} ${row.decade} ${row.game_position}`).join("; "));
console.log("Shust rows:", players.filter((row) => row.player_id === namedIds.bohdan_shust).map((row) => `${row.team_name} ${row.decade} ${row.game_position}`).join("; "));
console.log("Germany 2006 roster resolved IDs:", [...GERMANY_2006_PLAYER_IDS].join(", "));
console.log("Achievements without positive fixture: none");

if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    title_ua: achievement.title.ua,
    title_en: achievement.title.en,
    competition: achievement.competition,
    rarity: achievement.rarity,
    positive_fixture_passed: positiveFixtureIds.has(achievement.id),
  }));
  const report = {
    generated_at: new Date().toISOString(),
    real_production_evaluator: true,
    registry_count: ACHIEVEMENTS.length,
    expected_count: 95,
    rarity_distribution: rarityDistribution,
    expected_rarity_distribution: expectedRarityDistribution,
    all_positive_fixtures_passed: rows.every((row) => row.positive_fixture_passed),
    failures,
    achievements: rows,
  };
  fs.writeFileSync(
    path.join(outputDir, "achievement_reachability.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outputDir, "achievement_reachability.md"),
    [
      "# Achievement Reachability",
      "",
      `Generated: ${report.generated_at}`,
      "",
      `Registry count: ${report.registry_count}`,
      `All positive fixtures passed: ${report.all_positive_fixtures_passed ? "yes" : "no"}`,
      `Real production evaluator invoked: ${report.real_production_evaluator ? "yes" : "no"}`,
      "",
      `Rarity distribution: common ${rarityDistribution.common ?? 0}, rare ${rarityDistribution.rare ?? 0}, epic ${rarityDistribution.epic ?? 0}, legendary ${rarityDistribution.legendary ?? 0}`,
      "",
      "| ID | EN title | Competition | Rarity | Positive fixture |",
      "|---:|---|---|---|---|",
      ...rows.map((row) =>
        `| ${row.id} | ${row.title_en.replace(/\|/g, "\\|")} | ${row.competition} | ${row.rarity} | ${row.positive_fixture_passed ? "pass" : "fail"} |`
      ),
      "",
    ].join("\n"),
    "utf8",
  );
  const metadataPath = path.join(outputDir, "audit_run_metadata.json");
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch {
      metadata = {};
    }
  }
  fs.writeFileSync(
    metadataPath,
    `${JSON.stringify({
      ...metadata,
      reachability_validation: {
        command: `node scripts/validate_achievements.mjs --output ${path.relative(root, outputDir)}`,
        registry_count: ACHIEVEMENTS.length,
        rarity_distribution: rarityDistribution,
        all_positive_fixtures_passed: report.all_positive_fixtures_passed,
        failures,
      },
      updated_at: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
