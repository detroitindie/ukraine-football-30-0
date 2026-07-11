import {
  AFRICAN_COUNTRIES,
  BALKAN_COUNTRIES,
  FLAGGED_ZRADA_PLAYER_IDS,
  GERMANY_2006_PLAYER_IDS,
  MARIUPOL_TEAM_IDS,
  METALURH_ZAPORIZHZHIA_TEAM_IDS,
  NAMED_PLAYER_IDS,
  PFC_LVIV_TEAM_IDS,
  RUKH_LVIV_TEAM_IDS,
  SHEVCHENKO_PLAYER_IDS,
  SOUTH_AMERICAN_COUNTRIES,
  TEAM_SETS,
} from "@/lib/achievements/constants";
import { ACHIEVEMENTS } from "@/lib/achievements/registry";
import type {
  Achievement,
  AchievementRunInput,
  LineupPlayer,
} from "@/lib/achievements/types";
import type { DraftPlayer } from "@/lib/draft-types";
import { formationSlots } from "@/lib/formations";
import type {
  CupMatchResult,
  CupSimulationResult,
  SeasonResult,
} from "@/lib/seasonSimulation";

type Predicate = (context: EvaluationContext) => boolean;

type EvaluationContext = {
  input: AchievementRunInput;
  players: LineupPlayer[];
  uniquePlayers: LineupPlayer[];
  league: SeasonResult | null;
  cup: CupSimulationResult | null;
};

const PLAYER_IDS = NAMED_PLAYER_IDS;
const CDM_PLAYER_IDS = new Set<number>([
  PLAYER_IDS.taras_stepanenko,
  PLAYER_IDS.sergiy_sydorchuk,
  PLAYER_IDS.volodymyr_brazhko,
  PLAYER_IDS.danylo_ignatenko,
]);

function uniqueByPlayerId(players: LineupPlayer[]) {
  const seen = new Set<number>();
  return players.filter((player) => {
    if (seen.has(player.player_id)) {
      return false;
    }
    seen.add(player.player_id);
    return true;
  });
}

function toPlayers(input: AchievementRunInput): LineupPlayer[] {
  return Object.entries(input.lineup).map(([slotId, player]) => ({
    ...player,
    slotId,
  }));
}

function createContext(input: AchievementRunInput): EvaluationContext {
  const players = toPlayers(input);
  const cup = input.competition === "cup"
    ? input.result as CupSimulationResult
    : null;
  const league = input.competition === "league"
    ? input.result as SeasonResult
    : null;

  return {
    input,
    players,
    uniquePlayers: uniqueByPlayerId(players),
    league,
    cup,
  };
}

function setFrom(values: readonly number[]) {
  return new Set<number>(values);
}

function countPlayers(
  context: EvaluationContext,
  predicate: (player: LineupPlayer) => boolean,
) {
  return context.uniquePlayers.filter(predicate).length;
}

function teamCount(context: EvaluationContext, teamIds: Iterable<number>) {
  const teams = new Set(teamIds);
  return countPlayers(context, (player) => teams.has(player.team_id));
}

function teamDecadeCount(
  context: EvaluationContext,
  teamIds: Iterable<number>,
  decade: string,
) {
  const teams = new Set(teamIds);
  return countPlayers(
    context,
    (player) => teams.has(player.team_id) && player.decade === decade,
  );
}

function hasPlayer(context: EvaluationContext, playerId: number) {
  return context.uniquePlayers.some((player) => player.player_id === playerId);
}

function isLeagueWin(context: EvaluationContext) {
  return context.league?.verdict === "championship";
}

function isCupWin(context: EvaluationContext) {
  return context.cup?.wonCup === true;
}

function isWin(context: EvaluationContext) {
  return isLeagueWin(context) || isCupWin(context);
}

function isSuccess(context: EvaluationContext) {
  return (
    context.league?.verdict === "championship" ||
    context.league?.verdict === "europe" ||
    context.cup?.wonCup === true
  );
}

