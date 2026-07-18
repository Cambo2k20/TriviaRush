-- Trivia Rush Phase 5 category levelling backend
-- Adds trusted per-answer category XP, independent category levels, exact
-- authoritative backfill and owner-only progression summaries.

begin;

do $$
begin
  if to_regclass('public.question_categories') is null
     or to_regclass('public.trivia_questions') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.game_runs') is null
     or to_regclass('public.game_run_answers') is null
     or to_regclass('public.duel_matches') is null
     or to_regclass('public.duel_players') is null
     or to_regclass('public.duel_answers') is null then
    raise exception 'Run the Phase 4 question, solo and duel platforms before category levelling.';
  end if;
end;
$$;

create table if not exists public.category_level_thresholds (
  level smallint primary key,
  cumulative_xp bigint not null unique,
  created_at timestamptz not null default now(),
  constraint category_level_thresholds_level_valid check (level between 1 and 500),
  constraint category_level_thresholds_xp_valid check (cumulative_xp >= 0)
);

insert into public.category_level_thresholds (level, cumulative_xp)
select
  level_number::smallint,
  (50::bigint * (level_number - 1) * level_number)::bigint
from generate_series(1, 50) as levels(level_number)
on conflict (level) do update
set cumulative_xp = excluded.cumulative_xp;

do $$
begin
  if (select cumulative_xp from public.category_level_thresholds where level = 1) <> 0 then
    raise exception 'Category level 1 must begin at zero XP.';
  end if;

  if exists (
    select 1
    from (
      select
        level,
        cumulative_xp,
        lag(cumulative_xp) over (order by level) as previous_xp
      from public.category_level_thresholds
    ) thresholds
    where previous_xp is not null
      and cumulative_xp <= previous_xp
  ) then
    raise exception 'Category level thresholds must be strictly increasing.';
  end if;
end;
$$;

create table if not exists public.player_category_progress (
  player_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null references public.question_categories(id),
  xp bigint not null default 0,
  level smallint not null default 1,
  questions_answered bigint not null default 0,
  correct_answers bigint not null default 0,
  incorrect_answers bigint not null default 0,
  solo_questions bigint not null default 0,
  duel_questions bigint not null default 0,
  last_activity_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (player_id, category_id),
  constraint player_category_progress_xp_valid check (xp >= 0),
  constraint player_category_progress_level_valid check (level between 1 and 500),
  constraint player_category_progress_totals_valid check (
    questions_answered >= 0
    and correct_answers >= 0
    and incorrect_answers >= 0
    and questions_answered = correct_answers + incorrect_answers
    and solo_questions >= 0
    and duel_questions >= 0
    and questions_answered = solo_questions + duel_questions
  )
);

create index if not exists player_category_progress_player_rank_idx
  on public.player_category_progress (player_id, level desc, xp desc);

create index if not exists player_category_progress_category_rank_idx
  on public.player_category_progress (category_id, level desc, xp desc);

create table if not exists public.category_xp_awards (
  id bigint generated always as identity primary key,
  source_kind text not null,
  source_id uuid not null,
  player_id uuid not null references public.profiles(id) on delete cascade,
  answer_key text not null,
  category_id text not null references public.question_categories(id),
  difficulty text not null,
  is_correct boolean not null,
  xp_awarded integer not null,
  level_before smallint not null,
  level_after smallint not null,
  awarded_at timestamptz not null default now(),
  unique (source_kind, source_id, player_id, answer_key),
  constraint category_xp_awards_source_kind_valid check (
    source_kind in ('solo', 'live_duel', 'turn_based')
  ),
  constraint category_xp_awards_answer_key_valid check (length(btrim(answer_key)) between 1 and 120),
  constraint category_xp_awards_difficulty_valid check (difficulty in ('easy', 'medium', 'hard')),
  constraint category_xp_awards_xp_valid check (xp_awarded in (0, 10, 15, 25)),
  constraint category_xp_awards_level_valid check (
    level_before between 1 and 500
    and level_after between level_before and 500
  )
);

