-- Trivia Rush Phase 4A verification
-- Run after phase-4a-question-platform.sql and phase-4a-question-seed.sql.
-- Every query is read-only.

-- 1. Required objects and modes.
select
  to_regclass('public.question_categories') as question_categories,
  to_regclass('public.trivia_questions') as trivia_questions,
  to_regclass('public.game_runs') as game_runs,
  to_regclass('public.game_run_questions') as game_run_questions,
  to_regclass('public.game_run_answers') as game_run_answers,
  to_regprocedure('public.get_question_categories()') as category_rpc,
  to_regprocedure('public.start_solo_game(text,text)') as start_rpc,
  to_regprocedure('public.get_current_solo_question(uuid)') as current_question_rpc,
  to_regprocedure('public.submit_solo_answer(uuid,integer,integer,uuid)') as answer_rpc,
  to_regprocedure('public.finish_solo_game(uuid)') as finish_rpc;

select
  mode,
  label,
  mode_family,
  duration_seconds,
  max_questions,
  max_points_per_question,
  is_active
from public.game_modes
order by mode_family, duration_seconds;

-- 2. Exactly 700 active questions: 100 per category.
select
  qc.id as category_id,
  qc.label,
  count(q.id) filter (where q.is_active) as active_questions
from public.question_categories qc
left join public.trivia_questions q
  on q.category_id = qc.id
group by qc.id, qc.label, qc.sort_order
order by qc.sort_order;

select count(*) as total_active_questions
from public.trivia_questions
where is_active;

-- 3. Each category must contain 40 easy, 40 medium and 20 hard questions.
select
  category_id,
  count(*) filter (where difficulty = 'easy') as easy,
  count(*) filter (where difficulty = 'medium') as medium,
  count(*) filter (where difficulty = 'hard') as hard,
  count(*) as total
from public.trivia_questions
where is_active
group by category_id
order by category_id;

-- 4. Correct-answer positions must be balanced across the complete bank.
select
  correct_index,
  count(*) as questions
from public.trivia_questions
where is_active
group by correct_index
order by correct_index;

-- 5. These quality checks must all return zero.
select
  count(*) filter (
    where char_length(btrim(question_text)) not between 10 and 240
  ) as invalid_question_text,
  count(*) filter (
    where not trivia_private.question_answers_are_valid(answers)
  ) as invalid_answers,
  count(*) filter (
    where correct_index not between 0 and 2
  ) as invalid_correct_indexes,
  count(*) filter (
    where source_url !~ '^https://'
  ) as invalid_source_urls,
  count(*) filter (
    where verified_at is null
  ) as missing_verification_dates
from public.trivia_questions;

select count(*) as duplicate_normalised_questions
from (
  select lower(regexp_replace(btrim(question_text), '\s+', ' ', 'g'))
  from public.trivia_questions
  group by lower(regexp_replace(btrim(question_text), '\s+', ' ', 'g'))
  having count(*) > 1
) duplicates;

-- 6. Clients must have no direct table privileges.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'question_categories',
    'trivia_questions',
    'game_runs',
    'game_run_questions',
    'game_run_answers'
  )
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Expected: no rows.

-- 7. RLS must be enabled on every RPC-only table.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'question_categories',
    'trivia_questions',
    'game_runs',
    'game_run_questions',
    'game_run_answers'
  )
order by c.relname;

-- 8. No correct answer may be exposed by the category RPC.
select *
from public.get_question_categories();

