import type { DraftMode, DraftPlayer, Lineup } from "@/lib/draft-types";
import type { FormationId } from "@/lib/formations";

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

export type CupStage =
  | "round_of_64"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "final";

export type CupDecision = "regular_time" | "extra_time" | "penalties";

export type CupMatchResult = {
  stage: CupStage;
  result: "win" | "loss";
  goalsFor: number;
  goalsAgainst: number;
  decidedBy: CupDecision;
  penaltiesFor?: number;
  penaltiesAgainst?: number;
  regularTimeWin: boolean;
};

export type CupSimulationResult = {
  competition: "cup";
  matches: CupMatchResult[];
  stageRank: number;
  stageLabelUa: string;
  stageLabelEn: string;
  wonCup: boolean;
  regularTimeWins: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type SavedSeason = {
  competition: "league";
  mode: DraftMode;
  formationId: FormationId;
  lineup: Lineup;
  result: SeasonResult;
};

export type SavedCupPlaceholder = {
  competition: "cup";
  mode: DraftMode;
  formationId: FormationId;
  lineup: Lineup;
  result: CupSimulationResult | null;
};

export type SavedResult = SavedSeason | SavedCupPlaceholder;

const OPPONENT_STRENGTHS = [
  79, 77, 75, 74, 72, 71, 70, 69, 68, 67,
  66, 65, 64, 63, 62, 61, 60, 59, 57, 55,
  76, 73, 70, 68, 66, 64, 62, 60, 58, 54,
] as const;

const CUP_STAGES: Array<{
  stage: CupStage;
  labelUa: string;
  labelEn: string;
  opponentStrength: number;
}> = [
  {
    stage: "round_of_64",
    labelUa: "1/32",
    labelEn: "Round of 64",
    opponentStrength: 57,
  },
  {
    stage: "round_of_32",
    labelUa: "1/16",
    labelEn: "Round of 32",
    opponentStrength: 61,
  },
  {
    stage: "round_of_16",
    labelUa: "1/8",
    labelEn: "Round of 16",
    opponentStrength: 66,
  },
  {
    stage: "quarter_final",
    labelUa: "1/4",
    labelEn: "Quarter-final",
    opponentStrength: 71,
  },
  {
    stage: "semi_final",
    labelUa: "1/2",
    labelEn: "Semi-final",
    opponentStrength: 75,
  },
  {
    stage: "final",
    labelUa: "фінал",
    labelEn: "Final",
    opponentStrength: 79,
  },
];

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

function samplePenaltyScore(random: () => number) {
  let left = 0;
  let right = 0;

  for (let kick = 0; kick < 5; kick += 1) {
    if (random() < 0.74) {
      left += 1;
    }
    if (random() < 0.74) {
      right += 1;
    }
  }

  while (left === right) {
    if (random() < 0.74) {
      left += 1;
    }
    if (random() < 0.74) {
      right += 1;
    }
  }

  return { left, right };
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

export function simulateCup(players: DraftPlayer[]): CupSimulationResult {
  const strength = clamp(lineupStrength(players), 45, 95);
  const random = createRandom(hashLineup(players) ^ 0x9e3779b9);
  const matches: CupMatchResult[] = [];

  for (const stage of CUP_STAGES) {
    const cupSwing = (random() - 0.5) * 18;
    const strengthDifference = strength + cupSwing - stage.opponentStrength;
    const teamExpectedGoals = clamp(
      1.2 + strengthDifference * 0.038 + (random() - 0.5) * 0.42,
      0.25,
      3.25,
    );
    const opponentExpectedGoals = clamp(
      1.16 - strengthDifference * 0.031 + (random() - 0.5) * 0.48,
      0.25,
      3.05,
    );
    let goalsFor = samplePoisson(teamExpectedGoals, random);
    let goalsAgainst = samplePoisson(opponentExpectedGoals, random);
    let decidedBy: CupDecision = "regular_time";
    let penaltiesFor: number | undefined;
    let penaltiesAgainst: number | undefined;

    if (goalsFor === goalsAgainst) {
      decidedBy = "extra_time";
      const extraDifference = strengthDifference + (random() - 0.5) * 12;
      const teamExtraChance = clamp(0.26 + extraDifference * 0.018, 0.12, 0.56);
      const opponentExtraChance = clamp(0.24 - extraDifference * 0.014, 0.12, 0.52);
      if (random() < teamExtraChance) {
        goalsFor += 1;
      }
      if (random() < opponentExtraChance) {
        goalsAgainst += 1;
      }

      if (goalsFor === goalsAgainst) {
        decidedBy = "penalties";
        const shootout = samplePenaltyScore(random);
        const favoriteBoost = clamp(strengthDifference * 0.012, -0.16, 0.16);
        const playerWinsShootout =
          random() < clamp(0.5 + favoriteBoost, 0.22, 0.78);
        penaltiesFor = playerWinsShootout
          ? Math.max(shootout.left, shootout.right)
          : Math.min(shootout.left, shootout.right);
        penaltiesAgainst = playerWinsShootout
          ? Math.min(shootout.left, shootout.right)
          : Math.max(shootout.left, shootout.right);
      }
    }

    const result =
      decidedBy === "penalties"
        ? (penaltiesFor ?? 0) > (penaltiesAgainst ?? 0) ? "win" : "loss"
        : goalsFor > goalsAgainst ? "win" : "loss";

    matches.push({
      stage: stage.stage,
      result,
      goalsFor,
      goalsAgainst,
      decidedBy,
      penaltiesFor,
      penaltiesAgainst,
      regularTimeWin: result === "win" && decidedBy === "regular_time",
    });

    if (result === "loss") {
      break;
    }
  }

  const stageRank = matches.every((match) => match.result === "win")
    ? CUP_STAGES.length
    : Math.max(0, matches.length - 1);
  const finalStage = CUP_STAGES[Math.min(stageRank, CUP_STAGES.length - 1)];
  const goalsFor = matches.reduce((total, match) => total + match.goalsFor, 0);
  const goalsAgainst = matches.reduce(
    (total, match) => total + match.goalsAgainst,
    0,
  );

  return {
    competition: "cup",
    matches,
    stageRank,
    stageLabelUa: finalStage.labelUa,
    stageLabelEn: finalStage.labelEn,
    wonCup: stageRank === CUP_STAGES.length,
    regularTimeWins: matches.filter((match) => match.regularTimeWin).length,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  };
}
