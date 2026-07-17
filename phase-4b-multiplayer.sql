-- Trivia Rush Phase 4B: friends, challenges and live authoritative duels
-- Run after the complete Phase 4A deployment and final cutover.

begin;

do $$
begin
  if to_regclass('public.trivia_questions') is null
     or to_regclass('public.game_runs') is null
     or to_regprocedure('public.start_solo_game(text,text)') is null then
    raise exception 'Phase 4A must be deployed before Phase 4B';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'is_anonymous'
      and data_type = 'boolean'
      and is_nullable = 'NO'
  ) then
    raise exception 'auth.users.is_anonymous boolean NOT NULL is required';
  end if;

  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Required publication supabase_realtime does not exist';
  end if;

end;
$$;

-- ---------------------------------------------------------------------------
-- Keep established solo totals and leaderboards isolated from duel sessions.
-- ---------------------------------------------------------------------------

create or replace function public.update_player_stats_after_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
    (
      select gm.mode_family
      from public.game_modes gm
      where gm.mode = new.game_mode
    ),
    'solo'
  ) <> 'solo' then
    return new;
  end if;

  insert into public.player_stats (
    player_id,
    games_played,
    total_questions,
    total_correct,
    total_incorrect,
    total_score,
    high_score,
    best_streak,
    total_response_ms,
    updated_at
  )
  values (
    new.player_id,
    1,
    new.questions_answered,
    new.correct_answers,
    new.incorrect_answers,
    new.score,
    new.score,
    new.best_streak,
    coalesce(new.average_response_ms, 0)::bigint * new.questions_answered,
    now()
  )
  on conflict (player_id)
  do update set
    games_played = public.player_stats.games_played + 1,
    total_questions = public.player_stats.total_questions + excluded.total_questions,
    total_correct = public.player_stats.total_correct + excluded.total_correct,
    total_incorrect = public.player_stats.total_incorrect + excluded.total_incorrect,
    total_score = public.player_stats.total_score + excluded.total_score,
    high_score = greatest(public.player_stats.high_score, excluded.high_score),
    best_streak = greatest(public.player_stats.best_streak, excluded.best_streak),
    total_response_ms = public.player_stats.total_response_ms + excluded.total_response_ms,
    updated_at = now();

  return new;
end;
$$;

