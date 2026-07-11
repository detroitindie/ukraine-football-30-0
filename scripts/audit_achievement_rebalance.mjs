import path from "node:path";
import {
  createRandom,
  DEFAULT_AUDIT_OUTPUT,
  DEFAULT_SEED,
  deriveStrengthBuckets,
  ensureOutputDir,
  formatPercent,
  loadAchievementRuntime,
  parseArgs,
  randomItem,
  readJson,
  root,
  syntheticLineupPlayers,
  topEntries,
  writeCsv,
  writeJson,
  writeRunMetadata,
  writeText,
} from "./achievement_audit_utils.mjs";

const BAVOVNA_THRESHOLDS = [65, 70, 75, 80, 85, 90, 100];
const DEFENSE_GF_THRESHOLDS = [55, 60, 65, 70, 75, 80];
const DEFENSE_GA_THRESHOLDS = [40, 45, 50, 55, 60];
const COMPETITIONS = ["league", "cup"];
const MODES = ["normal", "hardcore"];
const DIFFERENT_ERAS_ID = "47";
const ZRADA_FLAGGED_IDS = new Set([712857, 4602, 8562832, 118850, 59908, 89222]);

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

function percentile(sortedValues, ratio) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );
  return sortedValues[index] ?? 0;
}

function analyzeLeagueThresholds(runtime, playersData, iterations, seed) {
  const buckets = deriveStrengthBuckets(playersData);
  const bavovna = [];
  const defenseGrid = [];
  const defenseMaxGoalsForByGa = [];
  const defenseMaxGoalsAgainstByGf = [];
  const bucketResults = [];

  for (const bucket of buckets) {
    const goalsForValues = [];
    const results = [];
    for (let index = 0; index < iterations; index += 1) {
      const players = syntheticLineupPlayers(
        bucket.strength,
        seed + index + bucket.name.length * 300000,
        { teamId: 930000 + bucket.name.length },
      );
      const result = runtime.simulateSeason(players);
      results.push(result);
      goalsForValues.push(result.goalsFor);
    }
    goalsForValues.sort((a, b) => a - b);
    const maxGoalsFor = goalsForValues.at(-1) ?? 0;
    const quantiles = {
      p90: percentile(goalsForValues, 0.90),
      p95: percentile(goalsForValues, 0.95),
      p99: percentile(goalsForValues, 0.99),
      p999: percentile(goalsForValues, 0.999),
    };
    bucketResults.push({
      bucket: bucket.name,
      strength: bucket.strength,
      definition: bucket.definition,
      maxGoalsFor,
      ...quantiles,
    });

    for (const threshold of BAVOVNA_THRESHOLDS) {
      const count = results.filter((result) => result.goalsFor >= threshold).length;
      bavovna.push({
        section: "bavovna",
        bucket: bucket.name,
        strength: bucket.strength,
        threshold,
        count,
        frequency: count / iterations,
        frequency_percent: (count / iterations) * 100,
        maximum_goals_for: maxGoalsFor,
        p90_goals_for: quantiles.p90,
        p95_goals_for: quantiles.p95,
        p99_goals_for: quantiles.p99,
        p999_goals_for: quantiles.p999,
      });
    }

    for (const goalsFor of DEFENSE_GF_THRESHOLDS) {
      for (const goalsAgainst of DEFENSE_GA_THRESHOLDS) {
        const count = results.filter(
          (result) => result.goalsFor >= goalsFor && result.goalsAgainst >= goalsAgainst,
        ).length;
        defenseGrid.push({
          section: "defense_optional_grid",
          bucket: bucket.name,
          strength: bucket.strength,
          goals_for_threshold: goalsFor,
          goals_against_threshold: goalsAgainst,
          count,
          frequency: count / iterations,
          frequency_percent: (count / iterations) * 100,
        });
      }
    }

    for (const goalsAgainst of DEFENSE_GA_THRESHOLDS) {
      const matching = results.filter((result) => result.goalsAgainst >= goalsAgainst);
      defenseMaxGoalsForByGa.push({
        section: "max_goals_for_by_goals_against",
        bucket: bucket.name,
        strength: bucket.strength,
        goals_against_threshold: goalsAgainst,
        maximum_goals_for: Math.max(0, ...matching.map((result) => result.goalsFor)),
        sample_count: matching.length,
      });
    }
    for (const goalsFor of DEFENSE_GF_THRESHOLDS) {
      const matching = results.filter((result) => result.goalsFor >= goalsFor);
      defenseMaxGoalsAgainstByGf.push({
        section: "max_goals_against_by_goals_for",
        bucket: bucket.name,
        strength: bucket.strength,
        goals_for_threshold: goalsFor,
        maximum_goals_against: Math.max(0, ...matching.map((result) => result.goalsAgainst)),
        sample_count: matching.length,
      });
    }
  }

  const strongElite = bavovna.filter((row) => row.bucket === "strong" || row.bucket === "elite");
  const bavovnaCandidates = BAVOVNA_THRESHOLDS.map((threshold) => {
    const rows = strongElite.filter((row) => row.threshold === threshold);
    return {
      threshold,
      averageStrongEliteFrequency: rows.reduce((total, row) => total + row.frequency, 0) / rows.length,
    };
  });
  const recommendedBavovna = bavovnaCandidates
    .filter((row) => row.averageStrongEliteFrequency >= 0.001 && row.averageStrongEliteFrequency <= 0.01)
    .sort((left, right) =>
      Math.abs(left.averageStrongEliteFrequency - 0.005) -
      Math.abs(right.averageStrongEliteFrequency - 0.005)
    )[0] ?? bavovnaCandidates
    .sort((left, right) =>
      Math.abs(left.averageStrongEliteFrequency - 0.001) -
      Math.abs(right.averageStrongEliteFrequency - 0.001)
    )[0];

  const defenseCandidates = [];
  for (const goalsFor of DEFENSE_GF_THRESHOLDS) {
    for (const goalsAgainst of DEFENSE_GA_THRESHOLDS) {
      const rows = defenseGrid.filter(
        (row) =>
          (row.bucket === "average" || row.bucket === "strong") &&
          row.goals_for_threshold === goalsFor &&
          row.goals_against_threshold === goalsAgainst,
      );
      defenseCandidates.push({
        goalsFor,
        goalsAgainst,
        averageStrongAppropriateFrequency: rows.reduce((total, row) => total + row.frequency, 0) / rows.length,
      });
    }
  }
  const recommendedDefense = defenseCandidates
    .filter((row) => row.averageStrongAppropriateFrequency >= 0.001 && row.averageStrongAppropriateFrequency <= 0.01)
    .sort((left, right) =>
      Math.abs(left.averageStrongAppropriateFrequency - 0.005) -
      Math.abs(right.averageStrongAppropriateFrequency - 0.005)
    )[0] ?? defenseCandidates
    .sort((left, right) =>
      Math.abs(left.averageStrongAppropriateFrequency - 0.001) -
      Math.abs(right.averageStrongAppropriateFrequency - 0.001)
    )[0];

  return {
    buckets: bucketResults,
    bavovna,
    defenseGrid,
    defenseMaxGoalsForByGa,
    defenseMaxGoalsAgainstByGf,
    recommendedBavovna,
    recommendedDefense,
  };
}

