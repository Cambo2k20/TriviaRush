-- Trivia Rush Phase 4A: database question platform and authoritative solo engine
--
-- DEPLOYMENT
--   Run only after Phase 3 is live. This migration is additive and keeps the
--   existing questions.js frontend and submit_game_result RPC working until
--   the Phase 4A frontend is deployed and verified.
--
-- SECURITY MODEL
--   * Clients cannot read questions or write game state directly.
--   * Public RPCs identify the caller with auth.uid().
--   * The server owns question order, timing, answer checking and scoring.
--   * game_sessions remains the only completed per-player game history.

begin;

-- ---------------------------------------------------------------------------
-- Preconditions
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Required table public.profiles does not exist.';
  end if;

  if to_regclass('public.game_sessions') is null then
    raise exception 'Required table public.game_sessions does not exist.';
  end if;

  if to_regclass('public.game_modes') is null then
    raise exception 'Required table public.game_modes does not exist. Run Phase 3 first.';
  end if;

  if to_regprocedure(
    'public.submit_game_result(integer,integer,integer,integer,integer,integer,integer,text,text)'
  ) is null then
    raise exception 'Required Phase 3 submit_game_result RPC does not exist.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mode families
-- ---------------------------------------------------------------------------

alter table public.game_modes
add column if not exists mode_family text;

update public.game_modes
set mode_family = 'solo'
where mode_family is null;

alter table public.game_modes
alter column mode_family set default 'solo';

alter table public.game_modes
alter column mode_family set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.game_modes'::regclass
      and conname = 'game_modes_family_valid'
  ) then
    alter table public.game_modes
    add constraint game_modes_family_valid
    check (mode_family in ('solo', 'duel'));
  end if;
end;
$$;

update public.game_modes
set mode_family = 'solo'
where mode = 'rush_60';

insert into public.game_modes (
  mode,
  label,
  duration_seconds,
  max_questions,
  max_points_per_question,
  is_active,
  mode_family
)
values
  ('duel_30', '30 Second Duel', 30, 40, 600, true, 'duel'),
  ('duel_60', '60 Second Duel', 60, 80, 600, true, 'duel'),
  ('duel_90', '90 Second Duel', 90, 100, 600, true, 'duel')
on conflict (mode) do update
set
  label = excluded.label,
  duration_seconds = excluded.duration_seconds,
  max_questions = excluded.max_questions,
  max_points_per_question = excluded.max_points_per_question,
  is_active = excluded.is_active,
  mode_family = excluded.mode_family;

-- ---------------------------------------------------------------------------
-- Category and question storage
-- ---------------------------------------------------------------------------

