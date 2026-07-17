-- Trivia Rush Phase 5: historical global XP backfill
--
-- Run after the global XP foundation and the solo, live-duel and turn-based
-- integration migrations. This migration credits completed authoritative game
-- sessions that predate their XP completion triggers.
--
-- The backfill is idempotent. Existing game-session awards are never duplicated.
-- A malformed historical session is isolated, recorded for repair and does not
-- roll back valid awards from other sessions.

begin;

do $$
begin
  if to_regclass('public.game_runs') is null
     or to_regclass('public.duel_matches') is null
     or to_regclass('public.duel_players') is null
     or to_regclass('public.global_xp_awards') is null
     or to_regclass('public.player_global_progress') is null then
    raise exception 'Authoritative game and global progression tables are required';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'duel_matches'
      and column_name = 'match_format'
  ) then
    raise exception 'Turn-based challenge schema must be deployed first';
  end if;

  if to_regprocedure('trivia_private.award_solo_global_xp(uuid)') is null
     or to_regprocedure(
       'trivia_private.award_live_duel_global_xp(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'trivia_private.award_turn_based_global_xp(uuid,uuid)'
     ) is null then
    raise exception 'All global XP gameplay integrations must be deployed first';
  end if;
end;
$$;

create table if not exists trivia_private.global_xp_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  solo_candidates integer not null default 0,
  solo_awarded integer not null default 0,
  solo_replayed integer not null default 0,
  live_duel_candidates integer not null default 0,
  live_duel_awarded integer not null default 0,
  live_duel_replayed integer not null default 0,
  turn_based_candidates integer not null default 0,
  turn_based_awarded integer not null default 0,
  turn_based_replayed integer not null default 0,
  failure_count integer not null default 0,
  created_by text not null default current_user,

  constraint global_xp_backfill_runs_status_valid check (
    status in ('running', 'completed', 'completed_with_failures')
  ),
  constraint global_xp_backfill_runs_counts_valid check (
    solo_candidates >= 0
    and solo_awarded >= 0
    and solo_replayed >= 0
    and live_duel_candidates >= 0
    and live_duel_awarded >= 0
    and live_duel_replayed >= 0
    and turn_based_candidates >= 0
    and turn_based_awarded >= 0
    and turn_based_replayed >= 0
    and failure_count >= 0
  )
);

create unique index if not exists global_xp_backfill_one_running_idx
on trivia_private.global_xp_backfill_runs ((1))
where status = 'running';

create table if not exists trivia_private.global_xp_backfill_failures (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references trivia_private.global_xp_backfill_runs(id) on delete cascade,
  source_kind text not null,
  source_id uuid not null,
  player_id uuid not null,
  game_session_id uuid not null,
  error_code text not null,
  error_message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolution_run_id uuid null
    references trivia_private.global_xp_backfill_runs(id) on delete set null,

  unique (run_id, game_session_id),
  constraint global_xp_backfill_failures_source_valid check (
    source_kind in ('solo', 'live_duel', 'turn_based')
  ),
  constraint global_xp_backfill_failures_error_valid check (
    char_length(error_code) between 1 and 20
    and char_length(error_message) between 1 and 1000
  ),
  constraint global_xp_backfill_failures_resolution_valid check (
    (resolved_at is null and resolution_run_id is null)
    or (resolved_at is not null and resolution_run_id is not null)
  )
);

create index if not exists global_xp_backfill_failures_unresolved_idx
on trivia_private.global_xp_backfill_failures (
  source_kind,
  game_session_id,
  created_at
)
where resolved_at is null;

revoke all
on table trivia_private.global_xp_backfill_runs,
  trivia_private.global_xp_backfill_failures
from public, anon, authenticated;

create or replace function trivia_private.run_global_xp_historical_backfill()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_run trivia_private.global_xp_backfill_runs%rowtype;
  v_candidate record;
  v_result jsonb;
  v_is_replay boolean;
  v_solo_candidates integer := 0;
  v_solo_awarded integer := 0;
  v_solo_replayed integer := 0;
  v_live_candidates integer := 0;
  v_live_awarded integer := 0;
  v_live_replayed integer := 0;
  v_turn_candidates integer := 0;
  v_turn_awarded integer := 0;
  v_turn_replayed integer := 0;
  v_failures integer := 0;
begin
  insert into trivia_private.global_xp_backfill_runs default values
  returning id into v_run_id;

  for v_candidate in
    select
      run.id as source_id,
      run.player_id,
      run.completed_session_id as game_session_id
    from public.game_runs run
    where run.status = 'completed'
      and run.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = run.completed_session_id
      )
    order by run.updated_at, run.id
  loop
    v_solo_candidates := v_solo_candidates + 1;

    begin
      v_result := trivia_private.award_solo_global_xp(v_candidate.source_id);
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_solo_replayed := v_solo_replayed + 1;
      else
        v_solo_awarded := v_solo_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'solo',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  for v_candidate in
    select
      match.id as source_id,
      player.player_id,
      player.completed_session_id as game_session_id
    from public.duel_players player
    join public.duel_matches match
      on match.id = player.match_id
    where match.status = 'completed'
      and match.match_format = 'live'
      and player.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = player.completed_session_id
      )
    order by match.completed_at nulls last, match.id, player.player_role
  loop
    v_live_candidates := v_live_candidates + 1;

    begin
      v_result := trivia_private.award_live_duel_global_xp(
        v_candidate.source_id,
        v_candidate.player_id
      );
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_live_replayed := v_live_replayed + 1;
      else
        v_live_awarded := v_live_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'live_duel',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  for v_candidate in
    select
      match.id as source_id,
      player.player_id,
      player.completed_session_id as game_session_id
    from public.duel_players player
    join public.duel_matches match
      on match.id = player.match_id
    where match.status = 'completed'
      and match.match_format = 'turn_based'
      and player.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = player.completed_session_id
      )
    order by match.completed_at nulls last, match.id, player.player_role
  loop
    v_turn_candidates := v_turn_candidates + 1;

    begin
      v_result := trivia_private.award_turn_based_global_xp(
        v_candidate.source_id,
        v_candidate.player_id
      );
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_turn_replayed := v_turn_replayed + 1;
      else
        v_turn_awarded := v_turn_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'turn_based',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  update trivia_private.global_xp_backfill_runs
  set
    status = case
      when v_failures = 0 then 'completed'
      else 'completed_with_failures'
    end,
    completed_at = now(),
    solo_candidates = v_solo_candidates,
    solo_awarded = v_solo_awarded,
    solo_replayed = v_solo_replayed,
    live_duel_candidates = v_live_candidates,
    live_duel_awarded = v_live_awarded,
    live_duel_replayed = v_live_replayed,
    turn_based_candidates = v_turn_candidates,
    turn_based_awarded = v_turn_awarded,
    turn_based_replayed = v_turn_replayed,
    failure_count = v_failures
  where id = v_run_id
  returning * into v_run;

  return to_jsonb(v_run);
end;
$$;

revoke all
on function trivia_private.run_global_xp_historical_backfill()
from public, anon, authenticated;

select trivia_private.run_global_xp_historical_backfill()
  as backfill_result;

commit;

notify pgrst, 'reload schema';
