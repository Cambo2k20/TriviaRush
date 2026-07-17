-- Trivia Rush Phase 5 category and 1,000-question verification
-- Run after phase-5-category-platform.sql and phase-5-question-seed.sql.
-- Every query is read-only.

-- 1. Exactly ten active categories with complete card metadata and 100 questions.
select
  qc.id as category_id,
  qc.label,
  qc.icon_key,
  qc.color,
  qc.sort_order,
  count(q.id) filter (where q.is_active) as active_questions
from public.question_categories qc
left join public.trivia_questions q
  on q.category_id = qc.id
where qc.is_active
group by qc.id, qc.label, qc.icon_key, qc.color, qc.sort_order
order by qc.sort_order;

-- Expected: ten rows; active_questions is 100 on every row.

select
  count(*) filter (where is_active) as active_categories,
  count(*) filter (
    where is_active
      and icon_key is not null
      and color ~ '^#[0-9A-F]{6}$'
  ) as categories_with_card_metadata
from public.question_categories;

-- Expected: 10 and 10.

-- 2. Exactly 1,000 active questions at 40/40/20 per category.
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

select count(*) as total_active_questions
from public.trivia_questions
where is_active;

-- Expected: 40/40/20/100 on each row and 1,000 total.

-- 3. Correct-answer positions remain globally balanced.
select correct_index, count(*) as questions
from public.trivia_questions
where is_active
group by correct_index
order by correct_index;

-- Expected: 334 / 333 / 333.

-- 4. Moved questions kept their stable keys and changed only category.
select question_key, category_id
from public.trivia_questions
where question_key in (
  'science-039',
  'entertainment-006',
  'entertainment-007',
  'entertainment-009',
  'entertainment-010',
  'entertainment-011',
  'entertainment-012',
  'entertainment-013',
  'entertainment-014',
  'entertainment-015',
  'entertainment-016',
  'entertainment-017',
  'entertainment-018',
  'entertainment-019',
  'entertainment-020',
  'entertainment-041',
  'entertainment-042',
  'entertainment-043',
  'entertainment-044',
  'entertainment-045',
  'entertainment-046',
  'entertainment-047',
  'entertainment-048',
  'entertainment-049',
  'entertainment-050',
  'entertainment-081',
  'entertainment-082',
  'entertainment-083',
  'entertainment-084',
  'entertainment-085'
)
order by question_key;

-- Expected: science-039 is nature_animals; all 29 entertainment keys are
-- art_literature.

-- 5. All quality checks must return zero.
select
  count(*) filter (
    where char_length(btrim(question_text)) not between 10 and 240
  ) as invalid_question_text,
  count(*) filter (
    where not trivia_private.question_answers_are_valid(answers)
  ) as invalid_answers,
  count(*) filter (where correct_index not between 0 and 2) as invalid_indexes,
  count(*) filter (where source_url !~ '^https://') as invalid_source_urls,
  count(*) filter (where verified_at is null) as missing_verified_at
from public.trivia_questions
where is_active;

select count(*) as duplicate_normalised_questions
from (
  select lower(regexp_replace(btrim(question_text), '\s+', ' ', 'g'))
  from public.trivia_questions
  where is_active
  group by lower(regexp_replace(btrim(question_text), '\s+', ' ', 'g'))
  having count(*) > 1
) duplicates;

-- 6. Category RPC exposes safe display metadata, never answer data.
select *
from public.get_question_categories();

-- Expected: ten rows in sort order with category_id, label, question_count,
-- icon_key, color and sort_order only.

-- 7. Browser roles still have no direct access to question storage.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('question_categories', 'trivia_questions')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Expected: no rows.
