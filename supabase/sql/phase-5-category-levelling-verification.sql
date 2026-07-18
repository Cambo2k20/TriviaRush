-- Trivia Rush Phase 5 category levelling verification
-- Read only. Run after phase-5-category-levelling.sql.

with threshold_checks as (
  select
    count(*)::integer as threshold_count,
    min(level)::integer as minimum_level,
    max(level)::integer as maximum_level,
    min(cumulative_xp)::bigint as minimum_xp,
    max(cumulative_xp)::bigint as maximum_xp
  from public.category_level_thresholds
)
select
  threshold_count,
  minimum_level,
  maximum_level,
  minimum_xp,
  maximum_xp,
  case
    when threshold_count = 50
     and minimum_level = 1
     and maximum_level = 50
     and minimum_xp = 0
     and maximum_xp = 122500
    then 'PASS'
    else 'FAIL'
  end as verification_status
from threshold_checks;

select
  count(*)::integer as invalid_award_rows,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as verification_status
from public.category_xp_awards awards
where awards.xp_awarded <> case
  when not awards.is_correct then 0
  when awards.difficulty = 'easy' then 10
  when awards.difficulty = 'medium' then 15
  when awards.difficulty = 'hard' then 25
  else -1
end;

select
  count(*)::integer as duplicate_authoritative_awards,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as verification_status
from (
  select
    source_kind,
    source_id,
    player_id,
    answer_key
  from public.category_xp_awards
  group by source_kind, source_id, player_id, answer_key
  having count(*) > 1
) duplicates;

with ledger as (
  select
    player_id,
    category_id,
    sum(xp_awarded)::bigint as xp,
    count(*)::bigint as questions_answered,
    count(*) filter (where is_correct)::bigint as correct_answers,
    count(*) filter (where not is_correct)::bigint as incorrect_answers,
    count(*) filter (where source_kind = 'solo')::bigint as solo_questions,
    count(*) filter (where source_kind in ('live_duel', 'turn_based'))::bigint as duel_questions
  from public.category_xp_awards
  group by player_id, category_id
),
mismatches as (
  select
    coalesce(progress.player_id, ledger.player_id) as player_id,
    coalesce(progress.category_id, ledger.category_id) as category_id
  from public.player_category_progress progress
  full join ledger
    on ledger.player_id = progress.player_id
   and ledger.category_id = progress.category_id
  where coalesce(progress.xp, -1) <> coalesce(ledger.xp, -1)
     or coalesce(progress.questions_answered, -1) <> coalesce(ledger.questions_answered, -1)
     or coalesce(progress.correct_answers, -1) <> coalesce(ledger.correct_answers, -1)
     or coalesce(progress.incorrect_answers, -1) <> coalesce(ledger.incorrect_answers, -1)
     or coalesce(progress.solo_questions, -1) <> coalesce(ledger.solo_questions, -1)
     or coalesce(progress.duel_questions, -1) <> coalesce(ledger.duel_questions, -1)
)
select
  count(*)::integer as aggregate_mismatches,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as verification_status
from mismatches;

select
  count(*)::integer as invalid_cached_levels,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as verification_status
from public.player_category_progress progress
where progress.level <> trivia_private.category_level_for_xp(progress.xp);

select
  role_name,
  can_read_progress,
  can_write_progress,
  can_read_awards,
  can_write_awards
from (
  values
    (
      'anon',
      has_table_privilege('anon', 'public.player_category_progress', 'SELECT'),
      has_table_privilege('anon', 'public.player_category_progress', 'INSERT,UPDATE,DELETE'),
      has_table_privilege('anon', 'public.category_xp_awards', 'SELECT'),
      has_table_privilege('anon', 'public.category_xp_awards', 'INSERT,UPDATE,DELETE')
    ),
    (
      'authenticated',
      has_table_privilege('authenticated', 'public.player_category_progress', 'SELECT'),
      has_table_privilege('authenticated', 'public.player_category_progress', 'INSERT,UPDATE,DELETE'),
      has_table_privilege('authenticated', 'public.category_xp_awards', 'SELECT'),
      has_table_privilege('authenticated', 'public.category_xp_awards', 'INSERT,UPDATE,DELETE')
    )
) privileges (
  role_name,
  can_read_progress,
  can_write_progress,
  can_read_awards,
  can_write_awards
)
where can_read_progress
   or can_write_progress
   or can_read_awards
   or can_write_awards;

select
  has_function_privilege(
    'authenticated',
    'public.get_my_category_progression()',
    'EXECUTE'
  ) as can_read_own_progression,
  has_function_privilege(
    'authenticated',
    'public.get_solo_category_xp_summary(uuid)',
    'EXECUTE'
  ) as can_read_solo_summary,
  has_function_privilege(
    'authenticated',
    'public.get_duel_category_xp_summary(uuid)',
    'EXECUTE'
  ) as can_read_duel_summary,
  has_function_privilege(
    'authenticated',
    'trivia_private.record_category_answer_progress(uuid,text,uuid,text,text,text,boolean)',
    'EXECUTE'
  ) as browser_can_write_progression;
