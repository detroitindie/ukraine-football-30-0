# Patch 1.1 Import Summary

## Status

- Production data applied: yes
- Candidate passes included: legends, core_squad, first_pass
- Long Tail pass included: no

## Decisions

- Planned/imported club-decade entries: 122
- Unique planned/imported players: 71
- Skipped duplicate entries: 0
- Manual review entries: 77
- Legends entries: 63
- Core squad entries: 34
- First pass entries: 25

## Reconstructed Statistics

- Entries with goals: 12
- Entries with assists: 0
- Entries with clean sheets: 0
- Entries with seasons count: 68

## Policy

- Blank source statistics remain blank/null; zero is retained only when explicitly present in the enrichment CSV.
- Low-confidence and spelling/transliteration/identity-risk rows are held for manual review.
- A stable synthetic player ID is shared by all imported club-decade entries for the same normalized player.
- Ratings are bounded to 48-92 and use reconstructed raw score only when sufficient performance data exists. Otherwise they use the source-pass priority and the existing same-position or overall club-decade rating distribution.
