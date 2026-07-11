import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

export const root = process.cwd();
export const DEFAULT_AUDIT_OUTPUT = "data-audit/v2-3-achievements";
export const DEFAULT_SEED = 2303;

const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleCache = new Map();

function resolveAlias(specifier, fromFile) {
  if (specifier.startsWith("@/")) {
    return path.join(root, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }
  return null;
}

export function loadTsModule(filename) {
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
    return aliased ? loadTsModule(aliased) : require(specifier);
  };
  const wrapper = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname) { ${output}\n})`,
    { filename: resolved },
  );
  wrapper(loadedModule.exports, localRequire, loadedModule, resolved, path.dirname(resolved));
  return loadedModule.exports;
}

export function loadAchievementRuntime() {
  const { ACHIEVEMENTS, ACHIEVEMENT_COUNT } = loadTsModule(
    path.join(root, "lib/achievements/registry.ts"),
  );
  const { evaluateAchievements } = loadTsModule(
    path.join(root, "lib/achievements/evaluate.ts"),
  );
  const { formationSlots, FORMATION_IDS } = loadTsModule(
    path.join(root, "lib/formations.ts"),
  );
  const { simulateSeason, simulateCup } = loadTsModule(
    path.join(root, "lib/seasonSimulation.ts"),
  );
  return {
    ACHIEVEMENTS,
    ACHIEVEMENT_COUNT,
    evaluateAchievements,
    formationSlots,
    FORMATION_IDS,
    simulateSeason,
    simulateCup,
  };
}

export function parseArgs(argv, defaults = {}) {
  const options = {
    iterations: defaults.iterations ?? 1000,
    seed: defaults.seed ?? DEFAULT_SEED,
    output: defaults.output ?? DEFAULT_AUDIT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--iterations" || value === "--samples" || value === "-n") {
      options.iterations = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--seed") {
      options.seed = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--output") {
      options.output = argv[index + 1];
      index += 1;
    }
  }
  if (!Number.isInteger(options.iterations) || options.iterations <= 0) {
    throw new Error("--iterations must be a positive integer.");
  }
  if (!Number.isInteger(options.seed)) {
    throw new Error("--seed must be an integer.");
  }
  return options;
}

export function ensureOutputDir(output) {
  fs.mkdirSync(path.join(root, output), { recursive: true });
  return path.join(root, output);
}

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random, maxExclusive) {
  return Math.floor(random() * maxExclusive);
}

export function randomItem(random, items) {
  return items[randomInt(random, items.length)];
}

export function playerStrength(player) {
  return player.effective_global_rating ?? player.global_rating ?? 65;
}

export function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) {
    return 65;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.round((sortedValues.length - 1) * ratio)),
  );
  return sortedValues[index];
}

export function deriveStrengthBuckets(players) {
  const strengths = players
    .map(playerStrength)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  return [
    {
      name: "weak",
      strength: percentile(strengths, 0.15),
      definition: "15th percentile effective/global player rating from current generated player data",
    },
    {
      name: "average",
      strength: percentile(strengths, 0.50),
      definition: "50th percentile effective/global player rating from current generated player data",
    },
    {
      name: "strong",
      strength: percentile(strengths, 0.80),
      definition: "80th percentile effective/global player rating from current generated player data",
    },
    {
      name: "elite",
      strength: percentile(strengths, 0.95),
      definition: "95th percentile effective/global player rating from current generated player data",
    },
  ];
}

export function syntheticPlayer({ id, strength, slotIndex = 0, teamId = 900000, decade = "2000s" }) {
  return {
    club_decade_player_id: `audit-${teamId}-${decade}-${id}-${slotIndex}`,
    club_decade_id: `audit-${teamId}-${decade}`,
    team_id: teamId,
    team_name: "Audit FC",
    decade,
    player_id: id,
    player_name: `Audit Player ${id}`,
    citizenships: [],
    primary_citizenship: null,
    position: "Audit",
    main_position: "Audit",
    game_position: "CM",
    goals: null,
    assists: null,
    clean_sheets: null,
    raw_score: null,
    local_rating: strength,
    global_rating: strength,
    global_percentile: null,
    hidden_modifier: null,
    effective_global_rating: strength,
  };
}

export function syntheticLineupPlayers(strength, seed, options = {}) {
  const teamId = options.teamId ?? 900000;
  return Array.from({ length: 11 }, (_, index) =>
    syntheticPlayer({
      id: seed * 100 + index + 1,
      strength,
      slotIndex: index,
      teamId,
      decade: options.decade ?? "2000s",
    }),
  );
}

export function lineupFromPlayers(players, formationId, formationSlots) {
  const slots = formationSlots(formationId);
  const lineup = {};
  slots.forEach((slot, index) => {
    lineup[slot.slot_id] = players[index] ?? players[players.length - 1];
  });
  return lineup;
}

export function createAchievementCounts(achievements) {
  return Object.fromEntries(achievements.map((achievement) => [achievement.id, 0]));
}

export function incrementAchievementCounts(counts, earned) {
  const seen = new Set();
  for (const achievement of earned) {
    if (seen.has(achievement.id)) {
      throw new Error(`Duplicate earned achievement ID ${achievement.id}`);
    }
    seen.add(achievement.id);
    counts[achievement.id] = (counts[achievement.id] ?? 0) + 1;
  }
}

export function achievementFrequencyRows(achievements, counts, total) {
  return achievements.map((achievement) => {
    const count = counts[achievement.id] ?? 0;
    return {
      id: achievement.id,
      title_ua: achievement.title.ua,
      title_en: achievement.title.en,
      competition: achievement.competition,
      count,
      frequency: total > 0 ? count / total : 0,
      frequency_percent: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

export function observedBand(frequency) {
  if (frequency >= 0.05) return "common";
  if (frequency >= 0.01) return "rare";
  if (frequency >= 0.001) return "epic";
  return "legendary";
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function writeCsv(filePath, rows, headers) {
  const content = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(filePath, `${content}\n`, "utf8");
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, "utf8");
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(4)}%`;
}

export function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function gitInfo() {
  function run(args) {
    try {
      return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  }
  return {
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
    commit: run(["rev-parse", "HEAD"]),
  };
}

export function writeRunMetadata(output, metadata) {
  const outputDir = ensureOutputDir(output);
  const existingPath = path.join(outputDir, "audit_run_metadata.json");
  let existing = {};
  if (fs.existsSync(existingPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
    } catch {
      existing = {};
    }
  }
  writeJson(existingPath, {
    ...existing,
    ...metadata,
    git: gitInfo(),
    node: process.version,
    updated_at: new Date().toISOString(),
  });
}
