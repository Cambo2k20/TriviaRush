-- Trivia Rush Phase 5: global XP progression foundation
--
-- This additive migration creates the trusted global progression model but does
-- not yet attach awards to solo or multiplayer finalisation. The later
-- integration migrations call trivia_private.record_global_xp_award().
--
-- Global XP rules:
--   * Correct Easy / Medium / Hard answers start at 10 / 15 / 25 XP.
--   * Per-answer speed and streak multipliers are server-derived.
--   * Completed-game score and multiplayer-result multipliers are server-derived.
--   * Final game XP is capped at 150% of unmodified base XP.
--   * Levels use cumulative threshold 50 * (level - 1) * level.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Required table public.profiles does not exist';
  end if;

  if to_regclass('public.game_sessions') is null then
    raise exception 'Required table public.game_sessions does not exist';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Level configuration and trusted aggregates
-- ---------------------------------------------------------------------------

create table if not exists public.global_level_thresholds (
  level smallint primary key,
  cumulative_xp bigint not null unique,
  created_at timestamptz not null default now(),

  constraint global_level_thresholds_level_valid check (level between 1 and 500),
  constraint global_level_thresholds_xp_valid check (cumulative_xp >= 0)
);

insert into public.global_level_thresholds (level, cumulative_xp)
select
  generated_level::smallint,
  (50::bigint * (generated_level - 1) * generated_level)::bigint
from generate_series(1, 50) generated_level
on conflict (level) do update
set cumulative_xp = excluded.cumulative_xp;

create table if not exists public.player_global_progress (
  player_id uuid primary key
    references public.profiles(id) on delete cascade,
  total_xp bigint not null default 0,
  level smallint not null default 1,
  credited_games bigint not null default 0,
  last_xp_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint player_global_progress_xp_valid check (total_xp >= 0),
  constraint player_global_progress_level_valid check (level between 1 and 500),
  constraint player_global_progress_games_valid check (credited_games >= 0)
);

create index if not exists player_global_progress_level_xp_idx
on public.player_global_progress (level desc, total_xp desc);

create table if not exists public.global_xp_awards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null
    references public.profiles(id) on delete cascade,
  game_session_id uuid not null unique
    references public.game_sessions(id) on delete restrict,
  source_kind text not null,
  source_id uuid null,
  base_xp integer not null,
  answer_xp integer not null,
  score integer not null,
  max_possible_score integer not null,
  score_efficiency numeric(8, 6) not null,
  score_multiplier numeric(4, 2) not null,
  result_multiplier numeric(4, 2) not null,
  uncapped_xp integer not null,
  cap_xp integer not null,
  xp_awarded integer not null,
  calculation_version smallint not null default 1,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint global_xp_awards_source_valid check (
    source_kind in ('solo', 'live_duel', 'turn_based', 'legacy_backfill')
  ),
  constraint global_xp_awards_base_valid check (base_xp >= 0),
  constraint global_xp_awards_answer_valid check (
    answer_xp >= 0 and answer_xp >= base_xp
  ),
  constraint global_xp_awards_score_valid check (
    score >= 0
    and max_possible_score >= 0
    and (max_possible_score > 0 or score = 0)
    and (max_possible_score = 0 or score <= max_possible_score)
  ),
  constraint global_xp_awards_efficiency_valid check (
    score_efficiency between 0 and 1
  ),
  constraint global_xp_awards_multipliers_valid check (
    score_multiplier between 1 and 1.50
    and result_multiplier between 1 and 1.50
  ),
  constraint global_xp_awards_totals_valid check (
    uncapped_xp >= 0
    and cap_xp >= 0
    and xp_awarded >= 0
    and xp_awarded <= uncapped_xp
    and xp_awarded <= cap_xp
  ),
  constraint global_xp_awards_version_valid check (
    calculation_version between 1 and 32767
  ),
  constraint global_xp_awards_breakdown_object check (
    jsonb_typeof(breakdown) = 'object'
  )
);

create index if not exists global_xp_awards_player_created_idx
on public.global_xp_awards (player_id, created_at desc);

alter table public.global_level_thresholds enable row level security;
alter table public.player_global_progress enable row level security;
alter table public.global_xp_awards enable row level security;

revoke all on table public.global_level_thresholds
from public, anon, authenticated;

revoke all on table public.player_global_progress
from public, anon, authenticated;

revoke all on table public.global_xp_awards
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Immutable server-owned rule helpers
-- ---------------------------------------------------------------------------

