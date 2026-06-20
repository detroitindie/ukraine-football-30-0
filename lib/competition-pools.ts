import type { DraftCompetition } from "@/lib/draft-types";

export const LEAGUE_ROLL_POOL_PATH = "/data/roll_pool.json";

// TODO(v2 cup data): regenerate a Cup roll pool from the existing upstream
// aggregate source once the pre-top-division club eligibility field is
// available. The repository currently has only the League-ready roll pool, so
// Cup temporarily uses the League pool rather than inventing player data.
export const CUP_ROLL_POOL_PATH = LEAGUE_ROLL_POOL_PATH;

export function rollPoolPathForCompetition(competition: DraftCompetition) {
  return competition === "cup" ? CUP_ROLL_POOL_PATH : LEAGUE_ROLL_POOL_PATH;
}
