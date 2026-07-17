-- Trivia Rush global progression foundation: read-only production verification
--
-- Run after supabase/sql/phase-5-global-progression-foundation.sql.
-- This file does not award XP or mutate player progression.

with checks as (
  select
    (select count(*) from public.global_level_thresholds) = 50
      as has_50_level_thresholds,
    not exists (
      select 1
      from public.global_level_thresholds threshold
      where threshold.cumulative_xp <>
        50::bigint * (threshold.level - 1) * threshold.level
    ) as level_formula_valid,
    to_regclass('public.player_global_progress') is not null
      as player_progress_table_exists,
    to_regclass('public.global_xp_awards') is not null
      as award_ledger_exists,
    to_regprocedure(
      'public.get_my_global_progression()'
    ) is not null as read_rpc_exists,
    to_regprocedure(
      'trivia_private.record_global_xp_award(uuid,uuid,text,uuid,integer,integer,integer,integer,text,text,jsonb)'
    ) is not null as private_award_writer_exists
)
select
  case
    when has_50_level_thresholds
      and level_formula_valid
      and player_progress_table_exists
      and award_ledger_exists
      and read_rpc_exists
      and private_award_writer_exists
    then 'PASS'
    else 'FAIL'
  end as verification_status,
  *
from checks;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'global_level_thresholds',
    'player_global_progress',
    'global_xp_awards'
  )
order by c.relname;

select
  grantee as role_name,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'global_level_thresholds',
    'player_global_progress',
    'global_xp_awards'
  )
  and grantee in ('anon', 'authenticated')
order by grantee, table_name, privilege_type;

select
  role_name,
  has_function_privilege(
    role_name,
    'public.get_my_global_progression()',
    'EXECUTE'
  ) as can_read_own_progression,
  has_function_privilege(
    role_name,
    'trivia_private.record_global_xp_award(uuid,uuid,text,uuid,integer,integer,integer,integer,text,text,jsonb)',
    'EXECUTE'
  ) as can_write_global_xp
from (
  values ('anon'), ('authenticated'), ('service_role')
) roles(role_name)
order by role_name;

select
  trivia_private.global_base_xp('easy', true) as easy_correct_xp,
  trivia_private.global_base_xp('medium', true) as medium_correct_xp,
  trivia_private.global_base_xp('hard', true) as hard_correct_xp,
  trivia_private.global_base_xp('hard', false) as incorrect_xp,
  trivia_private.global_speed_multiplier(1500) as fastest_speed_multiplier,
  trivia_private.global_speed_multiplier(3000) as fast_speed_multiplier,
  trivia_private.global_speed_multiplier(5000) as moderate_speed_multiplier,
  trivia_private.global_speed_multiplier(5001) as standard_speed_multiplier,
  trivia_private.global_streak_multiplier(3) as streak_3_multiplier,
  trivia_private.global_streak_multiplier(5) as streak_5_multiplier,
  trivia_private.global_streak_multiplier(10) as streak_10_multiplier;

select
  trivia_private.global_score_multiplier(0.49) as score_below_50,
  trivia_private.global_score_multiplier(0.50) as score_50,
  trivia_private.global_score_multiplier(0.70) as score_70,
  trivia_private.global_score_multiplier(0.85) as score_85,
  trivia_private.global_result_multiplier('win', 'score') as score_win,
  trivia_private.global_result_multiplier('win', 'forfeit') as forfeit_win,
  trivia_private.global_result_multiplier('draw', 'draw') as draw_multiplier,
  trivia_private.global_result_multiplier('loss', 'score') as loss_multiplier;

select
  trivia_private.calculate_global_answer_xp(
    'hard',
    true,
    1200,
    6
  ) as hard_fast_streak_answer_example,
  trivia_private.calculate_global_game_xp(
    200,
    258,
    540,
    600,
    'win',
    'score'
  ) as capped_game_example;

select
  level,
  cumulative_xp
from public.global_level_thresholds
where level in (1, 2, 5, 10, 20, 25, 50)
order by level;