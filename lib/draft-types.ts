export type DraftMode = "normal" | "hardcore";
export type DraftCompetition = "league" | "cup";
export type DraftSort = "stats" | "position";

export type DraftPlayer = {
  club_decade_player_id: string;
  club_decade_id: string;
  team_id: number;
  team_name: string;
  decade: string;
  player_id: number;
  player_name: string;
  citizenships: string[];
  primary_citizenship: string | null;
  position: string;
  main_position: string;
  game_position: string;
  goals: number | null;
  assists: number | null;
  clean_sheets: number | null;
  raw_score: number | null;
  local_rating: number | null;
  global_rating: number | null;
  global_percentile: number | null;
  hidden_modifier: number | null;
  effective_global_rating: number | null;
};

export type RollPoolEntry = {
  club_decade_id: string;
  team_id: number;
  team_name: string;
  decade: string;
  players_count: number;
};

export type FormationLine = "attack" | "midfield" | "defense" | "goalkeeper";

export type FormationSlot = {
  slot_id: string;
  slot_label: string;
  line: FormationLine;
  allowed_positions: string[];
  semantic_positions?: string[];
  slot_order: number;
};

export type DraftData = {
  players: DraftPlayer[];
  rollPool: RollPoolEntry[];
};

export type Lineup = Record<string, DraftPlayer>;