create index if not exists category_xp_awards_player_source_idx
  on public.category_xp_awards (player_id, source_kind, source_id);

create index if not exists category_xp_awards_player_category_idx
  on public.category_xp_awards (player_id, category_id, awarded_at desc);

alter table public.category_level_thresholds enable row level security;
alter table public.player_category_progress enable row level security;
alter table public.category_xp_awards enable row level security;

revoke all on table public.category_level_thresholds from public, anon, authenticated;
revoke all on table public.player_category_progress from public, anon, authenticated;
revoke all on table public.category_xp_awards from public, anon, authenticated;
revoke all on sequence public.category_xp_awards_id_seq from public, anon, authenticated;

create or replace function trivia_private.category_level_for_xp(p_xp bigint)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(thresholds.level), 1)::smallint
  from public.category_level_thresholds thresholds
  where thresholds.cumulative_xp <= greatest(coalesce(p_xp, 0), 0);
$$;

create or replace function trivia_private.category_xp_for_answer(
  p_difficulty text,
  p_is_correct boolean
)
returns integer
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when not coalesce(p_is_correct, false) then 0
    when lower(p_difficulty) = 'easy' then 10
    when lower(p_difficulty) = 'medium' then 15
    when lower(p_difficulty) = 'hard' then 25
    else 0
  end;
$$;

