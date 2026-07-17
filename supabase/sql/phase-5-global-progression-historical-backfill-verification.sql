-- Trivia Rush historical global XP backfill: read-only production verification
-- Run after phase-5-global-progression-historical-backfill.sql.
-- This script does not award XP or modify progression.

with latest_run as (
  select run.*
  from trivia_private.global_xp_backfill_runs run
  order by run.started_at desc, run.id desc
  limit 1
),
aggregate_mismatches as (
  with expected as (
    select
      award.player_id,
      coalesce(sum(award.xp_awarded), 0)::bigint as total_xp,
      count(*)::bigint as credited_games
    from public.global_xp_awards award
    group by award.player_id
  )
  select coalesce(expected.player_id, progress.player_id) as player_id
  from expected
  full join public.player_global_progress progress
    on progress.player_id = expected.player_id
  where coalesce(progress.total_xp, 0) <> coalesce(expected.total_xp, 0)
     or coalesce(progress.credited_games, 0) <> coalesce(expected.credited_games, 0)
     or coalesce(progress.level, 1) <>
       trivia_private.global_level_for_xp(coalesce(expected.total_xp, 0))
),
checks as (
  select
    to_regclass(
      'trivia_private.global_xp_backfill_runs'
    ) is not null as run_audit_table_exists,
    to_regclass(
      'trivia_private.global_xp_backfill_failures'
    ) is not null as failure_audit_table_exists,
    to_regprocedure(
      'trivia_private.run_global_xp_historical_backfill()'
    ) is not null as backfill_helper_exists,
    exists (
      select 1
      from latest_run
      where status = 'completed'
        and completed_at is not null
        and failure_count = 0
    ) as latest_run_completed,
    not exists (
      select 1
      from public.game_runs run
      where run.status = 'completed'
        and run.completed_session_id is not null
        and not exists (
          select 1
          from public.global_xp_awards award
          where award.game_session_id = run.completed_session_id
        )
    ) as no_pending_solo_sessions,
    not exists (
      select 1
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
    ) as no_pending_live_duel_sessions,
    not exists (
      select 1
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
    ) as no_pending_turn_based_sessions,
    not exists (
      select 1
      from trivia_private.global_xp_backfill_failures failure
      where failure.resolved_at is null
    ) as no_unresolved_backfill_failures,
    not exists (
      select 1
      from aggregate_mismatches
    ) as progression_aggregates_valid,
    not exists (
      select 1
      from public.global_xp_awards award
      join public.duel_matches match
        on match.id = award.source_id
      where (match.match_format = 'live' and award.source_kind <> 'live_duel')
         or (match.match_format = 'turn_based' and award.source_kind <> 'turn_based')
    ) as multiplayer_sources_valid,
    not has_function_privilege(
      'anon',
      'trivia_private.run_global_xp_historical_backfill()',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'trivia_private.run_global_xp_historical_backfill()',
      'EXECUTE'
    ) as browser_cannot_run_backfill
)
select
  case
    when run_audit_table_exists
      and failure_audit_table_exists
      and backfill_helper_exists
      and latest_run_completed
      and no_pending_solo_sessions
      and no_pending_live_duel_sessions
      and no_pending_turn_based_sessions
      and no_unresolved_backfill_failures
      and progression_aggregates_valid
      and multiplayer_sources_valid
      and browser_cannot_run_backfill
    then 'PASS'
    else 'FAIL'
  end as verification_status,
  *
from checks;

select
  run.id as backfill_run_id,
  run.status,
  run.started_at,
  run.completed_at,
  run.solo_candidates,
  run.solo_awarded,
  run.solo_replayed,
  run.live_duel_candidates,
  run.live_duel_awarded,
  run.live_duel_replayed,
  run.turn_based_candidates,
  run.turn_based_awarded,
  run.turn_based_replayed,
  run.failure_count
from trivia_private.global_xp_backfill_runs run
order by run.started_at desc, run.id desc
limit 1;

select
  award.source_kind,
  count(*)::integer as backfilled_sessions,
  coalesce(sum(award.xp_awarded), 0)::bigint as backfilled_xp
from public.global_xp_awards award
where award.breakdown ->> 'credit_path' = 'historical_backfill'
group by award.source_kind
order by award.source_kind;

select
  failure.source_kind,
  failure.source_id,
  failure.player_id,
  failure.game_session_id,
  failure.error_code,
  failure.error_message,
  failure.created_at
from trivia_private.global_xp_backfill_failures failure
where failure.resolved_at is null
order by failure.created_at, failure.source_kind;

with expected as (
  select
    award.player_id,
    coalesce(sum(award.xp_awarded), 0)::bigint as expected_total_xp,
    count(*)::bigint as expected_credited_games
  from public.global_xp_awards award
  group by award.player_id
)
select
  count(*)::integer as progression_aggregate_mismatches
from expected
full join public.player_global_progress progress
  on progress.player_id = expected.player_id
where coalesce(progress.total_xp, 0) <> coalesce(expected.expected_total_xp, 0)
   or coalesce(progress.credited_games, 0) <>
      coalesce(expected.expected_credited_games, 0)
   or coalesce(progress.level, 1) <>
      trivia_private.global_level_for_xp(
        coalesce(expected.expected_total_xp, 0)
      );
