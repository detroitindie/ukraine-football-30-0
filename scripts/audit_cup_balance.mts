#!/usr/bin/env node

import type { DraftPlayer } from "../lib/draft-types";
import type { CupSimulationResult } from "../lib/seasonSimulation";

type ScenarioName = "low" | "medium" | "high";

type Scenario = {
  name: ScenarioName;
  strength: number;
};

type Aggregate = {
  cupWins: number;
  finalAppearances: number;
  semiFinalAppearances: number;
  earlyEliminations: number;
  goalsFor: number;
  goalsAgainst: number;
};

type CupSimulationModule = {
  simulateCup(players: DraftPlayer[]): CupSimulationResult;
};

const DEFAULT_SAMPLE_SIZE = 20_000;
const SCENARIOS: Scenario[] = [
  { name: "low", strength: 62 },
  { name: "medium", strength: 76 },
  { name: "high", strength: 90 },
];

const SLOT_COUNT = 11;

function parseSampleSize(argv: string[]) {
  const sampleFlagIndex = argv.findIndex((value) => value === "--samples" || value === "-n");
  if (sampleFlagIndex === -1) {
    return DEFAULT_SAMPLE_SIZE;
  }

  const rawValue = argv[sampleFlagIndex + 1];
  const sampleSize = Number(rawValue);
  if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
    throw new Error("Sample size must be a positive integer.");
  }

  return sampleSize;
}

function syntheticPlayer(
  scenario: Scenario,
  trialIndex: number,
  playerIndex: number,
): DraftPlayer {
  const uniqueId = trialIndex * SLOT_COUNT + playerIndex + 1;

  return {
    club_decade_player_id: `cup-balance-${scenario.name}-${uniqueId}`,
    club_decade_id: `cup-balance-${scenario.name}-${trialIndex}`,
    team_id: 0,
    team_name: `Synthetic ${scenario.name}`,
    decade: "balance",
    player_id: uniqueId,
    player_name: `Synthetic Player ${uniqueId}`,
    position: "Synthetic",
    main_position: "Synthetic",
    game_position: "Synthetic",
    goals: null,
    assists: null,
    clean_sheets: null,
    raw_score: null,
    local_rating: scenario.strength,
    global_rating: scenario.strength,
    global_percentile: null,
    hidden_modifier: null,
    effective_global_rating: scenario.strength,
  };
}

function syntheticLineup(scenario: Scenario, trialIndex: number) {
  return Array.from({ length: SLOT_COUNT }, (_, playerIndex) =>
    syntheticPlayer(scenario, trialIndex, playerIndex),
  );
}

function percentage(count: number, sampleSize: number) {
  return `${((count / sampleSize) * 100).toFixed(2)}%`;
}

function average(total: number, sampleSize: number) {
  return (total / sampleSize).toFixed(2);
}

function runScenario(
  scenario: Scenario,
  sampleSize: number,
  simulateCup: CupSimulationModule["simulateCup"],
): Aggregate {
  const aggregate: Aggregate = {
    cupWins: 0,
    finalAppearances: 0,
    semiFinalAppearances: 0,
    earlyEliminations: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };

  for (let trialIndex = 0; trialIndex < sampleSize; trialIndex += 1) {
    const result = simulateCup(syntheticLineup(scenario, trialIndex));

    if (result.wonCup) {
      aggregate.cupWins += 1;
    }
    if (result.stageRank >= 5) {
      aggregate.finalAppearances += 1;
    }
    if (result.stageRank >= 4) {
      aggregate.semiFinalAppearances += 1;
    }
    if (result.stageRank <= 1) {
      aggregate.earlyEliminations += 1;
    }

    aggregate.goalsFor += result.goalsFor;
    aggregate.goalsAgainst += result.goalsAgainst;
  }

  return aggregate;
}

function printScenario(scenario: Scenario, sampleSize: number, aggregate: Aggregate) {
  console.log(`${scenario.name.toUpperCase()} strength (${scenario.strength})`);
  console.log(`sample size: ${sampleSize}`);
  console.log(`cup win rate: ${percentage(aggregate.cupWins, sampleSize)}`);
  console.log(`final appearance rate: ${percentage(aggregate.finalAppearances, sampleSize)}`);
  console.log(`semi-final appearance rate: ${percentage(aggregate.semiFinalAppearances, sampleSize)}`);
  console.log(`early elimination rate: ${percentage(aggregate.earlyEliminations, sampleSize)}`);
  console.log(`average goals for: ${average(aggregate.goalsFor, sampleSize)}`);
  console.log(`average goals against: ${average(aggregate.goalsAgainst, sampleSize)}`);
  console.log("");
}

async function main() {
  const sampleSize = parseSampleSize(process.argv.slice(2));
  const simulationModuleUrl = new URL("../lib/seasonSimulation.ts", import.meta.url).href;
  const { simulateCup } = await import(simulationModuleUrl) as unknown as CupSimulationModule;

  console.log("Ukrainian Cup balance simulation");
  console.log("Uses the production simulateCup function with synthetic fixed-strength lineups.");
  console.log("");

  for (const scenario of SCENARIOS) {
    printScenario(scenario, sampleSize, runScenario(scenario, sampleSize, simulateCup));
  }
}

await main();
