create extension if not exists pgcrypto;

create or replace function public.is_valid_leaderboard_lineup(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  seen_slots text[] := array[]::text[];
  slot_name text;
begin
  if jsonb_typeof(candidate) <> 'array' or jsonb_array_length(candidate) <> 11 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(candidate)
  loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(item -> 'player_name') <> 'string'
      or jsonb_typeof(item -> 'game_position') <> 'string'
      or jsonb_typeof(item -> 'slot_position') <> 'string'
      or jsonb_typeof(item -> 'position_label') <> 'string'
    then
      return false;
    end if;
    if item ?| array[
      'team_name',
      'club_decade_id',
      'club_decade_player_id',
      'player_id',
      'decade',
      'raw_score',
      'hidden_modifier',
      'rating',
      'effective_rating',
      'effective_global_rating',
      'global_rating'
    ] then
      return false;
    end if;
    if char_length(item ->> 'player_name') not between 1 and 80
      or char_length(item ->> 'game_position') not between 1 and 8
      or char_length(item ->> 'position_label') not between 1 and 8
    then
      return false;
    end if;

    slot_name := item ->> 'slot_position';
    if slot_name not in (
      'gk', 'lb', 'cb_1', 'cb_2', 'rb',
      'cm', 'am_cm', 'lm', 'rm', 'am_fw', 'fw'
    ) or slot_name = any(seen_slots) then
      return false;
    end if;
    seen_slots := array_append(seen_slots, slot_name);
  end loop;

  return true;
end;
$$;

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  mode text not null,
  wins smallint not null,
  draws smallint not null,
  losses smallint not null,
  score_points smallint not null,
  lineup jsonb not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_nickname_length
    check (char_length(btrim(nickname)) between 2 and 20),
  constraint leaderboard_nickname_trimmed
    check (nickname = btrim(nickname)),
  constraint leaderboard_nickname_characters
    check (nickname !~ $pattern$[<>{}\[\]\\"'`]$pattern$),
  constraint leaderboard_nickname_controls
    check (nickname !~ '[[:cntrl:]]'),
  constraint leaderboard_mode
    check (mode in ('normal', 'hardcore')),
  constraint leaderboard_record_ranges
    check (
      wins between 0 and 30
      and draws between 0 and 30
      and losses between 0 and 30
      and wins + draws + losses = 30
    ),
  constraint leaderboard_points
    check (
      score_points between 0 and 90
      and score_points = wins * 3 + draws
    ),
  constraint leaderboard_lineup_array
    check (public.is_valid_leaderboard_lineup(lineup))
);

create index if not exists leaderboard_normal_ranking_idx
  on public.leaderboard_entries
  (wins desc, draws desc, losses asc, score_points desc, created_at asc)
  where mode = 'normal';

create index if not exists leaderboard_hardcore_ranking_idx
  on public.leaderboard_entries
  (wins desc, draws desc, losses asc, score_points desc, created_at asc)
  where mode = 'hardcore';

alter table public.leaderboard_entries enable row level security;

revoke all on public.leaderboard_entries from anon, authenticated;
grant select on public.leaderboard_entries to anon, authenticated;
grant insert (
  nickname,
  mode,
  wins,
  draws,
  losses,
  score_points,
  lineup
) on public.leaderboard_entries to anon, authenticated;

drop policy if exists "Public leaderboard read" on public.leaderboard_entries;
create policy "Public leaderboard read"
  on public.leaderboard_entries
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public validated leaderboard insert"
  on public.leaderboard_entries;
create policy "Public validated leaderboard insert"
  on public.leaderboard_entries
  for insert
  to anon, authenticated
  with check (
    mode in ('normal', 'hardcore')
    and wins between 0 and 30
    and draws between 0 and 30
    and losses between 0 and 30
    and wins + draws + losses = 30
    and score_points = wins * 3 + draws
    and char_length(nickname) between 2 and 20
    and public.is_valid_leaderboard_lineup(lineup)
  );

comment on table public.leaderboard_entries is
  'Anonymous optional season submissions for the 30-0 global leaderboard.';
