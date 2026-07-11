import path from "node:path";
import {
  achievementFrequencyRows,
  createAchievementCounts,
  DEFAULT_AUDIT_OUTPUT,
  DEFAULT_SEED,
  deriveStrengthBuckets,
  ensureOutputDir,
  formatPercent,
  incrementAchievementCounts,
  lineupFromPlayers,
  loadAchievementRuntime,
  parseArgs,
  readJson,
  syntheticLineupPlayers,
  writeCsv,
  writeJson,
  writeRunMetadata,
  writeText,
} from "./achievement_audit_utils.mjs";

const CUP_ATTENTION_IDS = new Set([
  "13", "20", "27", "28", "29", "30", "35", "56",
  "57", "58", "60", "74", "82",
]);

function emptyStats() {
  return {
    runs: 0,
    stageRanks: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index), 0])),
    cupWins: 0,
    finalLosses: 0,
    regularTimeWins: 0,
    extraTimeWins: 0,
    extraTimeLosses: 0,
    penaltyWins: 0,
    penaltyLosses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    repeatedScorelineRuns: 0,
  };
}

function hasRepeatedWinScore(result) {
  const counts = new Map();
  for (const match of result.matches) {
    if (match.result !== "win") continue;
    const key = `${match.goalsFor}-${match.goalsAgainst}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 3);
}

function addCupResult(stats, result) {
  stats.runs += 1;
  stats.stageRanks[String(result.stageRank)] += 1;
  if (result.wonCup) stats.cupWins += 1;
  if (!result.wonCup && result.matches.at(-1)?.stage === "final") stats.finalLosses += 1;
  stats.goalsFor += result.goalsFor;
  stats.goalsAgainst += result.goalsAgainst;
  if (hasRepeatedWinScore(result)) stats.repeatedScorelineRuns += 1;

  for (const match of result.matches) {
    if (match.result === "win" && match.decidedBy === "regular_time") stats.regularTimeWins += 1;
    if (match.result === "win" && match.decidedBy === "extra_time") stats.extraTimeWins += 1;
    if (match.result === "loss" && match.decidedBy === "extra_time") stats.extraTimeLosses += 1;
    if (match.result === "win" && match.decidedBy === "penalties") stats.penaltyWins += 1;
    if (match.result === "loss" && match.decidedBy === "penalties") stats.penaltyLosses += 1;
  }
}

function evaluateCupThresholdContexts({
  ACHIEVEMENTS,
  evaluateAchievements,
  formationSlots,
  players,
  result,
}) {
  const shovkovskyiPlayers = [...players];
  shovkovskyiPlayers[0] = {
    ...shovkovskyiPlayers[0],
    player_id: 8816756,
    player_name: "Oleksandr Shovkovskyi (8816756)",
  };
  const contexts = [
    {
      competition: "cup",
      mode: "normal",
      formationId: "4-4-2",
      lineup: lineupFromPlayers(players, "4-4-2", formationSlots),
      result,
    },
    {
      competition: "cup",
      mode: "normal",
      formationId: "5-3-2",
      lineup: lineupFromPlayers(players, "5-3-2", formationSlots),
      result,
    },
    {
      competition: "cup",
      mode: "normal",
      formationId: "4-4-2",
      lineup: lineupFromPlayers(shovkovskyiPlayers, "4-4-2", formationSlots),
      result,
    },
  ];
  const byId = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));
  const ids = new Set();
  for (const context of contexts) {
    for (const achievement of evaluateAchievements(context)) {
      if (CUP_ATTENTION_IDS.has(achievement.id)) {
        ids.add(achievement.id);
      }
    }
  }
  return [...ids].map((id) => byId.get(id)).filter(Boolean);
}

function runAudit() {
  const options = parseArgs(process.argv.slice(2), {
    iterations: 100000,
    seed: DEFAULT_SEED,
    output: DEFAULT_AUDIT_OUTPUT,
  });
  const started = Date.now();
  const outputDir = ensureOutputDir(options.output);
  const playersData = readJson("public/data/players.json");
  const runtime = loadAchievementRuntime();
  const buckets = deriveStrengthBuckets(playersData);
  const csvRows = [];
  const jsonBuckets = [];

  for (const bucket of buckets) {
    const stats = emptyStats();
    const achievementCounts = createAchievementCounts(runtime.ACHIEVEMENTS);

    for (let index = 0; index < options.iterations; index += 1) {
      const players = syntheticLineupPlayers(
        bucket.strength,
        options.seed + index + bucket.name.length * 200000,
        { teamId: 920000 + bucket.name.length },
      );
      const result = runtime.simulateCup(players);
      addCupResult(stats, result);
      const earned = evaluateCupThresholdContexts({
        ...runtime,
        players,
        result,
      });
      incrementAchievementCounts(achievementCounts, earned);
    }

    const rows = achievementFrequencyRows(
      runtime.ACHIEVEMENTS,
      achievementCounts,
      options.iterations,
    ).filter((row) => row.count > 0 || CUP_ATTENTION_IDS.has(row.id));
    for (const row of rows) {
      csvRows.push({
        bucket: bucket.name,
        strength: bucket.strength,
        definition: bucket.definition,
        ...row,
      });
    }
    jsonBuckets.push({
      ...bucket,
      iterations: options.iterations,
      stats: {
        stageRanks: stats.stageRanks,
        cupWins: stats.cupWins,
        finalLosses: stats.finalLosses,
        regularTimeWins: stats.regularTimeWins,
        extraTimeWins: stats.extraTimeWins,
        extraTimeLosses: stats.extraTimeLosses,
        penaltyWins: stats.penaltyWins,
        penaltyLosses: stats.penaltyLosses,
        averageGoalsFor: stats.goalsFor / stats.runs,
        averageGoalsAgainst: stats.goalsAgainst / stats.runs,
        repeatedScorelineRuns: stats.repeatedScorelineRuns,
      },
      achievements: rows,
    });
  }

  const runtimeMs = Date.now() - started;
  const report = {
    generated_at: new Date().toISOString(),
    seed: options.seed,
    iterations_per_bucket: options.iterations,
    runtime_ms: runtimeMs,
    bucket_method: "Synthetic fixed-strength 11-player lineups; bucket strengths are player-rating percentiles from public/data/players.json. Production simulateCup and evaluateAchievements are invoked.",
    tracked_attention_ids: [...CUP_ATTENTION_IDS],
    buckets: jsonBuckets,
  };
  writeJson(path.join(outputDir, "cup_threshold_audit.json"), report);
  writeCsv(path.join(outputDir, "cup_threshold_audit.csv"), csvRows, [
    "bucket",
    "strength",
    "definition",
    "id",
    "title_ua",
    "title_en",
    "competition",
    "count",
    "frequency",
    "frequency_percent",
  ]);
  writeText(
    path.join(outputDir, "cup_threshold_audit.md"),
    [
      "# Cup Threshold Achievement Audit",
      "",
      `Generated: ${report.generated_at}`,
      `Seed: ${options.seed}`,
      `Iterations per bucket: ${options.iterations}`,
      `Runtime: ${(runtimeMs / 1000).toFixed(2)}s`,
      "",
      "Bucket definition: synthetic fixed-strength lineups using rating percentiles from current generated player data; production `simulateCup` and `evaluateAchievements` are used.",
      "",
      ...jsonBuckets.flatMap((bucket) => [
        `## ${bucket.name} (${bucket.strength})`,
        "",
        `Definition: ${bucket.definition}`,
        `Cup wins: ${bucket.stats.cupWins}`,
        `Final losses: ${bucket.stats.finalLosses}`,
        `Stage ranks: ${JSON.stringify(bucket.stats.stageRanks)}`,
        `Average goals: ${bucket.stats.averageGoalsFor.toFixed(2)}-${bucket.stats.averageGoalsAgainst.toFixed(2)}`,
        `Penalty wins/losses: ${bucket.stats.penaltyWins}/${bucket.stats.penaltyLosses}`,
        `Extra-time wins/losses: ${bucket.stats.extraTimeWins}/${bucket.stats.extraTimeLosses}`,
        "",
        "| ID | Achievement | Frequency | Count |",
        "|---:|---|---:|---:|",
        ...bucket.achievements
          .filter((row) => row.count > 0 || CUP_ATTENTION_IDS.has(row.id))
          .map((row) => `| ${row.id} | ${row.title_en} | ${formatPercent(row.frequency)} | ${row.count} |`),
        "",
      ]),
    ].join("\n"),
  );
  writeRunMetadata(options.output, {
    cup_threshold_audit: {
      seed: options.seed,
      iterations_per_bucket: options.iterations,
      runtime_ms: runtimeMs,
      approximation: report.bucket_method,
      failed_or_skipped_runs: [],
      command: `node scripts/audit_achievement_cup_thresholds.mjs --iterations ${options.iterations} --seed ${options.seed} --output ${options.output}`,
    },
  });
  console.log(`Cup threshold audit wrote ${outputDir}`);
}

runAudit();