create or replace function trivia_private.leaderboard_rankings_v2(
  p_period text default 'all',
  p_category text default 'overall'
)
returns table (
  player_id uuid,
  leaderboard_rank bigint,
  display_name text,
  account_number bigint,
  high_score bigint,
  accuracy_percent numeric,
  best_streak integer,
  games_played bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period text := lower(btrim(coalesce(nullif(p_period, ''), 'all')));
  v_category text := lower(btrim(coalesce(nullif(p_category, ''), 'overall')));
  v_since timestamptz;
begin
  if v_period not in ('all', 'week', 'today') then
    v_period := 'all';
  end if;

  if v_period = 'today' then
    v_since := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  elsif v_period = 'week' then
    v_since := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
  else
    v_since := '-infinity'::timestamptz;
  end if;

  return query
  with metrics as (
    select
      p.id as player_id,
      p.display_name::text,
      p.account_number::bigint,
      max(gs.score)::bigint as high_score,
      round(
        case when sum(gs.questions_answered) = 0 then 0::numeric
        else sum(gs.correct_answers)::numeric * 100 /
          sum(gs.questions_answered)::numeric end,
        1
      ) as accuracy_percent,
      max(gs.best_streak)::integer as best_streak,
      count(*)::bigint as games_played
    from public.game_sessions gs
    join public.game_modes gm
      on gm.mode = gs.game_mode
     and gm.mode_family = 'solo'
    join public.profiles p on p.id = gs.player_id
    where gs.played_at >= v_since
      and (
        v_category = 'overall'
        or lower(btrim(gs.category)) = v_category
      )
    group by p.id, p.display_name, p.account_number
  ),
  ranked as (
    select
      m.*,
      dense_rank() over (
        order by m.high_score desc, m.accuracy_percent desc, m.best_streak desc
      )::bigint as leaderboard_rank
    from metrics m
  )
  select
    r.player_id,
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.high_score,
    r.accuracy_percent,
    r.best_streak,
    r.games_played
  from ranked r
  order by r.leaderboard_rank, r.account_number;
end;
$$;

revoke all
on function trivia_private.leaderboard_rankings_v2(text, text)
from public, anon, authenticated;

-- A duel can legitimately end before a disconnected player answers once.
alter table public.game_sessions
drop constraint if exists game_questions_range;

alter table public.game_sessions
add constraint game_questions_range check (
  questions_answered between 0 and 200
  and (questions_answered >= 1 or game_mode like 'duel\_%' escape '\')
);

-- ---------------------------------------------------------------------------
-- Social and operational match state.
-- ---------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz null,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_valid check (
    status in ('pending', 'accepted', 'declined')
  )
);

create unique index friendships_pair_unique
on public.friendships (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);

create index friendships_requester_idx
on public.friendships (requester_id, status, updated_at desc);

create index friendships_addressee_idx
on public.friendships (addressee_id, status, updated_at desc);

create table public.duel_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid not null references public.profiles(id) on delete restrict,
  guest_id uuid null references public.profiles(id) on delete restrict,
  invited_player_id uuid null references public.profiles(id) on delete restrict,
  game_mode text not null references public.game_modes(mode),
  category_id text not null,
  status text not null default 'waiting',
  starts_at timestamptz null,
  ends_at timestamptz null,
  waiting_expires_at timestamptz not null default (now() + interval '15 minutes'),
  winner_id uuid null references public.profiles(id) on delete restrict,
  result_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint duel_matches_code_valid check (room_code ~ '^[A-Z0-9]{8}$'),
  constraint duel_matches_players_distinct check (
    guest_id is null or guest_id <> host_id
  ),
  constraint duel_matches_invite_distinct check (
    invited_player_id is null or invited_player_id <> host_id
  ),
  constraint duel_matches_category_valid check (
    category_id = 'mixed' or category_id ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  constraint duel_matches_status_valid check (
    status in ('waiting', 'countdown', 'active', 'completed', 'cancelled')
  ),
  constraint duel_matches_result_valid check (
    result_reason is null or result_reason in ('score', 'draw', 'forfeit')
  ),
  constraint duel_matches_times_valid check (
    (starts_at is null and ends_at is null)
    or (starts_at is not null and ends_at > starts_at)
  )
);

create index duel_matches_host_created_idx
on public.duel_matches (host_id, created_at desc);

create index duel_matches_guest_created_idx
on public.duel_matches (guest_id, created_at desc)
where guest_id is not null;

create index duel_matches_invited_waiting_idx
on public.duel_matches (invited_player_id, created_at desc)
where status = 'waiting' and invited_player_id is not null;

create index duel_matches_due_idx
on public.duel_matches (ends_at)
where status in ('countdown', 'active');

alter table public.game_sessions
add column duel_match_id uuid null;

alter table public.game_sessions
add constraint game_sessions_duel_match_fkey
foreign key (duel_match_id)
references public.duel_matches(id)
on delete restrict;

create unique index game_sessions_duel_player_unique
on public.game_sessions (duel_match_id, player_id)
where duel_match_id is not null;

create table public.duel_players (
  match_id uuid not null references public.duel_matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete restrict,
  player_role text not null,
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
  last_seen_at timestamptz not null default now(),
  outcome text null,
  completed_session_id uuid null references public.game_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id),
  unique (match_id, player_role),
  constraint duel_players_role_valid check (player_role in ('host', 'guest')),
  constraint duel_players_position_valid check (current_position >= 1),
  constraint duel_players_score_valid check (score >= 0),
  constraint duel_players_streak_valid check (
    streak >= 0 and best_streak >= streak
  ),
  constraint duel_players_answers_valid check (
    questions_answered >= 0
    and correct_answers >= 0
    and incorrect_answers >= 0
    and correct_answers + incorrect_answers = questions_answered
  ),
  constraint duel_players_response_valid check (total_response_ms >= 0),
  constraint duel_players_outcome_valid check (
    outcome is null or outcome in ('win', 'loss', 'draw', 'forfeit')
  )
);

create index duel_players_player_updated_idx
on public.duel_players (player_id, updated_at desc);

-- This is the only participant progress row exposed to Realtime. It
-- intentionally omits correctness, streaks, answer selections and timing.
create table public.duel_live_progress (
  match_id uuid not null,
  player_id uuid not null,
  score integer not null default 0,
  questions_answered integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id),
  foreign key (match_id, player_id)
    references public.duel_players(match_id, player_id) on delete cascade,
  constraint duel_live_progress_score_valid check (score >= 0),
  constraint duel_live_progress_answers_valid check (questions_answered >= 0)
);

create or replace function trivia_private.sync_duel_live_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.duel_live_progress (
    match_id, player_id, score, questions_answered, updated_at
  ) values (
    new.match_id, new.player_id, new.score, new.questions_answered, new.updated_at
  )
  on conflict (match_id, player_id) do update
  set
    score = excluded.score,
    questions_answered = excluded.questions_answered,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all
on function trivia_private.sync_duel_live_progress()
from public, anon, authenticated;

create trigger sync_duel_live_progress_trigger
after insert or update of score, questions_answered
on public.duel_players
for each row execute function trivia_private.sync_duel_live_progress();

create table public.duel_match_questions (
  match_id uuid not null references public.duel_matches(id) on delete cascade,
  position integer not null,
  question_id bigint not null references public.trivia_questions(id),
  primary key (match_id, position),
  unique (match_id, question_id),
  constraint duel_match_questions_position_valid check (position >= 1)
);

create table public.duel_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  player_id uuid not null,
  position integer not null,
  question_id bigint not null references public.trivia_questions(id),
  request_id uuid not null,
  selected_index smallint null,
  is_correct boolean not null,
  response_ms integer not null,
  points_awarded integer not null,
  answered_at timestamptz not null default now(),
  foreign key (match_id, player_id)
    references public.duel_players(match_id, player_id) on delete cascade,
  unique (match_id, player_id, position),
  unique (match_id, player_id, request_id),
  constraint duel_answers_position_valid check (position >= 1),
  constraint duel_answers_selected_valid check (
    selected_index is null or selected_index between 0 and 2
  ),
  constraint duel_answers_response_valid check (response_ms between 0 and 600000),
  constraint duel_answers_points_valid check (points_awarded between 0 and 10000)
);

