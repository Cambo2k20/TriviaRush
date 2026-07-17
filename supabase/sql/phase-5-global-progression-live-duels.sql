-- Trivia Rush Phase 5: live duel global XP integration
--
-- Run after phase-5-global-progression-foundation.sql and the Phase 4B live
-- duel deployment. This additive migration awards trusted global XP to both
-- players when an authoritative live duel transitions to completed.

begin;

do $$
begin
  if to_regclass('public.duel_matches') is null
     or to_regclass('public.duel_players') is null
     or to_regclass('public.duel_answers') is null
     or to_regclass('public.trivia_questions') is null then
    raise exception 'Authoritative live duel tables are required';
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

-- Maximum score for N answered questions under the current authoritative live
-- duel scoring model: perfect accuracy, zero response time and an uninterrupted
-- streak. This prevents the browser from supplying the score denominator.
create or replace function trivia_private.global_live_duel_max_possible_score(
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
on function trivia_private.global_live_duel_max_possible_score(integer)
from public, anon, authenticated;

-- Reconstruct one player's XP inputs from accepted server-owned duel answers.
-- Streak, difficulty, response time, score and outcome are all read from trusted
-- database state rather than accepted as browser parameters.
create or replace function trivia_private.calculate_live_duel_global_xp(
  p_match_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.duel_matches%rowtype;
  v_player public.duel_players%rowtype;
  v_answer record;
  v_answer_calculation jsonb;
  v_streak integer := 0;
  v_answer_count integer := 0;
  v_correct_count integer := 0;
  v_incorrect_count integer := 0;
  v_base_xp integer := 0;
  v_answer_xp integer := 0;
  v_points_total integer := 0;
  v_max_possible_score integer := 0;
  v_answers jsonb := '[]'::jsonb;
begin
  if p_match_id is null or p_player_id is null then
    raise exception 'Live duel match and player are required';
  end if;

  select *
  into v_match
  from public.duel_matches
  where id = p_match_id;

  if not found then
    raise exception 'Live duel does not exist';
  end if;

  if v_match.status <> 'completed'
     or v_match.result_reason is null then
    raise exception 'Live duel is not completed';
  end if;

  select *
  into v_player
  from public.duel_players
  where match_id = p_match_id
    and player_id = p_player_id;

  if not found then
    raise exception 'Player did not participate in this live duel';
  end if;

  if v_player.completed_session_id is null
     or v_player.outcome is null then
    raise exception 'Live duel player result is incomplete';
  end if;

  if not exists (
    select 1
    from public.game_sessions session
    where session.id = v_player.completed_session_id
      and session.player_id = v_player.player_id
      and session.duel_match_id = v_player.match_id
  ) then
    raise exception 'Live duel session does not match the player and duel';
  end if;

  for v_answer in
    select
      answer.position,
      answer.question_id,
      answer.is_correct,
      answer.response_ms,
      answer.points_awarded,
      question.difficulty
    from public.duel_answers answer
    join public.trivia_questions question
      on question.id = answer.question_id
    where answer.match_id = v_player.match_id
      and answer.player_id = v_player.player_id
    order by answer.position
  loop
    v_answer_count := v_answer_count + 1;
    v_points_total := v_points_total + v_answer.points_awarded;

    if v_answer.is_correct then
      v_streak := v_streak + 1;
      v_correct_count := v_correct_count + 1;
    else
      v_streak := 0;
      v_incorrect_count := v_incorrect_count + 1;
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

  if v_answer_count <> v_player.questions_answered
     or v_correct_count <> v_player.correct_answers
     or v_incorrect_count <> v_player.incorrect_answers then
    raise exception
      'Live duel answer totals do not match player state for match %, player %',
      v_player.match_id,
      v_player.player_id;
  end if;

  if v_points_total <> v_player.score then
    raise exception
      'Live duel score mismatch for match %, player %: player %, answers %',
      v_player.match_id,
      v_player.player_id,
      v_player.score,
      v_points_total;
  end if;

  v_max_possible_score :=
    trivia_private.global_live_duel_max_possible_score(v_answer_count);

  return jsonb_build_object(
    'match_id', v_match.id,
    'game_session_id', v_player.completed_session_id,
    'player_id', v_player.player_id,
    'questions_answered', v_answer_count,
    'base_xp', v_base_xp,
    'answer_xp', v_answer_xp,
    'score', v_player.score,
    'max_possible_score', v_max_possible_score,
    'outcome', v_player.outcome,
    'result_reason', v_match.result_reason,
    'answers', v_answers
  );
end;
$$;

revoke all
on function trivia_private.calculate_live_duel_global_xp(uuid, uuid)
from public, anon, authenticated;

-- Idempotent internal integration entry point. Each participant has a distinct
-- game session, and the global ledger uniquely keys awards by that session ID.
create or replace function trivia_private.award_live_duel_global_xp(
  p_match_id uuid,
  p_player_id uuid
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
  v_calculation := trivia_private.calculate_live_duel_global_xp(
    p_match_id,
    p_player_id
  );

  v_result := trivia_private.record_global_xp_award(
    (v_calculation ->> 'player_id')::uuid,
    (v_calculation ->> 'game_session_id')::uuid,
    'live_duel',
    p_match_id,
    (v_calculation ->> 'base_xp')::integer,
    (v_calculation ->> 'answer_xp')::integer,
    (v_calculation ->> 'score')::integer,
    (v_calculation ->> 'max_possible_score')::integer,
    v_calculation ->> 'outcome',
    v_calculation ->> 'result_reason',
    jsonb_build_object(
      'calculation_version', 1,
      'questions_answered',
        (v_calculation ->> 'questions_answered')::integer,
      'outcome', v_calculation ->> 'outcome',
      'result_reason', v_calculation ->> 'result_reason',
      'answers', v_calculation -> 'answers'
    )
  );

  return v_result || jsonb_build_object(
    'source_kind', 'live_duel',
    'source_id', p_match_id,
    'outcome', v_calculation ->> 'outcome',
    'result_reason', v_calculation ->> 'result_reason'
  );
end;
$$;

revoke all
on function trivia_private.award_live_duel_global_xp(uuid, uuid)
from public, anon, authenticated;

-- The Phase 4B finaliser creates both game sessions and stores both player
-- outcomes before transitioning duel_matches.status to completed. Awarding from
-- that final transition therefore sees a complete, internally consistent match.
create or replace function trivia_private.award_live_duel_global_xp_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant record;
  v_participant_count integer := 0;
begin
  for v_participant in
    select player.player_id
    from public.duel_players player
    where player.match_id = new.id
    order by player.player_role
  loop
    v_participant_count := v_participant_count + 1;
    perform trivia_private.award_live_duel_global_xp(
      new.id,
      v_participant.player_id
    );
  end loop;

  if v_participant_count <> 2 then
    raise exception 'Completed live duel must contain exactly two players';
  end if;

  return new;
end;
$$;

revoke all
on function trivia_private.award_live_duel_global_xp_after_completion()
from public, anon, authenticated;

drop trigger if exists award_live_duel_global_xp_after_completion_trigger
on public.duel_matches;

create trigger award_live_duel_global_xp_after_completion_trigger
after update of status
on public.duel_matches
for each row
when (
  new.status = 'completed'
  and old.status is distinct from new.status
)
execute function trivia_private.award_live_duel_global_xp_after_completion();

-- Safe read model for a participant's own award. Older completed duels can
-- legitimately return uncredited until the separate historical backfill runs.
create or replace function public.get_live_duel_global_xp_summary(
  p_match_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_match public.duel_matches%rowtype;
  v_player public.duel_players%rowtype;
  v_award public.global_xp_awards%rowtype;
  v_progress public.player_global_progress%rowtype;
begin
  if v_player_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
  into v_match
  from public.duel_matches
  where id = p_match_id;

  if not found then
    raise exception 'Live duel does not exist';
  end if;

  select *
  into v_player
  from public.duel_players
  where match_id = p_match_id
    and player_id = v_player_id;

  if not found then
    raise exception 'Player did not participate in this live duel';
  end if;

  if v_match.status <> 'completed'
     or v_player.completed_session_id is null then
    return jsonb_build_object(
      'status', 'pending',
      'match_id', v_match.id
    );
  end if;

  select *
  into v_award
  from public.global_xp_awards
  where game_session_id = v_player.completed_session_id
    and source_kind = 'live_duel';

  if not found then
    return jsonb_build_object(
      'status', 'uncredited',
      'match_id', v_match.id,
      'game_session_id', v_player.completed_session_id,
      'outcome', v_player.outcome,
      'result_reason', v_match.result_reason
    );
  end if;

  select *
  into v_progress
  from public.player_global_progress
  where player_id = v_player_id;

  return jsonb_build_object(
    'status', 'credited',
    'match_id', v_match.id,
    'game_session_id', v_award.game_session_id,
    'outcome', v_player.outcome,
    'result_reason', v_match.result_reason,
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
on function public.get_live_duel_global_xp_summary(uuid)
from public, anon;

grant execute
on function public.get_live_duel_global_xp_summary(uuid)
to authenticated;

commit;

notify pgrst, 'reload schema';