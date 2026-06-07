# Current Game Player Entries Audit

## Totals

- Total rows exported: 4156
- Total unique normalized players: 1649
- Total clubs: 54
- Total club-decade combinations: 115
- Rows in a currently eligible roll-pool club-decade: 4032
- Rows outside the currently eligible roll pool: 124

## Duplicate Player Examples

- Volodymyr Lysenko: 12 entries across Arsenal Kyiv ( -2019) (2000s); Dynamo Kyiv (2000s); FC Sevastopol (- 2014) (2010s); Goverla Uzhgorod (- 2016) (2010s); Goverla-Zakarpattya Uzhgorod (2010s); Kolos Kovalivka (2010s); Kolos Kovalivka (2020s); Kryvbas Kryvyi Rig (2010s); Metalist Kharkiv (2000s); Metalist Kharkiv (2010s); Olimpik Donetsk ( - 2021) (2010s); Volyn Lutsk (2010s)
- Sergiy Dolganskyi: 11 entries across CSKA Kyiv (1990s); CSKA Kyiv (2000s); Chornomorets Odesa (1990s); Kryvbas Kryvyi Rig (1990s); Metalist Kharkiv (1990s); Metalurg Donetsk (- 2015) (2000s); Shakhtar Donetsk (2000s); Veres Rivne (1990s); Vorskla Poltava (2000s); Vorskla Poltava (2010s); Vorskla-Naftogaz Poltava (2000s)
- Volodymyr Yezerskyi: 11 entries across Dnipro Dnipropetrovsk (- 2020) (2000s); Dnipro Dnipropetrovsk (2000s); Dynamo Kyiv (1990s); Dynamo Kyiv (2000s); Goverla Uzhgorod (- 2016) (2010s); Karpaty Lviv (1990s); Kryvbas Kryvyi Rig (1990s); SC Tavriya Simferopol (-2022) (2010s); Shakhtar Donetsk (2000s); Zorya Lugansk (2000s); Zorya Lugansk (2010s)
- Maksim Startsev: 10 entries across Dnipro Dnipropetrovsk (- 2020) (2000s); Dnipro Dnipropetrovsk (1990s); Dnipro Dnipropetrovsk (2000s); Kryvbas Kryvyi Rig (2000s); Metalist Kharkiv (2010s); Metalurg Zaporizhya (2010s); SC Tavriya Simferopol (-2022) (2000s); SC Tavriya Simferopol (-2022) (2010s); Tavriya Simferopol (2000s); Volyn Lutsk (2010s)
- Oleksandr Gladkyi: 10 entries across Chornomorets Odesa (2010s); Chornomorets Odesa (2020s); Dnipro Dnipropetrovsk (- 2020) (2010s); Dynamo Kyiv (2010s); FK Kharkiv (-2010) (2000s); Karpaty Lviv (2010s); Metalist Kharkiv (2000s); Shakhtar Donetsk (2000s); Shakhtar Donetsk (2010s); Zorya Lugansk (2020s)
- Oleksandr Romanchuk: 10 entries across Arsenal Kyiv ( -2019) (2000s); Arsenal Kyiv ( -2019) (2010s); Dnipro Dnipropetrovsk (- 2020) (2000s); Dynamo Kyiv (2000s); Kryvbas Kryvyi Rig (2020s); Metalist Kharkiv (2010s); PFC Lviv (2020s); SC Tavriya Simferopol (-2022) (2010s); Volyn Lutsk (2010s); Vorskla Poltava (2010s)
- Rustam Khudzhamov: 10 entries across Dynamo Kyiv (2000s); FC Mariupol (2010s); FK Kharkiv (-2010) (2000s); Illichivets Mariupol (2010s); Metalist Kharkiv (2010s); Metalurg Donetsk (- 2015) (2010s); Shakhtar Donetsk (2000s); Shakhtar Donetsk (2010s); Zakarpattya Uzhgorod (2000s); Zorya Lugansk (2010s)
- Valeriy Fedorchuk: 10 entries across Dnipro Dnipropetrovsk (- 2020) (2010s); Dynamo Kyiv (2010s); FC Mariupol (2010s); Karpaty Lviv (2010s); Kryvbas Kryvyi Rig (2000s); Kryvbas Kryvyi Rig (2010s); NK Veres Rivne (2010s); PFC Lviv (2000s); Rukh Lviv (2020s); Volyn Lutsk (2010s)
- Vsevolod Romanenko: 10 entries across Dynamo Kyiv (1990s); Illichivets Mariupol (2000s); Illichivets Mariupol (2010s); Karpaty Lviv (2000s); Obolon Kyiv (-2012) (2000s); Tavriya Simferopol (1990s); Tavriya Simferopol (2000s); Volyn Lutsk (2000s); Volyn Lutsk (2010s); Zakarpattya Uzhgorod (2000s)
- Andriy Bogdanov: 9 entries across Arsenal Kyiv ( -2019) (2000s); Arsenal Kyiv ( -2019) (2010s); Desna Chernigiv (2010s); Dynamo Kyiv (2010s); Kolos Kovalivka (2010s); Kolos Kovalivka (2020s); Metalist Kharkiv (2010s); Olimpik Donetsk ( - 2021) (2010s); Volyn Lutsk (2010s)

## Assumptions

- The authoritative set for this audit is `public/data/players.json`, because the draft UI loads that file directly at runtime.
- Every row in `players.json` is exported, including rows whose club-decade is not currently present in `public/data/roll_pool.json`. The roll-pool counts above make that distinction explicit.
- `player_name` matches the in-game display name by removing the trailing numeric ID in parentheses. The original numeric value remains in `player_id`.
- Normalized names are Unicode-decomposed, stripped of combining marks, case-folded, converted from punctuation to spaces, and whitespace-collapsed.
- `nationality` is joined read-only from `exports/club_decade_players.csv` using `club_decade_player_id`; the runtime JSON does not contain nationality.
- `position` uses the detailed runtime `position` value. `effective_rating` uses `effective_global_rating`, the value used first by season simulation.
- Club and club-decade totals use `team_id` and `club_decade_id`, respectively.
