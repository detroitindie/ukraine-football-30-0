# Patch 1.2A Duplicate Player Audit

## Results

- Source rows audited: 4279
- Candidate pairs found: 24
- High-confidence duplicate pairs: 15
- Distinct high-confidence identities: 8
- Manual-review pairs: 9
- Source rows after cleanup: 4264
- Cleanup applied: yes

## Method

- Candidates are compared only within the same `club_decade_id`.
- Positions must share `game_position` or `main_position`.
- Names are Unicode/case normalized and folded for common Ukrainian/Russian
  transliteration variants including `g/h`, `kh/h`, `i/y/yi/iy`, and
  `skyi/sky`.
- A dependency-free Levenshtein distance and sequence similarity identify
  broader candidates.
- Automatic deletion is restricted to the explicit reviewed identity map in
  `scripts/audit_duplicate_players.py`; fuzzy similarity alone is manual-only.

## Merge Policy

- The record with more populated source statistics is retained.
- Missing values are filled from the removed record where available.
- Goals, assists, and clean sheets from the better-supported record are never
  replaced by blanks.
- When ratings differ, the rating attached to the better-supported statistical
  record is retained. No rating is averaged or recomputed.
- Canonical names use modern Ukrainian-style English transliteration only on
  rows involved in a duplicate merge.

## Risks

- Fuzzy matching can surface legitimate different players; all non-reviewed
  pairs remain unchanged in `duplicate_players_manual_review.csv`.
- Source statistics may still be incomplete even after preserving all
  non-null values.
- The explicit identity map should be reviewed when future data imports add
  new transliteration conventions.
