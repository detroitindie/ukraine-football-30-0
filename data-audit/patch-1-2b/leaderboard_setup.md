# Patch 1.2B Global Leaderboard Setup

## Architecture

The application uses Supabase Postgres through the Supabase REST API.

- The browser calls `/api/leaderboard`.
- The Next.js route handler validates nickname, mode, formation, unique players,
  and the complete 30-game result.
- The route handler reruns the existing deterministic season simulation and
  rejects a result that does not match.
- Only the sanitized public lineup is inserted into Supabase.
- The Supabase anonymous key is used. No service-role key is required or
  permitted in the frontend.

The public lineup stores only player name, game position, formation slot, and
position label. Club, decade, ratings, player IDs, simulation debug values, and
unrelated player statistics are not stored. Older rows that already contain
rating fields remain readable, but the public UI ignores those fields.

For an existing Patch 1.2B installation, run
`supabase/migrations/20260609_remove_public_leaderboard_ratings.sql` in the
Supabase SQL Editor before deploying this UI update. It updates only lineup
payload validation; existing leaderboard rows are not rewritten.

## 1. Create The Supabase Project

1. Create a project at <https://supabase.com/dashboard>.
2. Open **Project Settings > API**.
3. Record:
   - Project URL
   - Project API anonymous/publishable key
4. Do not copy the service-role key into this project or Vercel.

## 2. Apply The SQL Migration

Open **SQL Editor** in Supabase and run:

`supabase/migrations/20260609_create_leaderboard_entries.sql`

For a project where the original Patch 1.2B migration has already been
applied, run only:

`supabase/migrations/20260609_remove_public_leaderboard_ratings.sql`

The migration creates:

- `public.leaderboard_entries`;
- record, nickname, mode, points, and lineup constraints;
- separate partial ranking indexes for normal and hardcore modes;
- Row Level Security;
- public `SELECT`;
- public validated `INSERT`;
- no public `UPDATE` or `DELETE`.

The application additionally validates submissions server-side. RLS and table
constraints are a second layer, not a replacement for application validation.

## 3. Environment Variables

Required:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

These names are public by design. The anonymous key is restricted by Row Level
Security and table grants.

Never add:

```env
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Local Setup

Create `.env.local` in the repository root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

`.env.local` is already ignored by Git.

Restart `npm run dev` after changing environment variables.

## 5. Vercel Setup

1. Open the project in Vercel.
2. Go to **Settings > Environment Variables**.
3. Add `NEXT_PUBLIC_SUPABASE_URL`.
4. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Enable them for Production, Preview, and Development as appropriate.
6. Redeploy after adding or changing either value. `NEXT_PUBLIC_` variables are
   embedded at build time.

## 6. Manual Test Plan

### Configuration and reads

1. Start the app without Supabase variables.
2. Confirm home, result, and `/leaderboard` show the localized load-error state.
3. Configure Supabase and restart the app.
4. Confirm empty normal and hardcore tabs show the localized empty state.

### Submission validation

1. Complete a normal-mode draft.
2. Confirm submission is optional and **Skip** removes the form.
3. Try a one-character nickname and confirm it is rejected.
4. Try leading/trailing and repeated whitespace; confirm the stored nickname is
   trimmed and collapsed.
5. Submit a valid nickname.
6. Confirm the success message appears.
7. Confirm the same result screen cannot accidentally submit again.
8. Confirm the compact result-page leaderboard refreshes.
9. Repeat with a hardcore draft and confirm it appears only on the hardcore tab.

### Ranking and lineup

1. Insert several valid results in each mode.
2. Confirm ordering is:
   `wins DESC`, `draws DESC`, `losses ASC`, `score_points DESC`,
   `created_at ASC`.
3. Open `/leaderboard`.
4. Expand a lineup and confirm all 11 slots appear.
5. Confirm public lineup rows do not display club, decade, or ratings.

### Security

1. Use the Supabase API with the anonymous key and confirm `SELECT` works.
2. Confirm a malformed 29-game or 31-game insert fails.
3. Confirm a bad nickname or lineup with fewer than 11 entries fails.
4. Confirm anonymous `UPDATE` and `DELETE` fail.
5. Confirm no service-role key exists in browser bundles, environment
   configuration, or repository files.

## Operational Notes

Anonymous public insert can be spammed even with RLS. Supabase rate limits,
project-level abuse controls, or a future server-side rate limiter should be
added if abuse occurs. The current patch minimizes trust by recomputing every
submitted result and by permitting only insert/select operations.
