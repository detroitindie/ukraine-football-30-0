# Patch 1.2A: 30-0-0 Balance Audit Before

## Verdict

- **30-0-0 is possible under the current simulation without any changes.**
- Distinct valid 30-0-0 lineups found: **25**.
- Unique elite lineups evaluated before stopping: **43580**.
- Target of at least 10 viable distinct lineups: **passed**.
- Gameplay adjustment recommended: **none**.

The search stops after finding 25 perfect lineups, so the count is
a demonstrated lower bound rather than the total number present in the full
lineup space.

## Current Simulation

- Team strength is the arithmetic mean of the 11 players'
  `effective_global_rating`, falling back to `global_rating` and then 65.
- Strength is clamped to 45-95. The highest-rating legal lineup found has average
  strength **94.59**, so the
  upper cap does not reduce it.
- Each of 30 matches compares that single team-strength value with a fixed
  opponent-strength list ranging from 54 to 79.
- Expected goals use small strength-difference coefficients and a home/away
  factor, then both teams' scores are sampled from capped Poisson distributions.
- Randomness exists, but its seed is the sorted set of
  `player_id:club_decade_id` values. The same lineup therefore always receives
  the same result; replaying it does not reroll the season.
- Formation matters for draft eligibility only. Once the lineup is complete,
  every player contributes equally to the average strength.
- Draft validity requires all 11 configured slots, compatible
  `game_position`, a reachable roll-pool club-decade, and distinct `player_id`
  values.

## Data And Formation Constraints

- Runtime player rows: 4263
- Reachable roll-pool player rows: 4132
- Reachable distinct player IDs: 1705
- Formation slots: 11
- Every slot has multiple elite options; no position blocks a high-end lineup.

## Strongest Rating Lineup

- Deterministic result: **26-4-0, 69-9 goals**
- Average strength: **94.59**

The highest-rating lineup found is not automatically the best result because the
lineup identity also controls the deterministic random sequence. Its
4 draw(s) show that the bottleneck is elite-level match
variance, not insufficient ratings or an unreachable threshold.

### Perfect Lineups Found

#### Lineup 1: 30-0-0, 85-17 goals

- Average strength: 89.81

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Yevgen Volynets | GK | 80.7 | Kolos Kovalivka / 2020s |
| LB | Răzvan Raț | LB | 85.9 | Shakhtar Donetsk / 2000s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| CB | Yaroslav Rakitskyi | CB | 89.0 | Shakhtar Donetsk / 2010s |
| RB | Vasyl Kobin | RB | 87.2 | Karpaty Lviv / 2000s |
| CM | Anatoliy Tymoshchuk | CDM | 92.0 | Shakhtar Donetsk / 2000s |
| AM/CM | Georgiy Sudakov | AM | 93.5 | Shakhtar Donetsk / 2020s |
| LM | Benjamin Verbic | LM | 89.1 | Dynamo Kyiv / 2010s |
| RM | Oleg Gusev | RM | 92.0 | Dynamo Kyiv / 2010s |
| AM/FW | Jádson | AM | 95.6 | Shakhtar Donetsk / 2000s |
| FW | Oleksandr Gladkyi | FW | 93.2 | Shakhtar Donetsk / 2000s |

#### Lineup 2: 30-0-0, 76-12 goals

- Average strength: 90.74

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Andriy Pyatov | GK | 91.9 | Shakhtar Donetsk / 2010s |
| LB | Vitaliy Mykolenko | LB | 80.9 | Dynamo Kyiv / 2010s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| RB | Igor Perduta | RB | 84.9 | Vorskla Poltava / 2010s |
| CM | Matuzalém | CDM | 92.2 | Shakhtar Donetsk / 2000s |
| AM/CM | Alan Patrick | AM | 88.3 | Shakhtar Donetsk / 2010s |
| LM | Mohammed Rharsalla | LM | 86.7 | Olimpik Donetsk ( - 2021) / 2010s |
| RM | Andriy Yarmolenko | RM | 99.0 | Dynamo Kyiv / 2010s |
| AM/FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |
| FW | Luiz Adriano | FW | 96.7 | Shakhtar Donetsk / 2010s |

#### Lineup 3: 30-0-0, 79-11 goals

- Average strength: 91.21

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Andriy Pyatov | GK | 91.9 | Shakhtar Donetsk / 2010s |
| LB | Răzvan Raț | LB | 85.9 | Shakhtar Donetsk / 2000s |
| CB | Ayila Yussuf | CB | 83.6 | Dynamo Kyiv / 2000s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Corrêa | CDM | 88.2 | Dynamo Kyiv / 2000s |
| AM/CM | Cleiton Xavier | AM | 95.9 | Metalist Kharkiv / 2010s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Volodymyr Arzhanov | RM | 87.3 | Metalurg Zaporizhya / 2000s |
| AM/FW | Andriy Shevchenko | FW | 96.3 | Dynamo Kyiv / 1990s |
| FW | Serhiy Rebrov | FW | 92.0 | Dynamo Kyiv / 1990s |