create table if not exists public.question_categories (
  id text primary key,
  label text not null,
  sort_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint question_categories_id_valid check (
    id = lower(btrim(id))
    and id ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  constraint question_categories_label_valid check (
    char_length(btrim(label)) between 2 and 40
  ),
  constraint question_categories_sort_order_valid check (
    sort_order between 1 and 1000
  )
);

insert into public.question_categories (id, label, sort_order)
values
  ('science', 'Science', 10),
  ('history', 'History', 20),
  ('geography', 'Geography', 30),
  ('entertainment', 'Entertainment', 40),
  ('sport', 'Sport', 50),
  ('technology', 'Technology', 60),
  ('gaming', 'Gaming', 70)
on conflict (id) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

create table if not exists public.trivia_questions (
  id bigint generated always as identity primary key,
  question_key text not null unique,
  category_id text not null
    references public.question_categories(id),
  difficulty text not null,
  question_text text not null,
  answers jsonb not null,
  correct_index smallint not null,
  source_name text not null,
  source_url text not null,
  verified_at date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint trivia_questions_key_valid check (
    question_key = lower(btrim(question_key))
    and question_key ~ '^[a-z][a-z0-9_-]{2,79}$'
  ),
  constraint trivia_questions_difficulty_valid check (
    difficulty in ('easy', 'medium', 'hard')
  ),
  constraint trivia_questions_text_valid check (
    char_length(btrim(question_text)) between 10 and 240
  ),
  constraint trivia_questions_answers_array check (
    jsonb_typeof(answers) = 'array'
    and jsonb_array_length(answers) = 3
  ),
  constraint trivia_questions_correct_index_valid check (
    correct_index between 0 and 2
  ),
  constraint trivia_questions_source_name_valid check (
    char_length(btrim(source_name)) between 2 and 120
  ),
  constraint trivia_questions_source_url_valid check (
    source_url ~ '^https://'
    and char_length(source_url) <= 500
  )
);

create unique index if not exists
trivia_questions_normalised_text_unique
on public.trivia_questions (
  lower(regexp_replace(btrim(question_text), '\s+', ' ', 'g'))
);

create index if not exists
trivia_questions_active_category_difficulty_idx
on public.trivia_questions (
  category_id,
  difficulty,
  id
)
where is_active;

create or replace function trivia_private.question_answers_are_valid(
  p_answers jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_answers) = 'array'
    and jsonb_array_length(p_answers) = 3
    and not exists (
      select 1
      from jsonb_array_elements(p_answers) answer(value)
      where jsonb_typeof(answer.value) <> 'string'
         or char_length(btrim(answer.value #>> '{}')) not between 1 and 120
    )
    and (
      select count(distinct lower(btrim(answer.value #>> '{}')))
      from jsonb_array_elements(p_answers) answer(value)
    ) = 3;
$$;

revoke all
on function trivia_private.question_answers_are_valid(jsonb)
from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trivia_questions'::regclass
      and conname = 'trivia_questions_answers_valid'
  ) then
    alter table public.trivia_questions
    add constraint trivia_questions_answers_valid
    check (trivia_private.question_answers_are_valid(answers));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Authoritative operational game state
-- ---------------------------------------------------------------------------

create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null
    references public.profiles(id) on delete cascade,
  game_mode text not null
    references public.game_modes(mode),
  category_id text not null,
  status text not null default 'active',
  started_at timestamptz not null,
  ends_at timestamptz not null,
  current_position integer not null default 1,
  current_question_started_at timestamptz null,
  next_question_at timestamptz null,
  score integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  incorrect_answers integer not null default 0,
  total_response_ms bigint not null default 0,
  completed_session_id uuid null
    references public.game_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint game_runs_category_valid check (
    category_id = 'mixed'
    or category_id ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  constraint game_runs_status_valid check (
    status in ('active', 'completed', 'expired', 'cancelled')
  ),
  constraint game_runs_time_valid check (ends_at > started_at),
  constraint game_runs_position_valid check (current_position >= 1),
  constraint game_runs_score_valid check (score >= 0),
  constraint game_runs_streak_valid check (
    streak >= 0 and best_streak >= streak
  ),
  constraint game_runs_answer_counts_valid check (
    questions_answered >= 0
    and correct_answers >= 0
    and incorrect_answers >= 0
    and correct_answers + incorrect_answers = questions_answered
  ),
  constraint game_runs_response_time_valid check (total_response_ms >= 0)
);

create unique index if not exists
game_runs_one_active_solo_per_player_idx
on public.game_runs (player_id)
where status = 'active';

create index if not exists
game_runs_player_created_idx
on public.game_runs (player_id, created_at desc);

create index if not exists
game_runs_expiry_idx
on public.game_runs (ends_at)
where status = 'active';

create table if not exists public.game_run_questions (
  run_id uuid not null
    references public.game_runs(id) on delete cascade,
  position integer not null,
  question_id bigint not null
    references public.trivia_questions(id),
  primary key (run_id, position),
  unique (run_id, question_id),
  constraint game_run_questions_position_valid check (position >= 1)
);

create table if not exists public.game_run_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.game_runs(id) on delete cascade,
  position integer not null,
  question_id bigint not null
    references public.trivia_questions(id),
  request_id uuid not null,
  selected_index smallint null,
  is_correct boolean not null,
  response_ms integer not null,
  points_awarded integer not null,
  answered_at timestamptz not null default now(),

  unique (run_id, position),
  unique (run_id, request_id),
  constraint game_run_answers_position_valid check (position >= 1),
  constraint game_run_answers_selected_index_valid check (
    selected_index is null or selected_index between 0 and 2
  ),
  constraint game_run_answers_response_valid check (
    response_ms between 0 and 600000
  ),
  constraint game_run_answers_points_valid check (
    points_awarded between 0 and 10000
  )
);

alter table public.question_categories enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.game_runs enable row level security;
alter table public.game_run_questions enable row level security;
alter table public.game_run_answers enable row level security;

revoke all on table public.question_categories from public, anon, authenticated;
revoke all on table public.trivia_questions from public, anon, authenticated;
revoke all on table public.game_runs from public, anon, authenticated;
revoke all on table public.game_run_questions from public, anon, authenticated;
revoke all on table public.game_run_answers from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

create or replace function trivia_private.game_run_question_payload(
  p_run_id uuid,
  p_position integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'position', grq.position,
    'question_id', q.id,
    'category_id', q.category_id,
    'category_label', qc.label,
    'difficulty', q.difficulty,
    'question', q.question_text,
    'answers', q.answers
  )
  from public.game_run_questions grq
  join public.trivia_questions q
    on q.id = grq.question_id
  join public.question_categories qc
    on qc.id = q.category_id
  where grq.run_id = p_run_id
    and grq.position = p_position
    and q.is_active;
$$;

revoke all
on function trivia_private.game_run_question_payload(uuid, integer)
from public, anon, authenticated;

create or replace function trivia_private.finalise_solo_game(
  p_run_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.game_runs%rowtype;
  v_session_id uuid;
  v_average_response_ms integer;
begin
  select *
  into v_run
  from public.game_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'Game run does not exist';
  end if;

  if v_run.completed_session_id is not null then
    return v_run.completed_session_id;
  end if;

  if v_run.status <> 'active' then
    return null;
  end if;

  if v_run.questions_answered = 0 then
    update public.game_runs
    set
      status = 'expired',
      updated_at = p_now
    where id = p_run_id;

    return null;
  end if;

  v_average_response_ms := round(
    v_run.total_response_ms::numeric /
    v_run.questions_answered::numeric
  )::integer;

  insert into public.game_sessions (
    player_id,
    game_mode,
    category,
    questions_answered,
    correct_answers,
    incorrect_answers,
    score,
    best_streak,
    average_response_ms,
    duration_seconds,
    played_at
  )
  values (
    v_run.player_id,
    v_run.game_mode,
    v_run.category_id,
    v_run.questions_answered,
    v_run.correct_answers,
    v_run.incorrect_answers,
    v_run.score,
    v_run.best_streak,
    greatest(50, v_average_response_ms),
    extract(epoch from (v_run.ends_at - v_run.started_at))::integer,
    p_now
  )
  returning id into v_session_id;

  update public.game_runs
  set
    status = 'completed',
    completed_session_id = v_session_id,
    updated_at = p_now
  where id = p_run_id;

  return v_session_id;
end;
$$;

revoke all
on function trivia_private.finalise_solo_game(uuid, timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public question/category API
-- ---------------------------------------------------------------------------

create or replace function public.get_question_categories()
returns table (
  category_id text,
  label text,
  question_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    qc.id,
    qc.label,
    count(q.id)::bigint
  from public.question_categories qc
  left join public.trivia_questions q
    on q.category_id = qc.id
   and q.is_active
  where qc.is_active
  group by qc.id, qc.label, qc.sort_order
  order by qc.sort_order;
$$;

revoke all
on function public.get_question_categories()
from public;

grant execute
on function public.get_question_categories()
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authoritative solo RPCs
-- ---------------------------------------------------------------------------

create or replace function public.start_solo_game(
  p_game_mode text default 'rush_60',
  p_category text default 'mixed'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_mode public.game_modes%rowtype;
  v_category text := lower(btrim(coalesce(nullif(p_category, ''), 'mixed')));
  v_run_id uuid;
  v_started_at timestamptz := clock_timestamp();
  v_ends_at timestamptz;
  v_question_count integer;
begin
  if v_player_id is null then
    raise exception 'Player must be signed in';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_player_id
  ) then
    raise exception 'Player profile does not exist';
  end if;

  select *
  into v_mode
  from public.game_modes
  where mode = lower(btrim(p_game_mode))
    and mode_family = 'solo'
    and is_active;

  if not found or v_mode.duration_seconds is null then
    raise exception 'Unknown or unsupported solo game mode';
  end if;

  if v_category <> 'mixed' and not exists (
    select 1
    from public.question_categories
    where id = v_category and is_active
  ) then
    raise exception 'Unknown question category';
  end if;

  select count(*)::integer
  into v_question_count
  from public.trivia_questions
  where is_active
    and (v_category = 'mixed' or category_id = v_category);

  if v_question_count < v_mode.max_questions then
    raise exception
      'Question bank is incomplete for category %: requires %, found %',
      v_category,
      v_mode.max_questions,
      v_question_count;
  end if;

  update public.game_runs
  set status = 'expired', updated_at = v_started_at
  where player_id = v_player_id
    and status = 'active'
    and ends_at <= v_started_at;

  if exists (
    select 1
    from public.game_runs
    where player_id = v_player_id
      and status = 'active'
  ) then
    raise exception 'Player already has an active game';
  end if;

  v_ends_at := v_started_at + make_interval(secs => v_mode.duration_seconds);

  insert into public.game_runs (
    player_id,
    game_mode,
    category_id,
    started_at,
    ends_at,
    current_question_started_at
  )
  values (
    v_player_id,
    v_mode.mode,
    v_category,
    v_started_at,
    v_ends_at,
    v_started_at
  )
  returning id into v_run_id;

  insert into public.game_run_questions (run_id, position, question_id)
  select
    v_run_id,
    row_number() over (order by selected.sort_key, selected.id)::integer,
    selected.id
  from (
    select
      q.id,
      random() as sort_key
    from public.trivia_questions q
    where q.is_active
      and (v_category = 'mixed' or q.category_id = v_category)
    order by sort_key
    limit v_mode.max_questions
  ) selected;

  return jsonb_build_object(
    'run_id', v_run_id,
    'game_mode', v_mode.mode,
    'category_id', v_category,
    'duration_seconds', v_mode.duration_seconds,
    'server_now', v_started_at,
    'started_at', v_started_at,
    'ends_at', v_ends_at,
    'score', 0,
    'streak', 0,
    'best_streak', 0,
    'questions_answered', 0,
    'correct_answers', 0,
    'question', trivia_private.game_run_question_payload(v_run_id, 1)
  );
end;
$$;

revoke all
on function public.start_solo_game(text, text)
from public, anon;

grant execute
on function public.start_solo_game(text, text)
to authenticated;

create or replace function public.get_current_solo_question(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_run public.game_runs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
  v_question jsonb;
begin
  select *
  into v_run
  from public.game_runs
  where id = p_run_id
    and player_id = v_player_id
  for update;

  if not found then
    raise exception 'Game run does not exist';
  end if;

  if v_run.status <> 'active' then
    return jsonb_build_object(
      'status', v_run.status,
      'run_id', v_run.id,
      'session_id', v_run.completed_session_id
    );
  end if;

  if v_now >= v_run.ends_at then
    v_session_id := trivia_private.finalise_solo_game(v_run.id, v_now);
    return jsonb_build_object(
      'status', case when v_session_id is null then 'expired' else 'completed' end,
      'run_id', v_run.id,
      'session_id', v_session_id,
      'server_now', v_now,
      'ends_at', v_run.ends_at
    );
  end if;

  if v_run.next_question_at is not null and v_now < v_run.next_question_at then
    return jsonb_build_object(
      'status', 'waiting',
      'run_id', v_run.id,
      'server_now', v_now,
      'available_at', v_run.next_question_at,
      'ends_at', v_run.ends_at
    );
  end if;

  v_question := trivia_private.game_run_question_payload(
    v_run.id,
    v_run.current_position
  );

  if v_question is null then
    v_session_id := trivia_private.finalise_solo_game(v_run.id, v_now);
    return jsonb_build_object(
      'status', case when v_session_id is null then 'expired' else 'completed' end,
      'run_id', v_run.id,
      'session_id', v_session_id,
      'server_now', v_now
    );
  end if;

  if v_run.current_question_started_at is null then
    update public.game_runs
    set
      current_question_started_at = v_now,
      next_question_at = null,
      updated_at = v_now
    where id = v_run.id;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'run_id', v_run.id,
    'server_now', v_now,
    'ends_at', v_run.ends_at,
    'score', v_run.score,
    'streak', v_run.streak,
    'best_streak', v_run.best_streak,
    'questions_answered', v_run.questions_answered,
    'correct_answers', v_run.correct_answers,
    'question', v_question
  );
end;
$$;

revoke all
on function public.get_current_solo_question(uuid)
from public, anon;

grant execute
on function public.get_current_solo_question(uuid)
to authenticated;

create or replace function public.submit_solo_answer(
  p_run_id uuid,
  p_position integer,
  p_selected_index integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_run public.game_runs%rowtype;
  v_question public.trivia_questions%rowtype;
  v_existing public.game_run_answers%rowtype;
  v_now timestamptz := clock_timestamp();
  v_response_ms integer;
  v_is_correct boolean;
  v_new_streak integer;
  v_new_best_streak integer;
  v_speed_bonus integer;
  v_multiplier numeric;
  v_points integer := 0;
  v_correct_answer text;
  v_session_id uuid;
begin
  if p_request_id is null then
    raise exception 'Answer request ID is required';
  end if;

  if p_selected_index is not null
     and p_selected_index not between 0 and 2 then
    raise exception 'Selected answer index is invalid';
  end if;

  select *
  into v_run
  from public.game_runs
  where id = p_run_id
    and player_id = v_player_id
  for update;

  if not found then
    raise exception 'Game run does not exist';
  end if;

  select *
  into v_existing
  from public.game_run_answers
  where run_id = p_run_id
    and request_id = p_request_id;

  if found then
    select q.answers ->> q.correct_index
    into v_correct_answer
    from public.trivia_questions q
    where q.id = v_existing.question_id;

    return jsonb_build_object(
      'status', 'accepted',
      'idempotent_replay', true,
      'run_id', v_run.id,
      'position', v_existing.position,
      'is_correct', v_existing.is_correct,
      'correct_answer', v_correct_answer,
      'points_awarded', v_existing.points_awarded,
      'response_ms', v_existing.response_ms,
      'score', v_run.score,
      'streak', v_run.streak,
      'best_streak', v_run.best_streak,
      'questions_answered', v_run.questions_answered,
      'correct_answers', v_run.correct_answers,
      'server_now', v_now,
      'ends_at', v_run.ends_at,
      'next_question_at', v_run.next_question_at
    );
  end if;

  if v_run.status <> 'active' then
    raise exception 'Game is not active';
  end if;

  if v_now >= v_run.ends_at then
    v_session_id := trivia_private.finalise_solo_game(v_run.id, v_now);
    return jsonb_build_object(
      'status', case when v_session_id is null then 'expired' else 'completed' end,
      'run_id', v_run.id,
      'session_id', v_session_id,
      'server_now', v_now,
      'ends_at', v_run.ends_at
    );
  end if;

  if p_position <> v_run.current_position then
    raise exception 'Answer does not match the current question';
  end if;

  if v_run.current_question_started_at is null then
    raise exception 'Current question has not been delivered';
  end if;

  select q.*
  into v_question
  from public.game_run_questions grq
  join public.trivia_questions q
    on q.id = grq.question_id
  where grq.run_id = v_run.id
    and grq.position = v_run.current_position
    and q.is_active;

  if not found then
    raise exception 'Current question is unavailable';
  end if;

  v_response_ms := greatest(
    0,
    round(
      extract(epoch from (v_now - v_run.current_question_started_at)) * 1000
    )::integer
  );

  v_is_correct := p_selected_index is not null
    and p_selected_index = v_question.correct_index;

  if v_is_correct then
    v_new_streak := v_run.streak + 1;
    v_speed_bonus := greatest(0, 100 - floor(v_response_ms / 60.0)::integer);
    v_multiplier := least(
      3.0,
      1.0 + floor((v_new_streak - 1) / 3.0) * 0.5
    );
    v_points := round((100 + v_speed_bonus) * v_multiplier)::integer;
  else
    v_new_streak := 0;
  end if;

  v_new_best_streak := greatest(v_run.best_streak, v_new_streak);
  v_correct_answer := v_question.answers ->> v_question.correct_index;

  insert into public.game_run_answers (
    run_id,
    position,
    question_id,
    request_id,
    selected_index,
    is_correct,
    response_ms,
    points_awarded,
    answered_at
  )
  values (
    v_run.id,
    v_run.current_position,
    v_question.id,
    p_request_id,
    p_selected_index,
    v_is_correct,
    v_response_ms,
    v_points,
    v_now
  );

  update public.game_runs
  set
    current_position = current_position + 1,
    current_question_started_at = null,
    next_question_at = v_now + interval '850 milliseconds',
    score = score + v_points,
    streak = v_new_streak,
    best_streak = v_new_best_streak,
    questions_answered = questions_answered + 1,
    correct_answers = correct_answers + case when v_is_correct then 1 else 0 end,
    incorrect_answers = incorrect_answers + case when v_is_correct then 0 else 1 end,
    total_response_ms = total_response_ms + v_response_ms,
    updated_at = v_now
  where id = v_run.id
  returning * into v_run;

  return jsonb_build_object(
    'status', 'accepted',
    'idempotent_replay', false,
    'run_id', v_run.id,
    'position', p_position,
    'is_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'points_awarded', v_points,
    'response_ms', v_response_ms,
    'score', v_run.score,
    'streak', v_run.streak,
    'best_streak', v_run.best_streak,
    'questions_answered', v_run.questions_answered,
    'correct_answers', v_run.correct_answers,
    'server_now', v_now,
    'ends_at', v_run.ends_at,
    'next_question_at', v_run.next_question_at
  );
end;
$$;

revoke all
on function public.submit_solo_answer(uuid, integer, integer, uuid)
from public, anon;

grant execute
on function public.submit_solo_answer(uuid, integer, integer, uuid)
to authenticated;

create or replace function public.finish_solo_game(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
  v_run public.game_runs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_session_id uuid;
begin
  select *
  into v_run
  from public.game_runs
  where id = p_run_id
    and player_id = v_player_id
  for update;

  if not found then
    raise exception 'Game run does not exist';
  end if;

  if v_run.completed_session_id is not null then
    v_session_id := v_run.completed_session_id;
  elsif v_now < v_run.ends_at then
    raise exception 'Game timer has not expired';
  else
    v_session_id := trivia_private.finalise_solo_game(v_run.id, v_now);
  end if;

  select *
  into v_run
  from public.game_runs
  where id = p_run_id;

  return jsonb_build_object(
    'status', v_run.status,
    'run_id', v_run.id,
    'session_id', v_session_id,
    'score', v_run.score,
    'best_streak', v_run.best_streak,
    'questions_answered', v_run.questions_answered,
    'correct_answers', v_run.correct_answers,
    'incorrect_answers', v_run.incorrect_answers,
    'average_response_ms', case
      when v_run.questions_answered = 0 then null
      else round(v_run.total_response_ms::numeric / v_run.questions_answered)::integer
    end,
    'server_now', v_now,
    'ends_at', v_run.ends_at
  );
end;
$$;

revoke all
on function public.finish_solo_game(uuid)
from public, anon;

grant execute
on function public.finish_solo_game(uuid)
to authenticated;

commit;

notify pgrst, 'reload schema';

-- Verification queries are provided in phase-4a-verification.sql.
