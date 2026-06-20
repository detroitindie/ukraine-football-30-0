import type { DraftMode, DraftPlayer, Lineup } from "@/lib/draft-types";

export const SEASON_RESULT_STORAGE_KEY = "uf30-season-result-v1";

export type SeasonVerdict =
  | "championship"
  | "europe"
  | "midTable"
  | "relegation";

export type SeasonResult = {
  matches: 30;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  verdict: SeasonVerdict;
};

export type SavedSeason = {
  competition: "league";
  mode: DraftMode;
  lineup: Lineup;
  result: SeasonResult;
};

export type SavedCupPlaceholder = {
  competition: "cup";
  mode: DraftMode;
  lineup: Lineup;
  result: null;
};

export type SavedResult = SavedSeason | SavedCupPlaceholder;

const OPPONENT_STRENGTHS = [
  79, 77, 75, 74, 72, 71, 70, 69, 68, 67,
  66, 65, 64, 63, 62, 61, 60, 59, 57, 55,
  76, 73, 70, 68, 66, 64, 62, 60, 58, 54,
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function playerStrength(player: DraftPlayer) {
  return player.effective_global_rating ?? player.global_rating ?? 65;
}

function lineupStrength(players: DraftPlayer[]) {
  if (players.length === 0) {
    return 65;
  }

  return players.reduce((total, player) => total + playerStrength(player), 0) /
    players.length;
}

function hashLineup(players: DraftPlayer[]) {
  const signature = players
    .map((player) => `${player.player_id}:${player.club_decade_id}`)
    .sort()
    .join("|");

  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePoisson(lambda: number, random: () => number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;

  do {
    count += 1;
    product *= random();
  } while (product > limit && count < 8);

  return Math.min(6, count - 1);
}

function verdictForPoints(points: number): SeasonVerdict {
  if (points >= 60) {
    return "championship";
  }
  if (points >= 50) {
    return "europe";
  }
  if (points >= 29) {
    return "midTable";
  }
  return "relegation";
}

export function simulateSeason(players: DraftPlayer[]): SeasonResult {
  const strength = clamp(lineupStrength(players), 45, 95);
  const random = createRandom(hashLineup(players));
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const opponentStrength of OPPONENT_STRENGTHS) {
    const strengthDifference = strength - opponentStrength;
    const homeFactor = random() < 0.5 ? 0.12 : -0.06;
    const teamExpectedGoals = clamp(
      1.22 + strengthDifference * 0.043 + homeFactor,
      0.35,
      2.85,
    );
    const opponentExpectedGoals = clamp(
      1.24 - strengthDifference * 0.034 - homeFactor * 0.6,
      0.35,
      2.65,
    );
    const teamGoals = samplePoisson(teamExpectedGoals, random);
    const opponentGoals = samplePoisson(opponentExpectedGoals, random);

    goalsFor += teamGoals;
    goalsAgainst += opponentGoals;

    if (teamGoals > opponentGoals) {
      wins += 1;
    } else if (teamGoals === opponentGoals) {
      draws += 1;
    } else {
      losses += 1;
    }
  }

  const points = wins * 3 + draws;

  return {
    matches: 30,
    wins,
    draws,
    losses,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    verdict: verdictForPoints(points),
  };
}