create or replace function trivia_private.record_category_answer_progress(
  p_player_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_answer_key text,
  p_category_id text,
  p_difficulty text,
  p_is_correct boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_award_id bigint;
  v_xp integer;
  v_total_xp bigint;
  v_level_before smallint;
  v_level_after smallint;
  v_is_solo boolean;
  v_existing public.category_xp_awards%rowtype;
begin
  if p_player_id is null
     or p_source_id is null
     or nullif(btrim(p_answer_key), '') is null then
    raise exception 'Category progression requires a player, source and answer identity.';
  end if;

  if p_source_kind not in ('solo', 'live_duel', 'turn_based') then
    raise exception 'Unsupported category progression source: %', p_source_kind;
  end if;

  if not exists (
    select 1
    from public.question_categories categories
    where categories.id = p_category_id
  ) then
    raise exception 'Unknown category progression category: %', p_category_id;
  end if;

  if lower(p_difficulty) not in ('easy', 'medium', 'hard') then
    raise exception 'Unknown question difficulty: %', p_difficulty;
  end if;

  v_xp := trivia_private.category_xp_for_answer(p_difficulty, p_is_correct);
  v_is_solo := p_source_kind = 'solo';

  insert into public.category_xp_awards (
    source_kind,
    source_id,
    player_id,
    answer_key,
    category_id,
    difficulty,
    is_correct,
    xp_awarded,
    level_before,
    level_after
  )
  values (
    p_source_kind,
    p_source_id,
    p_player_id,
    btrim(p_answer_key),
    p_category_id,
    lower(p_difficulty),
    coalesce(p_is_correct, false),
    v_xp,
    1,
    1
  )
  on conflict (source_kind, source_id, player_id, answer_key) do nothing
  returning id into v_award_id;

  if v_award_id is null then
    select *
    into v_existing
    from public.category_xp_awards awards
    where awards.source_kind = p_source_kind
      and awards.source_id = p_source_id
      and awards.player_id = p_player_id
      and awards.answer_key = btrim(p_answer_key);

    return jsonb_build_object(
      'idempotent_replay', true,
      'category_id', v_existing.category_id,
      'xp_awarded', v_existing.xp_awarded,
      'level_before', v_existing.level_before,
      'level_after', v_existing.level_after
    );
  end if;

  insert into public.player_category_progress (
    player_id,
    category_id,
    xp,
    level,
    questions_answered,
    correct_answers,
    incorrect_answers,
    solo_questions,
    duel_questions,
    last_activity_at,
    updated_at
  )
  values (
    p_player_id,
    p_category_id,
    v_xp,
    1,
    1,
    case when p_is_correct then 1 else 0 end,
    case when p_is_correct then 0 else 1 end,
    case when v_is_solo then 1 else 0 end,
    case when v_is_solo then 0 else 1 end,
    now(),
    now()
  )
  on conflict (player_id, category_id) do update
  set
    xp = public.player_category_progress.xp + excluded.xp,
    questions_answered = public.player_category_progress.questions_answered + 1,
    correct_answers = public.player_category_progress.correct_answers + excluded.correct_answers,
    incorrect_answers = public.player_category_progress.incorrect_answers + excluded.incorrect_answers,
    solo_questions = public.player_category_progress.solo_questions + excluded.solo_questions,
    duel_questions = public.player_category_progress.duel_questions + excluded.duel_questions,
    last_activity_at = excluded.last_activity_at,
    updated_at = excluded.updated_at
  returning xp into v_total_xp;

  v_level_before := trivia_private.category_level_for_xp(v_total_xp - v_xp);
  v_level_after := trivia_private.category_level_for_xp(v_total_xp);

  update public.player_category_progress
  set
    level = v_level_after,
    updated_at = now()
  where player_id = p_player_id
    and category_id = p_category_id;

  update public.category_xp_awards
  set
    level_before = v_level_before,
    level_after = v_level_after
  where id = v_award_id;

  return jsonb_build_object(
    'idempotent_replay', false,
    'category_id', p_category_id,
    'xp_awarded', v_xp,
    'total_xp', v_total_xp,
    'level_before', v_level_before,
    'level_after', v_level_after,
    'level_up', v_level_after > v_level_before
  );
end;
$$;

create or replace function trivia_private.award_solo_category_progress(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
  v_answer record;
  v_processed integer := 0;
begin
  select runs.player_id
  into v_player_id
  from public.game_runs runs
  where runs.id = p_run_id
    and runs.completed_session_id is not null;

  if v_player_id is null then
    return jsonb_build_object('status', 'not_completed', 'run_id', p_run_id);
  end if;

  for v_answer in
    select
      answers.position,
      answers.is_correct,
      questions.category_id,
      lower(questions.difficulty) as difficulty
    from public.game_run_answers answers
    join public.trivia_questions questions
      on questions.id = answers.question_id
    where answers.run_id = p_run_id
    order by answers.position
  loop
    perform trivia_private.record_category_answer_progress(
      v_player_id,
      'solo',
      p_run_id,
      'position:' || v_answer.position::text,
      v_answer.category_id,
      v_answer.difficulty,
      v_answer.is_correct
    );
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'status', 'credited',
    'run_id', p_run_id,
    'player_id', v_player_id,
    'answers_processed', v_processed
  );
end;
$$;

create or replace function trivia_private.award_duel_category_progress(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_kind text;
  v_answer record;
  v_processed integer := 0;
begin
  select case
    when matches.match_format = 'turn_based' then 'turn_based'
    else 'live_duel'
  end
  into v_source_kind
  from public.duel_matches matches
  where matches.id = p_match_id
    and matches.status = 'completed';

  if v_source_kind is null then
    return jsonb_build_object('status', 'not_completed', 'match_id', p_match_id);
  end if;

  for v_answer in
    select
      answers.id,
      answers.player_id,
      answers.is_correct,
      questions.category_id,
      lower(questions.difficulty) as difficulty
    from public.duel_answers answers
    join public.trivia_questions questions
      on questions.id = answers.question_id
    where answers.match_id = p_match_id
    order by answers.player_id, answers.position
  loop
    perform trivia_private.record_category_answer_progress(
      v_answer.player_id,
      v_source_kind,
      p_match_id,
      'answer:' || v_answer.id::text,
      v_answer.category_id,
      v_answer.difficulty,
      v_answer.is_correct
    );
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'status', 'credited',
    'match_id', p_match_id,
    'source_kind', v_source_kind,
    'answers_processed', v_processed
  );
end;
$$;

create or replace function trivia_private.handle_completed_solo_category_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_session_id is not null
     and (
       old.completed_session_id is distinct from new.completed_session_id
       or old.status is distinct from new.status
     ) then
    perform trivia_private.award_solo_category_progress(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists game_runs_category_progression_after_completion
on public.game_runs;

create trigger game_runs_category_progression_after_completion
after update of completed_session_id, status
on public.game_runs
for each row
execute function trivia_private.handle_completed_solo_category_progress();

create or replace function trivia_private.handle_completed_duel_category_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from new.status then
    perform trivia_private.award_duel_category_progress(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists duel_matches_category_progression_after_completion
on public.duel_matches;

create trigger duel_matches_category_progression_after_completion
after update of status
on public.duel_matches
for each row
execute function trivia_private.handle_completed_duel_category_progress();

create or replace function trivia_private.category_progress_summary(
  p_source_kind text,
  p_source_id uuid,
  p_player_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with grouped as (
    select
      awards.category_id,
      categories.label,
      categories.icon_key,
      categories.color,
      categories.sort_order,
      sum(awards.xp_awarded)::bigint as xp_awarded,
      count(*)::bigint as questions_answered,
      count(*) filter (where awards.is_correct)::bigint as correct_answers,
      min(awards.level_before)::smallint as level_before,
      max(awards.level_after)::smallint as level_after
    from public.category_xp_awards awards
    join public.question_categories categories
      on categories.id = awards.category_id
    where awards.source_kind = p_source_kind
      and awards.source_id = p_source_id
      and awards.player_id = p_player_id
    group by
      awards.category_id,
      categories.label,
      categories.icon_key,
      categories.color,
      categories.sort_order
  )
  select jsonb_build_object(
    'status', case when count(*) = 0 then 'pending' else 'credited' end,
    'source_kind', p_source_kind,
    'source_id', p_source_id,
    'total_xp_awarded', coalesce(sum(grouped.xp_awarded), 0),
    'categories', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category_id', grouped.category_id,
          'label', grouped.label,
          'icon_key', grouped.icon_key,
          'color', grouped.color,
          'xp_awarded', grouped.xp_awarded,
          'questions_answered', grouped.questions_answered,
          'correct_answers', grouped.correct_answers,
          'level_before', grouped.level_before,
          'level_after', grouped.level_after,
          'current_xp', coalesce(progress.xp, 0),
          'current_level', coalesce(progress.level, 1)
        )
        order by grouped.sort_order
      ),
      '[]'::jsonb
    )
  )
  from grouped
  left join public.player_category_progress progress
    on progress.player_id = p_player_id
   and progress.category_id = grouped.category_id;
$$;

create or replace function public.get_my_category_progression()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with category_rows as (
    select
      categories.id as category_id,
      categories.label,
      categories.icon_key,
      categories.color,
      categories.sort_order,
      coalesce(progress.xp, 0)::bigint as xp,
      coalesce(progress.level, 1)::smallint as level,
      coalesce(progress.questions_answered, 0)::bigint as questions_answered,
      coalesce(progress.correct_answers, 0)::bigint as correct_answers,
      coalesce(progress.incorrect_answers, 0)::bigint as incorrect_answers,
      coalesce(progress.solo_questions, 0)::bigint as solo_questions,
      coalesce(progress.duel_questions, 0)::bigint as duel_questions
    from public.question_categories categories
    left join public.player_category_progress progress
      on progress.player_id = auth.uid()
     and progress.category_id = categories.id
    where categories.is_active
  ),
  enriched as (
    select
      category_rows.*,
      current_threshold.cumulative_xp as current_level_xp,
      next_threshold.level as next_level,
      next_threshold.cumulative_xp as next_level_xp
    from category_rows
    left join public.category_level_thresholds current_threshold
      on current_threshold.level = category_rows.level
    left join public.category_level_thresholds next_threshold
      on next_threshold.level = category_rows.level + 1
  )
  select jsonb_build_object(
    'total_xp', coalesce(sum(enriched.xp), 0),
    'categories', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category_id', enriched.category_id,
          'label', enriched.label,
          'icon_key', enriched.icon_key,
          'color', enriched.color,
          'xp', enriched.xp,
          'level', enriched.level,
          'current_level_xp', enriched.current_level_xp,
          'next_level', enriched.next_level,
          'next_level_xp', enriched.next_level_xp,
          'xp_into_level', enriched.xp - enriched.current_level_xp,
          'xp_to_next_level', case
            when enriched.next_level_xp is null then null
            else greatest(enriched.next_level_xp - enriched.xp, 0)
          end,
          'progress_percent', case
            when enriched.next_level_xp is null then 100
            when enriched.next_level_xp = enriched.current_level_xp then 100
            else round(
              (
                (enriched.xp - enriched.current_level_xp)::numeric
                * 100
                / (enriched.next_level_xp - enriched.current_level_xp)
              ),
              1
            )
          end,
          'questions_answered', enriched.questions_answered,
          'correct_answers', enriched.correct_answers,
          'incorrect_answers', enriched.incorrect_answers,
          'accuracy_percent', case
            when enriched.questions_answered = 0 then 0
            else round(
              enriched.correct_answers::numeric * 100 / enriched.questions_answered,
              1
            )
          end,
          'solo_questions', enriched.solo_questions,
          'duel_questions', enriched.duel_questions
        )
        order by enriched.sort_order
      ),
      '[]'::jsonb
    )
  )
  from enriched;