function hasAtLeastOneWin(context: EvaluationContext) {
  if (context.league) {
    return context.league.wins > 0;
  }
  return context.cup?.matches.some((match) => match.result === "win") === true;
}

function reachedCupFinal(context: EvaluationContext) {
  return (context.cup?.stageRank ?? -1) >= 5;
}

function reachedCupSemi(context: EvaluationContext) {
  return (context.cup?.stageRank ?? -1) >= 4;
}

function citizenships(player: DraftPlayer) {
  return Array.isArray(player.citizenships) ? player.citizenships : [];
}

function primaryCitizenship(player: DraftPlayer) {
  return player.primary_citizenship ?? citizenships(player)[0] ?? null;
}

function hasCitizenship(player: DraftPlayer, country: string) {
  return citizenships(player).includes(country);
}

function hasCitizenshipInSet(player: DraftPlayer, countries: Set<string>) {
  return citizenships(player).some((country) => countries.has(country));
}

function isUkrainian(player: DraftPlayer) {
  return hasCitizenship(player, "Ukraine");
}

function isLegionnaire(player: DraftPlayer) {
  const values = citizenships(player);
  return values.length > 0 && !values.includes("Ukraine");
}

function citizenshipCount(
  context: EvaluationContext,
  predicate: (player: DraftPlayer) => boolean,
) {
  return countPlayers(context, predicate);
}

function uniquePrimaryCitizenshipCount(context: EvaluationContext) {
  const countries = new Set<string>();
  for (const player of context.uniquePlayers) {
    const country = primaryCitizenship(player);
    if (country) {
      countries.add(country);
    }
  }
  return countries.size;
}

function linePlayers(context: EvaluationContext, line: string) {
  const slots = formationSlots(context.input.formationId)
    .filter((slot) => slot.line === line)
    .map((slot) => slot.slot_id);
  return slots.map((slotId) => context.input.lineup[slotId]).filter(Boolean);
}

function attackPlayers(context: EvaluationContext) {
  return linePlayers(context, "attack");
}

function cupPenaltyShootoutWin(context: EvaluationContext) {
  return context.cup?.matches.some(
    (match) => match.result === "win" && match.decidedBy === "penalties",
  ) === true;
}

function cupEtOrPenaltyCount(context: EvaluationContext) {
  return context.cup?.matches.filter(
    (match) => match.decidedBy === "extra_time" ||
      match.decidedBy === "penalties",
  ).length ?? 0;
}

function finalMatch(context: EvaluationContext): CupMatchResult | null {
  return context.cup?.matches.find((match) => match.stage === "final") ?? null;
}

function isZradaPlayer(player: DraftPlayer) {
  return (
    hasCitizenship(player, "Russia") ||
    hasCitizenship(player, "Belarus") ||
    FLAGGED_ZRADA_PLAYER_IDS.has(player.player_id)
  );
}

function zradaCount(context: EvaluationContext) {
  return countPlayers(context, isZradaPlayer);
}