alter table public.friendships enable row level security;
alter table public.duel_matches enable row level security;
alter table public.duel_players enable row level security;
alter table public.duel_live_progress enable row level security;
alter table public.duel_match_questions enable row level security;
alter table public.duel_answers enable row level security;

revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.duel_matches from public, anon, authenticated;
revoke all on table public.duel_players from public, anon, authenticated;
revoke all on table public.duel_live_progress from public, anon, authenticated;
revoke all on table public.duel_match_questions from public, anon, authenticated;
revoke all on table public.duel_answers from public, anon, authenticated;

grant select on public.friendships, public.duel_matches, public.duel_live_progress
to authenticated;

create policy "Players see their friendships"
on public.friendships for select to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Participants see their duel matches"
on public.duel_matches for select to authenticated
using (
  auth.uid() = host_id
  or auth.uid() = guest_id
  or auth.uid() = invited_player_id
);

create policy "Participants see safe duel progress"
on public.duel_live_progress for select to authenticated
using (
  exists (
    select 1
    from public.duel_matches dm
    where dm.id = match_id
      and auth.uid() in (dm.host_id, dm.guest_id)
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_matches'
  ) then
    alter publication supabase_realtime add table public.duel_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duel_live_progress'
  ) then
    alter publication supabase_realtime add table public.duel_live_progress;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private helpers.
-- ---------------------------------------------------------------------------

create or replace function trivia_private.require_permanent_player()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := auth.uid();
begin
  if v_player_id is null or not exists (
    select 1
    from auth.users au
    join public.profiles p on p.id = au.id
    where au.id = v_player_id
      and au.is_anonymous = false
  ) then
    raise exception 'A permanent Trivia Rush account is required';
  end if;

  return v_player_id;
end;
$$;

revoke all
on function trivia_private.require_permanent_player()
from public, anon, authenticated;

