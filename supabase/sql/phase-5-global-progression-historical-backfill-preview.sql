-- Trivia Rush global XP historical backfill: read-only preview
--
-- Run before phase-5-global-progression-historical-backfill.sql.
-- This script does not award XP or modify progression.

with pending as (
  select
    'solo'::text as source_kind,
    run.id as source_id,
    run.player_id,
    run.completed_session_id as game_session_id,
    run.updated_at as completed_at
  from public.game_runs run
  where run.status = 'completed'
    and run.completed_session_id is not null
    and not exists (
      select 1
      from public.global_xp_awards award
      where award.game_session_id = run.completed_session_id
    )

  union all

  select
    case match.match_format
      when 'live' then 'live_duel'
      when 'turn_based' then 'turn_based'
    end as source_kind,
    match.id as source_id,
    player.player_id,
    player.completed_session_id as game_session_id,
    match.completed_at
  from public.duel_players player
  join public.duel_matches match
    on match.id = player.match_id
  where match.status = 'completed'
    and match.match_format in ('live', 'turn_based')
    and player.completed_session_id is not null
    and not exists (
      select 1
      from public.global_xp_awards award
      where award.game_session_id = player.completed_session_id
    )
)
select
  source_kind,
  count(*)::integer as pending_sessions
from pending
group by source_kind

union all

select
  'total'::text as source_kind,
  count(*)::integer as pending_sessions
from pending
order by source_kind;

with pending as (
  select
    'solo'::text as source_kind,
    run.id as source_id,
    run.player_id,
    run.completed_session_id as game_session_id,
    run.questions_answered,
    run.score,
    run.updated_at as completed_at
  from public.game_runs run
  where run.status = 'completed'
    and run.completed_session_id is not null
    and not exists (
      select 1
      from public.global_xp_awards award
      where award.game_session_id = run.completed_session_id
    )

  union all

  select
    case match.match_format
      when 'live' then 'live_duel'
      when 'turn_based' then 'turn_based'
    end as source_kind,
    match.id as source_id,
    player.player_id,
    player.completed_session_id as game_session_id,
    player.questions_answered,
    player.score,
    match.completed_at
  from public.duel_players player
  join public.duel_matches match
    on match.id = player.match_id
  where match.status = 'completed'
    and match.match_format in ('live', 'turn_based')
    and player.completed_session_id is not null
    and not exists (
      select 1
      from public.global_xp_awards award
      where award.game_session_id = player.completed_session_id
    )
)
select
  pending.source_kind,
  pending.source_id,
  pending.game_session_id,
  profile.display_name,
  profile.account_number,
  pending.questions_answered,
  pending.score,
  pending.completed_at
from pending
join public.profiles profile
  on profile.id = pending.player_id
order by pending.completed_at nulls last, pending.source_kind, pending.source_id;
