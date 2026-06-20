import type { DraftCompetition } from "@/lib/draft-types";

export const LEAGUE_ROLL_POOL_PATH = "/data/roll_pool.json";
export const CUP_ROLL_POOL_PATH = "/data/cup_roll_pool.json";

export function rollPoolPathForCompetition(competition: DraftCompetition) {
  return competition === "cup" ? CUP_ROLL_POOL_PATH : LEAGUE_ROLL_POOL_PATH;
}
