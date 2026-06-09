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
