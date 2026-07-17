-- Trivia Rush — Phase 4A final cutover
-- Run only after phase-4a-question-platform.sql, phase-4a-question-seed.sql,
-- and the Phase 4A frontend have been deployed and a production game passes.
--
-- This closes the legacy client-computed result path. The function is kept in
-- place for a reversible rollback, but browser roles can no longer execute it.

begin;

do $$
declare
  v_question_count integer;
begin
  if to_regprocedure('public.start_solo_game(text,text)') is null
     or to_regprocedure('public.submit_solo_answer(uuid,integer,integer,uuid)') is null
     or to_regprocedure('public.finish_solo_game(uuid)') is null then
    raise exception 'Phase 4A authoritative solo RPCs are incomplete';
  end if;

  select count(*)::integer
  into v_question_count
  from public.trivia_questions
  where is_active;

  if v_question_count <> 700 then
    raise exception
      'Phase 4A question bank must contain exactly 700 active questions; found %',
      v_question_count;
  end if;

  if exists (
    select 1
    from public.question_categories qc
    left join public.trivia_questions q
      on q.category_id = qc.id
     and q.is_active
    where qc.is_active
    group by qc.id
    having count(q.id) <> 100
  ) then
    raise exception 'Every active category must contain exactly 100 questions';
  end if;

  if to_regprocedure(
    'public.submit_game_result(integer,integer,integer,integer,integer,integer,integer,text,text)'
  ) is null then
    raise exception 'Established submit_game_result signature was not found';
  end if;
end;
$$;

revoke execute
on function public.submit_game_result(
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
)
from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Expected after the cutover: has_function_privilege = false for each role.
select
  role_name,
  has_function_privilege(
    role_name,
    'public.submit_game_result(integer,integer,integer,integer,integer,integer,integer,text,text)',
    'EXECUTE'
  ) as has_function_privilege
from unnest(array['anon', 'authenticated']) as roles(role_name);
