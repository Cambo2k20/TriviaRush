-- Trivia Rush Phase 5 category rollback
-- Use only if the expanded bank must be hidden after deployment.
-- This is reversible: rerun phase-5-question-seed.sql to restore all ten.

begin;

update public.trivia_questions
set
  is_active = false,
  updated_at = now()
where category_id in ('food_drink', 'nature_animals', 'art_literature');

update public.question_categories
set is_active = false
where id in ('food_drink', 'nature_animals', 'art_literature');

do $$
declare
  v_active_categories integer;
  v_active_questions integer;
begin
  select count(*)::integer
  into v_active_categories
  from public.question_categories
  where is_active;

  select count(*)::integer
  into v_active_questions
  from public.trivia_questions
  where is_active;

  if v_active_categories <> 7 or v_active_questions <> 700 then
    raise exception
      'Rollback expected 7 categories and 700 questions; found % categories and % questions.',
      v_active_categories,
      v_active_questions;
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