#### Lineup 4: 30-0-0, 87-8 goals

- Average strength: 90.80

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Oleksandr Horyainov | GK | 89.5 | Metalist Kharkiv / 2000s |
| LB | Cristian Villagra | LB | 83.0 | Metalist Kharkiv / 2010s |
| CB | Volodymyr Chesnakov | CB | 85.7 | Vorskla Poltava / 2010s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| RB | Pavlo Ksyonz | RB | 85.2 | Karpaty Lviv / 2010s |
| CM | Oleh Holodyuk | CM | 85.6 | Karpaty Lviv / 2010s |
| AM/CM | Jádson | AM | 95.6 | Shakhtar Donetsk / 2000s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Andriy Yarmolenko | RM | 99.0 | Dynamo Kyiv / 2010s |
| AM/FW | Dieumerci Mbokani | FW | 91.1 | Dynamo Kyiv / 2010s |
| FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |

#### Lineup 5: 30-0-0, 68-8 goals

- Average strength: 91.75

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Anatoliy Trubin | GK | 80.0 | Shakhtar Donetsk / 2020s |
| LB | Andriy Nesmachnyi | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Oleksandr Sklyar | CM | 89.2 | Vorskla Poltava / 2020s |
| AM/CM | Cleiton Xavier | AM | 95.9 | Metalist Kharkiv / 2010s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Maryan Shved | RM | 89.3 | Karpaty Lviv / 2010s |
| AM/FW | Andriy Shevchenko | FW | 96.3 | Dynamo Kyiv / 1990s |
| FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |

#### Lineup 6: 30-0-0, 83-10 goals

- Average strength: 90.58

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Maksym Koval | GK | 83.1 | Dynamo Kyiv / 2010s |
| LB | Ismaily | LB | 91.6 | Shakhtar Donetsk / 2010s |
| CB | Yaroslav Rakitskyi | CB | 89.0 | Shakhtar Donetsk / 2010s |
| CB | Domagoj Vida | CB | 84.1 | Dynamo Kyiv / 2010s |
| RB | Igor Kyryukhantsev | RB | 81.6 | Zorya Lugansk / 2020s |
| CM | Ihor Khudobiak | CM | 91.7 | Karpaty Lviv / 2010s |
| AM/CM | Cleiton Xavier | AM | 95.9 | Metalist Kharkiv / 2010s |
| LM | Benjamin Verbic | LM | 89.1 | Dynamo Kyiv / 2010s |
| RM | Marlos | RM | 98.0 | Shakhtar Donetsk / 2010s |
| AM/FW | Artem Milevskyi | FW | 96.5 | Dynamo Kyiv / 2000s |
| FW | Yevgen Seleznyov | FW | 95.8 | Dnipro Dnipropetrovsk (- 2020) / 2010s |

#### Lineup 7: 30-0-0, 90-8 goals

- Average strength: 91.76

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Yevgen Volynets | GK | 80.7 | Kolos Kovalivka / 2020s |
| LB | Andriy Nesmachnyi | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Volodymyr Brazhko | CDM | 83.6 | Dynamo Kyiv / 2020s |
| AM/CM | Henrikh Mkhitaryan | CM | 94.1 | Shakhtar Donetsk / 2010s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Marlos | RM | 98.0 | Shakhtar Donetsk / 2010s |
| AM/FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |
| FW | Artem Dovbyk | FW | 94.9 | SC Dnipro-1 / 2020s |

#### Lineup 8: 30-0-0, 94-8 goals

- Average strength: 90.97

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Oleksandr Horyainov | GK | 89.5 | Metalist Kharkiv / 2000s |
| LB | Yuriy Dmytrulin | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| RB | Pavlo Ksyonz | RB | 85.2 | Karpaty Lviv / 2010s |
| CM | Matuzalém | CDM | 92.2 | Shakhtar Donetsk / 2000s |
| AM/CM | Artem Bondarenko | AM | 93.4 | Shakhtar Donetsk / 2020s |
| LM | Pavlo Rebenok | LM | 92.0 | Vorskla Poltava / 2010s |
| RM | Oleksandr Zubkov | RM | 89.2 | Shakhtar Donetsk / 2020s |
| AM/FW | Alex Teixeira | FW | 97.1 | Shakhtar Donetsk / 2010s |
| FW | Yevgen Seleznyov | FW | 95.8 | Dnipro Dnipropetrovsk (- 2020) / 2010s |

