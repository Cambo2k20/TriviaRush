-- Trivia Rush Phase 5: solo global XP integration
--
-- Run after phase-5-global-progression-foundation.sql.
-- This additive migration awards trusted global XP when an authoritative solo
-- run transitions to a completed game session.

begin;

do $$
begin
  if to_regclass('public.game_runs') is null
     or to_regclass('public.game_run_answers') is null
     or to_regclass('public.trivia_questions') is null then
    raise exception 'Authoritative solo game tables are required';
  end if;

  if to_regclass('public.player_global_progress') is null
     or to_regclass('public.global_xp_awards') is null
     or to_regprocedure(
       'trivia_private.record_global_xp_award(uuid,uuid,text,uuid,integer,integer,integer,integer,text,text,jsonb)'
     ) is null then
    raise exception 'Global progression foundation must be deployed first';
  end if;
end;
$$;

-- Maximum score for N answered solo questions under the current authoritative
-- scoring rules: perfect accuracy, zero response time and an uninterrupted
-- streak. This normalises score without trusting a client-supplied maximum.
create or replace function trivia_private.global_solo_max_possible_score(
  p_questions_answered integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    sum(
      round(
        200::numeric * least(
          3.0::numeric,
          1.0::numeric + floor((position - 1) / 3.0::numeric) * 0.5::numeric
        )
      )::integer
    ),
    0
  )::integer
  from generate_series(
    1,
    greatest(coalesce(p_questions_answered, 0), 0)
  ) as positions(position);
$$;

revoke all
on function trivia_private.global_solo_max_possible_score(integer)
from public, anon, authenticated;