create or replace function trivia_private.new_room_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    exit when not exists (
      select 1 from public.duel_matches where room_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

revoke all
on function trivia_private.new_room_code()
from public, anon, authenticated;

create or replace function trivia_private.duel_question_payload(
  p_match_id uuid,
  p_position integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'position', dmq.position,
    'question_id', q.id,
    'category_id', q.category_id,
    'category_label', qc.label,
    'difficulty', q.difficulty,
    'question', q.question_text,
    'answers', q.answers
  )
  from public.duel_match_questions dmq
  join public.trivia_questions q on q.id = dmq.question_id
  join public.question_categories qc on qc.id = q.category_id
  where dmq.match_id = p_match_id
    and dmq.position = p_position
    and q.is_active;
$$;

revoke all
on function trivia_private.duel_question_payload(uuid, integer)
from public, anon, authenticated;

create or replace function trivia_private.finalise_duel(
  p_match_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.duel_matches%rowtype;
  v_host public.duel_players%rowtype;
  v_guest public.duel_players%rowtype;
  v_host_recent boolean;
  v_guest_recent boolean;
  v_host_outcome text;
  v_guest_outcome text;
  v_winner_id uuid;
  v_reason text;
  v_duration integer;
  v_average integer;
  v_session_id uuid;
begin
  select * into v_match
  from public.duel_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Duel does not exist';
  end if;

  if v_match.status = 'completed' then
    return jsonb_build_object(
      'status', v_match.status,
      'match_id', v_match.id,
      'winner_id', v_match.winner_id,
      'result_reason', v_match.result_reason
    );
  end if;

  if v_match.status not in ('countdown', 'active')
     or v_match.ends_at is null
     or p_now < v_match.ends_at then
    raise exception 'Duel is not ready to be finalised';
  end if;

  select * into v_host
  from public.duel_players
  where match_id = v_match.id and player_role = 'host'
  for update;

  select * into v_guest
  from public.duel_players
  where match_id = v_match.id and player_role = 'guest'
  for update;

  if v_host.player_id is null or v_guest.player_id is null then
    update public.duel_matches
    set status = 'cancelled', updated_at = p_now
    where id = v_match.id;
    return jsonb_build_object('status', 'cancelled', 'match_id', v_match.id);
  end if;

  -- Clients heartbeat every five seconds. A player absent for the final
  -- twelve seconds forfeits only when the opponent remained present.
  v_host_recent := v_host.last_seen_at >= v_match.ends_at - interval '12 seconds';
  v_guest_recent := v_guest.last_seen_at >= v_match.ends_at - interval '12 seconds';

  if v_host_recent and not v_guest_recent then
    v_host_outcome := 'win';
    v_guest_outcome := 'forfeit';
    v_winner_id := v_host.player_id;
    v_reason := 'forfeit';
  elsif v_guest_recent and not v_host_recent then
    v_host_outcome := 'forfeit';
    v_guest_outcome := 'win';
    v_winner_id := v_guest.player_id;
    v_reason := 'forfeit';
  elsif v_host.score > v_guest.score then
    v_host_outcome := 'win';
    v_guest_outcome := 'loss';
    v_winner_id := v_host.player_id;
    v_reason := 'score';
  elsif v_guest.score > v_host.score then
    v_host_outcome := 'loss';
    v_guest_outcome := 'win';
    v_winner_id := v_guest.player_id;
    v_reason := 'score';
  else
    v_host_outcome := 'draw';
    v_guest_outcome := 'draw';
    v_winner_id := null;
    v_reason := 'draw';
  end if;

  update public.duel_players
  set
    outcome = case
      when player_role = 'host' then v_host_outcome
      else v_guest_outcome
    end,
    updated_at = p_now
  where match_id = v_match.id;

  v_duration := extract(epoch from (v_match.ends_at - v_match.starts_at))::integer;

  for v_host in
    select *
    from public.duel_players
    where match_id = v_match.id
    order by player_role
  loop
    if v_host.completed_session_id is null then
      v_average := case
        when v_host.questions_answered = 0 then null
        else greatest(
          50,
          round(v_host.total_response_ms::numeric / v_host.questions_answered)::integer
        )
      end;

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
        played_at,
        duel_match_id
      )
      values (
        v_host.player_id,
        v_match.game_mode,
        v_match.category_id,
        v_host.questions_answered,
        v_host.correct_answers,
        v_host.incorrect_answers,
        v_host.score,
        v_host.best_streak,
        v_average,
        v_duration,
        v_match.ends_at,
        v_match.id
      )
      returning id into v_session_id;

      update public.duel_players
      set completed_session_id = v_session_id
      where match_id = v_match.id and player_id = v_host.player_id;
    end if;
  end loop;

  update public.duel_matches
  set
    status = 'completed',
    winner_id = v_winner_id,
    result_reason = v_reason,
    completed_at = p_now,
    updated_at = p_now
  where id = v_match.id;

  return jsonb_build_object(
    'status', 'completed',
    'match_id', v_match.id,
    'winner_id', v_winner_id,
    'result_reason', v_reason
  );
end;
$$;

revoke all
on function trivia_private.finalise_duel(uuid, timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Friends and account lookup RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.lookup_duel_player(p_account_number bigint)
returns table (
  player_id uuid,
  display_name text,
  account_number bigint,
  friendship_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select trivia_private.require_permanent_player() as id
  )
  select
    p.id,
    p.display_name::text,
    p.account_number::bigint,
    f.status::text
  from caller c
  join public.profiles p on p.account_number = p_account_number
  join auth.users au on au.id = p.id and au.is_anonymous = false
  left join public.friendships f
    on (f.requester_id = c.id and f.addressee_id = p.id)
    or (f.requester_id = p.id and f.addressee_id = c.id)
  where p.id <> c.id
  limit 1;
$$;

revoke all on function public.lookup_duel_player(bigint) from public, anon;
grant execute on function public.lookup_duel_player(bigint) to authenticated;

create or replace function public.send_friend_request(p_account_number bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_target_id uuid;
  v_friendship public.friendships%rowtype;
begin
  select p.id into v_target_id
  from public.profiles p
  join auth.users au on au.id = p.id and au.is_anonymous = false
  where p.account_number = p_account_number;

  if v_target_id is null then
    raise exception 'Permanent player not found';
  end if;

  if v_target_id = v_player_id then
    raise exception 'You cannot add yourself';
  end if;

  select * into v_friendship
  from public.friendships f
  where (f.requester_id = v_player_id and f.addressee_id = v_target_id)
     or (f.requester_id = v_target_id and f.addressee_id = v_player_id)
  for update;

  if found and v_friendship.status = 'accepted' then
    raise exception 'You are already friends';
  elsif found and v_friendship.status = 'pending' then
    if v_friendship.addressee_id = v_player_id then
      update public.friendships
      set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = v_friendship.id;
    end if;
    return v_friendship.id;
  elsif found then
    update public.friendships
    set
      requester_id = v_player_id,
      addressee_id = v_target_id,
      status = 'pending',
      accepted_at = null,
      updated_at = now()
    where id = v_friendship.id;
    return v_friendship.id;
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (v_player_id, v_target_id)
  returning id into v_friendship.id;

  return v_friendship.id;
end;
$$;

revoke all on function public.send_friend_request(bigint) from public, anon;
grant execute on function public.send_friend_request(bigint) to authenticated;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  update public.friendships
  set
    status = case when p_accept then 'accepted' else 'declined' end,
    accepted_at = case when p_accept then now() else null end,
    updated_at = now()
  where id = p_friendship_id
    and addressee_id = v_player_id
    and status = 'pending';

  if not found then
    raise exception 'Pending friend request not found';
  end if;

  return true;
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.remove_friend(p_friend_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  delete from public.friendships
  where status = 'accepted'
    and (
      (requester_id = v_player_id and addressee_id = p_friend_id)
      or (requester_id = p_friend_id and addressee_id = v_player_id)
    );

  return found;
end;
$$;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.get_social_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'friendship_id', f.id,
        'player_id', other.id,
        'display_name', other.display_name,
        'account_number', other.account_number,
        'friends_since', f.accepted_at
      ) order by lower(other.display_name))
      from public.friendships f
      join public.profiles other
        on other.id = case
          when f.requester_id = v_player_id then f.addressee_id
          else f.requester_id
        end
      where f.status = 'accepted'
        and v_player_id in (f.requester_id, f.addressee_id)
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'friendship_id', f.id,
        'player_id', p.id,
        'display_name', p.display_name,
        'account_number', p.account_number,
        'created_at', f.created_at
      ) order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.requester_id
      where f.addressee_id = v_player_id and f.status = 'pending'
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'friendship_id', f.id,
        'player_id', p.id,
        'display_name', p.display_name,
        'account_number', p.account_number,
        'created_at', f.created_at
      ) order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.addressee_id
      where f.requester_id = v_player_id and f.status = 'pending'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_social_dashboard() from public, anon;
