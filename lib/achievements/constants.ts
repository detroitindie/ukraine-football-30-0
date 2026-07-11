import spec from "@/docs/achievement-implementation-spec.json";

export const TEAM_SETS = spec.team_id_sets;
export const NAMED_PLAYER_IDS = spec.named_player_ids;
export const FLAGGED_ZRADA_PLAYER_IDS = new Set<number>(spec.flagged_zrada_player_ids);

export const BALKAN_COUNTRIES = new Set<string>(spec.country_sets.balkans);
export const SOUTH_AMERICAN_COUNTRIES = new Set<string>(spec.country_sets.south_america);
export const AFRICAN_COUNTRIES = new Set<string>([
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cameroon",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "DR Congo",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Ivory Coast",
  "Cote d'Ivoire",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "Sao Tome and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
]);

export const GERMANY_2006_PLAYER_IDS = new Set<number>([
  8816756,
  39996,
  NAMED_PLAYER_IDS.bohdan_shust,
  8841428,
  24006,
  24050,
  25732,
  8789170,
  15681,
  8562832,
  24054,
  NAMED_PLAYER_IDS.serhiy_rebrov,
  8620253,
  NAMED_PLAYER_IDS.sergiy_nazarenko,
  NAMED_PLAYER_IDS.ruslan_rotan,
  NAMED_PLAYER_IDS.andriy_shevchenko,
  NAMED_PLAYER_IDS.artem_milevskyi,
  14945,
]);

export const SHEVCHENKO_PLAYER_IDS = new Set<number>([
  91714,
  80312,
  136537,
  363740,
  NAMED_PLAYER_IDS.andriy_shevchenko,
  1266282,
  1395982,
]);

export const RUKH_LVIV_TEAM_IDS = new Set<number>([48726]);
export const PFC_LVIV_TEAM_IDS = new Set<number>([18105]);
export const METALURH_ZAPORIZHZHIA_TEAM_IDS = new Set<number>(TEAM_SETS.metalurh_zaporizhzhia);
export const MARIUPOL_TEAM_IDS = new Set<number>(TEAM_SETS.mariupol_line);