-- Reconstruct the XP inputs from authoritative accepted-answer rows. The
-- streak is recalculated in answer order so the browser cannot influence it.
create or replace function trivia_private.calculate_solo_global_xp(
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_run public.game_runs%rowtype;
  v_answer record;
  v_answer_calculation jsonb;
  v_streak integer := 0;
  v_answer_count integer := 0;
  v_base_xp integer := 0;
  v_answer_xp integer := 0;
  v_points_total integer := 0;
  v_max_possible_score integer := 0;
  v_answers jsonb := '[]'::jsonb;
begin
  select *
  into v_run
  from public.game_runs
  where id = p_run_id;

  if not found then
    raise exception 'Solo run does not exist';
  end if;

  if v_run.status <> 'completed' or v_run.completed_session_id is null then
    raise exception 'Solo run is not completed';
  end if;

  for v_answer in
    select
      answer.position,
      answer.question_id,
      answer.is_correct,
      answer.response_ms,
      answer.points_awarded,
      question.difficulty
    from public.game_run_answers answer
    join public.trivia_questions question
      on question.id = answer.question_id
    where answer.run_id = v_run.id
    order by answer.position
  loop
    v_answer_count := v_answer_count + 1;
    v_points_total := v_points_total + v_answer.points_awarded;

    if v_answer.is_correct then
      v_streak := v_streak + 1;
    else
      v_streak := 0;
    end if;

    v_answer_calculation := trivia_private.calculate_global_answer_xp(
      v_answer.difficulty,
      v_answer.is_correct,
      v_answer.response_ms,
      v_streak
    );

    v_base_xp := v_base_xp
      + (v_answer_calculation ->> 'base_xp')::integer;
    v_answer_xp := v_answer_xp
      + (v_answer_calculation ->> 'answer_xp')::integer;

    v_answers := v_answers || jsonb_build_array(
      jsonb_build_object(
        'position', v_answer.position,
        'question_id', v_answer.question_id,
        'difficulty', v_answer.difficulty,
        'is_correct', v_answer.is_correct,
        'response_ms', v_answer.response_ms,
        'streak', v_streak,
        'base_xp', (v_answer_calculation ->> 'base_xp')::integer,
        'speed_multiplier', v_answer_calculation -> 'speed_multiplier',
        'streak_multiplier', v_answer_calculation -> 'streak_multiplier',
        'answer_xp', (v_answer_calculation ->> 'answer_xp')::integer
      )
    );
  end loop;

  if v_answer_count <> v_run.questions_answered then
    raise exception
      'Solo answer count mismatch for run %: run %, rows %',
      v_run.id,
      v_run.questions_answered,
      v_answer_count;
  end if;

  if v_points_total <> v_run.score then
    raise exception
      'Solo score mismatch for run %: run %, answers %',
      v_run.id,
      v_run.score,
      v_points_total;
  end if;

  v_max_possible_score :=
    trivia_private.global_solo_max_possible_score(v_answer_count);

  return jsonb_build_object(
    'run_id', v_run.id,
    'game_session_id', v_run.completed_session_id,
    'player_id', v_run.player_id,
    'questions_answered', v_answer_count,
    'base_xp', v_base_xp,
    'answer_xp', v_answer_xp,
    'score', v_run.score,
    'max_possible_score', v_max_possible_score,
    'answers', v_answers
  );
end;
$$;

revoke all
on function trivia_private.calculate_solo_global_xp(uuid)
from public, anon, authenticated;

-- Idempotent internal integration entry point. The underlying award writer has
-- a unique game_session_id ledger key, so retries cannot grant XP twice.
create or replace function trivia_private.award_solo_global_xp(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calculation jsonb;
  v_result jsonb;
begin
  v_calculation := trivia_private.calculate_solo_global_xp(p_run_id);

  v_result := trivia_private.record_global_xp_award(
    (v_calculation ->> 'player_id')::uuid,
    (v_calculation ->> 'game_session_id')::uuid,
    'solo',
    p_run_id,
    (v_calculation ->> 'base_xp')::integer,
    (v_calculation ->> 'answer_xp')::integer,
    (v_calculation ->> 'score')::integer,
    (v_calculation ->> 'max_possible_score')::integer,
    null,
    null,
    jsonb_build_object(
      'calculation_version', 1,
      'questions_answered',
        (v_calculation ->> 'questions_answered')::integer,
      'answers', v_calculation -> 'answers'
    )
  );

  return v_result || jsonb_build_object(
    'source_kind', 'solo',
    'source_id', p_run_id
  );
end;
$$;

revoke all
on function trivia_private.award_solo_global_xp(uuid)
from public, anon, authenticated;

create or replace function trivia_private.award_solo_global_xp_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_session_id is not null
     and new.completed_session_id is distinct from old.completed_session_id then
    perform trivia_private.award_solo_global_xp(new.id);
  end if;

  return new;
end;
$$;

revoke all
on function trivia_private.award_solo_global_xp_after_completion()
from public, anon, authenticated;

drop trigger if exists award_solo_global_xp_after_completion_trigger
on public.game_runs;

create trigger award_solo_global_xp_after_completion_trigger
after update of completed_session_id
on public.game_runs
for each row
execute function trivia_private.award_solo_global_xp_after_completion();

-- Safe read model for the owner of a completed solo run. Older runs completed
-- before this integration may legitimately return status = 'uncredited' until
-- the separate historical backfill is deployed.
create or replace function public.get_solo_global_xp_summary(
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_run public.game_runs%rowtype;
  v_award public.global_xp_awards%rowtype;
  v_progress public.player_global_progress%rowtype;
begin
  if v_player_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into v_run
  from public.game_runs
  where id = p_run_id
    and player_id = v_player_id;

  if not found then
    raise exception 'Solo run does not exist';
  end if;

  if v_run.completed_session_id is null then
    return jsonb_build_object(
      'status', 'pending',
      'run_id', v_run.id
    );
  end if;

  select *
  into v_award
  from public.global_xp_awards
  where game_session_id = v_run.completed_session_id;

  if not found then
    return jsonb_build_object(
      'status', 'uncredited',
      'run_id', v_run.id,
      'game_session_id', v_run.completed_session_id
    );
  end if;

  select *
  into v_progress
  from public.player_global_progress
  where player_id = v_player_id;

  return jsonb_build_object(
    'status', 'credited',
    'run_id', v_run.id,
    'game_session_id', v_award.game_session_id,
    'xp_awarded', v_award.xp_awarded,
    'base_xp', v_award.base_xp,
    'answer_xp', v_award.answer_xp,
    'score_efficiency', v_award.score_efficiency,
    'score_multiplier', v_award.score_multiplier,
    'result_multiplier', v_award.result_multiplier,
    'uncapped_xp', v_award.uncapped_xp,
    'cap_xp', v_award.cap_xp,
    'total_xp', v_progress.total_xp,
    'level', v_progress.level,
    'credited_games', v_progress.credited_games,
    'breakdown', v_award.breakdown
  );
end;
$$;

revoke all
on function public.get_solo_global_xp_summary(uuid)
from public, anon;

grant execute
on function public.get_solo_global_xp_summary(uuid)
to authenticated;

commit;

notify pgrst, 'reload schema';