grant execute on function public.get_social_dashboard() to authenticated;

-- ---------------------------------------------------------------------------
-- Duel lobby and live game RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.create_duel(
  p_category text default 'mixed',
  p_duration_seconds integer default 60,
  p_invited_account_number bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_category text := lower(btrim(coalesce(nullif(p_category, ''), 'mixed')));
  v_mode public.game_modes%rowtype;
  v_invited_id uuid;
  v_match_id uuid;
  v_room_code text;
begin
  select * into v_mode
  from public.game_modes
  where mode = 'duel_' || p_duration_seconds::text
    and mode_family = 'duel'
    and is_active;

  if not found then
    raise exception 'Duel length must be 30, 60 or 90 seconds';
  end if;

  if v_category <> 'mixed' and not exists (
    select 1 from public.question_categories
    where id = v_category and is_active
  ) then
    raise exception 'Unknown question category';
  end if;

  if (
    select count(*)
    from public.trivia_questions q
    where q.is_active
      and (v_category = 'mixed' or q.category_id = v_category)
  ) < v_mode.max_questions then
    raise exception 'Question bank is incomplete for this duel';
  end if;

  if exists (
    select 1
    from public.duel_players dp
    join public.duel_matches dm on dm.id = dp.match_id
    where dp.player_id = v_player_id
      and dm.status in ('countdown', 'active')
  ) then
    raise exception 'You already have an active duel';
  end if;

  update public.duel_matches
  set status = 'cancelled', updated_at = now()
  where host_id = v_player_id
    and status = 'waiting';

  if p_invited_account_number is not null then
    select p.id into v_invited_id
    from public.profiles p
    join auth.users au on au.id = p.id and au.is_anonymous = false
    where p.account_number = p_invited_account_number;

    if v_invited_id is null then
      raise exception 'Permanent invited player not found';
    end if;

    if v_invited_id = v_player_id then
      raise exception 'You cannot challenge yourself';
    end if;
  end if;

  v_room_code := trivia_private.new_room_code();

  insert into public.duel_matches (
    room_code,
    host_id,
    invited_player_id,
    game_mode,
    category_id
  )
  values (
    v_room_code,
    v_player_id,
    v_invited_id,
    v_mode.mode,
    v_category
  )
  returning id into v_match_id;

  insert into public.duel_players (match_id, player_id, player_role)
  values (v_match_id, v_player_id, 'host');

  insert into public.duel_match_questions (match_id, position, question_id)
  select
    v_match_id,
    row_number() over (order by selected.sort_key, selected.id)::integer,
    selected.id
  from (
    select q.id, random() as sort_key
    from public.trivia_questions q
    where q.is_active
      and (v_category = 'mixed' or q.category_id = v_category)
    order by sort_key
    limit v_mode.max_questions
  ) selected;

  return jsonb_build_object(
    'match_id', v_match_id,
    'room_code', v_room_code,
    'status', 'waiting',
    'game_mode', v_mode.mode,
    'duration_seconds', v_mode.duration_seconds,
    'category_id', v_category,
    'invited_player_id', v_invited_id,
    'waiting_expires_at', now() + interval '15 minutes'
  );
end;
$$;

revoke all on function public.create_duel(text, integer, bigint) from public, anon;
grant execute on function public.create_duel(text, integer, bigint) to authenticated;

create or replace function public.join_duel(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_match public.duel_matches%rowtype;
  v_duration integer;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_match
  from public.duel_matches
  where room_code = upper(btrim(p_room_code))
  for update;

  if not found then
    raise exception 'Duel room not found';
  end if;

  if v_match.status <> 'waiting' or v_match.waiting_expires_at <= v_now then
    if v_match.status = 'waiting' then
      update public.duel_matches
      set status = 'cancelled', updated_at = v_now
      where id = v_match.id;
    end if;
    raise exception 'Duel room is no longer available';
  end if;

  if v_match.host_id = v_player_id then
    raise exception 'The host cannot join their own room';
  end if;

  if v_match.invited_player_id is not null
     and v_match.invited_player_id <> v_player_id then
    raise exception 'This challenge is reserved for another player';
  end if;

  if exists (
    select 1
    from public.duel_players dp
    join public.duel_matches dm on dm.id = dp.match_id
    where dp.player_id = v_player_id
      and dm.status in ('countdown', 'active')
  ) then
    raise exception 'You already have an active duel';
  end if;

  select duration_seconds into v_duration
  from public.game_modes
  where mode = v_match.game_mode and mode_family = 'duel' and is_active;

  if v_duration is null then
    raise exception 'Duel mode is unavailable';
  end if;

  update public.duel_matches
  set
    guest_id = v_player_id,
    status = 'countdown',
    starts_at = v_now + interval '5 seconds',
    ends_at = v_now + interval '5 seconds' + make_interval(secs => v_duration),
    updated_at = v_now
  where id = v_match.id
  returning * into v_match;

  update public.duel_players
  set current_question_started_at = v_match.starts_at, updated_at = v_now
  where match_id = v_match.id and player_role = 'host';

  insert into public.duel_players (
    match_id,
    player_id,
    player_role,
    current_question_started_at
  )
  values (v_match.id, v_player_id, 'guest', v_match.starts_at);

  return jsonb_build_object(
    'match_id', v_match.id,
    'room_code', v_match.room_code,
    'status', v_match.status,
    'starts_at', v_match.starts_at,
    'ends_at', v_match.ends_at,
    'server_now', v_now
  );
end;
$$;

revoke all on function public.join_duel(text) from public, anon;
grant execute on function public.join_duel(text) to authenticated;

create or replace function public.cancel_duel(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  update public.duel_matches
  set status = 'cancelled', updated_at = now()
  where id = p_match_id
    and host_id = v_player_id
    and status = 'waiting';

  if not found then
    raise exception 'Waiting duel was not found or cannot be cancelled';
  end if;

  return true;
end;
$$;

revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;

create or replace function public.get_duel_state(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_match public.duel_matches%rowtype;
  v_self public.duel_players%rowtype;
  v_opponent public.duel_players%rowtype;
  v_now timestamptz := clock_timestamp();
  v_question jsonb;
  v_result jsonb;
begin
  select * into v_match
  from public.duel_matches
  where id = p_match_id
    and v_player_id in (host_id, guest_id, invited_player_id)
  for update;

  if not found then
    raise exception 'Duel does not exist or is not available to this player';
  end if;

  if v_match.status = 'waiting' and v_match.waiting_expires_at <= v_now then
    update public.duel_matches
    set status = 'cancelled', updated_at = v_now
    where id = v_match.id
    returning * into v_match;
  elsif v_match.status = 'countdown' and v_now >= v_match.starts_at then
    update public.duel_matches
    set status = 'active', updated_at = v_now
    where id = v_match.id
    returning * into v_match;
  end if;

  if v_match.status in ('countdown', 'active') and v_now >= v_match.ends_at then
    v_result := trivia_private.finalise_duel(v_match.id, v_now);
    select * into v_match from public.duel_matches where id = v_match.id;
  end if;

  select * into v_self
  from public.duel_players
  where match_id = v_match.id and player_id = v_player_id;

  if v_self.player_id is not null and v_match.status in ('countdown', 'active') then
    update public.duel_players
    set last_seen_at = v_now, updated_at = v_now
    where match_id = v_match.id and player_id = v_player_id
    returning * into v_self;
  end if;

  select * into v_opponent
  from public.duel_players
  where match_id = v_match.id and player_id <> v_player_id
  limit 1;

  if v_match.status = 'active'
     and v_self.player_id is not null
     and (v_self.next_question_at is null or v_now >= v_self.next_question_at) then
    if v_self.current_question_started_at is null then
      update public.duel_players
      set
        current_question_started_at = v_now,
        next_question_at = null,
        updated_at = v_now
      where match_id = v_match.id and player_id = v_player_id
      returning * into v_self;
    end if;

    v_question := trivia_private.duel_question_payload(
      v_match.id,
      v_self.current_position
    );
  end if;

  return jsonb_build_object(
    'match_id', v_match.id,
    'room_code', v_match.room_code,
    'status', v_match.status,
    'game_mode', v_match.game_mode,
    'category_id', v_match.category_id,
    'server_now', v_now,
    'starts_at', v_match.starts_at,
    'ends_at', v_match.ends_at,
    'waiting_expires_at', v_match.waiting_expires_at,
    'winner_id', v_match.winner_id,
    'result_reason', v_match.result_reason,
    'is_host', v_match.host_id = v_player_id,
    'can_accept', v_match.status = 'waiting'
      and v_match.invited_player_id = v_player_id,
    'self', case when v_self.player_id is null then null else jsonb_build_object(
      'player_id', v_self.player_id,
      'score', v_self.score,
      'streak', v_self.streak,
      'best_streak', v_self.best_streak,
      'questions_answered', v_self.questions_answered,
      'correct_answers', v_self.correct_answers,
      'outcome', v_self.outcome
    ) end,
    'opponent', case when v_opponent.player_id is null then null else (
      select jsonb_build_object(
        'player_id', v_opponent.player_id,
        'display_name', p.display_name,
        'account_number', p.account_number,
        'score', v_opponent.score,
        'questions_answered', v_opponent.questions_answered,
        'outcome', v_opponent.outcome
      ) from public.profiles p where p.id = v_opponent.player_id
    ) end,
    'question', v_question,
    'next_question_at', v_self.next_question_at
  );
end;
$$;

revoke all on function public.get_duel_state(uuid) from public, anon;
grant execute on function public.get_duel_state(uuid) to authenticated;

create or replace function public.submit_duel_answer(
  p_match_id uuid,
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
  v_player_id uuid := trivia_private.require_permanent_player();
  v_match public.duel_matches%rowtype;
  v_player public.duel_players%rowtype;
  v_existing public.duel_answers%rowtype;
  v_question public.trivia_questions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_response_ms integer;
  v_is_correct boolean;
  v_new_streak integer;
  v_new_best_streak integer;
  v_speed_bonus integer;
  v_multiplier numeric;
  v_points integer := 0;
  v_correct_answer text;
begin
  if p_request_id is null then
    raise exception 'Answer request ID is required';
  end if;

  if p_selected_index is not null and p_selected_index not between 0 and 2 then
    raise exception 'Selected answer index is invalid';
  end if;

  select * into v_match
  from public.duel_matches
  where id = p_match_id
    and v_player_id in (host_id, guest_id)
  for update;

  if not found then
    raise exception 'Duel does not exist';
  end if;

  select * into v_player
  from public.duel_players
  where match_id = v_match.id and player_id = v_player_id
  for update;

  select * into v_existing
  from public.duel_answers
  where match_id = v_match.id
    and player_id = v_player_id
    and request_id = p_request_id;

  if found then
    select q.answers ->> q.correct_index into v_correct_answer
    from public.trivia_questions q where q.id = v_existing.question_id;

    return jsonb_build_object(
      'status', 'accepted',
      'idempotent_replay', true,
      'position', v_existing.position,
      'is_correct', v_existing.is_correct,
      'correct_answer', v_correct_answer,
      'points_awarded', v_existing.points_awarded,
      'score', v_player.score,
      'streak', v_player.streak,
      'best_streak', v_player.best_streak,
      'questions_answered', v_player.questions_answered,
      'correct_answers', v_player.correct_answers,
      'server_now', v_now,
      'ends_at', v_match.ends_at,
      'next_question_at', v_player.next_question_at
    );
  end if;

  if v_match.status = 'countdown' and v_now >= v_match.starts_at then
    update public.duel_matches set status = 'active', updated_at = v_now
    where id = v_match.id;
    v_match.status := 'active';
  end if;

  if v_match.ends_at is not null and v_now >= v_match.ends_at then
    perform trivia_private.finalise_duel(v_match.id, v_now);
    return jsonb_build_object(
      'status', 'completed',
      'match_id', v_match.id,
      'server_now', v_now,
      'ends_at', v_match.ends_at
    );
  end if;

  if v_match.status <> 'active' then
    raise exception 'Duel has not started';
  end if;

  if p_position <> v_player.current_position then
    raise exception 'Answer does not match the current question';
  end if;

  if v_player.current_question_started_at is null
     or (v_player.next_question_at is not null and v_now < v_player.next_question_at) then
    raise exception 'Current question is not ready';
  end if;

  select q.* into v_question
  from public.duel_match_questions dmq
  join public.trivia_questions q on q.id = dmq.question_id
  where dmq.match_id = v_match.id
    and dmq.position = v_player.current_position
    and q.is_active;

  if not found then
    raise exception 'Current duel question is unavailable';
  end if;

  v_response_ms := greatest(
    0,
    round(extract(epoch from (v_now - v_player.current_question_started_at)) * 1000)::integer
  );
  v_is_correct := p_selected_index is not null
    and p_selected_index = v_question.correct_index;

  if v_is_correct then
    v_new_streak := v_player.streak + 1;
    v_speed_bonus := greatest(0, 100 - floor(v_response_ms / 60.0)::integer);
    v_multiplier := least(
      3.0,
      1.0 + floor((v_new_streak - 1) / 3.0) * 0.5
    );
    v_points := round((100 + v_speed_bonus) * v_multiplier)::integer;
  else
    v_new_streak := 0;
  end if;

  v_new_best_streak := greatest(v_player.best_streak, v_new_streak);
  v_correct_answer := v_question.answers ->> v_question.correct_index;

  insert into public.duel_answers (
    match_id,
    player_id,
    position,
    question_id,
    request_id,
    selected_index,
    is_correct,
    response_ms,
    points_awarded,
    answered_at
  ) values (
    v_match.id,
    v_player_id,
    v_player.current_position,
    v_question.id,
    p_request_id,
    p_selected_index,
    v_is_correct,
    v_response_ms,
    v_points,
    v_now
  );

  update public.duel_players
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
    last_seen_at = v_now,
    updated_at = v_now
  where match_id = v_match.id and player_id = v_player_id
  returning * into v_player;

  return jsonb_build_object(
    'status', 'accepted',
    'idempotent_replay', false,
    'position', p_position,
    'is_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'points_awarded', v_points,
    'score', v_player.score,
    'streak', v_player.streak,
    'best_streak', v_player.best_streak,
    'questions_answered', v_player.questions_answered,
    'correct_answers', v_player.correct_answers,
    'server_now', v_now,
    'ends_at', v_match.ends_at,
    'next_question_at', v_player.next_question_at
  );
end;
$$;

revoke all
on function public.submit_duel_answer(uuid, integer, integer, uuid)
from public, anon;
grant execute
on function public.submit_duel_answer(uuid, integer, integer, uuid)
to authenticated;

create or replace function public.get_duel_invitations()
returns table (
  match_id uuid,
  room_code text,
  host_display_name text,
  host_account_number bigint,
  category_id text,
  duration_seconds integer,
  created_at timestamptz,
  waiting_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select trivia_private.require_permanent_player() as id
  )
  select
    dm.id,
    dm.room_code,
    p.display_name::text,
    p.account_number::bigint,
    dm.category_id,
    gm.duration_seconds,
    dm.created_at,
    dm.waiting_expires_at
  from caller c
  join public.duel_matches dm
    on dm.invited_player_id = c.id
   and dm.status = 'waiting'
   and dm.waiting_expires_at > now()
  join public.profiles p on p.id = dm.host_id
  join public.game_modes gm on gm.mode = dm.game_mode
  order by dm.created_at desc;
$$;

revoke all on function public.get_duel_invitations() from public, anon;
grant execute on function public.get_duel_invitations() to authenticated;

create or replace function public.get_duel_match_history(
  p_opponent_account_number bigint default null,
  p_limit integer default 30
)
returns table (
  match_id uuid,
  played_at timestamptz,
  opponent_display_name text,
  opponent_account_number bigint,
  category_id text,
  duration_seconds integer,
  player_score integer,
  opponent_score integer,
  player_questions_answered integer,
  opponent_questions_answered integer,
  outcome text,
  result_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as (
    select trivia_private.require_permanent_player() as id
  )
  select
    dm.id,
    dm.completed_at,
    opponent_profile.display_name::text,
    opponent_profile.account_number::bigint,
    dm.category_id,
    gm.duration_seconds,
    self_player.score,
    opponent_player.score,
    self_player.questions_answered,
    opponent_player.questions_answered,
    self_player.outcome::text,
    dm.result_reason::text
  from caller c
  join public.duel_players self_player on self_player.player_id = c.id
  join public.duel_matches dm
    on dm.id = self_player.match_id
   and dm.status = 'completed'
  join public.duel_players opponent_player
    on opponent_player.match_id = dm.id
   and opponent_player.player_id <> c.id
  join public.profiles opponent_profile on opponent_profile.id = opponent_player.player_id
  join public.game_modes gm on gm.mode = dm.game_mode
  where p_opponent_account_number is null
     or opponent_profile.account_number = p_opponent_account_number
  order by dm.completed_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all
on function public.get_duel_match_history(bigint, integer)
from public, anon;
grant execute
on function public.get_duel_match_history(bigint, integer)
to authenticated;

create or replace function trivia_private.duel_rankings()
returns table (
  player_id uuid,
  leaderboard_rank bigint,
  display_name text,
  account_number bigint,
  wins bigint,
  draws bigint,
  losses bigint,
  matches_played bigint,
  win_rate numeric,
  total_duel_score bigint,
  is_provisional boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with metrics as (
    select
      p.id as player_id,
      p.display_name::text,
      p.account_number::bigint,
      count(*) filter (where dp.outcome = 'win')::bigint as wins,
      count(*) filter (where dp.outcome = 'draw')::bigint as draws,
      count(*) filter (where dp.outcome in ('loss', 'forfeit'))::bigint as losses,
      count(*)::bigint as matches_played,
      case when count(*) >= 5 then
        round(
          count(*) filter (where dp.outcome = 'win')::numeric * 100 /
          count(*)::numeric,
          1
        )
      else null end as win_rate,
      sum(dp.score)::bigint as total_duel_score,
      count(*) < 5 as is_provisional
    from public.duel_players dp
    join public.duel_matches dm
      on dm.id = dp.match_id and dm.status = 'completed'
    join public.profiles p on p.id = dp.player_id
    group by p.id, p.display_name, p.account_number
  ),
  ranked as (
    select
      m.*,
      dense_rank() over (
        order by
          m.wins desc,
          (not m.is_provisional) desc,
          m.win_rate desc nulls last,
          m.total_duel_score desc
      )::bigint as leaderboard_rank
    from metrics m
  )
  select
    r.player_id,
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.wins,
    r.draws,
    r.losses,
    r.matches_played,
    r.win_rate,
    r.total_duel_score,
    r.is_provisional
  from ranked r
  order by r.leaderboard_rank, r.account_number;
$$;

revoke all on function trivia_private.duel_rankings()
from public, anon, authenticated;

create or replace function public.get_duel_leaderboard(p_limit integer default 20)
returns table (
  leaderboard_rank bigint,
  display_name text,
  account_number bigint,
  wins bigint,
  draws bigint,
  losses bigint,
  matches_played bigint,
  win_rate numeric,
  total_duel_score bigint,
  is_provisional boolean,
  is_current_player boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.wins,
    r.draws,
    r.losses,
    r.matches_played,
    r.win_rate,
    r.total_duel_score,
    r.is_provisional,
    r.player_id = auth.uid()
  from trivia_private.duel_rankings() r
  order by r.leaderboard_rank, r.account_number
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.get_duel_leaderboard(integer) from public;
grant execute on function public.get_duel_leaderboard(integer) to anon, authenticated;

create or replace function public.get_my_duel_rank()
returns table (
  leaderboard_rank bigint,
  display_name text,
  account_number bigint,
  wins bigint,
  draws bigint,
  losses bigint,
  matches_played bigint,
  win_rate numeric,
  total_duel_score bigint,
  is_provisional boolean,
  is_current_player boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.wins,
    r.draws,
    r.losses,
    r.matches_played,
    r.win_rate,
    r.total_duel_score,
    r.is_provisional,
    true
  from trivia_private.duel_rankings() r
  where r.player_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_duel_rank() from public, anon;
grant execute on function public.get_my_duel_rank() to authenticated;

commit;

notify pgrst, 'reload schema';

-- Realtime visibility remains participant-only through the SELECT policies.
