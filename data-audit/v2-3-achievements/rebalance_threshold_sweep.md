# v2.3 Rebalance Threshold Sweep

Generated: 2026-07-11T14:14:20.176Z
Seed: 2303
League threshold iterations per bucket: 100000
Draft iterations per competition/formation: 100000
Runtime: 205.42s

## Bavovna

Current production threshold: goalsFor >= 100
Recommended audit threshold: goalsFor >= 80
Closest tested strong/elite average frequency to an epic/legendary 0.1%-1% target: 0.5165%.

| Bucket | Max GF | p90 | p95 | p99 | p99.9 |
|---|---:|---:|---:|---:|---:|
| weak | 45 | 25 | 27 | 30 | 34 |
| average | 63 | 42 | 44 | 48 | 54 |
| strong | 81 | 57 | 59 | 65 | 70 |
| elite | 95 | 71 | 74 | 80 | 86 |

## Defense Optional

Current production threshold: goalsFor >= 80 and goalsAgainst >= 60
Recommended audit thresholds: goalsFor >= 55, goalsAgainst >= 40
Preserves high-scoring chaotic result and lands near the 0.1%-1% average/strong target: 0.1905%.

## Different Eras

Recommended alternative: balanced
Recommended alternative keeps the achievement visible while avoiding the current majority-of-runs frequency.

| Alternative | Frequency | At least one achievement | Avg achievements/run | Zero | One | Two | Three+ |
|---|---:|---:|---:|---:|---:|---:|---:|
| current | 68.3922% | 97.8674% | 2.9878 | 25591 | 146611 | 294393 | 733405 |
| balanced | 21.2792% | 93.9735% | 2.5167 | 72318 | 225996 | 331899 | 569787 |
| edge_eras | 32.4963% | 94.8810% | 2.6289 | 61428 | 206783 | 322236 | 609553 |
| no_dominant_era | 37.9705% | 95.6283% | 2.6836 | 52461 | 196378 | 321904 | 629257 |

## Zrada Verification

Player matches from Russia/Belarus citizenship only: 819664
Player matches from manual flagged-player set only: 30434
Player matches satisfying both: 40288
Runs containing at least one unique match: 646614 (53.8845%)
Runs containing at least two unique matches: 198940 (16.5783%)

Top manual override player IDs:
- 4602: 17448
- 59908: 7052
- 89222: 4396
- 118850: 2873
- 712857: 2696
- 8562832: 896

Top Russia/Belarus citizenship strings:
- Russia: 376413
- Belarus: 62818

## Projected Overall Frequency

Using the recommended Different Eras replacement only: at least one achievement 93.9735%, average achievements/run 2.5167.

No production condition changes were made.