#### Lineup 9: 30-0-0, 92-8 goals

- Average strength: 91.39

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Yuriy Virt | GK | 80.0 | Metalurg Donetsk (- 2015) / 2000s |
| LB | Vyacheslav Shevchuk | LB | 84.5 | Shakhtar Donetsk / 2010s |
| CB | Yaroslav Rakitskyi | CB | 89.0 | Shakhtar Donetsk / 2010s |
| CB | Mykola Matvienko | CB | 85.8 | Shakhtar Donetsk / 2020s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Miguel Veloso | CDM | 84.8 | Dynamo Kyiv / 2010s |
| AM/CM | Sergiy Nazarenko | AM | 95.0 | Dnipro Dnipropetrovsk (- 2020) / 2000s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Andriy Yarmolenko | RM | 99.0 | Dynamo Kyiv / 2010s |
| AM/FW | Yevgen Seleznyov | FW | 95.8 | Dnipro Dnipropetrovsk (- 2020) / 2010s |
| FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |

#### Lineup 10: 30-0-0, 92-11 goals

- Average strength: 91.78

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Oleksandr Horyainov | GK | 89.5 | Metalist Kharkiv / 2000s |
| LB | Ismaily | LB | 91.6 | Shakhtar Donetsk / 2010s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| RB | Pavlo Ksyonz | RB | 85.2 | Karpaty Lviv / 2010s |
| CM | Fernandinho | CDM | 93.3 | Shakhtar Donetsk / 2000s |
| AM/CM | Denys Garmash | AM | 94.0 | Dynamo Kyiv / 2010s |
| LM | Maksym Tretyakov | LM | 87.0 | FC Oleksandriya / 2020s |
| RM | Marlos | RM | 98.0 | Shakhtar Donetsk / 2010s |
| AM/FW | Alex Teixeira | FW | 97.1 | Shakhtar Donetsk / 2010s |
| FW | Vladyslav Vanat | FW | 95.4 | Dynamo Kyiv / 2020s |


### Best Search Results

#### Lineup 1: 30-0-0, 94-8 goals

- Average strength: 90.97

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Oleksandr Horyainov | GK | 89.5 | Metalist Kharkiv / 2000s |
| LB | Yuriy Dmytrulin | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| RB | Pavlo Ksyonz | RB | 85.2 | Karpaty Lviv / 2010s |
| CM | Matuzalém | CDM | 92.2 | Shakhtar Donetsk / 2000s |
| AM/CM | Artem Bondarenko | AM | 93.4 | Shakhtar Donetsk / 2020s |
| LM | Pavlo Rebenok | LM | 92.0 | Vorskla Poltava / 2010s |
| RM | Oleksandr Zubkov | RM | 89.2 | Shakhtar Donetsk / 2020s |
| AM/FW | Alex Teixeira | FW | 97.1 | Shakhtar Donetsk / 2010s |
| FW | Yevgen Seleznyov | FW | 95.8 | Dnipro Dnipropetrovsk (- 2020) / 2010s |

#### Lineup 2: 30-0-0, 92-8 goals

- Average strength: 91.39

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Yuriy Virt | GK | 80.0 | Metalurg Donetsk (- 2015) / 2000s |
| LB | Vyacheslav Shevchuk | LB | 84.5 | Shakhtar Donetsk / 2010s |
| CB | Yaroslav Rakitskyi | CB | 89.0 | Shakhtar Donetsk / 2010s |
| CB | Mykola Matvienko | CB | 85.8 | Shakhtar Donetsk / 2020s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Miguel Veloso | CDM | 84.8 | Dynamo Kyiv / 2010s |
| AM/CM | Sergiy Nazarenko | AM | 95.0 | Dnipro Dnipropetrovsk (- 2020) / 2000s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Andriy Yarmolenko | RM | 99.0 | Dynamo Kyiv / 2010s |
| AM/FW | Yevgen Seleznyov | FW | 95.8 | Dnipro Dnipropetrovsk (- 2020) / 2010s |
| FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |

#### Lineup 3: 30-0-0, 90-8 goals

- Average strength: 91.76

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Yevgen Volynets | GK | 80.7 | Kolos Kovalivka / 2020s |
| LB | Andriy Nesmachnyi | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| RB | Darijo Srna | RB | 96.1 | Shakhtar Donetsk / 2010s |
| CM | Volodymyr Brazhko | CDM | 83.6 | Dynamo Kyiv / 2020s |
| AM/CM | Henrikh Mkhitaryan | CM | 94.1 | Shakhtar Donetsk / 2010s |
| LM | Taison | LM | 96.8 | Shakhtar Donetsk / 2010s |
| RM | Marlos | RM | 98.0 | Shakhtar Donetsk / 2010s |
| AM/FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |
| FW | Artem Dovbyk | FW | 94.9 | SC Dnipro-1 / 2020s |