function maxTeamCount(context: EvaluationContext) {
  const counts = new Map<number, number>();
  for (const player of context.uniquePlayers) {
    counts.set(player.team_id, (counts.get(player.team_id) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function uniqueTeamCount(context: EvaluationContext) {
  return new Set(context.uniquePlayers.map((player) => player.team_id)).size;
}

function teamIdsInSet(context: EvaluationContext, teamIds: Iterable<number>) {
  const teams = new Set(teamIds);
  return new Set(
    context.uniquePlayers
      .filter((player) => teams.has(player.team_id))
      .map((player) => player.team_id),
  );
}

function hasTwoFromEveryDecade(context: EvaluationContext) {
  return (
    decadeCount(context, "1990s") >= 2 &&
    decadeCount(context, "2000s") >= 2 &&
    decadeCount(context, "2010s") >= 2 &&
    decadeCount(context, "2020s") >= 2
  );
}

function sameTeamAcrossAllDecades(context: EvaluationContext) {
  const teamDecades = new Map<number, Set<string>>();
  for (const player of context.uniquePlayers) {
    const decades = teamDecades.get(player.team_id) ?? new Set<string>();
    decades.add(player.decade);
    teamDecades.set(player.team_id, decades);
  }
  return [...teamDecades.values()].some(
    (decades) =>
      decades.has("1990s") &&
      decades.has("2000s") &&
      decades.has("2010s") &&
      decades.has("2020s"),
  );
}

function decadeCount(context: EvaluationContext, decade: string) {
  return countPlayers(context, (player) => player.decade === decade);
}

function defensiveLine(context: EvaluationContext) {
  return linePlayers(context, "defense");
}

function allPresent(players: Array<DraftPlayer | undefined>, count: number) {
  return players.length === count && players.every(Boolean);
}

function cdmSlotAssignment(context: EvaluationContext) {
  const slots = formationSlots(context.input.formationId);
  return slots.some((slot) => {
    const semantics = slot.semantic_positions ?? slot.allowed_positions;
    const player = context.input.lineup[slot.slot_id];
    return Boolean(
      player &&
      CDM_PLAYER_IDS.has(player.player_id) &&
      semantics.includes("CDM"),
    );
  });
}

function everyCupWinMarginAtMostOne(context: EvaluationContext) {
  return context.cup?.matches.every((match) => {
    if (match.result !== "win") {
      return true;
    }
    return match.goalsFor - match.goalsAgainst <= 1;
  }) === true;
}

function identicalCupWinScoreCount(context: EvaluationContext) {
  const counts = new Map<string, number>();
  for (const match of context.cup?.matches ?? []) {
    if (match.result !== "win") {
      continue;
    }
    const key = `${match.goalsFor}-${match.goalsAgainst}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function numberedPredicates(): Record<number, Predicate> {
  const dynamo = setFrom(TEAM_SETS.dynamo_kyiv);
  const shakhtar = setFrom(TEAM_SETS.shakhtar_donetsk);
  const dnipro = setFrom(TEAM_SETS.dnipro);
  const tavriya = setFrom(TEAM_SETS.tavriya);
  const chornomorets = setFrom(TEAM_SETS.chornomorets_odesa);
  const metalist = setFrom(TEAM_SETS.metalist_kharkiv);
  const volyn = setFrom(TEAM_SETS.volyn_lutsk);
  const vorskla = setFrom(TEAM_SETS.vorskla_poltava);
  const zorya = setFrom(TEAM_SETS.zorya_luhansk);
  const kryvbas = setFrom(TEAM_SETS.kryvbas_kryvyi_rih);
  const oleksandriya = setFrom(TEAM_SETS.oleksandriya);
  const kolos = setFrom(TEAM_SETS.kolos_kovalivka);
  const obolon = setFrom(TEAM_SETS.obolon);
  const metalurhDonetsk = setFrom(TEAM_SETS.metalurh_donetsk);
  const karpaty = setFrom(TEAM_SETS.karpaty_lviv);
  const nyva = setFrom(TEAM_SETS.nyva_ternopil);
  const donbas = setFrom(TEAM_SETS.donbas);
  const crimea = setFrom(TEAM_SETS.crimea);
  const kyiv = setFrom(TEAM_SETS.kyiv);
  const lviv = setFrom(TEAM_SETS.lviv);
  const uzhhorod = setFrom(TEAM_SETS.uzhhorod);

  return {
    1: (c) => hasPlayer(c, PLAYER_IDS.artem_milevskyi) && hasPlayer(c, PLAYER_IDS.oleksandr_aliev),
    2: (c) => teamCount(c, nyva) >= 2,
    3: (c) => isWin(c) && teamCount(c, dynamo) === 0 && teamCount(c, shakhtar) === 0,
    4: (c) => citizenshipCount(c, (player) => hasCitizenship(player, "Brazil")) >= 9,
    5: (c) => c.uniquePlayers.length === 11 && c.uniquePlayers.every(isLegionnaire),
    6: (c) => c.uniquePlayers.length === 11 && c.uniquePlayers.every(isUkrainian),
    7: (c) => teamCount(c, donbas) >= 8,
    8: (c) => teamCount(c, crimea) >= 3,
    9: (c) => isCupWin(c) && teamCount(c, karpaty) >= 1,
    10: (c) => zradaCount(c) >= 1,
    11: (c) => zradaCount(c) >= 2,
    12: (c) => Boolean(c.league && c.league.losses > c.league.wins + c.league.draws),
    13: (c) => c.league?.verdict === "relegation" || c.cup?.matches[0]?.result === "loss",
    14: (c) => isLeagueWin(c) && teamCount(c, tavriya) >= 2,
    15: (c) => isWin(c) && (teamDecadeCount(c, dynamo, "1990s") >= 2 || teamCount(c, dynamo) >= 4),
    16: (c) => isCupWin(c) && (teamDecadeCount(c, shakhtar, "2000s") >= 2 || teamCount(c, shakhtar) >= 4),
    17: (c) => reachedCupFinal(c) && (teamDecadeCount(c, dnipro, "2010s") >= 2 || teamCount(c, dnipro) >= 4),
    18: (c) => hasPlayer(c, PLAYER_IDS.andriy_shevchenko) && hasPlayer(c, PLAYER_IDS.serhiy_rebrov),
    19: (c) => isWin(c) && hasPlayer(c, PLAYER_IDS.andriy_shevchenko),
    20: (c) => hasPlayer(c, PLAYER_IDS.oleksandr_shovkovskyi) && cupPenaltyShootoutWin(c),
    21: (c) => countPlayers(c, (player) => GERMANY_2006_PLAYER_IDS.has(player.player_id)) >= 5,
    22: (c) => isCupWin(c) && teamCount(c, chornomorets) >= 3,
    23: (c) => c.league?.losses === 0,
    24: (c) => c.league?.draws === 0,
    25: (c) => c.league?.wins === 10 && c.league.draws === 10 && c.league.losses === 10,
    26: (c) => c.league?.wins === 30,
    27: (c) => (c.league?.goalsAgainst ?? Infinity) <= 15 || (isCupWin(c) && c.cup?.goalsAgainst === 0),
    28: (c) => Boolean(c.cup?.wonCup && c.cup.regularTimeWins === c.cup.matches.length),
    29: (c) => isCupWin(c) && cupEtOrPenaltyCount(c) >= 3,
    30: (c) => isCupWin(c) && c.cup?.regularTimeWins === 0,
    31: (c) => c.input.mode === "hardcore" && isWin(c),
    32: (c) => maxTeamCount(c) >= 6,
    33: (c) => c.uniquePlayers.length === 11 && uniqueTeamCount(c) === 11,
    34: (c) => {
      const defenders = defensiveLine(c);
      return c.input.formationId === "3-5-2" &&
        allPresent(defenders, 3) &&
        new Set(defenders.map((player) => player.team_id)).size === 1;
    },
    35: (c) => c.input.formationId === "5-3-2" && isWin(c) && ((c.league?.goalsAgainst ?? Infinity) <= 20 || (c.cup?.goalsAgainst ?? Infinity) <= 2),
    36: (c) => isWin(c) && (hasPlayer(c, PLAYER_IDS.jadson) || (teamCount(c, shakhtar) >= 3 && teamCount(c, dynamo) === 0)),
    37: (c) => isWin(c) && (teamDecadeCount(c, metalist, "2010s") >= 2 || teamCount(c, metalist) >= 4),
    38: (c) => teamCount(c, volyn) >= 3 && hasAtLeastOneWin(c),
    39: (c) => isCupWin(c) && teamCount(c, vorskla) >= 2,
    40: (c) => hasPlayer(c, PLAYER_IDS.ruslan_rotan) && hasPlayer(c, PLAYER_IDS.sergiy_nazarenko),
    41: (c) => isWin(c) && hasPlayer(c, PLAYER_IDS.darijo_srna),
    42: (c) => hasPlayer(c, PLAYER_IDS.jadson) && hasPlayer(c, PLAYER_IDS.fernandinho) && hasPlayer(c, PLAYER_IDS.willian_shakhtar),
    43: (c) => c.input.mode === "hardcore" && isWin(c) && c.uniquePlayers.length === 11 && c.uniquePlayers.every(isUkrainian),
    44: (c) => uniquePrimaryCitizenshipCount(c) >= 8,
    45: (c) => citizenshipCount(c, (player) => hasCitizenshipInSet(player, BALKAN_COUNTRIES)) >= 5,
    46: (c) => citizenshipCount(c, (player) => hasCitizenshipInSet(player, SOUTH_AMERICAN_COUNTRIES)) >= 6,
    47: hasTwoFromEveryDecade,
    48: (c) => decadeCount(c, "2020s") >= 6,
    49: (c) => decadeCount(c, "1990s") >= 6,
    50: (c) => c.league?.wins === 0,
    51: (c) => (c.league?.draws ?? 0) >= 15,
    52: (c) => c.league?.verdict === "midTable" && c.league.goalDifference === 0,
    53: (c) => c.league?.verdict === "championship" && c.league.goalDifference <= 10,
    54: (c) => (c.league?.goalsFor ?? 0) >= 75,
    55: (c) => (c.league?.goalsFor ?? 0) >= 55 && (c.league?.goalsAgainst ?? 0) >= 40,
    56: (c) => isCupWin(c) && finalMatch(c)?.decidedBy === "penalties",
    57: (c) => isCupWin(c) && finalMatch(c)?.decidedBy === "extra_time",
    58: (c) => finalMatch(c)?.result === "loss" && c.cup?.wonCup === false,
    59: (c) => hasPlayer(c, PLAYER_IDS.nikola_vasilj),
    60: (c) => isCupWin(c) && everyCupWinMarginAtMostOne(c),
    61: (c) => countPlayers(c, (player) => dynamo.has(player.team_id) && isUkrainian(player)) >= 4,
    62: (c) => reachedCupFinal(c) && (teamDecadeCount(c, METALURH_ZAPORIZHZHIA_TEAM_IDS, "2000s") >= 2 || teamCount(c, METALURH_ZAPORIZHZHIA_TEAM_IDS) >= 4),
    63: (c) => hasPlayer(c, PLAYER_IDS.yaya_toure),
    64: (c) => teamCount(c, METALURH_ZAPORIZHZHIA_TEAM_IDS) >= 1 && teamCount(c, metalurhDonetsk) >= 1 && teamCount(c, MARIUPOL_TEAM_IDS) >= 1,
    65: (c) => hasPlayer(c, PLAYER_IDS.andriy_yarmolenko) && hasPlayer(c, PLAYER_IDS.yevhen_konoplyanka),
    66: sameTeamAcrossAllDecades,
    67: (c) => countPlayers(c, (player) => SHEVCHENKO_PLAYER_IDS.has(player.player_id)) >= 3,
    68: (c) => teamCount(c, donbas) >= 2 && teamCount(c, lviv) >= 2,
    69: (c) => isWin(c) && teamCount(c, crimea) >= 1 && teamCount(c, donbas) >= 1,
    70: (c) => teamCount(c, karpaty) >= 1 && teamCount(c, RUKH_LVIV_TEAM_IDS) >= 1 && teamCount(c, PFC_LVIV_TEAM_IDS) >= 1,
    71: (c) => teamCount(c, kyiv) >= 5 && teamIdsInSet(c, kyiv).size >= 3,
    72: (c) => c.uniquePlayers.length === 11 && uniquePrimaryCitizenshipCount(c) === 11,
    73: (c) => citizenshipCount(c, (player) => hasCitizenshipInSet(player, AFRICAN_COUNTRIES)) >= 5,
    74: (c) => identicalCupWinScoreCount(c) >= 3,
    75: (c) => c.input.mode === "hardcore" && c.input.formationId === "4-4-2" && isWin(c),
    76: (c) => decadeCount(c, "2000s") >= 6,
    77: (c) => decadeCount(c, "2010s") >= 6,
    78: cdmSlotAssignment,
    79: (c) => teamCount(c, zorya) >= 3 || (teamCount(c, zorya) >= 2 && isSuccess(c)),
    80: (c) => teamCount(c, kryvbas) >= 3 || (teamCount(c, kryvbas) >= 2 && isSuccess(c)),
    81: (c) => isSuccess(c) && (teamDecadeCount(c, oleksandriya, "2010s") >= 2 || teamCount(c, oleksandriya) >= 3),
    82: (c) => teamCount(c, kolos) >= 2 && (reachedCupSemi(c) || c.league?.verdict === "europe" || c.league?.verdict === "championship"),
    83: (c) => teamCount(c, obolon) >= 3 && hasAtLeastOneWin(c),
    84: (c) => teamCount(c, dynamo) >= 2 && teamCount(c, shakhtar) >= 2,
    85: (c) => c.uniquePlayers.length === 11 && c.uniquePlayers.every(isUkrainian) && uniqueTeamCount(c) === 11,
    86: (c) => citizenshipCount(c, (player) => hasCitizenship(player, "Georgia")) >= 3,
    87: (c) => citizenshipCount(c, (player) => hasCitizenship(player, "Nigeria")) >= 3,
    88: (c) => {
      const defenders = defensiveLine(c);
      return c.input.formationId === "5-3-2" &&
        allPresent(defenders, 5) &&
        new Set(defenders.map((player) => player.team_id)).size === 1;
    },
    89: (c) => {
      const defenders = defensiveLine(c);
      return c.input.formationId === "5-3-2" &&
        allPresent(defenders, 5) &&
        new Set(defenders.map((player) => player.team_id)).size === 5;
    },
    90: (c) => {
      const midfielders = linePlayers(c, "midfield");
      const countries = midfielders.map(primaryCitizenship).filter(Boolean);
      return c.input.formationId === "3-5-2" &&
        allPresent(midfielders, 5) &&
        countries.length === 5 &&
        new Set(countries).size === 5;
    },
    91: (c) => {
      const defenders = defensiveLine(c);
      return c.input.formationId === "3-5-2" &&
        allPresent(defenders, 3) &&
        defenders.every(isUkrainian) &&
        new Set(defenders.map((player) => player.team_id)).size === 3;
    },
    92: (c) => {
      const attackers = attackPlayers(c);
      return allPresent(attackers, 2) &&
        attackers[0].team_id === attackers[1].team_id &&
        hasAtLeastOneWin(c);
    },
    93: (c) => Boolean(c.league && c.league.goalsAgainst >= 60 && c.league.verdict !== "relegation"),
    94: (c) => teamCount(c, uzhhorod) >= 1 && teamCount(c, kyiv) === 0 && teamCount(c, lviv) === 0,
    95: (c) => citizenshipCount(c, (player) => hasCitizenship(player, "Albania")) >= 2,
  };
}

const PREDICATES = numberedPredicates();

export function evaluateAchievements(input: AchievementRunInput): Achievement[] {
  const context = createContext(input);
  const seen = new Set<string>();
  const earned: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (seen.has(achievement.id)) {
      continue;
    }
    const predicate = PREDICATES[achievement.numericId];
    if (predicate?.(context)) {
      earned.push(achievement);
      seen.add(achievement.id);
    }
  }

  return earned;
}
