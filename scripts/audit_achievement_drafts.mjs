import path from "node:path";
import {
  achievementFrequencyRows,
  createAchievementCounts,
  createRandom,
  DEFAULT_AUDIT_OUTPUT,
  DEFAULT_SEED,
  ensureOutputDir,
  formatPercent,
  incrementAchievementCounts,
  loadAchievementRuntime,
  observedBand,
  parseArgs,
  randomItem,
  readJson,
  topEntries,
  writeCsv,
  writeJson,
  writeRunMetadata,
  writeText,
} from "./achievement_audit_utils.mjs";

const MODES = ["normal", "hardcore"];
const COMPETITIONS = ["league", "cup"];

function playerFitsSlot(player, slot) {
  return typeof player.game_position === "string" &&
    slot.allowed_positions.includes(player.game_position);
}

function indexPlayersByRoll(players) {
  const grouped = new Map();
  for (const player of players) {
    const group = grouped.get(player.club_decade_id) ?? [];
    group.push(player);
    grouped.set(player.club_decade_id, group);
  }
  return grouped;
}

function generateDraft({ rollPool, playersByRoll, slots, random }) {
  const lineup = {};
  const selectedPlayerIds = new Set();

  while (Object.keys(lineup).length < slots.length) {
    const remainingSlots = slots.filter((slot) => !lineup[slot.slot_id]);
    const validRolls = [];
    for (const roll of rollPool) {
      const players = playersByRoll.get(roll.club_decade_id) ?? [];
      if (players.some((player) =>
        !selectedPlayerIds.has(player.player_id) &&
        remainingSlots.some((slot) => playerFitsSlot(player, slot))
      )) {
        validRolls.push(roll);
      }
    }

    if (validRolls.length === 0) {
      return { ok: false, reason: "no_valid_roll", lineup: null };
    }

    const roll = randomItem(random, validRolls);
    const availablePlayers = (playersByRoll.get(roll.club_decade_id) ?? [])
      .filter((player) =>
        !selectedPlayerIds.has(player.player_id) &&
        remainingSlots.some((slot) => playerFitsSlot(player, slot))
      );

    if (availablePlayers.length === 0) {
      return { ok: false, reason: "empty_roll_after_filter", lineup: null };
    }

    const player = randomItem(random, availablePlayers);
    const validSlots = remainingSlots.filter((slot) => playerFitsSlot(player, slot));
    if (validSlots.length === 0) {
      return { ok: false, reason: "no_valid_slot_for_candidate", lineup: null };
    }

    const slot = randomItem(random, validSlots);
    lineup[slot.slot_id] = player;
    selectedPlayerIds.add(player.player_id);
  }

  return { ok: true, reason: null, lineup };
}

function ensureScope(scopes, key, achievements) {
  if (!scopes.has(key)) {
    scopes.set(key, {
      key,
      runs: 0,
      counts: createAchievementCounts(achievements),
    });
  }
  return scopes.get(key);
}

function addEarnedToScope(scope, earned) {
  scope.runs += 1;
  incrementAchievementCounts(scope.counts, earned);
}