#### Lineup 4: 30-0-0, 92-11 goals

- Average strength: 91.78

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Oleksandr Horyainov | GK | 89.5 | Metalist Kharkiv / 2000s |
| LB | Ismaily | LB | 91.6 | Shakhtar Donetsk / 2010s |
| CB | Goran Gavrancic | CB | 89.7 | Dynamo Kyiv / 2000s |
| CB | Denis Glavina | CB | 88.8 | Vorskla Poltava / 2000s |
| RB | Pavlo Ksyonz | RB | 85.2 | Karpaty Lviv / 2010s |
| CM | Fernandinho | CDM | 93.3 | Shakhtar Donetsk / 2000s |
| AM/CM | Denys Garmash | AM | 94.0 | Dynamo Kyiv / 2010s |
| LM | Maksym Tretyakov | LM | 87.0 | FC Oleksandriya / 2020s |
| RM | Marlos | RM | 98.0 | Shakhtar Donetsk / 2010s |
| AM/FW | Alex Teixeira | FW | 97.1 | Shakhtar Donetsk / 2010s |
| FW | Vladyslav Vanat | FW | 95.4 | Dynamo Kyiv / 2020s |

#### Lineup 5: 30-0-0, 84-3 goals

- Average strength: 89.46

| Slot | Player | Position | Rating | Club-decade |
| --- | --- | --- | ---: | --- |
| GK | Andriy Pyatov | GK | 91.9 | Shakhtar Donetsk / 2010s |
| LB | Andriy Nesmachnyi | LB | 88.2 | Dynamo Kyiv / 1990s |
| CB | Vladyslav Vashchuk | CB | 89.3 | Dynamo Kyiv / 1990s |
| CB | Ayila Yussuf | CB | 83.6 | Dynamo Kyiv / 2000s |
| RB | Denys Kulakov | RB | 83.1 | Vorskla Poltava / 2000s |
| CM | Oleksandr Sklyar | CM | 89.2 | Vorskla Poltava / 2020s |
| AM/CM | Vasil Gigiadze | AM | 92.7 | Tavriya Simferopol / 2000s |
| LM | Dmytro Khomchenovskyi | LM | 91.4 | Zorya Lugansk / 2010s |
| RM | Vladyslav Kalitvintsev | RM | 81.9 | Desna Chernigiv / 2020s |
| AM/FW | Maksim Shatskikh | FW | 98.5 | Dynamo Kyiv / 2000s |
| FW | Eduardo | FW | 94.3 | Shakhtar Donetsk / 2010s |


## Counterfactual Random-Seed Trials

These trials hold strength constant and vary only the random seed. They do not
change live gameplay; they estimate how rare a perfect season is at each elite
strength level.

| Strength | Perfect seasons | Estimated probability |
| ---: | ---: | ---: |
| 85 | 0/20000 | 0.000% |
| 88 | 1/20000 | 0.005% |
| 90 | 5/20000 | 0.025% |
| 92 | 18/20000 | 0.090% |
| 94 | 40/20000 | 0.200% |
| 95 | 65/20000 | 0.325% |

## Bottlenecks

- **Ratings:** not a blocker. Valid lineups can exceed 90 average strength.
- **Thresholds/caps:** not a blocker. The strongest lineup remains below the
  95 strength cap, and no record-mapping threshold prevents 30 wins.
- **Formation:** not a blocker. All required positions have sufficient elite
  depth in reachable club-decades.
- **Randomness:** the main limiting factor. Even elite expected-goal advantages
  leave a small chance of a draw or loss in every match.
- **Deterministic seed:** makes the challenge lineup-specific. A near-identical
  legal lineup may receive a different 30-match random sequence.

## Balance Decision

No simulation tweak is implemented. The current system already produces more
than 10 demonstrated legal perfect-season lineups while keeping the
counterfactual probability around a few tenths of one percent even at the
extreme top end. Increasing elite output would make 30-0-0 less exceptional
without solving an actual reachability problem.

## Audit Method And Limits

- The script mirrors the TypeScript hash, random generator, Poisson sampler,
  expected-goal formulas, clamps, and opponent list.
- Candidate generation is deterministic and biased toward the top 40 players
  available for each slot, with 80% of choices drawn from the top 12.
- The search is not an exhaustive enumeration of the enormous valid lineup
  space. The reported perfect count is only what was directly demonstrated.
- Run with `npm run audit:30-0` to regenerate this report.
