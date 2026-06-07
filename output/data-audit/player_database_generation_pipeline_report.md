# Player Database Generation Pipeline

## Executive conclusion

The player records used by the game are **club-player-decade aggregates**, not
average-season or peak-season records. Goals, assists, clean sheets, disciplinary
statistics, and minutes in `exports/club_decade_players.csv` are cumulative totals
for the source rows grouped into each player/club/decade entry.

The repository does not contain the raw season-level source data or the program
that created `club_decade_players.csv`. Those files are also absent from every
commit and branch in the available Git history. Therefore, the complete upstream
formula, especially the omitted appearance/participation component of
`raw_score` and the exact curve used for `global_rating`, cannot be recovered
with source-code certainty from this repository.

The downstream CSV-to-game transformation is fully traceable and lossless for
the fields selected by the game.

## Pipeline overview

```text
Raw player-season/source rows (not present)
    |
    | group by player + club + decade
    | sum counting statistics
    | count seasons/source rows
    | calculate raw_score and ratings
    v
exports/club_decade_players.csv (4,157 rows)
    |
    | scripts/export_json_from_csv.py
    | remove rows with missing player_name
    | select and type-convert runtime fields
    v
public/data/players.json (4,156 rows)
    |
    | browser fetch("/data/players.json")
    v
Draft UI and season simulation
```

The aggregate CSV first entered Git as a prebuilt artifact in commit `c7a1b82`
(`Working draft engine`). That commit also added the JSON exporter and generated
JSON. No earlier data-generation implementation exists in the repository.

## Record grain

Each CSV row is identified by:

```text
club_decade_player_id =
    team/player club identity + decade + player_id
```

The related fields are:

- `player_id`: stable player identity.
- `team_id`: stable club/team identity.
- `club_decade_id`: club plus decade identity.
- `club_decade_player_id`: one player entry within that club-decade.

A player can therefore have multiple records for different clubs and decades.
The same player can also occur under more than one historical club identity.

## Aggregation method

The final CSV contains:

- `seasons_count`: number of distinct contributing seasons.
- `rows_count`: number of contributing source rows.
- `goals`, `assists`, `clean_sheets`, `goals_conceded`,
  `yellow_cards`, `direct_red_cards`, `penalty_goals`, and
  `minutes_played`: cumulative values over the grouped records.

Evidence that this is cumulative rather than average or peak:

- Values grow well beyond single-season scale: up to 91 goals, 61 assists,
  111 clean sheets, 209 goals conceded, and 19,308 minutes.
- 1,881 entries cover two or more seasons.
- `rows_count` can exceed `seasons_count`, showing that multiple source rows
  can contribute within the same season.
- `raw_score` generally increases as weighted cumulative production and
  contributing seasons increase.

No division by `seasons_count`, `rows_count`, appearances, or minutes occurs in
the checked-in JSON exporter.

## Goals and assists

`goals` and `assists` are already calculated in the aggregate CSV. The JSON
exporter only parses them:

- `goals` is parsed as a number and can retain a fractional representation from
  the CSV, although all current values are whole-number totals.
- `assists` is parsed as an integer.
- The exporter does not average, cap, rank, or otherwise transform either field.

The draft UI displays these cumulative club-decade totals in normal mode.

`penalty_goals` exists in the aggregate CSV but is not exported to the runtime
JSON. The displayed `goals` value includes the aggregate goal total; the
repository contains no downstream penalty-goal subtraction.

## Clean sheets

`clean_sheets` is a cumulative aggregate in the CSV and is parsed as an integer
for the runtime JSON. The UI displays it only when `game_position` is `GK`.

The field still exists as zero for non-goalkeepers. `goals_conceded` is retained
only in the aggregate CSV and is not included in `players.json`.

## Appearances

There is **no appearances field** in:

- `exports/club_decade_players.csv`
- `public/data/players.json`
- the runtime `DraftPlayer` type

Consequently, appearances are neither displayed nor directly used by current
gameplay code.

`rows_count` is not a safe substitute for appearances. It ranges from 1 to 13
and describes the number of contributing source records. `minutes_played` is
available in the aggregate CSV, but the JSON exporter drops it.

The data strongly suggests that an appearance or participation-derived component
was used upstream when calculating `raw_score`, but the source appearances and
that calculation were not retained. It cannot be reconstructed exactly.

## Raw score

`raw_score` is calculated before the data reaches this repository's exporter.
The exporter only copies it.

The current records support the following reconstructed decomposition:

```text
raw_score =
    5.0 * goals
  + 4.0 * assists
  + 1.5 * clean_sheets
  + omitted participation/adjustment component
```

For 3,448 of 4,157 aggregate rows, the final component is exactly:

```text
3.0 * seasons_count
```

For the other 709 rows it differs, always in half-point increments, ranging from
-1.0 to 30.0 in the current data. This is consistent with a summed upstream
participation or availability score plus occasional adjustments. It is not
possible to identify its exact inputs because appearances and the upstream
scoring code are missing.

This reconstruction proves that `raw_score` is based predominantly on cumulative
club-decade output. It is not an average-season score and is not a peak-season
selection.