$$;

create or replace function public.get_solo_category_xp_summary(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  select runs.player_id
  into v_player_id
  from public.game_runs runs
  where runs.id = p_run_id;

  if v_player_id is null or v_player_id <> auth.uid() then
    raise exception 'Solo category progression summary is not available.';
  end if;

  return trivia_private.category_progress_summary('solo', p_run_id, v_player_id);
end;
$$;

create or replace function public.get_duel_category_xp_summary(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_source_kind text;
begin
  if v_player_id is null or not exists (
    select 1
    from public.duel_players players
    where players.match_id = p_match_id
      and players.player_id = v_player_id
  ) then
    raise exception 'Duel category progression summary is not available.';
  end if;

  select case
    when matches.match_format = 'turn_based' then 'turn_based'
    else 'live_duel'
  end
  into v_source_kind
  from public.duel_matches matches
  where matches.id = p_match_id;

  if v_source_kind is null then
    raise exception 'Duel category progression summary is not available.';
  end if;

  return trivia_private.category_progress_summary(v_source_kind, p_match_id, v_player_id);
end;
$$;

revoke all on function trivia_private.category_level_for_xp(bigint) from public, anon, authenticated;
revoke all on function trivia_private.category_xp_for_answer(text, boolean) from public, anon, authenticated;
revoke all on function trivia_private.record_category_answer_progress(uuid, text, uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function trivia_private.award_solo_category_progress(uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_duel_category_progress(uuid) from public, anon, authenticated;
revoke all on function trivia_private.category_progress_summary(text, uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_my_category_progression() from public;
revoke all on function public.get_solo_category_xp_summary(uuid) from public;
revoke all on function public.get_duel_category_xp_summary(uuid) from public;

grant execute on function public.get_my_category_progression() to authenticated;
grant execute on function public.get_solo_category_xp_summary(uuid) to authenticated;
grant execute on function public.get_duel_category_xp_summary(uuid) to authenticated;

do $$
declare
  v_run record;
  v_match record;
begin
  for v_run in
    select runs.id
    from public.game_runs runs
    where runs.completed_session_id is not null
    order by runs.id
  loop
    perform trivia_private.award_solo_category_progress(v_run.id);
  end loop;

  for v_match in
    select matches.id
    from public.duel_matches matches
    where matches.status = 'completed'
    order by matches.id
  loop
    perform trivia_private.award_duel_category_progress(v_match.id);
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
