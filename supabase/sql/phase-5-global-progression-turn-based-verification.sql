-- Trivia Rush turn-based global XP integration: read-only production verification
-- Run after phase-5-global-progression-turn-based.sql.
-- This script does not award XP or change player progression.

with checks as (
  select
    to_regprocedure(
      'trivia_private.global_multiplayer_max_possible_score(integer)'
    ) is not null as shared_max_score_helper_exists,
    to_regprocedure(
      'trivia_private.global_turn_based_max_possible_score(integer)'
    ) is not null as turn_max_score_helper_exists,
    to_regprocedure(
      'trivia_private.calculate_turn_based_global_xp(uuid,uuid)'
    ) is not null as calculation_helper_exists,
    to_regprocedure(
      'trivia_private.award_turn_based_global_xp(uuid,uuid)'
    ) is not null as award_helper_exists,
    to_regprocedure(
      'public.get_turn_based_global_xp_summary(uuid)'
    ) is not null as summary_rpc_exists,
    exists (
      select 1
      from pg_trigger trigger_row
      join pg_class table_row on table_row.oid = trigger_row.tgrelid
      join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
      where namespace_row.nspname = 'public'
        and table_row.relname = 'duel_matches'
        and trigger_row.tgname =
          'award_live_duel_global_xp_after_completion_trigger'
        and trigger_row.tgenabled <> 'D'
        and not trigger_row.tgisinternal
        and lower(pg_get_triggerdef(trigger_row.oid)) like '%match_format%live%'
    ) as live_trigger_is_format_restricted,
    exists (
      select 1
      from pg_trigger trigger_row
      join pg_class table_row on table_row.oid = trigger_row.tgrelid
      join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
      where namespace_row.nspname = 'public'
        and table_row.relname = 'duel_matches'
        and trigger_row.tgname =
          'award_turn_based_global_xp_after_completion_trigger'
        and trigger_row.tgenabled <> 'D'
        and not trigger_row.tgisinternal
        and lower(pg_get_triggerdef(trigger_row.oid)) like '%match_format%turn_based%'
    ) as turn_completion_trigger_exists,
    not exists (
      select 1
      from public.global_xp_awards award
      join public.duel_matches match on match.id = award.source_id
      where award.source_kind = 'live_duel'
        and match.match_format = 'turn_based'
    ) as no_turn_awards_misclassified_as_live
)
select
  case
    when shared_max_score_helper_exists
      and turn_max_score_helper_exists
      and calculation_helper_exists
      and award_helper_exists
      and summary_rpc_exists
      and live_trigger_is_format_restricted
      and turn_completion_trigger_exists
      and no_turn_awards_misclassified_as_live
    then 'PASS'
    else 'FAIL'
  end as verification_status,
  *
from checks;

select
  trivia_private.global_turn_based_max_possible_score(0)
    as zero_question_max_score,
  trivia_private.global_turn_based_max_possible_score(1)
    as one_question_max_score,
  trivia_private.global_turn_based_max_possible_score(3)
    as three_question_max_score,
  trivia_private.global_turn_based_max_possible_score(5)
    as five_question_max_score,
  trivia_private.global_turn_based_max_possible_score(10)
    as ten_question_max_score;

select
  role_name,
  has_function_privilege(
    role_name,
    'public.get_turn_based_global_xp_summary(uuid)',
    'EXECUTE'
  ) as can_read_turn_based_xp_summary,
  has_function_privilege(
    role_name,
    'trivia_private.award_turn_based_global_xp(uuid,uuid)',
    'EXECUTE'
  ) as can_award_turn_based_xp,
  has_function_privilege(
    role_name,
    'trivia_private.calculate_turn_based_global_xp(uuid,uuid)',
    'EXECUTE'
  ) as can_calculate_turn_based_xp
from (
  values ('anon'), ('authenticated'), ('service_role')
) roles(role_name)
order by role_name;

select
  count(*)::integer as credited_turn_based_sessions,
  coalesce(sum(award.xp_awarded), 0)::bigint as total_turn_based_xp_awarded,
  count(*) filter (
    where award.source_id is null
       or not exists (
         select 1
         from public.duel_matches match
         where match.id = award.source_id
           and match.match_format = 'turn_based'
       )
       or not exists (
         select 1
         from public.game_sessions session
         where session.id = award.game_session_id
           and session.player_id = award.player_id
           and session.duel_match_id = award.source_id
       )
  )::integer as invalid_turn_based_ledger_rows
from public.global_xp_awards award
where award.source_kind = 'turn_based';

-- Informational only: this includes historical turn-based player sessions
-- completed before this integration was deployed. The later backfill checkpoint
-- handles any remaining rows.
select
  count(*)::integer as completed_turn_based_player_sessions_without_xp
from public.duel_players player
join public.duel_matches match
  on match.id = player.match_id
where match.match_format = 'turn_based'
  and match.status = 'completed'
  and player.completed_session_id is not null
  and not exists (
    select 1
    from public.global_xp_awards award
    where award.game_session_id = player.completed_session_id
  );