## Local rating

`local_rating` compares a player with other entries in the same club-decade.
The data reproduces the following formula, rounded to one decimal:

```text
local_rating =
    50 + 45 * raw_score / max(raw_score in the club-decade)
```

The top-scoring player or tied players receive 95.0. A zero score receives 50.0.
All but one row reproduce exactly under ordinary decimal rounding; the single
0.1 difference is consistent with floating-point or rounding-mode behavior.

This rating is relative to the club-decade pool. It is not used by the current
season simulation.

## Global percentile

`global_percentile` is exactly the average-tie percentile rank of `raw_score`
across all 4,157 aggregate CSV rows:

```text
global_percentile =
    pandas-style rank(raw_score, method="average", pct=True)
```

For a tied score:

```text
(rows below score + (tie count + 1) / 2) / total rows
```

Examples:

| Raw score | Rows below | Tie count | Percentile |
|---:|---:|---:|---:|
| 0 | 0 | 4 | 0.0006013952 |
| 3 | 83 | 1,226 | 0.1675487130 |
| 31 | 3,318 | 23 | 0.8010584556 |
| 719.5 | 4,156 | 1 | 1.0 |

## Global rating

`global_rating` is a deterministic, monotonic transformation of global
`raw_score` rank. Every row with the same `raw_score` has the same
`global_percentile` and `global_rating`, regardless of club, decade, or position.

Observed range:

- Minimum: 45.0
- Maximum: 99.0
- Stored precision: one decimal

The curve behaves like a compressed percentile-to-rating scale: low and middle
percentiles rise gradually, while exceptional upper-tail scores reach the
90s. Representative mappings are:

| Raw score | Global percentile | Global rating |
|---:|---:|---:|
| 0 | 0.000601 | 45.0 |
| 3 | 0.167549 | 51.2 |
| 10 | 0.518884 | 63.6 |
| 31 | 0.801058 | 74.0 |
| 97 | 0.955617 | 85.0 |
| 198 | 0.989897 | 92.0 |
| 719.5 | 1.0 | 99.0 |

The exact percentile-to-rating function is not present in the repository.
Several common normal-quantile transformations approximate it, but none exactly
reproduces every stored value; presenting one as the original formula would be
unsupported.

## Hidden modifier and effective rating

The exact relationship is:

```text
effective_global_rating = global_rating * hidden_modifier
```

All 4,157 aggregate rows currently have:

```text
hidden_modifier = 1.0
```

Therefore, for every current player entry:

```text
effective_global_rating = global_rating
```

The modifier infrastructure exists, but it currently changes no player rating.

The season simulation uses:

```text
effective_global_rating ?? global_rating ?? 65
```

It averages the selected eleven players' effective ratings to obtain lineup
strength. Goals, assists, clean sheets, local rating, and global percentile do
not directly enter season simulation.

## CSV-to-runtime transformation

`scripts/export_json_from_csv.py` performs no statistical generation. It:

1. Reads `exports/club_decade_players.csv` as UTF-8 with optional BOM.
2. Removes rows whose `player_name` is blank, `nan`, `null`, or `none`.
3. Selects the runtime fields.
4. Converts strings to integers/floats and converts empty or non-finite values
   to JSON `null`.
5. Writes `public/data/players.json`.

One of the 4,157 aggregate rows has a missing player name, producing the 4,156
runtime player records loaded by the game.

The exporter intentionally drops provenance and audit fields including:

- `citizenship`
- `seasons_count`
- `rows_count`
- `goals_conceded`
- `yellow_cards`
- `direct_red_cards`
- `penalty_goals`
- `minutes_played`

## Runtime use

The draft component fetches `players.json` and groups entries by
`club_decade_id`. It filters candidates by formation position and already
selected `player_id`.

Normal mode displays:

- cumulative goals
- cumulative assists
- cumulative clean sheets for goalkeepers

Hardcore mode hides those statistics.

The result simulation uses only effective/global rating for player strength.

## Provenance limits

The following cannot be established exactly from the available repository:

- Original data provider and extraction method.
- Original appearance counts.
- Exact raw row grain and why some seasons produce multiple rows.
- Exact participation/adjustment term in `raw_score`.
- Exact percentile-to-`global_rating` curve.
- Whether upstream null handling or source-specific corrections occurred.

Recovering those details requires the missing pre-aggregation dataset, notebook,
SQL query, or script that produced `exports/club_decade_players.csv`.

## Classification

| Field | Method represented by current entry |
|---|---|
| Goals | Cumulative player-club-decade total |
| Assists | Cumulative player-club-decade total |
| Clean sheets | Cumulative player-club-decade total |
| Appearances | Not retained; cannot be recovered |
| Raw score | Weighted cumulative output plus an omitted participation/adjustment component |
| Local rating | Raw score normalized against the club-decade maximum |
| Global percentile | Average-tie percentile rank of raw score across all aggregate rows |
| Global rating | Stored nonlinear transformation of global raw-score rank; exact curve missing |
| Effective rating | Global rating multiplied by hidden modifier; currently identical to global rating |
