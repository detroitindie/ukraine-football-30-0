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

const RESULT_ATTENTION_IDS = new Set([
  "12", "13", "23", "24", "25", "26", "27", "35",
  "50", "51", "52", "53", "54", "55", "93",
]);

function emptyStats() {
  return {
    runs: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    verdicts: {
      championship: 0,
      europe: 0,
      midTable: 0,
      relegation: 0,
    },
  };
}

function addResult(stats, result) {
  stats.runs += 1;
  stats.wins += result.wins;
  stats.draws += result.draws;
  stats.losses += result.losses;
  stats.points += result.points;
  stats.goalsFor += result.goalsFor;
  stats.goalsAgainst += result.goalsAgainst;
  stats.goalDifference += result.goalDifference;
  stats.verdicts[result.verdict] += 1;
}

function averages(stats) {
  return {
    wins: stats.wins / stats.runs,
    draws: stats.draws / stats.runs,
    losses: stats.losses / stats.runs,
    points: stats.points / stats.runs,
    goalsFor: stats.goalsFor / stats.runs,
    goalsAgainst: stats.goalsAgainst / stats.runs,
    goalDifference: stats.goalDifference / stats.runs,
  };
}

function evaluateLeagueThresholdContexts({
  ACHIEVEMENTS,
  evaluateAchievements,
  formationSlots,
  players,
  result,
}) {
  const contexts = [
    {
      competition: "league",
      mode: "normal",
      formationId: "4-4-2",
      lineup: lineupFromPlayers(players, "4-4-2", formationSlots),
      result,
    },
    {
      competition: "league",
      mode: "normal",
      formationId: "5-3-2",
      lineup: lineupFromPlayers(players, "5-3-2", formationSlots),
      result,
    },
    {
      competition: "league",
      mode: "hardcore",
      formationId: "4-4-2",
      lineup: lineupFromPlayers(players, "4-4-2", formationSlots),
      result,
    },
  ];
  const byId = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));
  const ids = new Set();
  for (const context of contexts) {
    for (const achievement of evaluateAchievements(context)) {
      if (RESULT_ATTENTION_IDS.has(achievement.id) || achievement.id === "31" || achievement.id === "75") {
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
        options.seed + index + bucket.name.length * 100000,
        { teamId: 910000 + bucket.name.length },
      );
      const result = runtime.simulateSeason(players);
      addResult(stats, result);
      const earned = evaluateLeagueThresholdContexts({
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
    ).filter((row) => row.count > 0 || RESULT_ATTENTION_IDS.has(row.id));
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
      averages: averages(stats),
      verdicts: stats.verdicts,
      achievements: rows,
    });
  }

  const runtimeMs = Date.now() - started;
  const report = {
    generated_at: new Date().toISOString(),
    seed: options.seed,
    iterations_per_bucket: options.iterations,
    runtime_ms: runtimeMs,
    bucket_method: "Synthetic fixed-strength 11-player lineups; bucket strengths are player-rating percentiles from public/data/players.json. Production simulateSeason and evaluateAchievements are invoked.",
    tracked_attention_ids: [...RESULT_ATTENTION_IDS],
    buckets: jsonBuckets,
  };
  writeJson(path.join(outputDir, "league_threshold_audit.json"), report);
  writeCsv(path.join(outputDir, "league_threshold_audit.csv"), csvRows, [
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
    path.join(outputDir, "league_threshold_audit.md"),
    [
      "# League Threshold Achievement Audit",
      "",
      `Generated: ${report.generated_at}`,
      `Seed: ${options.seed}`,
      `Iterations per bucket: ${options.iterations}`,
      `Runtime: ${(runtimeMs / 1000).toFixed(2)}s`,
      "",
      "Bucket definition: synthetic fixed-strength lineups using rating percentiles from current generated player data; production `simulateSeason` and `evaluateAchievements` are used.",
      "",
      ...jsonBuckets.flatMap((bucket) => [
        `## ${bucket.name} (${bucket.strength})`,
        "",
        `Definition: ${bucket.definition}`,
        `Average record: ${bucket.averages.wins.toFixed(2)}-${bucket.averages.draws.toFixed(2)}-${bucket.averages.losses.toFixed(2)}`,
        `Average points: ${bucket.averages.points.toFixed(2)}`,
        `Average goals: ${bucket.averages.goalsFor.toFixed(2)}-${bucket.averages.goalsAgainst.toFixed(2)}`,
        `Verdicts: championship ${bucket.verdicts.championship}, europe ${bucket.verdicts.europe}, midTable ${bucket.verdicts.midTable}, relegation ${bucket.verdicts.relegation}`,
        "",
        "| ID | Achievement | Frequency | Count |",
        "|---:|---|---:|---:|",
        ...bucket.achievements
          .filter((row) => row.count > 0 || RESULT_ATTENTION_IDS.has(row.id))
          .map((row) => `| ${row.id} | ${row.title_en} | ${formatPercent(row.frequency)} | ${row.count} |`),
        "",
      ]),
    ].join("\n"),
  );
  writeRunMetadata(options.output, {
    league_threshold_audit: {
      seed: options.seed,
      iterations_per_bucket: options.iterations,
      runtime_ms: runtimeMs,
      approximation: report.bucket_method,
      failed_or_skipped_runs: [],
      command: `node scripts/audit_achievement_league_thresholds.mjs --iterations ${options.iterations} --seed ${options.seed} --output ${options.output}`,
    },
  });
  console.log(`League threshold audit wrote ${outputDir}`);
}

runAudit();
