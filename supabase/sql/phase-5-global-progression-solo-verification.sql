-- Trivia Rush solo global XP integration: read-only production verification
-- Run after phase-5-global-progression-solo.sql.
-- This script does not award XP or change player progression.

with checks as (
  select
    to_regprocedure(
      'trivia_private.global_solo_max_possible_score(integer)'
    ) is not null as max_score_helper_exists,
    to_regprocedure(
      'trivia_private.calculate_solo_global_xp(uuid)'
    ) is not null as calculation_helper_exists,
    to_regprocedure(
      'trivia_private.award_solo_global_xp(uuid)'
    ) is not null as award_helper_exists,
    to_regprocedure(
      'public.get_solo_global_xp_summary(uuid)'
    ) is not null as summary_rpc_exists,
    exists (
      select 1
      from pg_trigger trigger_row
      join pg_class table_row on table_row.oid = trigger_row.tgrelid
      join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
      where namespace_row.nspname = 'public'
        and table_row.relname = 'game_runs'
        and trigger_row.tgname =
          'award_solo_global_xp_after_completion_trigger'
        and not trigger_row.tgisinternal
    ) as completion_trigger_exists
)
select
  case
    when max_score_helper_exists
      and calculation_helper_exists
      and award_helper_exists
      and summary_rpc_exists
      and completion_trigger_exists
    then 'PASS'
    else 'FAIL'
  end as verification_status,
  *
from checks;

select
  trivia_private.global_solo_max_possible_score(0)
    as zero_question_max_score,
  trivia_private.global_solo_max_possible_score(1)
    as one_question_max_score,
  trivia_private.global_solo_max_possible_score(3)
    as three_question_max_score,
  trivia_private.global_solo_max_possible_score(5)
    as five_question_max_score,
  trivia_private.global_solo_max_possible_score(10)
    as ten_question_max_score;

select
  role_name,
  has_function_privilege(
    role_name,
    'public.get_solo_global_xp_summary(uuid)',
    'EXECUTE'
  ) as can_read_solo_xp_summary,
  has_function_privilege(
    role_name,
    'trivia_private.award_solo_global_xp(uuid)',
    'EXECUTE'
  ) as can_award_solo_xp,
  has_function_privilege(
    role_name,
    'trivia_private.calculate_solo_global_xp(uuid)',
    'EXECUTE'
  ) as can_calculate_solo_xp
from (
  values ('anon'), ('authenticated'), ('service_role')
) roles(role_name)
order by role_name;

select
  count(*)::integer as credited_solo_sessions,
  coalesce(sum(xp_awarded), 0)::bigint as total_solo_xp_awarded,
  count(*) filter (
    where source_id is null or source_kind <> 'solo'
  )::integer as invalid_solo_ledger_rows
from public.global_xp_awards
where source_kind = 'solo';

-- Informational only: this includes historical runs completed before the solo
-- integration was deployed. Those are handled by the later backfill migration.
select
  count(*)::integer as completed_solo_runs_without_xp
from public.game_runs run
where run.status = 'completed'
  and run.completed_session_id is not null
  and not exists (
    select 1
    from public.global_xp_awards award
    where award.game_session_id = run.completed_session_id
  );