function addCombinations(earned, pairCounts, tripleCounts) {
  const ids = earned.map((achievement) => achievement.id).sort((a, b) => Number(a) - Number(b));
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const key = `${ids[left]}+${ids[right]}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      for (let third = right + 1; third < ids.length; third += 1) {
        const tripleKey = `${ids[left]}+${ids[right]}+${ids[third]}`;
        tripleCounts.set(tripleKey, (tripleCounts.get(tripleKey) ?? 0) + 1);
      }
    }
  }
}

function recommendationDifficulty(achievement, observed) {
  const text = `${achievement.title.en} ${achievement.description.en}`.toLowerCase();
  let score = 0;
  const reasons = [];
  if (/win|champion|cup|final|europe|qualification/.test(text)) {
    score += 1;
    reasons.push("requires a competition result");
  }
  if (/hardcore/.test(text)) {
    score += 1;
    reasons.push("mode restricted");
  }
  if (/3-5-2|5-3-2|4-4-2/.test(text)) {
    score += 1;
    reasons.push("formation restricted");
  }
  if (/andriy|artem|oleksandr|serhiy|jadson|fernandinho|willian|srna|yaya|nikola|yarmolenko|konoplyanka|rotan|nazarenko|milevskyi|aliev|shovkovskyi/.test(text)) {
    score += 2;
    reasons.push("requires specific named player IDs");
  }
  if (/eleven|nine|eight|six|five|three|two|brazil|ukrainian|citizenship|club|players/.test(text)) {
    score += 1;
    reasons.push("requires roster targeting");
  }
  if (/30|100|60|zero|no .*loss|no .*draw|penalt|extra-time|120th|same score|perfectly balanced/.test(text)) {
    score += 2;
    reasons.push("depends on an extreme or narrow simulation outcome");
  }

  const band = observedBand(observed);
  const rank = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const byDifficulty = score >= 5 ? "legendary" : score >= 3 ? "epic" : score >= 1 ? "rare" : "common";
  const recommended = rank[byDifficulty] > rank[band] ? byDifficulty : band;
  return {
    observed_frequency_band: band,
    recommended_rarity: recommended,
    recommendation_reason: reasons.length > 0
      ? reasons.join("; ")
      : "broad condition with no special targeting detected",
  };
}

function runAudit() {
  const options = parseArgs(process.argv.slice(2), {
    iterations: 50000,
    seed: DEFAULT_SEED,
    output: DEFAULT_AUDIT_OUTPUT,
  });
  const started = Date.now();
  const outputDir = ensureOutputDir(options.output);
  const runtime = loadAchievementRuntime();
  const players = readJson("public/data/players.json");
  const leagueRollPool = readJson("public/data/roll_pool.json");
  const cupRollPool = readJson("public/data/cup_roll_pool.json");
  const playersByRoll = indexPlayersByRoll(players);
  const random = createRandom(options.seed);
  const scopes = new Map();
  const overallCounts = createAchievementCounts(runtime.ACHIEVEMENTS);
  const pairCounts = new Map();
  const tripleCounts = new Map();
  const distribution = { zero: 0, one: 0, two: 0, three_or_more: 0 };
  const failures = {};
  const completions = [];
  let evaluatedRuns = 0;
  let completedDrafts = 0;
  let attemptedDrafts = 0;

  for (const competition of COMPETITIONS) {
    const rollPool = competition === "cup" ? cupRollPool : leagueRollPool;
    for (const formationId of runtime.FORMATION_IDS) {
      const slots = runtime.formationSlots(formationId);
      let completedForCombo = 0;
      let attemptsForCombo = 0;

      while (completedForCombo < options.iterations) {
        attemptedDrafts += 1;
        attemptsForCombo += 1;
        const generated = generateDraft({ rollPool, playersByRoll, slots, random });
        if (!generated.ok) {
          failures[generated.reason] = (failures[generated.reason] ?? 0) + 1;
          if (attemptsForCombo > options.iterations * 5) {
            break;
          }
          continue;
        }

        completedDrafts += 1;
        completedForCombo += 1;
        const lineup = generated.lineup;
        const lineupPlayers = Object.values(lineup);
        const result = competition === "cup"
          ? runtime.simulateCup(lineupPlayers)
          : runtime.simulateSeason(lineupPlayers);

        for (const mode of MODES) {
          const context = {
            competition,
            mode,
            formationId,
            lineup,
            result,
          };
          const earned = runtime.evaluateAchievements(context);
          evaluatedRuns += 1;
          incrementAchievementCounts(overallCounts, earned);
          addCombinations(earned, pairCounts, tripleCounts);

          if (earned.length === 0) distribution.zero += 1;
          else if (earned.length === 1) distribution.one += 1;
          else if (earned.length === 2) distribution.two += 1;
          else distribution.three_or_more += 1;

          addEarnedToScope(
            ensureScope(scopes, `competition:${competition}`, runtime.ACHIEVEMENTS),
            earned,
          );
          addEarnedToScope(
            ensureScope(scopes, `formation:${formationId}`, runtime.ACHIEVEMENTS),
            earned,
          );
          addEarnedToScope(
            ensureScope(scopes, `mode:${mode}`, runtime.ACHIEVEMENTS),
            earned,
          );
          addEarnedToScope(
            ensureScope(scopes, `competition:${competition}|formation:${formationId}|mode:${mode}`, runtime.ACHIEVEMENTS),
            earned,
          );
        }
      }

      completions.push({
        competition,
        formationId,
        target_iterations: options.iterations,
        attempts: attemptsForCombo,
        completed: completedForCombo,
      });
    }
  }

  const overallRows = achievementFrequencyRows(
    runtime.ACHIEVEMENTS,
    overallCounts,
    evaluatedRuns,
  );
  const scopeRows = [];
  for (const scope of scopes.values()) {
    for (const row of achievementFrequencyRows(runtime.ACHIEVEMENTS, scope.counts, scope.runs)) {
      scopeRows.push({
        scope: scope.key,
        runs: scope.runs,
        ...row,
      });
    }
  }
  const csvRows = [
    ...overallRows.map((row) => ({ scope: "overall", runs: evaluatedRuns, ...row })),
    ...scopeRows,
  ];
  const zeroObserved = overallRows.filter((row) => row.count === 0);
  const tooOften = overallRows.filter((row) => row.frequency >= 0.05);
  const rarityRows = overallRows.map((row) => {
    const achievement = runtime.ACHIEVEMENTS.find((entry) => entry.id === row.id);
    return {
      ...row,
      ...recommendationDifficulty(achievement, row.frequency),
    };
  });
  const rarityDistribution = rarityRows.reduce((counts, row) => {
    counts[row.recommended_rarity] = (counts[row.recommended_rarity] ?? 0) + 1;
    return counts;
  }, {});
  const runtimeMs = Date.now() - started;
  const report = {
    generated_at: new Date().toISOString(),
    seed: options.seed,
    iterations_per_competition_formation: options.iterations,
    runtime_ms: runtimeMs,
    approximation: "Mirrors draft roll legality using real roll pools, real generated players, slot compatibility, club-decade rolls, duplicate player_id blocking, and random legal slot assignment. It approximates a neutral user by choosing uniformly among valid rolls, available players and valid slots; UI sorting is intentionally ignored.",
    attempted_drafts: attemptedDrafts,
    completed_drafts: completedDrafts,
    evaluated_runs: evaluatedRuns,
    completions,
    failures,
    distribution,
    average_achievements_per_run: overallRows.reduce((total, row) => total + row.count, 0) / evaluatedRuns,
    percentage_with_at_least_one: evaluatedRuns > 0 ? 1 - distribution.zero / evaluatedRuns : 0,
    achievements_zero_observed: zeroObserved,
    achievements_observed_at_or_above_5_percent: tooOften,
    most_common_pairs: topEntries(pairCounts, 25),
    most_common_triples: topEntries(tripleCounts, 25),
    overall: overallRows,
    scopes: scopeRows,
    rarity_recommendations: rarityRows,
    rarity_distribution: rarityDistribution,
  };

  writeJson(path.join(outputDir, "achievement_monte_carlo.json"), report);
  writeCsv(path.join(outputDir, "achievement_monte_carlo.csv"), csvRows, [
    "scope",
    "runs",
    "id",
    "title_ua",
    "title_en",
    "competition",
    "count",
    "frequency",
    "frequency_percent",
  ]);
  writeCsv(path.join(outputDir, "achievement_rarity_recommendations.csv"), rarityRows, [
    "id",
    "title_ua",
    "title_en",
    "competition",
    "count",
    "frequency",
    "frequency_percent",
    "observed_frequency_band",
    "recommended_rarity",
    "recommendation_reason",
  ]);
  writeText(
    path.join(outputDir, "achievement_monte_carlo.md"),
    [
      "# Achievement Monte Carlo Draft Audit",
      "",
      `Generated: ${report.generated_at}`,
      `Seed: ${options.seed}`,
      `Iterations per competition/formation: ${options.iterations}`,
      `Completed drafts: ${completedDrafts}`,
      `Evaluated runs: ${evaluatedRuns}`,
      `Runtime: ${(runtimeMs / 1000).toFixed(2)}s`,
      "",
      `Approximation: ${report.approximation}`,
      "",
      `Average achievements per run: ${report.average_achievements_per_run.toFixed(4)}`,
      `Runs with at least one achievement: ${formatPercent(report.percentage_with_at_least_one)}`,
      `Zero/one/two/three-plus: ${distribution.zero}/${distribution.one}/${distribution.two}/${distribution.three_or_more}`,
      "",
      "## Too Often (>=5%)",
      "",
      "| ID | Achievement | Frequency | Count |",
      "|---:|---|---:|---:|",
      ...tooOften.map((row) => `| ${row.id} | ${row.title_en} | ${formatPercent(row.frequency)} | ${row.count} |`),
      "",
      "## Zero Observed",
      "",
      zeroObserved.length === 0 ? "None." : zeroObserved.map((row) => `- ${row.id}: ${row.title_en}`).join("\n"),
      "",
      "## Most Common Pairs",
      "",
      ...report.most_common_pairs.map((entry) => `- ${entry.key}: ${entry.count}`),
      "",
      "## Most Common Triples",
      "",
      ...report.most_common_triples.map((entry) => `- ${entry.key}: ${entry.count}`),
      "",
    ].join("\n"),
  );
  writeText(
    path.join(outputDir, "achievement_rarity_recommendations.md"),
    [
      "# Tentative Achievement Rarity Recommendations",
      "",
      "Advisory only. No rarity fields were written to production registry or UI.",
      "",
      `Generated: ${report.generated_at}`,
      `Observed frequency bands: common >=5%, rare >=1% and <5%, epic >=0.1% and <1%, legendary <0.1%.`,
      "",
      `Distribution: common ${rarityDistribution.common ?? 0}, rare ${rarityDistribution.rare ?? 0}, epic ${rarityDistribution.epic ?? 0}, legendary ${rarityDistribution.legendary ?? 0}`,
      "",
      "| ID | Achievement | Observed band | Recommended | Reason |",
      "|---:|---|---|---|---|",
      ...rarityRows.map((row) =>
        `| ${row.id} | ${row.title_en.replace(/\|/g, "\\|")} | ${row.observed_frequency_band} | ${row.recommended_rarity} | ${row.recommendation_reason.replace(/\|/g, "\\|")} |`
      ),
      "",
    ].join("\n"),
  );
  writeRunMetadata(options.output, {
    random_draft_monte_carlo: {
      seed: options.seed,
      iterations_per_competition_formation: options.iterations,
      runtime_ms: runtimeMs,
      attempted_drafts: attemptedDrafts,
      completed_drafts: completedDrafts,
      evaluated_runs: evaluatedRuns,
      approximation: report.approximation,
      failed_or_skipped_runs: [],
      command: `node scripts/audit_achievement_drafts.mjs --iterations ${options.iterations} --seed ${options.seed} --output ${options.output}`,
    },
  });
  console.log(`Draft Monte Carlo audit wrote ${outputDir}`);
}

runAudit();