create or replace function trivia_private.global_base_xp(
  p_difficulty text,
  p_is_correct boolean
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when not coalesce(p_is_correct, false) then 0
    when lower(btrim(coalesce(p_difficulty, ''))) = 'easy' then 10
    when lower(btrim(coalesce(p_difficulty, ''))) = 'medium' then 15
    when lower(btrim(coalesce(p_difficulty, ''))) = 'hard' then 25
    else 0
  end;
$$;

create or replace function trivia_private.global_speed_multiplier(
  p_response_ms integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when greatest(coalesce(p_response_ms, 600001), 0) <= 1500 then 1.25::numeric
    when greatest(coalesce(p_response_ms, 600001), 0) <= 3000 then 1.15::numeric
    when greatest(coalesce(p_response_ms, 600001), 0) <= 5000 then 1.05::numeric
    else 1.00::numeric
  end;
$$;

create or replace function trivia_private.global_streak_multiplier(
  p_current_streak integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when greatest(coalesce(p_current_streak, 0), 0) >= 10 then 1.15::numeric
    when greatest(coalesce(p_current_streak, 0), 0) >= 5 then 1.10::numeric
    when greatest(coalesce(p_current_streak, 0), 0) >= 3 then 1.05::numeric
    else 1.00::numeric
  end;
$$;

create or replace function trivia_private.calculate_global_answer_xp(
  p_difficulty text,
  p_is_correct boolean,
  p_response_ms integer,
  p_current_streak integer
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with values_for_answer as (
    select
      trivia_private.global_base_xp(p_difficulty, p_is_correct) as base_xp,
      trivia_private.global_speed_multiplier(p_response_ms) as speed_multiplier,
      trivia_private.global_streak_multiplier(p_current_streak) as streak_multiplier
  )
  select jsonb_build_object(
    'base_xp', base_xp,
    'speed_multiplier', speed_multiplier,
    'streak_multiplier', streak_multiplier,
    'answer_xp', case
      when base_xp = 0 then 0
      else round(base_xp * speed_multiplier * streak_multiplier)::integer
    end
  )
  from values_for_answer;
$$;

create or replace function trivia_private.global_score_multiplier(
  p_score_efficiency numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.85 then 1.10::numeric
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.70 then 1.06::numeric
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.50 then 1.03::numeric
    else 1.00::numeric
  end;
$$;

create or replace function trivia_private.global_result_multiplier(
  p_outcome text,
  p_result_reason text
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'win'
      and lower(btrim(coalesce(p_result_reason, 'score'))) = 'forfeit'
      then 1.05::numeric
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'win'
      then 1.10::numeric
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'draw'
      then 1.05::numeric
    else 1.00::numeric
  end;
$$;

create or replace function trivia_private.calculate_global_game_xp(
  p_base_xp integer,
  p_answer_xp integer,
  p_score integer,
  p_max_possible_score integer,
  p_outcome text default null,
  p_result_reason text default null
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base_xp integer := greatest(coalesce(p_base_xp, 0), 0);
  v_answer_xp integer := greatest(coalesce(p_answer_xp, 0), 0);
  v_score integer := greatest(coalesce(p_score, 0), 0);
  v_max_possible_score integer := greatest(coalesce(p_max_possible_score, 0), 0);
  v_efficiency numeric;
  v_score_multiplier numeric;
  v_result_multiplier numeric;
  v_uncapped_xp integer;
  v_cap_xp integer;
  v_final_xp integer;
begin
  if v_answer_xp < v_base_xp then
    raise exception 'Answer XP cannot be lower than base XP';
  end if;

  if v_max_possible_score = 0 and v_score <> 0 then
    raise exception 'A positive score requires a positive maximum possible score';
  end if;

  if v_max_possible_score > 0 and v_score > v_max_possible_score then
    raise exception 'Score cannot exceed the maximum possible score';
  end if;

  v_efficiency := case
    when v_max_possible_score = 0 then 0::numeric
    else least(1::numeric, v_score::numeric / v_max_possible_score::numeric)
  end;

  v_score_multiplier := trivia_private.global_score_multiplier(v_efficiency);
  v_result_multiplier := trivia_private.global_result_multiplier(
    p_outcome,
    p_result_reason
  );
  v_uncapped_xp := round(
    v_answer_xp * v_score_multiplier * v_result_multiplier
  )::integer;
  v_cap_xp := round(v_base_xp * 1.50)::integer;
  v_final_xp := least(v_uncapped_xp, v_cap_xp);

  return jsonb_build_object(
    'base_xp', v_base_xp,
    'answer_xp', v_answer_xp,
    'score', v_score,
    'max_possible_score', v_max_possible_score,
    'score_efficiency', round(v_efficiency, 6),
    'score_multiplier', v_score_multiplier,
    'result_multiplier', v_result_multiplier,
    'uncapped_xp', v_uncapped_xp,
    'cap_xp', v_cap_xp,
    'xp_awarded', v_final_xp
  );
end;
$$;

create or replace function trivia_private.global_level_for_xp(
  p_total_xp bigint
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select max(threshold.level)
      from public.global_level_thresholds threshold
      where threshold.cumulative_xp <= greatest(coalesce(p_total_xp, 0), 0)
    ),
    1
  )::smallint;
$$;

revoke all
on function trivia_private.global_base_xp(text, boolean)
from public, anon, authenticated;

revoke all
on function trivia_private.global_speed_multiplier(integer)
from public, anon, authenticated;

revoke all
on function trivia_private.global_streak_multiplier(integer)
from public, anon, authenticated;

revoke all
on function trivia_private.calculate_global_answer_xp(text, boolean, integer, integer)
from public, anon, authenticated;

revoke all
on function trivia_private.global_score_multiplier(numeric)
from public, anon, authenticated;

revoke all
on function trivia_private.global_result_multiplier(text, text)
from public, anon, authenticated;

revoke all
on function trivia_private.calculate_global_game_xp(integer, integer, integer, integer, text, text)
from public, anon, authenticated;

revoke all
on function trivia_private.global_level_for_xp(bigint)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent internal award writer
-- ---------------------------------------------------------------------------

create or replace function trivia_private.record_global_xp_award(
  p_player_id uuid,
  p_game_session_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_base_xp integer,
  p_answer_xp integer,
  p_score integer,
  p_max_possible_score integer,
  p_outcome text default null,
  p_result_reason text default null,
  p_breakdown jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.global_xp_awards%rowtype;
  v_award public.global_xp_awards%rowtype;
  v_progress public.player_global_progress%rowtype;
  v_calculation jsonb;
  v_previous_xp bigint;
  v_previous_level smallint;
  v_new_xp bigint;
  v_new_level smallint;
begin
  if p_player_id is null or p_game_session_id is null then
    raise exception 'Player and game session are required';
  end if;

  if lower(btrim(coalesce(p_source_kind, ''))) not in (
    'solo',
    'live_duel',
    'turn_based',
    'legacy_backfill'
  ) then
    raise exception 'Global XP source kind is invalid';
  end if;

  if jsonb_typeof(coalesce(p_breakdown, '{}'::jsonb)) <> 'object' then
    raise exception 'Global XP breakdown must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.game_sessions session
    where session.id = p_game_session_id
      and session.player_id = p_player_id
  ) then
    raise exception 'Game session does not belong to the player';
  end if;

  select *
  into v_existing
  from public.global_xp_awards
  where game_session_id = p_game_session_id;

  if found then
    return jsonb_build_object(
      'idempotent_replay', true,
      'award_id', v_existing.id,
      'game_session_id', v_existing.game_session_id,
      'xp_awarded', v_existing.xp_awarded,
      'total_xp', (
        select progress.total_xp
        from public.player_global_progress progress
        where progress.player_id = p_player_id
      ),
      'level', (
        select progress.level
        from public.player_global_progress progress
        where progress.player_id = p_player_id
      )
    );
  end if;

  v_calculation := trivia_private.calculate_global_game_xp(
    p_base_xp,
    p_answer_xp,
    p_score,
    p_max_possible_score,
    p_outcome,
    p_result_reason
  );

  insert into public.player_global_progress (
    player_id,
    total_xp,
    level,
    credited_games,
    updated_at
  )
  values (
    p_player_id,
    0,
    1,
    0,
    now()
  )
  on conflict (player_id) do nothing;

  select *
  into v_progress
  from public.player_global_progress
  where player_id = p_player_id
  for update;

  v_previous_xp := v_progress.total_xp;
  v_previous_level := v_progress.level;

  insert into public.global_xp_awards (
    player_id,
    game_session_id,
    source_kind,
    source_id,
    base_xp,
    answer_xp,
    score,
    max_possible_score,
    score_efficiency,
    score_multiplier,
    result_multiplier,
    uncapped_xp,
    cap_xp,
    xp_awarded,
    calculation_version,
    breakdown
  )
  values (
    p_player_id,
    p_game_session_id,
    lower(btrim(p_source_kind)),
    p_source_id,
    (v_calculation ->> 'base_xp')::integer,
    (v_calculation ->> 'answer_xp')::integer,
    (v_calculation ->> 'score')::integer,
    (v_calculation ->> 'max_possible_score')::integer,
    (v_calculation ->> 'score_efficiency')::numeric,
    (v_calculation ->> 'score_multiplier')::numeric,
    (v_calculation ->> 'result_multiplier')::numeric,
    (v_calculation ->> 'uncapped_xp')::integer,
    (v_calculation ->> 'cap_xp')::integer,
    (v_calculation ->> 'xp_awarded')::integer,
    1,
    coalesce(p_breakdown, '{}'::jsonb)
  )
  on conflict (game_session_id) do nothing
  returning * into v_award;

  if v_award.id is null then
    select *
    into v_existing
    from public.global_xp_awards
    where game_session_id = p_game_session_id;

    return jsonb_build_object(
      'idempotent_replay', true,
      'award_id', v_existing.id,
      'game_session_id', v_existing.game_session_id,
      'xp_awarded', v_existing.xp_awarded,
      'total_xp', v_progress.total_xp,
      'level', v_progress.level
    );
  end if;

  v_new_xp := v_previous_xp + v_award.xp_awarded;
  v_new_level := trivia_private.global_level_for_xp(v_new_xp);

  update public.player_global_progress
  set
    total_xp = v_new_xp,
    level = v_new_level,
    credited_games = credited_games + 1,
    last_xp_at = case
      when v_award.xp_awarded > 0 then now()
      else last_xp_at
    end,
    updated_at = now()
  where player_id = p_player_id
  returning * into v_progress;

  return jsonb_build_object(
    'idempotent_replay', false,
    'award_id', v_award.id,
    'game_session_id', v_award.game_session_id,
    'xp_awarded', v_award.xp_awarded,
    'base_xp', v_award.base_xp,
    'answer_xp', v_award.answer_xp,
    'score_efficiency', v_award.score_efficiency,
    'score_multiplier', v_award.score_multiplier,
    'result_multiplier', v_award.result_multiplier,
    'cap_xp', v_award.cap_xp,
    'previous_total_xp', v_previous_xp,
    'total_xp', v_progress.total_xp,
    'previous_level', v_previous_level,
    'level', v_progress.level,
    'level_up', v_progress.level > v_previous_level
  );
end;
$$;

revoke all
on function trivia_private.record_global_xp_award(
  uuid, uuid, text, uuid, integer, integer, integer, integer, text, text, jsonb
)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safe player read RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_my_global_progression()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_total_xp bigint := 0;
  v_level smallint := 1;
  v_credited_games bigint := 0;
  v_last_xp_at timestamptz;
  v_current_threshold bigint := 0;
  v_next_level smallint;
  v_next_threshold bigint;
  v_progress_percent numeric;
begin
  if v_player_id is null or not exists (
    select 1 from public.profiles profile where profile.id = v_player_id
  ) then
    raise exception 'A Trivia Rush player profile is required';
  end if;

  select
    progress.total_xp,
    progress.level,
    progress.credited_games,
    progress.last_xp_at
  into
    v_total_xp,
    v_level,
    v_credited_games,
    v_last_xp_at
  from public.player_global_progress progress
  where progress.player_id = v_player_id;

  if not found then
    v_total_xp := 0;
    v_level := 1;
    v_credited_games := 0;
    v_last_xp_at := null;
  end if;

  select threshold.cumulative_xp
  into v_current_threshold
  from public.global_level_thresholds threshold
  where threshold.level = v_level;

  select threshold.level, threshold.cumulative_xp
  into v_next_level, v_next_threshold
  from public.global_level_thresholds threshold
  where threshold.level > v_level
  order by threshold.level
  limit 1;

  v_progress_percent := case
    when v_next_threshold is null then 100::numeric
    when v_next_threshold = v_current_threshold then 100::numeric
    else round(
      (v_total_xp - v_current_threshold)::numeric * 100 /
      (v_next_threshold - v_current_threshold)::numeric,
      1
    )
  end;

  return jsonb_build_object(
    'total_xp', v_total_xp,
    'level', v_level,
    'credited_games', v_credited_games,
    'current_level_xp', v_current_threshold,
    'next_level', v_next_level,
    'next_level_xp', v_next_threshold,
    'xp_into_level', v_total_xp - v_current_threshold,
    'xp_to_next_level', case
      when v_next_threshold is null then null
      else greatest(v_next_threshold - v_total_xp, 0)
    end,
    'progress_percent', v_progress_percent,
    'last_xp_at', v_last_xp_at
  );
end;
$$;

revoke all
on function public.get_my_global_progression()
from public, anon;

grant execute
on function public.get_my_global_progression()
to authenticated;

commit;

notify pgrst, 'reload schema';