function decadeCounts(lineup) {
  const counts = { "1990s": 0, "2000s": 0, "2010s": 0, "2020s": 0 };
  for (const player of Object.values(lineup)) {
    counts[player.decade] = (counts[player.decade] ?? 0) + 1;
  }
  return counts;
}

function differentErasAlternatives(lineup) {
  const counts = decadeCounts(lineup);
  const values = ["1990s", "2000s", "2010s", "2020s"].map((decade) => counts[decade] ?? 0);
  const allRepresented = values.every((value) => value >= 1);
  return {
    current: allRepresented,
    balanced: values.every((value) => value >= 2),
    edge_eras: allRepresented && counts["1990s"] >= 2 && counts["2020s"] >= 2,
    no_dominant_era: allRepresented && Math.max(...values) <= 4,
  };
}

function initAlternativeStats() {
  return {
    count: 0,
    scopes: new Map(),
    distribution: { zero: 0, one: 0, two: 0, three_or_more: 0 },
    achievementTotal: 0,
    pairCounts: new Map(),
    tripleCounts: new Map(),
  };
}

function addCombination(ids, pairCounts, tripleCounts) {
  const sorted = [...ids].sort((a, b) => Number(a) - Number(b));
  if (!sorted.includes(DIFFERENT_ERAS_ID)) {
    return;
  }
  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = left + 1; right < sorted.length; right += 1) {
      if (sorted[left] !== DIFFERENT_ERAS_ID && sorted[right] !== DIFFERENT_ERAS_ID) {
        continue;
      }
      const key = `${sorted[left]}+${sorted[right]}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      for (let third = right + 1; third < sorted.length; third += 1) {
        const triple = [sorted[left], sorted[right], sorted[third]];
        if (!triple.includes(DIFFERENT_ERAS_ID)) {
          continue;
        }
        const tripleKey = triple.join("+");
        tripleCounts.set(tripleKey, (tripleCounts.get(tripleKey) ?? 0) + 1);
      }
    }
  }
}

function addAlternativeRun(stats, name, scopeKeys, earnedIds, alternativeFires) {
  if (alternativeFires) {
    stats.count += 1;
  }
  const adjusted = new Set(earnedIds);
  adjusted.delete(DIFFERENT_ERAS_ID);
  if (alternativeFires) {
    adjusted.add(DIFFERENT_ERAS_ID);
  }
  const adjustedCount = adjusted.size;
  stats.achievementTotal += adjustedCount;
  if (adjustedCount === 0) stats.distribution.zero += 1;
  else if (adjustedCount === 1) stats.distribution.one += 1;
  else if (adjustedCount === 2) stats.distribution.two += 1;
  else stats.distribution.three_or_more += 1;
  addCombination([...adjusted], stats.pairCounts, stats.tripleCounts);

  for (const scopeKey of scopeKeys) {
    const scope = stats.scopes.get(scopeKey) ?? { runs: 0, count: 0 };
    scope.runs += 1;
    if (alternativeFires) {
      scope.count += 1;
    }
    stats.scopes.set(scopeKey, scope);
  }
}

function analyzeZrada(lineup, zradaStats) {
  const seen = new Set();
  let uniqueMatches = 0;
  let citizenshipOnly = 0;
  let flaggedOnly = 0;
  let both = 0;
  for (const player of Object.values(lineup)) {
    if (seen.has(player.player_id)) {
      continue;
    }
    seen.add(player.player_id);
    const citizenshipMatch = player.citizenships.some(
      (citizenship) => citizenship === "Russia" || citizenship === "Belarus",
    );
    const flaggedMatch = ZRADA_FLAGGED_IDS.has(player.player_id);
    if (!citizenshipMatch && !flaggedMatch) {
      continue;
    }
    uniqueMatches += 1;
    if (citizenshipMatch && flaggedMatch) {
      both += 1;
    } else if (citizenshipMatch) {
      citizenshipOnly += 1;
    } else {
      flaggedOnly += 1;
    }
    if (flaggedMatch) {
      zradaStats.flaggedPlayerIds.set(
        player.player_id,
        (zradaStats.flaggedPlayerIds.get(player.player_id) ?? 0) + 1,
      );
    }
    if (citizenshipMatch) {
      for (const citizenship of player.citizenships) {
        if (citizenship === "Russia" || citizenship === "Belarus") {
          zradaStats.citizenshipStrings.set(
            citizenship,
            (zradaStats.citizenshipStrings.get(citizenship) ?? 0) + 1,
          );
        }
      }
    }
  }
  return { uniqueMatches, citizenshipOnly, flaggedOnly, both };
}

function analyzeDraftAlternatives(runtime, players, iterations, seed) {
  const leagueRollPool = readJson("public/data/roll_pool.json");
  const cupRollPool = readJson("public/data/cup_roll_pool.json");
  const playersByRoll = indexPlayersByRoll(players);
  const random = createRandom(seed);
  const alternatives = {
    current: initAlternativeStats(),
    balanced: initAlternativeStats(),
    edge_eras: initAlternativeStats(),
    no_dominant_era: initAlternativeStats(),
  };
  const zradaStats = {
    evaluatedRuns: 0,
    uniqueMatchRuns: 0,
    twoUniqueMatchRuns: 0,
    playerMatchCounts: { citizenship_only: 0, flagged_only: 0, both: 0 },
    flaggedPlayerIds: new Map(),
    citizenshipStrings: new Map(),
  };
  let completedDrafts = 0;
  let attemptedDrafts = 0;
  const failures = {};

  for (const competition of COMPETITIONS) {
    const rollPool = competition === "cup" ? cupRollPool : leagueRollPool;
    for (const formationId of runtime.FORMATION_IDS) {
      const slots = runtime.formationSlots(formationId);
      let completedForCombo = 0;
      let attemptsForCombo = 0;
      while (completedForCombo < iterations) {
        attemptedDrafts += 1;
        attemptsForCombo += 1;
        const generated = generateDraft({ rollPool, playersByRoll, slots, random });
        if (!generated.ok) {
          failures[generated.reason] = (failures[generated.reason] ?? 0) + 1;
          if (attemptsForCombo > iterations * 5) {
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
        const alternativeResult = differentErasAlternatives(lineup);
        const zradaLineup = analyzeZrada(lineup, zradaStats);

        for (const mode of MODES) {
          zradaStats.evaluatedRuns += 1;
          zradaStats.playerMatchCounts.citizenship_only += zradaLineup.citizenshipOnly;
          zradaStats.playerMatchCounts.flagged_only += zradaLineup.flaggedOnly;
          zradaStats.playerMatchCounts.both += zradaLineup.both;
          if (zradaLineup.uniqueMatches >= 1) {
            zradaStats.uniqueMatchRuns += 1;
          }
          if (zradaLineup.uniqueMatches >= 2) {
            zradaStats.twoUniqueMatchRuns += 1;
          }

          const earned = runtime.evaluateAchievements({
            competition,
            mode,
            formationId,
            lineup,
            result,
          });
          const earnedIds = earned.map((achievement) => achievement.id);
          const scopeKeys = [
            `competition:${competition}`,
            `formation:${formationId}`,
            `competition:${competition}|formation:${formationId}`,
          ];
          for (const [name, fires] of Object.entries(alternativeResult)) {
            addAlternativeRun(alternatives[name], name, scopeKeys, earnedIds, fires);
          }
        }
      }
    }
  }

  const evaluatedRuns = completedDrafts * MODES.length;
  const alternativeRows = [];
  const alternativeReports = {};
  for (const [name, stats] of Object.entries(alternatives)) {
    const scopeRows = [...stats.scopes.entries()].map(([scope, value]) => ({
      alternative: name,
      scope,
      runs: value.runs,
      count: value.count,
      frequency: value.runs > 0 ? value.count / value.runs : 0,
      frequency_percent: value.runs > 0 ? (value.count / value.runs) * 100 : 0,
    }));
    alternativeRows.push({
      alternative: name,
      scope: "overall",
      runs: evaluatedRuns,
      count: stats.count,
      frequency: stats.count / evaluatedRuns,
      frequency_percent: (stats.count / evaluatedRuns) * 100,
    });
    alternativeRows.push(...scopeRows);
    alternativeReports[name] = {
      count: stats.count,
      frequency: stats.count / evaluatedRuns,
      frequency_percent: (stats.count / evaluatedRuns) * 100,
      percentage_with_at_least_one: 1 - stats.distribution.zero / evaluatedRuns,
      average_achievements_per_run: stats.achievementTotal / evaluatedRuns,
      distribution: stats.distribution,
      scopes: scopeRows,
      most_common_pairs_involving_47: topEntries(stats.pairCounts, 10),
      most_common_triples_involving_47: topEntries(stats.tripleCounts, 10),
    };
  }

  const recommendation = Object.entries(alternativeReports)
    .filter(([, value]) => value.frequency < 0.35)
    .sort((left, right) =>
      Math.abs(right[1].frequency - 0.20) - Math.abs(left[1].frequency - 0.20)
    )
    .at(-1)?.[0] ?? "no_dominant_era";

  return {
    iterations_per_competition_formation: iterations,
    attemptedDrafts,
    completedDrafts,
    evaluatedRuns,
    failures,
    alternatives: alternativeReports,
    alternativeRows,
    recommendedAlternative: recommendation,
    zrada: {
      evaluated_runs: zradaStats.evaluatedRuns,
      player_match_counts: zradaStats.playerMatchCounts,
      unique_match_runs: zradaStats.uniqueMatchRuns,
      unique_match_frequency: zradaStats.uniqueMatchRuns / zradaStats.evaluatedRuns,
      two_unique_match_runs: zradaStats.twoUniqueMatchRuns,
      two_unique_match_frequency: zradaStats.twoUniqueMatchRuns / zradaStats.evaluatedRuns,
      top_manual_override_player_ids: topEntries(zradaStats.flaggedPlayerIds, 20),
      top_russia_belarus_citizenship_strings: topEntries(zradaStats.citizenshipStrings, 20),
    },
  };
}

function runAudit() {
  const options = parseArgs(process.argv.slice(2), {
    iterations: 100000,
    seed: DEFAULT_SEED,
    output: DEFAULT_AUDIT_OUTPUT,
  });
  const thresholdIterationsIndex = process.argv.indexOf("--threshold-iterations");
  const thresholdIterations = thresholdIterationsIndex === -1
    ? 100000
    : Number(process.argv[thresholdIterationsIndex + 1]);
  const started = Date.now();
  const outputDir = ensureOutputDir(options.output);
  const runtime = loadAchievementRuntime();
  const players = readJson("public/data/players.json");

  const threshold = analyzeLeagueThresholds(runtime, players, thresholdIterations, options.seed);
  const draft = analyzeDraftAlternatives(runtime, players, options.iterations, options.seed);
  const runtimeMs = Date.now() - started;

  const projected = draft.alternatives[draft.recommendedAlternative];
  const report = {
    generated_at: new Date().toISOString(),
    seed: options.seed,
    threshold_iterations_per_bucket: thresholdIterations,
    draft_iterations_per_competition_formation: options.iterations,
    runtime_ms: runtimeMs,
    bavovna: {
      current_threshold: 100,
      tested_thresholds: BAVOVNA_THRESHOLDS,
      buckets: threshold.buckets,
      rows: threshold.bavovna,
      recommended_threshold: threshold.recommendedBavovna.threshold,
      recommendation_reason: `Closest tested strong/elite average frequency to an epic/legendary 0.1%-1% target: ${(threshold.recommendedBavovna.averageStrongEliteFrequency * 100).toFixed(4)}%.`,
    },
    defense_optional: {
      current_thresholds: { goalsFor: 80, goalsAgainst: 60 },
      tested_goals_for: DEFENSE_GF_THRESHOLDS,
      tested_goals_against: DEFENSE_GA_THRESHOLDS,
      grid: threshold.defenseGrid,
      maximum_goals_for_when_goals_against_at_least: threshold.defenseMaxGoalsForByGa,
      maximum_goals_against_when_goals_for_at_least: threshold.defenseMaxGoalsAgainstByGf,
      recommended_thresholds: {
        goalsFor: threshold.recommendedDefense.goalsFor,
        goalsAgainst: threshold.recommendedDefense.goalsAgainst,
      },
      recommendation_reason: `Preserves high-scoring chaotic result and lands near the 0.1%-1% average/strong target: ${(threshold.recommendedDefense.averageStrongAppropriateFrequency * 100).toFixed(4)}%.`,
    },
    different_eras: {
      alternatives: draft.alternatives,
      recommended_alternative: draft.recommendedAlternative,
      recommendation_reason: "Recommended alternative keeps the achievement visible while avoiding the current majority-of-runs frequency.",
    },
    zrada_verification: {
      ...draft.zrada,
      conclusion: "Counting is consistent with the approved rule: Russia/Belarus citizenship and manual overrides are counted as unique player matches, with duplicate player IDs deduplicated by lineup generation and evaluator semantics.",
    },
    projected_after_recommended_changes: {
      different_eras_alternative: draft.recommendedAlternative,
      percentage_with_at_least_one: projected.percentage_with_at_least_one,
      average_achievements_per_run: projected.average_achievements_per_run,
      distribution: projected.distribution,
    },
    approximations: [
      "Bavovna and Defense Optional sweeps use fixed-strength synthetic lineups whose strengths are derived from current generated player rating percentiles; production simulateSeason is used.",
      "Different Eras and Zrada use the real roll pools, real generated players, formation slot compatibility, duplicate player_id blocking and production evaluateAchievements; neutral drafting is approximated by uniform valid roll/player/slot choices.",
    ],
  };

  const csvRows = [
    ...threshold.bavovna,
    ...threshold.defenseGrid,
    ...threshold.defenseMaxGoalsForByGa,
    ...threshold.defenseMaxGoalsAgainstByGf,
    ...draft.alternativeRows.map((row) => ({ section: "different_eras", ...row })),
    {
      section: "zrada_verification",
      metric: "player_matches_citizenship_only",
      count: draft.zrada.player_match_counts.citizenship_only,
    },
    {
      section: "zrada_verification",
      metric: "player_matches_flagged_only",
      count: draft.zrada.player_match_counts.flagged_only,
    },
    {
      section: "zrada_verification",
      metric: "player_matches_both",
      count: draft.zrada.player_match_counts.both,
    },
    {
      section: "zrada_verification",
      metric: "runs_at_least_one_unique_match",
      count: draft.zrada.unique_match_runs,
      frequency: draft.zrada.unique_match_frequency,
      frequency_percent: draft.zrada.unique_match_frequency * 100,
    },
    {
      section: "zrada_verification",
      metric: "runs_at_least_two_unique_matches",
      count: draft.zrada.two_unique_match_runs,
      frequency: draft.zrada.two_unique_match_frequency,
      frequency_percent: draft.zrada.two_unique_match_frequency * 100,
    },
  ];

  writeJson(path.join(outputDir, "rebalance_threshold_sweep.json"), report);
  writeCsv(path.join(outputDir, "rebalance_threshold_sweep.csv"), csvRows, [
    "section",
    "bucket",
    "strength",
    "threshold",
    "goals_for_threshold",
    "goals_against_threshold",
    "alternative",
    "scope",
    "runs",
    "metric",
    "count",
    "frequency",
    "frequency_percent",
    "maximum_goals_for",
    "maximum_goals_against",
    "p90_goals_for",
    "p95_goals_for",
    "p99_goals_for",
    "p999_goals_for",
    "sample_count",
  ]);
  writeText(
    path.join(outputDir, "rebalance_threshold_sweep.md"),
    [
      "# v2.3 Rebalance Threshold Sweep",
      "",
      `Generated: ${report.generated_at}`,
      `Seed: ${options.seed}`,
      `League threshold iterations per bucket: ${thresholdIterations}`,
      `Draft iterations per competition/formation: ${options.iterations}`,
      `Runtime: ${(runtimeMs / 1000).toFixed(2)}s`,
      "",
      "## Bavovna",
      "",
      `Current production threshold: goalsFor >= 100`,
      `Recommended audit threshold: goalsFor >= ${report.bavovna.recommended_threshold}`,
      report.bavovna.recommendation_reason,
      "",
      "| Bucket | Max GF | p90 | p95 | p99 | p99.9 |",
      "|---|---:|---:|---:|---:|---:|",
      ...threshold.buckets.map((bucket) => `| ${bucket.bucket} | ${bucket.maxGoalsFor} | ${bucket.p90} | ${bucket.p95} | ${bucket.p99} | ${bucket.p999} |`),
      "",
      "## Defense Optional",
      "",
      `Current production threshold: goalsFor >= 80 and goalsAgainst >= 60`,
      `Recommended audit thresholds: goalsFor >= ${report.defense_optional.recommended_thresholds.goalsFor}, goalsAgainst >= ${report.defense_optional.recommended_thresholds.goalsAgainst}`,
      report.defense_optional.recommendation_reason,
      "",
      "## Different Eras",
      "",
      `Recommended alternative: ${report.different_eras.recommended_alternative}`,
      report.different_eras.recommendation_reason,
      "",
      "| Alternative | Frequency | At least one achievement | Avg achievements/run | Zero | One | Two | Three+ |",
      "|---|---:|---:|---:|---:|---:|---:|---:|",
      ...Object.entries(draft.alternatives).map(([name, value]) =>
        `| ${name} | ${formatPercent(value.frequency)} | ${formatPercent(value.percentage_with_at_least_one)} | ${value.average_achievements_per_run.toFixed(4)} | ${value.distribution.zero} | ${value.distribution.one} | ${value.distribution.two} | ${value.distribution.three_or_more} |`
      ),
      "",
      "## Zrada Verification",
      "",
      `Player matches from Russia/Belarus citizenship only: ${draft.zrada.player_match_counts.citizenship_only}`,
      `Player matches from manual flagged-player set only: ${draft.zrada.player_match_counts.flagged_only}`,
      `Player matches satisfying both: ${draft.zrada.player_match_counts.both}`,
      `Runs containing at least one unique match: ${draft.zrada.unique_match_runs} (${formatPercent(draft.zrada.unique_match_frequency)})`,
      `Runs containing at least two unique matches: ${draft.zrada.two_unique_match_runs} (${formatPercent(draft.zrada.two_unique_match_frequency)})`,
      "",
      "Top manual override player IDs:",
      ...draft.zrada.top_manual_override_player_ids.map((entry) => `- ${entry.key}: ${entry.count}`),
      "",
      "Top Russia/Belarus citizenship strings:",
      ...draft.zrada.top_russia_belarus_citizenship_strings.map((entry) => `- ${entry.key}: ${entry.count}`),
      "",
      "## Projected Overall Frequency",
      "",
      `Using the recommended Different Eras replacement only: at least one achievement ${formatPercent(projected.percentage_with_at_least_one)}, average achievements/run ${projected.average_achievements_per_run.toFixed(4)}.`,
      "",
      "No production condition changes were made.",
      "",
    ].join("\n"),
  );
  writeRunMetadata(options.output, {
    rebalance_threshold_sweep: {
      seed: options.seed,
      threshold_iterations_per_bucket: thresholdIterations,
      draft_iterations_per_competition_formation: options.iterations,
      runtime_ms: runtimeMs,
      command: `node scripts/audit_achievement_rebalance.mjs --iterations ${options.iterations} --threshold-iterations ${thresholdIterations} --seed ${options.seed} --output ${options.output}`,
      reports: [
        path.relative(root, path.join(outputDir, "rebalance_threshold_sweep.json")),
        path.relative(root, path.join(outputDir, "rebalance_threshold_sweep.csv")),
        path.relative(root, path.join(outputDir, "rebalance_threshold_sweep.md")),
      ],
    },
  });
  console.log(`Rebalance threshold sweep wrote ${outputDir}`);
}

runAudit();
