# Andriy Glushchenko Data Correction

## Why this row was added
- The pre-release audit confirmed that no Andriy/Andrii/Andrey Glushchenko row existed in the checked-in source data.
- Metalurg Zaporizhya 2000s already has League eligibility, so adding the missing goalkeeper row makes him available in both League and Cup after regeneration.

## Source note
- Player id: `24401`
- Club/decade: `Metalurg Zaporizhya / 2000s`
- Position: `Goalkeeper / GK`
- Available source stats: 141 matches, 166 goals conceded
- Clean sheets were not provided, so they were left empty instead of being invented.

## Rating fallback
- The rating fields were copied from `Vitaliy Postranskyi (34670)` for the same club/decade/position:
  - raw_score: `45.0`
  - local_rating: `65.1`
  - global_rating: `77.7`
  - global_percentile: `0.8707000240558095`
  - hidden_modifier: `1.0`
  - effective_global_rating: `77.7`

