# Pre-release Player Data Audit

## Scope
- Read-only audit of the checked-in runtime datasets and generated Cup pool.
- No production data files were modified.

## Task 1: Andriy Glushchenko / Metalurh Zaporizhzhia 2000s

### Search result
- No exact or fuzzy `Andriy/Andrii/Andrey Glushchenko/Hlushchenko` row was found in `public/data/players.json`, `public/data/roll_pool.json`, `public/data/cup_roll_pool.json`, or `exports/club_decade_players.csv`.
- `Anton Glushchenko (717392)` exists in other club/decade rows, but that is a different player and not a duplicate of Andriy Glushchenko.

### Metalurh Zaporizhzhia 2000s GK rows found
| club_decade_player_id | player_id | player_name | team_id | club | decade | position | game_position | goals | assists | clean_sheets | raw_score | local_rating | global_rating | global_percentile | hidden_modifier | effective_global_rating |
|---|---:|---|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 6994_metalurg_zaporizhya_2000s_34670 | 34670 | Vitaliy Postranskyi (34670) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 22 | 45.0 | 65.1 | 77.7 | 0.8707000240558095 | 1.0 | 77.7 |
| 6994_metalurg_zaporizhya_2000s_59933 | 59933 | Stanislav Bogush (59933) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 9 | 28.5 | 59.6 | 73.4 | 0.7840991099350493 | 1.0 | 73.4 |
| 6994_metalurg_zaporizhya_2000s_120211 | 120211 | Maksym Koval (120211) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 6 | 12.0 | 54.0 | 65.5 | 0.5752946836661054 | 1.0 | 65.5 |
| 6994_metalurg_zaporizhya_2000s_59447 | 59447 | Andriy Tlumak (59447) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 3 | 7.5 | 52.5 | 61.1 | 0.44274717344238634 | 1.0 | 61.1 |
| 6994_metalurg_zaporizhya_2000s_269351 | 269351 | Maksym Kuchynskyi (269351) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 0 | 3.0 | 51.0 | 51.2 | 0.16754871301419294 | 1.0 | 51.2 |
| 6994_metalurg_zaporizhya_2000s_847553 | 847553 | Yuriy Khriyenko (847553) | 6994 | Metalurg Zaporizhya | 2000s | Goalkeeper | GK | 0.0 | 0 | 0 | 3.0 | 51.0 | 51.2 | 0.16754871301419294 | 1.0 | 51.2 |

### Confirmation
- The closest same-club, same-decade, same-position reference is `Vitaliy Postranskyi (34670)` (6994_metalurg_zaporizhya_2000s_34670).
- If a new Andriy Glushchenko row needs to be added later, the safe source shape would need to match the existing `exports/club_decade_players.csv` schema for a goalkeeper row in that club/decade, then be regenerated into `public/data/players.json` by the exporter.
- The current exporter is a pass-through from `exports/club_decade_players.csv`; it does not derive a brand-new player row from raw match counts alone.
- `Vitaliy Postranskyi` exists in `Metalurg Zaporizhya / 2000s` and is available as the closest rating/reference row if a fallback is needed.

## Task 2: Fuzzy duplicate audit in expanded Cup pool

### Method
- Checked the expanded Cup pool (`public/data/cup_roll_pool.json` + `public/data/players.json`) for identical canonical names with different `player_id` values.
- Also checked surname-bucketed near-matches using transliteration folding for `H/G`, `y/iy/ii`, and common given-name families (`Oleksandr`, `Andriy`, `Serhiy`, `Dmytro`, `Yuriy`).
- Excluded rows that share the same `player_id`, because those are valid multi-club / multi-decade representations of the same player.

### Result
- High-confidence suspicious pairs found: 0
- Medium-confidence suspicious pairs found: 0
- Low-confidence suspicious pairs found: 0
- No suspicious different-`player_id` duplicates were found under the tested heuristics.

### Notes
- Valid same-player multi-row entries remain in the Cup pool and were not treated as bugs.
- Examples of valid repeated `player_id` rows include `Vitaliy Postranskyi (34670)`, `Andriy Demchenko (8829783)`, `Oleksiy Godin (8602786)`, and `Dmytro Nevmyvaka (8713027)` across multiple club/decade rows.

## Sources checked
- `public/data/players.json`
- `public/data/roll_pool.json`
- `public/data/cup_roll_pool.json`
- `exports/club_decade_players.csv`
