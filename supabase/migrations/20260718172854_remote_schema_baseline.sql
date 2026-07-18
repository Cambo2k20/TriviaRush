-- Trivia Rush remote schema baseline
-- Catalogued read-only from Supabase project kgdnuzasbeavpqharbpf on 2026-07-18.
-- Schema only: production identities, sessions, progression and gameplay rows are excluded.
-- Before the first production db push, reconcile this baseline with an authenticated
-- `supabase db pull` and mark the baseline applied in remote migration history.

set check_function_bodies = false;

create schema if not exists trivia_private;

create sequence public.profile_account_number_seq
  as bigint
  increment by 1
  minvalue 1000
  no maxvalue
  start with 1000
  cache 1;

create table public.category_level_thresholds (
  level smallint not null,
  cumulative_xp bigint not null,
  created_at timestamp with time zone default now() not null
);

create table public.category_xp_awards (
  id bigint generated always as identity not null,
  source_kind text not null,
  source_id uuid not null,
  player_id uuid not null,
  answer_key text not null,
  category_id text not null,
  difficulty text not null,
  is_correct boolean not null,
  xp_awarded integer not null,
  level_before smallint not null,
  level_after smallint not null,
  awarded_at timestamp with time zone default now() not null
);

create table public.discord_links (
  discord_user_id text not null,
  user_id uuid not null,
  discord_username text,
  linked_at timestamp with time zone default now() not null
);

create table public.duel_answers (
  id uuid default gen_random_uuid() not null,
  match_id uuid not null,
  player_id uuid not null,
  "position" integer not null,
  question_id bigint not null,
  request_id uuid not null,
  selected_index smallint,
  is_correct boolean not null,
  response_ms integer not null,
  points_awarded integer not null,
  answered_at timestamp with time zone default now() not null
);

create table public.duel_live_progress (
  match_id uuid not null,
  player_id uuid not null,
  score integer default 0 not null,
  questions_answered integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.duel_match_questions (
  match_id uuid not null,
  "position" integer not null,
  question_id bigint not null
);

create table public.duel_matches (
  id uuid default gen_random_uuid() not null,
  room_code text not null,
  host_id uuid not null,
  guest_id uuid,
  invited_player_id uuid,
  game_mode text not null,
  category_id text not null,
  status text default 'waiting'::text not null,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  waiting_expires_at timestamp with time zone default (now() + '00:15:00'::interval) not null,
  winner_id uuid,
  result_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  match_format text default 'live'::text not null,
  response_expires_at timestamp with time zone,
  closed_at timestamp with time zone,
  closed_reason text
);

create table public.duel_players (
  match_id uuid not null,
  player_id uuid not null,
  player_role text not null,
  current_position integer default 1 not null,
  current_question_started_at timestamp with time zone,
  next_question_at timestamp with time zone,
  score integer default 0 not null,
  streak integer default 0 not null,
  best_streak integer default 0 not null,
  questions_answered integer default 0 not null,
  correct_answers integer default 0 not null,
  incorrect_answers integer default 0 not null,
  total_response_ms bigint default 0 not null,
  last_seen_at timestamp with time zone default now() not null,
  outcome text,
  completed_session_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  round_status text default 'pending'::text not null,
  round_starts_at timestamp with time zone,
  round_ends_at timestamp with time zone,
  round_completed_at timestamp with time zone
);

create table public.friendships (
  id uuid default gen_random_uuid() not null,
  requester_id uuid not null,
  addressee_id uuid not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  accepted_at timestamp with time zone
);

create table public.game_modes (
  mode text not null,
  label text not null,
  duration_seconds integer,
  max_questions integer not null,
  max_points_per_question integer not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  mode_family text default 'solo'::text not null
);

create table public.game_run_answers (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  "position" integer not null,
  question_id bigint not null,
  request_id uuid not null,
  selected_index smallint,
  is_correct boolean not null,
  response_ms integer not null,
  points_awarded integer not null,
  answered_at timestamp with time zone default now() not null
);

create table public.game_run_questions (
  run_id uuid not null,
  "position" integer not null,
  question_id bigint not null
);

create table public.game_runs (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  game_mode text not null,
  category_id text not null,
  status text default 'active'::text not null,
  started_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  current_position integer default 1 not null,
  current_question_started_at timestamp with time zone,
  next_question_at timestamp with time zone,
  score integer default 0 not null,
  streak integer default 0 not null,
  best_streak integer default 0 not null,
  questions_answered integer default 0 not null,
  correct_answers integer default 0 not null,
  incorrect_answers integer default 0 not null,
  total_response_ms bigint default 0 not null,
  completed_session_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.game_sessions (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  game_mode text default 'rush_60'::text not null,
  category text default 'mixed'::text not null,
  questions_answered integer not null,
  correct_answers integer not null,
  incorrect_answers integer not null,
  score integer not null,
  best_streak integer default 0 not null,
  average_response_ms integer,
  duration_seconds integer default 60 not null,
  played_at timestamp with time zone default now() not null,
  duel_match_id uuid
);

create table public.global_level_thresholds (
  level smallint not null,
  cumulative_xp bigint not null,
  created_at timestamp with time zone default now() not null
);

create table public.global_xp_awards (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  game_session_id uuid not null,
  source_kind text not null,
  source_id uuid,
  base_xp integer not null,
  answer_xp integer not null,
  score integer not null,
  max_possible_score integer not null,
  score_efficiency numeric(8,6) not null,
  score_multiplier numeric(4,2) not null,
  result_multiplier numeric(4,2) not null,
  uncapped_xp integer not null,
  cap_xp integer not null,
  xp_awarded integer not null,
  calculation_version smallint default 1 not null,
  breakdown jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.notification_deliveries (
  id uuid default gen_random_uuid() not null,
  notification_id uuid not null,
  channel text not null,
  push_subscription_id uuid,
  status text default 'pending'::text not null,
  attempt_count integer default 0 not null,
  next_attempt_at timestamp with time zone default now() not null,
  locked_at timestamp with time zone,
  sent_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notification_preferences (
  player_id uuid not null,
  push_enabled boolean default false not null,
  email_enabled boolean default false not null,
  challenge_notifications boolean default true not null,
  friend_request_notifications boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  recipient_id uuid not null,
  actor_id uuid,
  notification_type text not null,
  duel_match_id uuid,
  friendship_id uuid,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb not null,
  dedupe_key text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone
);

create table public.player_category_progress (
  player_id uuid not null,
  category_id text not null,
  xp bigint default 0 not null,
  level smallint default 1 not null,
  questions_answered bigint default 0 not null,
  correct_answers bigint default 0 not null,
  incorrect_answers bigint default 0 not null,
  solo_questions bigint default 0 not null,
  duel_questions bigint default 0 not null,
  last_activity_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

create table public.player_global_progress (
  player_id uuid not null,
  total_xp bigint default 0 not null,
  level smallint default 1 not null,
  credited_games bigint default 0 not null,
  last_xp_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

create table public.player_stats (
  player_id uuid not null,
  games_played bigint default 0 not null,
  total_questions bigint default 0 not null,
  total_correct bigint default 0 not null,
  total_incorrect bigint default 0 not null,
  total_score bigint default 0 not null,
  high_score integer default 0 not null,
  best_streak integer default 0 not null,
  total_response_ms bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  display_name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  account_number bigint default nextval('profile_account_number_seq'::regclass) not null
);

create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_success_at timestamp with time zone
);

create table public.question_categories (
  id text not null,
  label text not null,
  sort_order integer not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  icon_key text not null,
  color text not null
);

create table public.trivia_questions (
  id bigint generated always as identity not null,
  question_key text not null,
  category_id text not null,
  difficulty text not null,
  question_text text not null,
  answers jsonb not null,
  correct_index smallint not null,
  source_name text not null,
  source_url text not null,
  verified_at date not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table trivia_private.global_xp_backfill_failures (
  id uuid default gen_random_uuid() not null,
  run_id uuid not null,
  source_kind text not null,
  source_id uuid not null,
  player_id uuid not null,
  game_session_id uuid not null,
  error_code text not null,
  error_message text not null,
  created_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone,
  resolution_run_id uuid
);

create table trivia_private.global_xp_backfill_runs (
  id uuid default gen_random_uuid() not null,
  status text default 'running'::text not null,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  solo_candidates integer default 0 not null,
  solo_awarded integer default 0 not null,
  solo_replayed integer default 0 not null,
  live_duel_candidates integer default 0 not null,
  live_duel_awarded integer default 0 not null,
  live_duel_replayed integer default 0 not null,
  turn_based_candidates integer default 0 not null,
  turn_based_awarded integer default 0 not null,
  turn_based_replayed integer default 0 not null,
  failure_count integer default 0 not null,
  created_by text default CURRENT_USER not null
);

CREATE OR REPLACE FUNCTION public.cancel_duel(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cancel_turn_challenge(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_now timestamptz := clock_timestamp();
begin
  update public.duel_matches dm
  set
    status = 'cancelled',
    closed_reason = 'host_cancelled',
    closed_at = v_now,
    updated_at = v_now
  where dm.id = p_match_id
    and dm.match_format = 'turn_based'
    and dm.host_id = v_player_id
    and dm.status in ('host_turn', 'awaiting_response')
    and not exists (
      select 1
      from public.duel_players guest
      where guest.match_id = dm.id
        and guest.player_role = 'guest'
        and guest.round_status <> 'pending'
    );

  if not found then
    raise exception 'Challenge cannot be cancelled after the opponent starts';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, v_now)
  where duel_match_id = p_match_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(p_limit integer DEFAULT 50)
 RETURNS TABLE(delivery_id uuid, notification_id uuid, channel text, recipient_id uuid, title text, body text, data jsonb, push_subscription_id uuid, push_endpoint text, push_p256dh text, push_auth_secret text, attempt_count integer, expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with claimed as (
    select nd.id
    from public.notification_deliveries nd
    join public.notifications pending_notification
      on pending_notification.id = nd.notification_id
    where (
      nd.status in ('pending', 'failed')
      or (
        nd.status = 'processing'
        and nd.locked_at < now() - interval '10 minutes'
      )
    )
      and nd.attempt_count < 5
      and nd.next_attempt_at <= now()
      and (
        pending_notification.expires_at is null
        or pending_notification.expires_at > now()
      )
    order by nd.created_at
    for update of nd skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ),
  updated as (
    update public.notification_deliveries nd
    set
      status = 'processing',
      attempt_count = nd.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
    from claimed c
    where nd.id = c.id
    returning nd.*
  )
  select
    u.id,
    u.notification_id,
    u.channel::text,
    n.recipient_id,
    n.title::text,
    n.body::text,
    n.data,
    u.push_subscription_id,
    ps.endpoint::text,
    ps.p256dh::text,
    ps.auth_secret::text,
    u.attempt_count,
    n.expires_at
  from updated u
  join public.notifications n on n.id = u.notification_id
  left join public.push_subscriptions ps on ps.id = u.push_subscription_id;
$function$;

CREATE OR REPLACE FUNCTION public.complete_notification_delivery(p_delivery_id uuid, p_success boolean, p_error text DEFAULT NULL::text, p_permanent_failure boolean DEFAULT false, p_deactivate_subscription boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_delivery public.notification_deliveries%rowtype;
begin
  select * into v_delivery
  from public.notification_deliveries
  where id = p_delivery_id
  for update;

  if not found then
    return false;
  end if;

  if p_success then
    update public.notification_deliveries
    set
      status = 'sent',
      sent_at = now(),
      locked_at = null,
      last_error = null,
      updated_at = now()
    where id = p_delivery_id;

    if v_delivery.push_subscription_id is not null then
      update public.push_subscriptions
      set last_success_at = now(), updated_at = now()
      where id = v_delivery.push_subscription_id;
    end if;
  else
    update public.notification_deliveries
    set
      status = case
        when p_permanent_failure or attempt_count >= 5 then 'dead'
        else 'failed'
      end,
      next_attempt_at = now() + make_interval(
        secs => least(900, (15 * power(2, greatest(attempt_count - 1, 0)))::integer)
      ),
      locked_at = null,
      last_error = left(coalesce(p_error, 'Unknown delivery error'), 1000),
      updated_at = now()
    where id = p_delivery_id;

    if p_deactivate_subscription and v_delivery.push_subscription_id is not null then
      update public.push_subscriptions
      set is_active = false, updated_at = now()
      where id = v_delivery.push_subscription_id;
    end if;
  end if;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_duel(p_category text DEFAULT 'mixed'::text, p_duration_seconds integer DEFAULT 60, p_invited_account_number bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_player_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    insert into public.player_stats (player_id)
    values (new.id)
    on conflict (player_id) do nothing;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_turn_challenge(p_category text, p_duration_seconds integer, p_invited_account_number bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_category text := lower(btrim(coalesce(nullif(p_category, ''), 'mixed')));
  v_mode public.game_modes%rowtype;
  v_invited_id uuid;
  v_match_id uuid;
  v_room_code text;
  v_now timestamptz := clock_timestamp();
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  perform trivia_private.advance_due_turn_challenges(v_now);

  if p_invited_account_number is null then
    raise exception 'Turn-based challenges require an opponent account number';
  end if;

  select * into v_mode
  from public.game_modes
  where mode = 'duel_' || p_duration_seconds::text
    and mode_family = 'duel'
    and is_active;

  if not found then
    raise exception 'Challenge length must be 30, 60 or 90 seconds';
  end if;

  if v_category <> 'mixed' and not exists (
    select 1
    from public.question_categories
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
    raise exception 'Question bank is incomplete for this challenge';
  end if;

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

  -- Serialise challenge creation for this host so concurrent devices cannot
  -- race past the five-outgoing limit.
  perform 1
  from public.profiles
  where id = v_player_id
  for update;

  if (
    select count(*)
    from public.duel_matches dm
    where dm.match_format = 'turn_based'
      and dm.host_id = v_player_id
      and dm.status in ('host_turn', 'awaiting_response', 'guest_turn')
  ) >= 5 then
    raise exception 'You already have five outstanding turn-based challenges';
  end if;

  if exists (
    select 1
    from public.duel_matches dm
    where dm.match_format = 'turn_based'
      and dm.status in ('host_turn', 'awaiting_response', 'guest_turn')
      and least(dm.host_id::text, dm.guest_id::text)
          = least(v_player_id::text, v_invited_id::text)
      and greatest(dm.host_id::text, dm.guest_id::text)
          = greatest(v_player_id::text, v_invited_id::text)
  ) then
    raise exception 'An unfinished turn-based challenge already exists between these players';
  end if;

  if exists (
    select 1
    from public.duel_players dp
    join public.duel_matches dm on dm.id = dp.match_id
    where dp.player_id = v_player_id
      and dm.match_format = 'live'
      and dm.status in ('countdown', 'active')
  ) then
    raise exception 'Finish your active live duel first';
  end if;

  v_room_code := trivia_private.new_room_code();
  v_starts_at := v_now + interval '5 seconds';
  v_ends_at := v_starts_at + make_interval(secs => v_mode.duration_seconds);

  insert into public.duel_matches (
    room_code,
    host_id,
    guest_id,
    invited_player_id,
    game_mode,
    category_id,
    match_format,
    status
  ) values (
    v_room_code,
    v_player_id,
    v_invited_id,
    v_invited_id,
    v_mode.mode,
    v_category,
    'turn_based',
    'host_turn'
  )
  returning id into v_match_id;

  insert into public.duel_players (
    match_id,
    player_id,
    player_role,
    round_status,
    round_starts_at,
    round_ends_at,
    current_question_started_at
  ) values (
    v_match_id,
    v_player_id,
    'host',
    'countdown',
    v_starts_at,
    v_ends_at,
    v_starts_at
  );

  insert into public.duel_players (
    match_id, player_id, player_role, round_status
  ) values (
    v_match_id, v_invited_id, 'guest', 'pending'
  );

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
    'match_format', 'turn_based',
    'status', 'host_turn',
    'game_mode', v_mode.mode,
    'duration_seconds', v_mode.duration_seconds,
    'category_id', v_category,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'server_now', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.decline_turn_challenge(p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_now timestamptz := clock_timestamp();
begin
  update public.duel_matches dm
  set
    status = 'cancelled',
    closed_reason = 'declined',
    closed_at = v_now,
    updated_at = v_now
  where dm.id = p_match_id
    and dm.match_format = 'turn_based'
    and dm.guest_id = v_player_id
    and dm.status = 'awaiting_response'
    and exists (
      select 1
      from public.duel_players guest
      where guest.match_id = dm.id
        and guest.player_id = v_player_id
        and guest.round_status = 'pending'
    );

  if not found then
    raise exception 'Pending challenge was not found';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, v_now)
  where recipient_id = v_player_id and duel_match_id = p_match_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_solo_game(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_current_solo_question(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_category_xp_summary(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_invitations()
 RETURNS TABLE(match_id uuid, room_code text, host_display_name text, host_account_number bigint, category_id text, duration_seconds integer, created_at timestamp with time zone, waiting_expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_leaderboard(p_limit integer DEFAULT 20)
 RETURNS TABLE(leaderboard_rank bigint, display_name text, account_number bigint, wins bigint, draws bigint, losses bigint, matches_played bigint, win_rate numeric, total_duel_score bigint, is_provisional boolean, is_current_player boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_leaderboard_v2(p_match_format text DEFAULT 'all'::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(leaderboard_rank bigint, display_name text, account_number bigint, wins bigint, draws bigint, losses bigint, matches_played bigint, win_rate numeric, total_duel_score bigint, is_provisional boolean, is_current_player boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if lower(coalesce(p_match_format, 'all')) not in ('all', 'live', 'turn_based') then
    raise exception 'Unknown multiplayer leaderboard format';
  end if;

  return query
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
  from trivia_private.duel_rankings_v2(lower(p_match_format)) r
  order by r.leaderboard_rank, r.account_number
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_match_history(p_opponent_account_number bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 30)
 RETURNS TABLE(match_id uuid, played_at timestamp with time zone, opponent_display_name text, opponent_account_number bigint, category_id text, duration_seconds integer, player_score integer, opponent_score integer, player_questions_answered integer, opponent_questions_answered integer, outcome text, result_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_match_history_v2(p_opponent_account_number bigint DEFAULT NULL::bigint, p_match_format text DEFAULT 'all'::text, p_limit integer DEFAULT 30)
 RETURNS TABLE(match_id uuid, played_at timestamp with time zone, match_format text, opponent_display_name text, opponent_account_number bigint, category_id text, duration_seconds integer, player_score integer, opponent_score integer, player_questions_answered integer, opponent_questions_answered integer, outcome text, result_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with caller as (
    select trivia_private.require_permanent_player() as id
  )
  select
    dm.id,
    dm.completed_at,
    dm.match_format::text,
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
  where (p_opponent_account_number is null
         or opponent_profile.account_number = p_opponent_account_number)
    and (lower(coalesce(p_match_format, 'all')) = 'all'
         or dm.match_format = lower(p_match_format))
  order by dm.completed_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$function$;

CREATE OR REPLACE FUNCTION public.get_duel_state(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_v2(p_period text DEFAULT 'all'::text, p_category text DEFAULT 'overall'::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(leaderboard_rank bigint, display_name text, account_number bigint, high_score bigint, accuracy_percent numeric, best_streak integer, games_played bigint, is_current_player boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.high_score,
    r.accuracy_percent,
    r.best_streak,
    r.games_played,
    (
      r.player_id =
      auth.uid()
    ) as is_current_player

  from trivia_private.leaderboard_rankings_v2(
    p_period,
    p_category
  ) r

  order by
    r.leaderboard_rank,
    r.account_number

  limit least(
    greatest(
      coalesce(p_limit, 20),
      1
    ),
    100
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_live_duel_global_xp_summary(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_category_progression()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_duel_rank()
 RETURNS TABLE(leaderboard_rank bigint, display_name text, account_number bigint, wins bigint, draws bigint, losses bigint, matches_played bigint, win_rate numeric, total_duel_score bigint, is_provisional boolean, is_current_player boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_global_progression()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := auth.uid();
  v_total_xp bigint := 0;
  v_level smallint := 1;
  v_credited_games bigint := 0;
  v_last_xp_at timestamptz;
  v_current_threshold bigint := 0;
  v_next_level smallint;
  v_next_threshold bigint;
  v_progress_percent numeric;
begin
  if v_player_id is null or not exists (
    select 1 from public.profiles profile where profile.id = v_player_id
  ) then
    raise exception 'A Trivia Rush player profile is required';
  end if;

  select
    progress.total_xp,
    progress.level,
    progress.credited_games,
    progress.last_xp_at
  into
    v_total_xp,
    v_level,
    v_credited_games,
    v_last_xp_at
  from public.player_global_progress progress
  where progress.player_id = v_player_id;

  if not found then
    v_total_xp := 0;
    v_level := 1;
    v_credited_games := 0;
    v_last_xp_at := null;
  end if;

  select threshold.cumulative_xp
  into v_current_threshold
  from public.global_level_thresholds threshold
  where threshold.level = v_level;

  select threshold.level, threshold.cumulative_xp
  into v_next_level, v_next_threshold
  from public.global_level_thresholds threshold
  where threshold.level > v_level
  order by threshold.level
  limit 1;

  v_progress_percent := case
    when v_next_threshold is null then 100::numeric
    when v_next_threshold = v_current_threshold then 100::numeric
    else round(
      (v_total_xp - v_current_threshold)::numeric * 100 /
      (v_next_threshold - v_current_threshold)::numeric,
      1
    )
  end;

  return jsonb_build_object(
    'total_xp', v_total_xp,
    'level', v_level,
    'credited_games', v_credited_games,
    'current_level_xp', v_current_threshold,
    'next_level', v_next_level,
    'next_level_xp', v_next_threshold,
    'xp_into_level', v_total_xp - v_current_threshold,
    'xp_to_next_level', case
      when v_next_threshold is null then null
      else greatest(v_next_threshold - v_total_xp, 0)
    end,
    'progress_percent', v_progress_percent,
    'last_xp_at', v_last_xp_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank_v2(p_period text DEFAULT 'all'::text, p_category text DEFAULT 'overall'::text)
 RETURNS TABLE(leaderboard_rank bigint, display_name text, account_number bigint, high_score bigint, accuracy_percent numeric, best_streak integer, games_played bigint, is_current_player boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.leaderboard_rank,
    r.display_name,
    r.account_number,
    r.high_score,
    r.accuracy_percent,
    r.best_streak,
    r.games_played,
    true as is_current_player

  from trivia_private.leaderboard_rankings_v2(
    p_period,
    p_category
  ) r

  where r.player_id = auth.uid()

  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
 RETURNS TABLE(push_enabled boolean, email_enabled boolean, challenge_notifications boolean, friend_request_notifications boolean, active_push_subscriptions bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  insert into public.notification_preferences (player_id)
  values (v_player_id)
  on conflict (player_id) do nothing;

  return query
  select
    np.push_enabled,
    np.email_enabled,
    np.challenge_notifications,
    np.friend_request_notifications,
    count(ps.id)::bigint
  from public.notification_preferences np
  left join public.push_subscriptions ps
    on ps.player_id = np.player_id and ps.is_active
  where np.player_id = v_player_id
  group by
    np.push_enabled,
    np.email_enabled,
    np.challenge_notifications,
    np.friend_request_notifications;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_notifications(p_limit integer DEFAULT 30)
 RETURNS TABLE(notification_id uuid, notification_type text, title text, body text, data jsonb, actor_display_name text, duel_match_id uuid, friendship_id uuid, read_at timestamp with time zone, created_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  perform trivia_private.advance_due_turn_challenges(clock_timestamp());

  return query
  select
    n.id,
    n.notification_type::text,
    n.title::text,
    n.body::text,
    n.data,
    actor.display_name::text,
    n.duel_match_id,
    n.friendship_id,
    n.read_at,
    n.created_at,
    n.expires_at
  from public.notifications n
  left join public.profiles actor on actor.id = n.actor_id
  where n.recipient_id = v_player_id
    and (n.expires_at is null or n.expires_at > now() or n.read_at is not null)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_question_categories()
 RETURNS TABLE(category_id text, label text, question_count bigint, icon_key text, color text, sort_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    qc.id,
    qc.label,
    count(q.id)::bigint,
    qc.icon_key,
    qc.color,
    qc.sort_order
  from public.question_categories qc
  left join public.trivia_questions q
    on q.category_id = qc.id
   and q.is_active
  where qc.is_active
  group by qc.id, qc.label, qc.icon_key, qc.color, qc.sort_order
  order by qc.sort_order;
$function$;

CREATE OR REPLACE FUNCTION public.get_social_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_solo_category_xp_summary(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_solo_global_xp_summary(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_turn_based_global_xp_summary(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where id = p_match_id
    and match_format = 'turn_based';

  if not found then
    raise exception 'Turn-based challenge does not exist';
  end if;

  select *
  into v_player
  from public.duel_players
  where match_id = p_match_id
    and player_id = v_player_id;

  if not found then
    raise exception 'Player did not participate in this turn-based challenge';
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
    and source_kind = 'turn_based';

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
$function$;

CREATE OR REPLACE FUNCTION public.get_turn_challenge_state(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_match public.duel_matches%rowtype;
  v_self public.duel_players%rowtype;
  v_opponent public.duel_players%rowtype;
  v_now timestamptz := clock_timestamp();
  v_question jsonb;
begin
  perform trivia_private.advance_due_turn_challenges(v_now);

  select * into v_match
  from public.duel_matches
  where id = p_match_id
    and match_format = 'turn_based'
    and v_player_id in (host_id, guest_id)
  for update;

  if not found then
    raise exception 'Turn-based challenge does not exist';
  end if;

  select * into v_self
  from public.duel_players
  where match_id = v_match.id and player_id = v_player_id
  for update;

  if v_self.round_status = 'countdown'
     and v_now >= v_self.round_starts_at
     and v_now < v_self.round_ends_at then
    update public.duel_players
    set round_status = 'active', last_seen_at = v_now, updated_at = v_now
    where match_id = v_match.id and player_id = v_player_id
    returning * into v_self;
  elsif v_self.round_status = 'active' then
    update public.duel_players
    set last_seen_at = v_now, updated_at = v_now
    where match_id = v_match.id and player_id = v_player_id
    returning * into v_self;
  end if;

  select * into v_opponent
  from public.duel_players
  where match_id = v_match.id and player_id <> v_player_id
  limit 1;

  if v_self.round_status = 'active'
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
    'match_format', v_match.match_format,
    'status', v_match.status,
    'closed_reason', v_match.closed_reason,
    'game_mode', v_match.game_mode,
    'category_id', v_match.category_id,
    'server_now', v_now,
    'starts_at', v_self.round_starts_at,
    'ends_at', v_self.round_ends_at,
    'response_expires_at', v_match.response_expires_at,
    'winner_id', v_match.winner_id,
    'result_reason', v_match.result_reason,
    'is_host', v_match.host_id = v_player_id,
    'can_start', v_match.status = 'awaiting_response'
      and v_match.guest_id = v_player_id
      and v_self.round_status = 'pending'
      and v_match.response_expires_at > v_now,
    'can_cancel', v_match.host_id = v_player_id
      and v_match.status in ('host_turn', 'awaiting_response')
      and v_opponent.round_status = 'pending',
    'can_decline', v_match.guest_id = v_player_id
      and v_match.status = 'awaiting_response'
      and v_self.round_status = 'pending',
    'self', jsonb_build_object(
      'player_id', v_self.player_id,
      'round_status', v_self.round_status,
      'score', v_self.score,
      'streak', v_self.streak,
      'best_streak', v_self.best_streak,
      'questions_answered', v_self.questions_answered,
      'correct_answers', v_self.correct_answers,
      'outcome', v_self.outcome
    ),
    'opponent', (
      select jsonb_build_object(
        'player_id', v_opponent.player_id,
        'display_name', p.display_name,
        'account_number', p.account_number,
        'round_status', v_opponent.round_status,
        'score', case when v_match.status = 'completed' then v_opponent.score else null end,
        'questions_answered', case
          when v_match.status = 'completed' then v_opponent.questions_answered
          else null
        end,
        'outcome', case when v_match.status = 'completed' then v_opponent.outcome else null end
      )
      from public.profiles p
      where p.id = v_opponent.player_id
    ),
    'question', v_question,
    'next_question_at', v_self.next_question_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_turn_challenges(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  perform trivia_private.advance_due_turn_challenges(clock_timestamp());

  return jsonb_build_object(
    'active', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', active_match.match_id,
        'status', active_match.status,
        'is_host', active_match.is_host,
        'opponent_display_name', active_match.opponent_display_name,
        'opponent_account_number', active_match.opponent_account_number,
        'category_id', active_match.category_id,
        'duration_seconds', active_match.duration_seconds,
        'response_expires_at', active_match.response_expires_at,
        'self_round_status', active_match.self_round_status,
        'self_score', active_match.self_score,
        'can_start', active_match.can_start,
        'can_cancel', active_match.can_cancel,
        'can_decline', active_match.can_decline,
        'created_at', active_match.created_at
      ) order by active_match.updated_at desc)
      from (
        select
          dm.id as match_id,
          dm.status,
          dm.host_id = v_player_id as is_host,
          opponent.display_name as opponent_display_name,
          opponent.account_number as opponent_account_number,
          dm.category_id,
          gm.duration_seconds,
          dm.response_expires_at,
          self_player.round_status as self_round_status,
          self_player.score as self_score,
          dm.status = 'awaiting_response'
            and dm.guest_id = v_player_id
            and self_player.round_status = 'pending' as can_start,
          dm.host_id = v_player_id
            and dm.status in ('host_turn', 'awaiting_response')
            and opponent_player.round_status = 'pending' as can_cancel,
          dm.guest_id = v_player_id
            and dm.status = 'awaiting_response'
            and self_player.round_status = 'pending' as can_decline,
          dm.created_at,
          dm.updated_at
        from public.duel_matches dm
        join public.duel_players self_player
          on self_player.match_id = dm.id and self_player.player_id = v_player_id
        join public.duel_players opponent_player
          on opponent_player.match_id = dm.id and opponent_player.player_id <> v_player_id
        join public.profiles opponent on opponent.id = opponent_player.player_id
        join public.game_modes gm on gm.mode = dm.game_mode
        where dm.match_format = 'turn_based'
          and dm.status in ('host_turn', 'awaiting_response', 'guest_turn')
        order by dm.updated_at desc
        limit least(greatest(coalesce(p_limit, 30), 1), 100)
      ) active_match
    ), '[]'::jsonb),
    'recent_closed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', recent_match.match_id,
        'closed_reason', recent_match.closed_reason,
        'opponent_display_name', recent_match.opponent_display_name,
        'opponent_account_number', recent_match.opponent_account_number,
        'category_id', recent_match.category_id,
        'duration_seconds', recent_match.duration_seconds,
        'closed_at', recent_match.closed_at
      ) order by recent_match.closed_at desc)
      from (
        select
          dm.id as match_id,
          dm.closed_reason,
          opponent.display_name as opponent_display_name,
          opponent.account_number as opponent_account_number,
          dm.category_id,
          gm.duration_seconds,
          dm.closed_at
        from public.duel_matches dm
        join public.duel_players self_player
          on self_player.match_id = dm.id and self_player.player_id = v_player_id
        join public.duel_players opponent_player
          on opponent_player.match_id = dm.id and opponent_player.player_id <> v_player_id
        join public.profiles opponent on opponent.id = opponent_player.player_id
        join public.game_modes gm on gm.mode = dm.game_mode
        where dm.match_format = 'turn_based'
          and dm.status = 'cancelled'
          and dm.closed_at >= now() - interval '30 days'
        order by dm.closed_at desc
        limit least(greatest(coalesce(p_limit, 30), 1), 100)
      ) recent_match
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::bigint
  from public.notifications n
  where n.recipient_id = trivia_private.require_permanent_player()
    and n.read_at is null
    and (n.expires_at is null or n.expires_at > now());
$function$;

CREATE OR REPLACE FUNCTION public.join_duel(p_room_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.lookup_duel_player(p_account_number bigint)
 RETURNS TABLE(player_id uuid, display_name text, account_number bigint, friendship_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_count integer;
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = v_player_id
    and (p_notification_id is null or id = p_notification_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.normalise_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    new.display_name := btrim(new.display_name);
    new.updated_at := now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_notification_dispatch()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_match record;
  v_count integer := 0;
  v_host_name text;
begin
  v_count := trivia_private.advance_due_turn_challenges(clock_timestamp());

  update public.notification_deliveries nd
  set
    status = 'dead',
    locked_at = null,
    last_error = 'Notification expired before delivery',
    updated_at = now()
  from public.notifications n
  where n.id = nd.notification_id
    and n.expires_at is not null
    and n.expires_at <= now()
    and nd.status in ('pending', 'failed', 'processing');

  for v_match in
    select dm.id, dm.host_id, dm.guest_id, dm.response_expires_at
    from public.duel_matches dm
    where dm.match_format = 'turn_based'
      and dm.status = 'awaiting_response'
      and dm.response_expires_at > now()
      and dm.response_expires_at <= now() + interval '24 hours'
  loop
    select display_name into v_host_name
    from public.profiles where id = v_match.host_id;

    perform trivia_private.enqueue_notification(
      v_match.guest_id,
      'turn_challenge_reminder',
      v_match.host_id,
      v_match.id,
      null,
      'Challenge expires soon',
      'Your challenge from ' || coalesce(v_host_name, 'a Trivia Rush player') || ' expires within 24 hours.',
      jsonb_build_object('challenge', v_match.id),
      'turn-reminder:' || v_match.id::text,
      v_match.response_expires_at
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth_secret text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_subscription_id uuid;
begin
  if char_length(coalesce(p_endpoint, '')) not between 20 and 2048
     or char_length(coalesce(p_p256dh, '')) not between 20 and 512
     or char_length(coalesce(p_auth_secret, '')) not between 8 and 256 then
    raise exception 'Push subscription is invalid';
  end if;

  insert into public.push_subscriptions (
    player_id,
    endpoint,
    p256dh,
    auth_secret,
    user_agent,
    is_active,
    updated_at
  ) values (
    v_player_id,
    p_endpoint,
    p_p256dh,
    p_auth_secret,
    left(p_user_agent, 512),
    true,
    now()
  )
  on conflict (endpoint) do update
  set
    player_id = excluded.player_id,
    p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret,
    user_agent = excluded.user_agent,
    is_active = true,
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.remove_push_subscription(p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_removed boolean;
begin
  update public.push_subscriptions
  set is_active = false, updated_at = now()
  where player_id = v_player_id and endpoint = p_endpoint;

  v_removed := found;

  if not exists (
    select 1
    from public.push_subscriptions
    where player_id = v_player_id and is_active
  ) then
    update public.notification_preferences
    set push_enabled = false, updated_at = now()
    where player_id = v_player_id;
  end if;

  return v_removed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_account_number bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.start_solo_game(p_game_mode text DEFAULT 'rush_60'::text, p_category text DEFAULT 'mixed'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.start_turn_challenge(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
  v_match public.duel_matches%rowtype;
  v_duration integer;
  v_now timestamptz := clock_timestamp();
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  perform trivia_private.advance_due_turn_challenges(v_now);

  select * into v_match
  from public.duel_matches
  where id = p_match_id
    and match_format = 'turn_based'
    and guest_id = v_player_id
  for update;

  if not found then
    raise exception 'Turn-based challenge was not found';
  end if;

  if v_match.status <> 'awaiting_response'
     or v_match.response_expires_at <= v_now then
    raise exception 'This challenge is no longer ready to play';
  end if;

  if exists (
    select 1
    from public.duel_players dp
    join public.duel_matches dm on dm.id = dp.match_id
    where dp.player_id = v_player_id
      and dp.round_status in ('countdown', 'active')
      and (
        dm.match_format = 'turn_based'
        or dm.status in ('countdown', 'active')
      )
  ) then
    raise exception 'You already have an active timed match';
  end if;

  select duration_seconds into v_duration
  from public.game_modes
  where mode = v_match.game_mode and mode_family = 'duel' and is_active;

  if v_duration is null then
    raise exception 'Challenge mode is unavailable';
  end if;

  v_starts_at := v_now + interval '5 seconds';
  v_ends_at := v_starts_at + make_interval(secs => v_duration);

  update public.duel_players
  set
    round_status = 'countdown',
    round_starts_at = v_starts_at,
    round_ends_at = v_ends_at,
    current_question_started_at = v_starts_at,
    last_seen_at = v_now,
    updated_at = v_now
  where match_id = v_match.id and player_id = v_player_id;

  update public.duel_matches
  set status = 'guest_turn', updated_at = v_now
  where id = v_match.id;

  update public.notifications
  set read_at = coalesce(read_at, v_now)
  where recipient_id = v_player_id
    and duel_match_id = v_match.id
    and notification_type in (
      'turn_challenge_ready',
      'turn_challenge_reminder'
    );

  return jsonb_build_object(
    'match_id', v_match.id,
    'match_format', 'turn_based',
    'status', 'guest_turn',
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'server_now', v_now
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_duel_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_game_result(p_questions_answered integer, p_correct_answers integer, p_incorrect_answers integer, p_score integer, p_best_streak integer, p_average_response_ms integer DEFAULT NULL::integer, p_duration_seconds integer DEFAULT 60, p_game_mode text DEFAULT 'rush_60'::text, p_category text DEFAULT 'mixed'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_player_id uuid;
    v_session_id uuid;
    v_mode public.game_modes%rowtype;
begin
    v_player_id := auth.uid();

    if v_player_id is null then
        raise exception 'Player must be signed in';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = v_player_id
    ) then
        raise exception 'Player profile does not exist';
    end if;

    -- Phase 3: the mode must be registered. Its row supplies the
    -- plausibility limits used below.
    select *
    into v_mode
    from public.game_modes
    where mode = lower(btrim(p_game_mode))
      and is_active;

    if not found then
        raise exception 'Unknown game mode';
    end if;

    if p_questions_answered < 1
       or p_questions_answered > v_mode.max_questions then
        raise exception 'Invalid questions answered';
    end if;

    if p_correct_answers < 0
       or p_incorrect_answers < 0
       or p_correct_answers + p_incorrect_answers
          <> p_questions_answered then
        raise exception 'Answer totals do not match';
    end if;

    if p_best_streak < 0
       or p_best_streak > p_correct_answers then
        raise exception 'Invalid best streak';
    end if;

    if p_score < 0 or p_score > 1000000 then
        raise exception 'Invalid score';
    end if;

    -- Phase 3: the score must be achievable under the scoring formula.
    if p_score >
       p_correct_answers * v_mode.max_points_per_question then
        raise exception 'Score is not plausible for the answers given';
    end if;

    if p_duration_seconds < 10
       or p_duration_seconds > 600 then
        raise exception 'Invalid game duration';
    end if;

    -- Phase 3: fixed-duration modes must report exactly that duration.
    if v_mode.duration_seconds is not null
       and p_duration_seconds <> v_mode.duration_seconds then
        raise exception 'Duration does not match the game mode';
    end if;

    if p_average_response_ms is not null
       and (
           p_average_response_ms < 50
           or p_average_response_ms > 600000
       ) then
        raise exception 'Invalid response time';
    end if;

    -- Phase 3: total response time must fit inside the game clock.
    if p_average_response_ms is not null
       and p_questions_answered::bigint *
           p_average_response_ms::bigint >
           p_duration_seconds::bigint * 1000 + 2000 then
        raise exception 'Response times exceed the game duration';
    end if;

    -- Prevent rapid automated submissions.
    if exists (
        select 1
        from public.game_sessions
        where player_id = v_player_id
          and played_at > now() - interval '20 seconds'
    ) then
        raise exception 'Game results are being submitted too quickly';
    end if;

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
        duration_seconds
    )
    values (
        v_player_id,
        btrim(p_game_mode),
        btrim(p_category),
        p_questions_answered,
        p_correct_answers,
        p_incorrect_answers,
        p_score,
        p_best_streak,
        p_average_response_ms,
        p_duration_seconds
    )
    returning id into v_session_id;

    return v_session_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_solo_answer(p_run_id uuid, p_position integer, p_selected_index integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_turn_challenge_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and match_format = 'turn_based'
    and v_player_id in (host_id, guest_id)
  for update;

  if not found then
    raise exception 'Turn-based challenge does not exist';
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
      'ends_at', v_player.round_ends_at,
      'next_question_at', v_player.next_question_at
    );
  end if;

  if v_player.round_status = 'countdown'
     and v_now >= v_player.round_starts_at
     and v_now < v_player.round_ends_at then
    update public.duel_players
    set round_status = 'active', updated_at = v_now
    where match_id = v_match.id and player_id = v_player_id
    returning * into v_player;
  end if;

  if v_player.round_ends_at is not null and v_now >= v_player.round_ends_at then
    perform trivia_private.finish_turn_round(v_match.id, v_player_id, v_now);
    return jsonb_build_object(
      'status', 'round_completed',
      'match_id', v_match.id,
      'server_now', v_now,
      'ends_at', v_player.round_ends_at
    );
  end if;

  if v_player.round_status <> 'active'
     or not (
       (v_match.status = 'host_turn' and v_player.player_role = 'host')
       or (v_match.status = 'guest_turn' and v_player.player_role = 'guest')
     ) then
    raise exception 'Your turn-based round has not started';
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
    raise exception 'Current challenge question is unavailable';
  end if;

  v_response_ms := greatest(
    0,
    round(
      extract(epoch from (v_now - v_player.current_question_started_at)) * 1000
    )::integer
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
    'ends_at', v_player.round_ends_at,
    'next_question_at', v_player.next_question_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(p_push_enabled boolean, p_email_enabled boolean, p_challenge_notifications boolean, p_friend_request_notifications boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_player_id uuid := trivia_private.require_permanent_player();
begin
  if coalesce(p_push_enabled, false) and not exists (
    select 1
    from public.push_subscriptions
    where player_id = v_player_id and is_active
  ) then
    raise exception 'Enable push on this device before turning on push alerts';
  end if;

  insert into public.notification_preferences (
    player_id,
    push_enabled,
    email_enabled,
    challenge_notifications,
    friend_request_notifications,
    updated_at
  ) values (
    v_player_id,
    coalesce(p_push_enabled, false),
    coalesce(p_email_enabled, false),
    coalesce(p_challenge_notifications, true),
    coalesce(p_friend_request_notifications, true),
    now()
  )
  on conflict (player_id) do update
  set
    push_enabled = excluded.push_enabled,
    email_enabled = excluded.email_enabled,
    challenge_notifications = excluded.challenge_notifications,
    friend_request_notifications = excluded.friend_request_notifications,
    updated_at = now();

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_player_stats_after_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.advance_due_turn_challenges(p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_due record;
  v_count integer := 0;
  v_host_name text;
begin
  for v_due in
    select dp.match_id, dp.player_id
    from public.duel_players dp
    join public.duel_matches dm on dm.id = dp.match_id
    where dm.match_format = 'turn_based'
      and dm.status in ('host_turn', 'guest_turn')
      and dp.round_status in ('countdown', 'active')
      and dp.round_ends_at <= p_now
    order by dp.round_ends_at
    for update of dm skip locked
  loop
    perform trivia_private.finish_turn_round(
      v_due.match_id,
      v_due.player_id,
      p_now
    );
    v_count := v_count + 1;
  end loop;

  for v_due in
    select dm.id, dm.host_id, dm.guest_id
    from public.duel_matches dm
    where dm.match_format = 'turn_based'
      and dm.status = 'awaiting_response'
      and dm.response_expires_at <= p_now
    order by dm.response_expires_at
    for update skip locked
  loop
    update public.duel_matches
    set
      status = 'cancelled',
      closed_reason = 'expired',
      closed_at = p_now,
      updated_at = p_now
    where id = v_due.id;

    select display_name into v_host_name
    from public.profiles where id = v_due.guest_id;

    perform trivia_private.enqueue_notification(
      v_due.host_id,
      'turn_challenge_expired',
      v_due.guest_id,
      v_due.id,
      null,
      'Challenge expired',
      coalesce(v_host_name, 'Your opponent') || ' did not play before the challenge expired.',
      jsonb_build_object('challenge', v_due.id),
      'turn-expired:' || v_due.id::text,
      null
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_duel_category_progress(p_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_live_duel_global_xp(p_match_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_live_duel_global_xp_after_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_solo_category_progress(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_solo_global_xp(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_solo_global_xp_after_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.completed_session_id is not null
     and new.completed_session_id is distinct from old.completed_session_id then
    perform trivia_private.award_solo_global_xp(new.id);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_turn_based_global_xp(p_match_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_calculation jsonb;
  v_result jsonb;
begin
  v_calculation := trivia_private.calculate_turn_based_global_xp(
    p_match_id,
    p_player_id
  );

  v_result := trivia_private.record_global_xp_award(
    (v_calculation ->> 'player_id')::uuid,
    (v_calculation ->> 'game_session_id')::uuid,
    'turn_based',
    p_match_id,
    (v_calculation ->> 'base_xp')::integer,
    (v_calculation ->> 'answer_xp')::integer,
    (v_calculation ->> 'score')::integer,
    (v_calculation ->> 'max_possible_score')::integer,
    v_calculation ->> 'outcome',
    v_calculation ->> 'result_reason',
    jsonb_build_object(
      'calculation_version', 1,
      'match_format', 'turn_based',
      'questions_answered',
        (v_calculation ->> 'questions_answered')::integer,
      'outcome', v_calculation ->> 'outcome',
      'result_reason', v_calculation ->> 'result_reason',
      'answers', v_calculation -> 'answers'
    )
  );

  return v_result || jsonb_build_object(
    'source_kind', 'turn_based',
    'source_id', p_match_id,
    'outcome', v_calculation ->> 'outcome',
    'result_reason', v_calculation ->> 'result_reason'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.award_turn_based_global_xp_after_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform trivia_private.award_turn_based_global_xp(
      new.id,
      v_participant.player_id
    );
  end loop;

  if v_participant_count <> 2 then
    raise exception 'Completed turn-based challenge must contain exactly two players';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_global_answer_xp(p_difficulty text, p_is_correct boolean, p_response_ms integer, p_current_streak integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with values_for_answer as (
    select
      trivia_private.global_base_xp(p_difficulty, p_is_correct) as base_xp,
      trivia_private.global_speed_multiplier(p_response_ms) as speed_multiplier,
      trivia_private.global_streak_multiplier(p_current_streak) as streak_multiplier
  )
  select jsonb_build_object(
    'base_xp', base_xp,
    'speed_multiplier', speed_multiplier,
    'streak_multiplier', streak_multiplier,
    'answer_xp', case
      when base_xp = 0 then 0
      else round(base_xp * speed_multiplier * streak_multiplier)::integer
    end
  )
  from values_for_answer;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_global_game_xp(p_base_xp integer, p_answer_xp integer, p_score integer, p_max_possible_score integer, p_outcome text DEFAULT NULL::text, p_result_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_base_xp integer := greatest(coalesce(p_base_xp, 0), 0);
  v_answer_xp integer := greatest(coalesce(p_answer_xp, 0), 0);
  v_score integer := greatest(coalesce(p_score, 0), 0);
  v_max_possible_score integer := greatest(coalesce(p_max_possible_score, 0), 0);
  v_efficiency numeric;
  v_score_multiplier numeric;
  v_result_multiplier numeric;
  v_uncapped_xp integer;
  v_cap_xp integer;
  v_final_xp integer;
begin
  if v_answer_xp < v_base_xp then
    raise exception 'Answer XP cannot be lower than base XP';
  end if;

  if v_max_possible_score = 0 and v_score <> 0 then
    raise exception 'A positive score requires a positive maximum possible score';
  end if;

  if v_max_possible_score > 0 and v_score > v_max_possible_score then
    raise exception 'Score cannot exceed the maximum possible score';
  end if;

  v_efficiency := case
    when v_max_possible_score = 0 then 0::numeric
    else least(1::numeric, v_score::numeric / v_max_possible_score::numeric)
  end;

  v_score_multiplier := trivia_private.global_score_multiplier(v_efficiency);
  v_result_multiplier := trivia_private.global_result_multiplier(
    p_outcome,
    p_result_reason
  );
  v_uncapped_xp := round(
    v_answer_xp * v_score_multiplier * v_result_multiplier
  )::integer;
  v_cap_xp := round(v_base_xp * 1.50)::integer;
  v_final_xp := least(v_uncapped_xp, v_cap_xp);

  return jsonb_build_object(
    'base_xp', v_base_xp,
    'answer_xp', v_answer_xp,
    'score', v_score,
    'max_possible_score', v_max_possible_score,
    'score_efficiency', round(v_efficiency, 6),
    'score_multiplier', v_score_multiplier,
    'result_multiplier', v_result_multiplier,
    'uncapped_xp', v_uncapped_xp,
    'cap_xp', v_cap_xp,
    'xp_awarded', v_final_xp
  );
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_live_duel_global_xp(p_match_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select trivia_private.calculate_multiplayer_global_xp(
    p_match_id,
    p_player_id,
    'live'
  );
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_multiplayer_global_xp(p_match_id uuid, p_player_id uuid, p_expected_format text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_expected_format text := lower(btrim(coalesce(p_expected_format, '')));
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
    raise exception 'Multiplayer match and player are required';
  end if;

  if v_expected_format not in ('live', 'turn_based') then
    raise exception 'Expected multiplayer format is invalid';
  end if;

  select *
  into v_match
  from public.duel_matches
  where id = p_match_id;

  if not found then
    raise exception 'Multiplayer match does not exist';
  end if;

  if v_match.match_format <> v_expected_format then
    raise exception 'Multiplayer match format does not match the XP source';
  end if;

  if v_match.status <> 'completed'
     or v_match.result_reason is null then
    raise exception 'Multiplayer match is not completed';
  end if;

  select *
  into v_player
  from public.duel_players
  where match_id = p_match_id
    and player_id = p_player_id;

  if not found then
    raise exception 'Player did not participate in this multiplayer match';
  end if;

  if v_player.completed_session_id is null
     or v_player.outcome is null then
    raise exception 'Multiplayer player result is incomplete';
  end if;

  if not exists (
    select 1
    from public.game_sessions session
    where session.id = v_player.completed_session_id
      and session.player_id = v_player.player_id
      and session.duel_match_id = v_player.match_id
  ) then
    raise exception 'Multiplayer session does not match the player and match';
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
      'Multiplayer answer totals do not match player state for match %, player %',
      v_player.match_id,
      v_player.player_id;
  end if;

  if v_points_total <> v_player.score then
    raise exception
      'Multiplayer score mismatch for match %, player %: player %, answers %',
      v_player.match_id,
      v_player.player_id,
      v_player.score,
      v_points_total;
  end if;

  v_max_possible_score :=
    trivia_private.global_multiplayer_max_possible_score(v_answer_count);

  return jsonb_build_object(
    'match_id', v_match.id,
    'match_format', v_match.match_format,
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_solo_global_xp(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.calculate_turn_based_global_xp(p_match_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select trivia_private.calculate_multiplayer_global_xp(
    p_match_id,
    p_player_id,
    'turn_based'
  );
$function$;

CREATE OR REPLACE FUNCTION trivia_private.category_level_for_xp(p_xp bigint)
 RETURNS smallint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(max(thresholds.level), 1)::smallint
  from public.category_level_thresholds thresholds
  where thresholds.cumulative_xp <= greatest(coalesce(p_xp, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION trivia_private.category_progress_summary(p_source_kind text, p_source_id uuid, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.category_xp_for_answer(p_difficulty text, p_is_correct boolean)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when not coalesce(p_is_correct, false) then 0
    when lower(p_difficulty) = 'easy' then 10
    when lower(p_difficulty) = 'medium' then 15
    when lower(p_difficulty) = 'hard' then 25
    else 0
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.duel_question_payload(p_match_id uuid, p_position integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.duel_rankings()
 RETURNS TABLE(player_id uuid, leaderboard_rank bigint, display_name text, account_number bigint, wins bigint, draws bigint, losses bigint, matches_played bigint, win_rate numeric, total_duel_score bigint, is_provisional boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.duel_rankings_v2(p_match_format text DEFAULT 'all'::text)
 RETURNS TABLE(player_id uuid, leaderboard_rank bigint, display_name text, account_number bigint, wins bigint, draws bigint, losses bigint, matches_played bigint, win_rate numeric, total_duel_score bigint, is_provisional boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where lower(coalesce(p_match_format, 'all')) = 'all'
       or dm.match_format = lower(p_match_format)
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.enqueue_notification(p_recipient_id uuid, p_notification_type text, p_actor_id uuid, p_duel_match_id uuid, p_friendship_id uuid, p_title text, p_body text, p_data jsonb, p_dedupe_key text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    duel_match_id,
    friendship_id,
    title,
    body,
    data,
    dedupe_key,
    expires_at
  ) values (
    p_recipient_id,
    p_actor_id,
    p_notification_type,
    p_duel_match_id,
    p_friendship_id,
    p_title,
    p_body,
    coalesce(p_data, '{}'::jsonb),
    p_dedupe_key,
    p_expires_at
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.notifications
    where dedupe_key = p_dedupe_key;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.finalise_duel(p_match_id uuid, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.finalise_solo_game(p_run_id uuid, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.finalise_turn_challenge(p_match_id uuid, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_match public.duel_matches%rowtype;
  v_host public.duel_players%rowtype;
  v_guest public.duel_players%rowtype;
  v_player public.duel_players%rowtype;
  v_host_outcome text;
  v_guest_outcome text;
  v_winner_id uuid;
  v_reason text;
  v_duration integer;
  v_average integer;
  v_session_id uuid;
  v_opponent_name text;
begin
  select * into v_match
  from public.duel_matches
  where id = p_match_id
  for update;

  if not found or v_match.match_format <> 'turn_based' then
    raise exception 'Turn-based challenge does not exist';
  end if;

  if v_match.status = 'completed' then
    return jsonb_build_object(
      'status', 'completed',
      'match_id', v_match.id,
      'winner_id', v_match.winner_id,
      'result_reason', v_match.result_reason
    );
  end if;

  select * into v_host
  from public.duel_players
  where match_id = v_match.id and player_role = 'host'
  for update;

  select * into v_guest
  from public.duel_players
  where match_id = v_match.id and player_role = 'guest'
  for update;

  if v_host.round_status <> 'completed'
     or v_guest.round_status <> 'completed' then
    raise exception 'Both turn-based rounds must be complete';
  end if;

  if v_host.score > v_guest.score then
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

  select duration_seconds into v_duration
  from public.game_modes
  where mode = v_match.game_mode;

  for v_player in
    select *
    from public.duel_players
    where match_id = v_match.id
    order by player_role
  loop
    if v_player.completed_session_id is null then
      v_average := case
        when v_player.questions_answered = 0 then null
        else greatest(
          50,
          round(
            v_player.total_response_ms::numeric / v_player.questions_answered
          )::integer
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
      ) values (
        v_player.player_id,
        v_match.game_mode,
        v_match.category_id,
        v_player.questions_answered,
        v_player.correct_answers,
        v_player.incorrect_answers,
        v_player.score,
        v_player.best_streak,
        v_average,
        v_duration,
        coalesce(v_player.round_completed_at, p_now),
        v_match.id
      )
      returning id into v_session_id;

      update public.duel_players
      set completed_session_id = v_session_id
      where match_id = v_match.id and player_id = v_player.player_id;
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

  select display_name into v_opponent_name
  from public.profiles where id = v_guest.player_id;

  perform trivia_private.enqueue_notification(
    v_host.player_id,
    'turn_challenge_result',
    v_guest.player_id,
    v_match.id,
    null,
    'Challenge result ready',
    'Your turn-based challenge against ' || coalesce(v_opponent_name, 'your opponent') || ' is complete.',
    jsonb_build_object('challenge', v_match.id),
    'turn-result:' || v_match.id::text || ':' || v_host.player_id::text,
    null
  );

  select display_name into v_opponent_name
  from public.profiles where id = v_host.player_id;

  perform trivia_private.enqueue_notification(
    v_guest.player_id,
    'turn_challenge_result',
    v_host.player_id,
    v_match.id,
    null,
    'Challenge result ready',
    'Your turn-based challenge against ' || coalesce(v_opponent_name, 'your opponent') || ' is complete.',
    jsonb_build_object('challenge', v_match.id),
    'turn-result:' || v_match.id::text || ':' || v_guest.player_id::text,
    null
  );

  return jsonb_build_object(
    'status', 'completed',
    'match_id', v_match.id,
    'winner_id', v_winner_id,
    'result_reason', v_reason
  );
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.finish_turn_round(p_match_id uuid, p_player_id uuid, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_match public.duel_matches%rowtype;
  v_player public.duel_players%rowtype;
  v_opponent_name text;
  v_deadline timestamptz;
begin
  select * into v_match
  from public.duel_matches
  where id = p_match_id
  for update;

  if not found or v_match.match_format <> 'turn_based' then
    raise exception 'Turn-based challenge does not exist';
  end if;

  select * into v_player
  from public.duel_players
  where match_id = v_match.id and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Turn-based participant does not exist';
  end if;

  if v_player.round_status = 'completed' then
    return jsonb_build_object(
      'status', v_match.status,
      'round_status', 'completed',
      'match_id', v_match.id
    );
  end if;

  if v_player.round_ends_at is null or p_now < v_player.round_ends_at then
    raise exception 'Turn-based round is not ready to finish';
  end if;

  update public.duel_players
  set
    round_status = 'completed',
    round_completed_at = round_ends_at,
    current_question_started_at = null,
    next_question_at = null,
    last_seen_at = p_now,
    updated_at = p_now
  where match_id = v_match.id and player_id = p_player_id
  returning * into v_player;

  if v_player.player_role = 'host' then
    v_deadline := v_player.round_ends_at + interval '72 hours';

    update public.duel_matches
    set
      status = 'awaiting_response',
      response_expires_at = v_deadline,
      updated_at = p_now
    where id = v_match.id;

    select display_name into v_opponent_name
    from public.profiles where id = v_match.host_id;

    perform trivia_private.enqueue_notification(
      v_match.guest_id,
      'turn_challenge_ready',
      v_match.host_id,
      v_match.id,
      null,
      'Your Trivia Rush turn is ready',
      coalesce(v_opponent_name, 'A Trivia Rush player') || ' challenged you. Play within 72 hours.',
      jsonb_build_object('challenge', v_match.id),
      'turn-ready:' || v_match.id::text,
      v_deadline
    );

    return jsonb_build_object(
      'status', 'awaiting_response',
      'round_status', 'completed',
      'match_id', v_match.id,
      'response_expires_at', v_deadline
    );
  end if;

  return trivia_private.finalise_turn_challenge(v_match.id, p_now);
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.game_run_question_payload(p_run_id uuid, p_position integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_base_xp(p_difficulty text, p_is_correct boolean)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when not coalesce(p_is_correct, false) then 0
    when lower(btrim(coalesce(p_difficulty, ''))) = 'easy' then 10
    when lower(btrim(coalesce(p_difficulty, ''))) = 'medium' then 15
    when lower(btrim(coalesce(p_difficulty, ''))) = 'hard' then 25
    else 0
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_level_for_xp(p_total_xp bigint)
 RETURNS smallint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select max(threshold.level)
      from public.global_level_thresholds threshold
      where threshold.cumulative_xp <= greatest(coalesce(p_total_xp, 0), 0)
    ),
    1
  )::smallint;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_live_duel_max_possible_score(p_questions_answered integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select trivia_private.global_multiplayer_max_possible_score(
    p_questions_answered
  );
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_multiplayer_max_possible_score(p_questions_answered integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_result_multiplier(p_outcome text, p_result_reason text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'win'
      and lower(btrim(coalesce(p_result_reason, 'score'))) = 'forfeit'
      then 1.05::numeric
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'win'
      then 1.10::numeric
    when lower(btrim(coalesce(p_outcome, 'solo'))) = 'draw'
      then 1.05::numeric
    else 1.00::numeric
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_score_multiplier(p_score_efficiency numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.85 then 1.10::numeric
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.70 then 1.06::numeric
    when greatest(least(coalesce(p_score_efficiency, 0), 1), 0) >= 0.50 then 1.03::numeric
    else 1.00::numeric
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_solo_max_possible_score(p_questions_answered integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_speed_multiplier(p_response_ms integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when greatest(coalesce(p_response_ms, 600001), 0) <= 1500 then 1.25::numeric
    when greatest(coalesce(p_response_ms, 600001), 0) <= 3000 then 1.15::numeric
    when greatest(coalesce(p_response_ms, 600001), 0) <= 5000 then 1.05::numeric
    else 1.00::numeric
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_streak_multiplier(p_current_streak integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when greatest(coalesce(p_current_streak, 0), 0) >= 10 then 1.15::numeric
    when greatest(coalesce(p_current_streak, 0), 0) >= 5 then 1.10::numeric
    when greatest(coalesce(p_current_streak, 0), 0) >= 3 then 1.05::numeric
    else 1.00::numeric
  end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.global_turn_based_max_possible_score(p_questions_answered integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select trivia_private.global_multiplayer_max_possible_score(
    p_questions_answered
  );
$function$;

CREATE OR REPLACE FUNCTION trivia_private.handle_completed_duel_category_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'completed'
     and old.status is distinct from new.status then
    perform trivia_private.award_duel_category_progress(new.id);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.handle_completed_solo_category_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.leaderboard_rankings_v2(p_period text DEFAULT 'all'::text, p_category text DEFAULT 'overall'::text)
 RETURNS TABLE(player_id uuid, leaderboard_rank bigint, display_name text, account_number bigint, high_score bigint, accuracy_percent numeric, best_streak integer, games_played bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.new_room_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.notify_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_requester_name text;
begin
  if new.status <> 'pending'
     or (
       tg_op = 'UPDATE'
       and old.status = 'pending'
       and old.requester_id = new.requester_id
       and old.addressee_id = new.addressee_id
     ) then
    return new;
  end if;

  select display_name into v_requester_name
  from public.profiles
  where id = new.requester_id;

  perform trivia_private.enqueue_notification(
    new.addressee_id,
    'friend_request',
    new.requester_id,
    null,
    new.id,
    'New friend request',
    coalesce(v_requester_name, 'A Trivia Rush player') || ' sent you a friend request.',
    jsonb_build_object('view', 'friends'),
    'friend-request:' || new.id::text || ':' || extract(epoch from new.updated_at)::text,
    null
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.notify_live_duel_invite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_host_name text;
begin
  if new.match_format <> 'live' or new.invited_player_id is null then
    return new;
  end if;

  select display_name into v_host_name
  from public.profiles
  where id = new.host_id;

  perform trivia_private.enqueue_notification(
    new.invited_player_id,
    'live_duel_invite',
    new.host_id,
    new.id,
    null,
    'Live duel invitation',
    coalesce(v_host_name, 'A Trivia Rush player') || ' invited you to a live duel.',
    jsonb_build_object('duel', new.room_code),
    'live-duel-invite:' || new.id::text,
    new.waiting_expires_at
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.question_answers_are_valid(p_answers jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.queue_notification_deliveries()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_preferences public.notification_preferences%rowtype;
  v_event_enabled boolean;
begin
  select * into v_preferences
  from public.notification_preferences
  where player_id = new.recipient_id;

  if not found then
    return new;
  end if;

  v_event_enabled := case
    when new.notification_type = 'friend_request'
      then v_preferences.friend_request_notifications
    else v_preferences.challenge_notifications
  end;

  if not v_event_enabled then
    return new;
  end if;

  if v_preferences.push_enabled then
    insert into public.notification_deliveries (
      notification_id, channel, push_subscription_id
    )
    select new.id, 'push', ps.id
    from public.push_subscriptions ps
    where ps.player_id = new.recipient_id
      and ps.is_active
    on conflict do nothing;
  end if;

  if v_preferences.email_enabled then
    insert into public.notification_deliveries (
      notification_id, channel
    ) values (new.id, 'email')
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.record_category_answer_progress(p_player_id uuid, p_source_kind text, p_source_id uuid, p_answer_key text, p_category_id text, p_difficulty text, p_is_correct boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.record_global_xp_award(p_player_id uuid, p_game_session_id uuid, p_source_kind text, p_source_id uuid, p_base_xp integer, p_answer_xp integer, p_score integer, p_max_possible_score integer, p_outcome text DEFAULT NULL::text, p_result_reason text DEFAULT NULL::text, p_breakdown jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_existing public.global_xp_awards%rowtype;
  v_award public.global_xp_awards%rowtype;
  v_progress public.player_global_progress%rowtype;
  v_calculation jsonb;
  v_previous_xp bigint;
  v_previous_level smallint;
  v_new_xp bigint;
  v_new_level smallint;
begin
  if p_player_id is null or p_game_session_id is null then
    raise exception 'Player and game session are required';
  end if;

  if lower(btrim(coalesce(p_source_kind, ''))) not in (
    'solo',
    'live_duel',
    'turn_based',
    'legacy_backfill'
  ) then
    raise exception 'Global XP source kind is invalid';
  end if;

  if jsonb_typeof(coalesce(p_breakdown, '{}'::jsonb)) <> 'object' then
    raise exception 'Global XP breakdown must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.game_sessions session
    where session.id = p_game_session_id
      and session.player_id = p_player_id
  ) then
    raise exception 'Game session does not belong to the player';
  end if;

  select *
  into v_existing
  from public.global_xp_awards
  where game_session_id = p_game_session_id;

  if found then
    return jsonb_build_object(
      'idempotent_replay', true,
      'award_id', v_existing.id,
      'game_session_id', v_existing.game_session_id,
      'xp_awarded', v_existing.xp_awarded,
      'total_xp', (
        select progress.total_xp
        from public.player_global_progress progress
        where progress.player_id = p_player_id
      ),
      'level', (
        select progress.level
        from public.player_global_progress progress
        where progress.player_id = p_player_id
      )
    );
  end if;

  v_calculation := trivia_private.calculate_global_game_xp(
    p_base_xp,
    p_answer_xp,
    p_score,
    p_max_possible_score,
    p_outcome,
    p_result_reason
  );

  insert into public.player_global_progress (
    player_id,
    total_xp,
    level,
    credited_games,
    updated_at
  )
  values (
    p_player_id,
    0,
    1,
    0,
    now()
  )
  on conflict (player_id) do nothing;

  select *
  into v_progress
  from public.player_global_progress
  where player_id = p_player_id
  for update;

  v_previous_xp := v_progress.total_xp;
  v_previous_level := v_progress.level;

  insert into public.global_xp_awards (
    player_id,
    game_session_id,
    source_kind,
    source_id,
    base_xp,
    answer_xp,
    score,
    max_possible_score,
    score_efficiency,
    score_multiplier,
    result_multiplier,
    uncapped_xp,
    cap_xp,
    xp_awarded,
    calculation_version,
    breakdown
  )
  values (
    p_player_id,
    p_game_session_id,
    lower(btrim(p_source_kind)),
    p_source_id,
    (v_calculation ->> 'base_xp')::integer,
    (v_calculation ->> 'answer_xp')::integer,
    (v_calculation ->> 'score')::integer,
    (v_calculation ->> 'max_possible_score')::integer,
    (v_calculation ->> 'score_efficiency')::numeric,
    (v_calculation ->> 'score_multiplier')::numeric,
    (v_calculation ->> 'result_multiplier')::numeric,
    (v_calculation ->> 'uncapped_xp')::integer,
    (v_calculation ->> 'cap_xp')::integer,
    (v_calculation ->> 'xp_awarded')::integer,
    1,
    coalesce(p_breakdown, '{}'::jsonb)
  )
  on conflict (game_session_id) do nothing
  returning * into v_award;

  if v_award.id is null then
    select *
    into v_existing
    from public.global_xp_awards
    where game_session_id = p_game_session_id;

    return jsonb_build_object(
      'idempotent_replay', true,
      'award_id', v_existing.id,
      'game_session_id', v_existing.game_session_id,
      'xp_awarded', v_existing.xp_awarded,
      'total_xp', v_progress.total_xp,
      'level', v_progress.level
    );
  end if;

  v_new_xp := v_previous_xp + v_award.xp_awarded;
  v_new_level := trivia_private.global_level_for_xp(v_new_xp);

  update public.player_global_progress
  set
    total_xp = v_new_xp,
    level = v_new_level,
    credited_games = credited_games + 1,
    last_xp_at = case
      when v_award.xp_awarded > 0 then now()
      else last_xp_at
    end,
    updated_at = now()
  where player_id = p_player_id
  returning * into v_progress;

  return jsonb_build_object(
    'idempotent_replay', false,
    'award_id', v_award.id,
    'game_session_id', v_award.game_session_id,
    'xp_awarded', v_award.xp_awarded,
    'base_xp', v_award.base_xp,
    'answer_xp', v_award.answer_xp,
    'score_efficiency', v_award.score_efficiency,
    'score_multiplier', v_award.score_multiplier,
    'result_multiplier', v_award.result_multiplier,
    'cap_xp', v_award.cap_xp,
    'previous_total_xp', v_previous_xp,
    'total_xp', v_progress.total_xp,
    'previous_level', v_previous_level,
    'level', v_progress.level,
    'level_up', v_progress.level > v_previous_level
  );
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.require_permanent_player()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION trivia_private.run_global_xp_historical_backfill()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_run_id uuid;
  v_run trivia_private.global_xp_backfill_runs%rowtype;
  v_candidate record;
  v_result jsonb;
  v_is_replay boolean;
  v_solo_candidates integer := 0;
  v_solo_awarded integer := 0;
  v_solo_replayed integer := 0;
  v_live_candidates integer := 0;
  v_live_awarded integer := 0;
  v_live_replayed integer := 0;
  v_turn_candidates integer := 0;
  v_turn_awarded integer := 0;
  v_turn_replayed integer := 0;
  v_failures integer := 0;
begin
  insert into trivia_private.global_xp_backfill_runs default values
  returning id into v_run_id;

  for v_candidate in
    select
      run.id as source_id,
      run.player_id,
      run.completed_session_id as game_session_id
    from public.game_runs run
    where run.status = 'completed'
      and run.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = run.completed_session_id
      )
    order by run.updated_at, run.id
  loop
    v_solo_candidates := v_solo_candidates + 1;

    begin
      v_result := trivia_private.award_solo_global_xp(v_candidate.source_id);
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_solo_replayed := v_solo_replayed + 1;
      else
        v_solo_awarded := v_solo_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'solo',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  for v_candidate in
    select
      match.id as source_id,
      player.player_id,
      player.completed_session_id as game_session_id
    from public.duel_players player
    join public.duel_matches match
      on match.id = player.match_id
    where match.status = 'completed'
      and match.match_format = 'live'
      and player.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = player.completed_session_id
      )
    order by match.completed_at nulls last, match.id, player.player_role
  loop
    v_live_candidates := v_live_candidates + 1;

    begin
      v_result := trivia_private.award_live_duel_global_xp(
        v_candidate.source_id,
        v_candidate.player_id
      );
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_live_replayed := v_live_replayed + 1;
      else
        v_live_awarded := v_live_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'live_duel',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  for v_candidate in
    select
      match.id as source_id,
      player.player_id,
      player.completed_session_id as game_session_id
    from public.duel_players player
    join public.duel_matches match
      on match.id = player.match_id
    where match.status = 'completed'
      and match.match_format = 'turn_based'
      and player.completed_session_id is not null
      and not exists (
        select 1
        from public.global_xp_awards award
        where award.game_session_id = player.completed_session_id
      )
    order by match.completed_at nulls last, match.id, player.player_role
  loop
    v_turn_candidates := v_turn_candidates + 1;

    begin
      v_result := trivia_private.award_turn_based_global_xp(
        v_candidate.source_id,
        v_candidate.player_id
      );
      v_is_replay := coalesce(
        (v_result ->> 'idempotent_replay')::boolean,
        false
      );

      if v_is_replay then
        v_turn_replayed := v_turn_replayed + 1;
      else
        v_turn_awarded := v_turn_awarded + 1;

        update public.global_xp_awards
        set breakdown = breakdown || jsonb_build_object(
          'credit_path', 'historical_backfill',
          'backfill_run_id', v_run_id
        )
        where game_session_id = v_candidate.game_session_id;
      end if;

      update trivia_private.global_xp_backfill_failures
      set
        resolved_at = now(),
        resolution_run_id = v_run_id
      where game_session_id = v_candidate.game_session_id
        and resolved_at is null;
    exception
      when others then
        v_failures := v_failures + 1;

        insert into trivia_private.global_xp_backfill_failures (
          run_id,
          source_kind,
          source_id,
          player_id,
          game_session_id,
          error_code,
          error_message
        ) values (
          v_run_id,
          'turn_based',
          v_candidate.source_id,
          v_candidate.player_id,
          v_candidate.game_session_id,
          sqlstate,
          left(sqlerrm, 1000)
        );
    end;
  end loop;

  update trivia_private.global_xp_backfill_runs
  set
    status = case
      when v_failures = 0 then 'completed'
      else 'completed_with_failures'
    end,
    completed_at = now(),
    solo_candidates = v_solo_candidates,
    solo_awarded = v_solo_awarded,
    solo_replayed = v_solo_replayed,
    live_duel_candidates = v_live_candidates,
    live_duel_awarded = v_live_awarded,
    live_duel_replayed = v_live_replayed,
    turn_based_candidates = v_turn_candidates,
    turn_based_awarded = v_turn_awarded,
    turn_based_replayed = v_turn_replayed,
    failure_count = v_failures
  where id = v_run_id
  returning * into v_run;

  return to_jsonb(v_run);
end;
$function$;

CREATE OR REPLACE FUNCTION trivia_private.sync_duel_live_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.duel_matches dm
    where dm.id = new.match_id
      and dm.match_format = 'live'
  ) then
    delete from public.duel_live_progress
    where match_id = new.match_id and player_id = new.player_id;
    return new;
  end if;

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
$function$;


alter table public.category_level_thresholds add constraint category_level_thresholds_cumulative_xp_key UNIQUE (cumulative_xp);
alter table public.category_level_thresholds add constraint category_level_thresholds_level_valid CHECK (level >= 1 AND level <= 500);
alter table public.category_level_thresholds add constraint category_level_thresholds_pkey PRIMARY KEY (level);
alter table public.category_level_thresholds add constraint category_level_thresholds_xp_valid CHECK (cumulative_xp >= 0);
alter table public.category_xp_awards add constraint category_xp_awards_answer_key_valid CHECK (length(btrim(answer_key)) >= 1 AND length(btrim(answer_key)) <= 120);
alter table public.category_xp_awards add constraint category_xp_awards_difficulty_valid CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]));
alter table public.category_xp_awards add constraint category_xp_awards_level_valid CHECK (level_before >= 1 AND level_before <= 500 AND level_after >= level_before AND level_after <= 500);
alter table public.category_xp_awards add constraint category_xp_awards_pkey PRIMARY KEY (id);
alter table public.category_xp_awards add constraint category_xp_awards_source_kind_source_id_player_id_answer_k_key UNIQUE (source_kind, source_id, player_id, answer_key);
alter table public.category_xp_awards add constraint category_xp_awards_source_kind_valid CHECK (source_kind = ANY (ARRAY['solo'::text, 'live_duel'::text, 'turn_based'::text]));
alter table public.category_xp_awards add constraint category_xp_awards_xp_valid CHECK (xp_awarded = ANY (ARRAY[0, 10, 15, 25]));
alter table public.discord_links add constraint discord_links_pkey PRIMARY KEY (discord_user_id);
alter table public.duel_answers add constraint duel_answers_match_id_player_id_position_key UNIQUE (match_id, player_id, "position");
alter table public.duel_answers add constraint duel_answers_match_id_player_id_request_id_key UNIQUE (match_id, player_id, request_id);
alter table public.duel_answers add constraint duel_answers_pkey PRIMARY KEY (id);
alter table public.duel_answers add constraint duel_answers_points_valid CHECK (points_awarded >= 0 AND points_awarded <= 10000);
alter table public.duel_answers add constraint duel_answers_position_valid CHECK ("position" >= 1);
alter table public.duel_answers add constraint duel_answers_response_valid CHECK (response_ms >= 0 AND response_ms <= 600000);
alter table public.duel_answers add constraint duel_answers_selected_valid CHECK (selected_index IS NULL OR selected_index >= 0 AND selected_index <= 2);
alter table public.duel_live_progress add constraint duel_live_progress_answers_valid CHECK (questions_answered >= 0);
alter table public.duel_live_progress add constraint duel_live_progress_pkey PRIMARY KEY (match_id, player_id);
alter table public.duel_live_progress add constraint duel_live_progress_score_valid CHECK (score >= 0);
alter table public.duel_match_questions add constraint duel_match_questions_match_id_question_id_key UNIQUE (match_id, question_id);
alter table public.duel_match_questions add constraint duel_match_questions_pkey PRIMARY KEY (match_id, "position");
alter table public.duel_match_questions add constraint duel_match_questions_position_valid CHECK ("position" >= 1);
alter table public.duel_matches add constraint duel_matches_category_valid CHECK (category_id = 'mixed'::text OR category_id ~ '^[a-z][a-z0-9_]{1,39}$'::text);
alter table public.duel_matches add constraint duel_matches_closed_reason_valid CHECK (closed_reason IS NULL OR (closed_reason = ANY (ARRAY['host_cancelled'::text, 'declined'::text, 'expired'::text])));
alter table public.duel_matches add constraint duel_matches_code_valid CHECK (room_code ~ '^[A-Z0-9]{8}$'::text);
alter table public.duel_matches add constraint duel_matches_format_valid CHECK (match_format = ANY (ARRAY['live'::text, 'turn_based'::text]));
alter table public.duel_matches add constraint duel_matches_invite_distinct CHECK (invited_player_id IS NULL OR invited_player_id <> host_id);
alter table public.duel_matches add constraint duel_matches_pkey PRIMARY KEY (id);
alter table public.duel_matches add constraint duel_matches_players_distinct CHECK (guest_id IS NULL OR guest_id <> host_id);
alter table public.duel_matches add constraint duel_matches_result_valid CHECK (result_reason IS NULL OR (result_reason = ANY (ARRAY['score'::text, 'draw'::text, 'forfeit'::text])));
alter table public.duel_matches add constraint duel_matches_room_code_key UNIQUE (room_code);
alter table public.duel_matches add constraint duel_matches_status_valid CHECK (status = ANY (ARRAY['waiting'::text, 'countdown'::text, 'active'::text, 'host_turn'::text, 'awaiting_response'::text, 'guest_turn'::text, 'completed'::text, 'cancelled'::text]));
alter table public.duel_matches add constraint duel_matches_times_valid CHECK (starts_at IS NULL AND ends_at IS NULL OR starts_at IS NOT NULL AND ends_at > starts_at);
alter table public.duel_matches add constraint duel_matches_turn_deadline_valid CHECK (response_expires_at IS NULL OR match_format = 'turn_based'::text AND response_expires_at > created_at);
alter table public.duel_players add constraint duel_players_answers_valid CHECK (questions_answered >= 0 AND correct_answers >= 0 AND incorrect_answers >= 0 AND (correct_answers + incorrect_answers) = questions_answered);
alter table public.duel_players add constraint duel_players_match_id_player_role_key UNIQUE (match_id, player_role);
alter table public.duel_players add constraint duel_players_outcome_valid CHECK (outcome IS NULL OR (outcome = ANY (ARRAY['win'::text, 'loss'::text, 'draw'::text, 'forfeit'::text])));
alter table public.duel_players add constraint duel_players_pkey PRIMARY KEY (match_id, player_id);
alter table public.duel_players add constraint duel_players_position_valid CHECK (current_position >= 1);
alter table public.duel_players add constraint duel_players_response_valid CHECK (total_response_ms >= 0);
alter table public.duel_players add constraint duel_players_role_valid CHECK (player_role = ANY (ARRAY['host'::text, 'guest'::text]));
alter table public.duel_players add constraint duel_players_round_status_valid CHECK (round_status = ANY (ARRAY['pending'::text, 'countdown'::text, 'active'::text, 'completed'::text]));
alter table public.duel_players add constraint duel_players_round_times_valid CHECK (round_starts_at IS NULL AND round_ends_at IS NULL OR round_starts_at IS NOT NULL AND round_ends_at IS NOT NULL AND round_ends_at > round_starts_at);
alter table public.duel_players add constraint duel_players_score_valid CHECK (score >= 0);
alter table public.duel_players add constraint duel_players_streak_valid CHECK (streak >= 0 AND best_streak >= streak);
alter table public.friendships add constraint friendships_not_self CHECK (requester_id <> addressee_id);
alter table public.friendships add constraint friendships_pkey PRIMARY KEY (id);
alter table public.friendships add constraint friendships_status_valid CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));
alter table public.game_modes add constraint game_modes_duration_valid CHECK (duration_seconds IS NULL OR duration_seconds >= 10 AND duration_seconds <= 600);
alter table public.game_modes add constraint game_modes_family_valid CHECK (mode_family = ANY (ARRAY['solo'::text, 'duel'::text]));
alter table public.game_modes add constraint game_modes_max_points_valid CHECK (max_points_per_question >= 1 AND max_points_per_question <= 10000);
alter table public.game_modes add constraint game_modes_max_questions_valid CHECK (max_questions >= 1 AND max_questions <= 200);
alter table public.game_modes add constraint game_modes_mode_length CHECK (char_length(btrim(mode)) >= 1 AND char_length(btrim(mode)) <= 40);
alter table public.game_modes add constraint game_modes_pkey PRIMARY KEY (mode);
alter table public.game_run_answers add constraint game_run_answers_pkey PRIMARY KEY (id);
alter table public.game_run_answers add constraint game_run_answers_points_valid CHECK (points_awarded >= 0 AND points_awarded <= 10000);
alter table public.game_run_answers add constraint game_run_answers_position_valid CHECK ("position" >= 1);
alter table public.game_run_answers add constraint game_run_answers_response_valid CHECK (response_ms >= 0 AND response_ms <= 600000);
alter table public.game_run_answers add constraint game_run_answers_run_id_position_key UNIQUE (run_id, "position");
alter table public.game_run_answers add constraint game_run_answers_run_id_request_id_key UNIQUE (run_id, request_id);
alter table public.game_run_answers add constraint game_run_answers_selected_index_valid CHECK (selected_index IS NULL OR selected_index >= 0 AND selected_index <= 2);
alter table public.game_run_questions add constraint game_run_questions_pkey PRIMARY KEY (run_id, "position");
alter table public.game_run_questions add constraint game_run_questions_position_valid CHECK ("position" >= 1);
alter table public.game_run_questions add constraint game_run_questions_run_id_question_id_key UNIQUE (run_id, question_id);
alter table public.game_runs add constraint game_runs_answer_counts_valid CHECK (questions_answered >= 0 AND correct_answers >= 0 AND incorrect_answers >= 0 AND (correct_answers + incorrect_answers) = questions_answered);
alter table public.game_runs add constraint game_runs_category_valid CHECK (category_id = 'mixed'::text OR category_id ~ '^[a-z][a-z0-9_]{1,39}$'::text);
alter table public.game_runs add constraint game_runs_pkey PRIMARY KEY (id);
alter table public.game_runs add constraint game_runs_position_valid CHECK (current_position >= 1);
alter table public.game_runs add constraint game_runs_response_time_valid CHECK (total_response_ms >= 0);
alter table public.game_runs add constraint game_runs_score_valid CHECK (score >= 0);
alter table public.game_runs add constraint game_runs_status_valid CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text, 'cancelled'::text]));
alter table public.game_runs add constraint game_runs_streak_valid CHECK (streak >= 0 AND best_streak >= streak);
alter table public.game_runs add constraint game_runs_time_valid CHECK (ends_at > started_at);
alter table public.game_sessions add constraint game_answer_totals_match CHECK ((correct_answers + incorrect_answers) = questions_answered);
alter table public.game_sessions add constraint game_category_length CHECK (char_length(category) >= 1 AND char_length(category) <= 60);
alter table public.game_sessions add constraint game_correct_range CHECK (correct_answers >= 0 AND correct_answers <= questions_answered);
alter table public.game_sessions add constraint game_duration_valid CHECK (duration_seconds >= 10 AND duration_seconds <= 600);
alter table public.game_sessions add constraint game_incorrect_range CHECK (incorrect_answers >= 0 AND incorrect_answers <= questions_answered);
alter table public.game_sessions add constraint game_mode_length CHECK (char_length(game_mode) >= 1 AND char_length(game_mode) <= 40);
alter table public.game_sessions add constraint game_questions_range CHECK (questions_answered >= 0 AND questions_answered <= 200 AND (questions_answered >= 1 OR game_mode ~~ like_escape('duel\_%'::text, '\'::text)));
alter table public.game_sessions add constraint game_response_time_valid CHECK (average_response_ms IS NULL OR average_response_ms >= 50 AND average_response_ms <= 600000);
alter table public.game_sessions add constraint game_score_valid CHECK (score >= 0 AND score <= 1000000);
alter table public.game_sessions add constraint game_sessions_pkey PRIMARY KEY (id);
alter table public.game_sessions add constraint game_streak_valid CHECK (best_streak >= 0 AND best_streak <= correct_answers);
alter table public.global_level_thresholds add constraint global_level_thresholds_cumulative_xp_key UNIQUE (cumulative_xp);
alter table public.global_level_thresholds add constraint global_level_thresholds_level_valid CHECK (level >= 1 AND level <= 500);
alter table public.global_level_thresholds add constraint global_level_thresholds_pkey PRIMARY KEY (level);
alter table public.global_level_thresholds add constraint global_level_thresholds_xp_valid CHECK (cumulative_xp >= 0);
alter table public.global_xp_awards add constraint global_xp_awards_answer_valid CHECK (answer_xp >= 0 AND answer_xp >= base_xp);
alter table public.global_xp_awards add constraint global_xp_awards_base_valid CHECK (base_xp >= 0);
alter table public.global_xp_awards add constraint global_xp_awards_breakdown_object CHECK (jsonb_typeof(breakdown) = 'object'::text);
alter table public.global_xp_awards add constraint global_xp_awards_efficiency_valid CHECK (score_efficiency >= 0::numeric AND score_efficiency <= 1::numeric);
alter table public.global_xp_awards add constraint global_xp_awards_game_session_id_key UNIQUE (game_session_id);
alter table public.global_xp_awards add constraint global_xp_awards_multipliers_valid CHECK (score_multiplier >= 1::numeric AND score_multiplier <= 1.50 AND result_multiplier >= 1::numeric AND result_multiplier <= 1.50);
alter table public.global_xp_awards add constraint global_xp_awards_pkey PRIMARY KEY (id);
alter table public.global_xp_awards add constraint global_xp_awards_score_valid CHECK (score >= 0 AND max_possible_score >= 0 AND (max_possible_score > 0 OR score = 0) AND (max_possible_score = 0 OR score <= max_possible_score));
alter table public.global_xp_awards add constraint global_xp_awards_source_valid CHECK (source_kind = ANY (ARRAY['solo'::text, 'live_duel'::text, 'turn_based'::text, 'legacy_backfill'::text]));
alter table public.global_xp_awards add constraint global_xp_awards_totals_valid CHECK (uncapped_xp >= 0 AND cap_xp >= 0 AND xp_awarded >= 0 AND xp_awarded <= uncapped_xp AND xp_awarded <= cap_xp);
alter table public.global_xp_awards add constraint global_xp_awards_version_valid CHECK (calculation_version >= 1 AND calculation_version <= 32767);
alter table public.notification_deliveries add constraint notification_deliveries_pkey PRIMARY KEY (id);
alter table public.notification_deliveries add constraint notification_delivery_attempts_valid CHECK (attempt_count >= 0 AND attempt_count <= 10);
alter table public.notification_deliveries add constraint notification_delivery_channel_valid CHECK (channel = ANY (ARRAY['push'::text, 'email'::text]));
alter table public.notification_deliveries add constraint notification_delivery_error_length CHECK (last_error IS NULL OR char_length(last_error) <= 1000);
alter table public.notification_deliveries add constraint notification_delivery_status_valid CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'dead'::text]));
alter table public.notification_deliveries add constraint notification_delivery_target_valid CHECK (channel = 'push'::text AND push_subscription_id IS NOT NULL OR channel = 'email'::text AND push_subscription_id IS NULL);
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (player_id);
alter table public.notifications add constraint notifications_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 240);
alter table public.notifications add constraint notifications_data_object CHECK (jsonb_typeof(data) = 'object'::text);
alter table public.notifications add constraint notifications_dedupe_key_key UNIQUE (dedupe_key);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 100);
alter table public.notifications add constraint notifications_type_valid CHECK (notification_type = ANY (ARRAY['friend_request'::text, 'live_duel_invite'::text, 'turn_challenge_ready'::text, 'turn_challenge_reminder'::text, 'turn_challenge_result'::text, 'turn_challenge_expired'::text]));
alter table public.player_category_progress add constraint player_category_progress_level_valid CHECK (level >= 1 AND level <= 500);
alter table public.player_category_progress add constraint player_category_progress_pkey PRIMARY KEY (player_id, category_id);
alter table public.player_category_progress add constraint player_category_progress_totals_valid CHECK (questions_answered >= 0 AND correct_answers >= 0 AND incorrect_answers >= 0 AND questions_answered = (correct_answers + incorrect_answers) AND solo_questions >= 0 AND duel_questions >= 0 AND questions_answered = (solo_questions + duel_questions));
alter table public.player_category_progress add constraint player_category_progress_xp_valid CHECK (xp >= 0);
alter table public.player_global_progress add constraint player_global_progress_games_valid CHECK (credited_games >= 0);
alter table public.player_global_progress add constraint player_global_progress_level_valid CHECK (level >= 1 AND level <= 500);
alter table public.player_global_progress add constraint player_global_progress_pkey PRIMARY KEY (player_id);
alter table public.player_global_progress add constraint player_global_progress_xp_valid CHECK (total_xp >= 0);
alter table public.player_stats add constraint player_stats_best_streak_check CHECK (best_streak >= 0);
alter table public.player_stats add constraint player_stats_games_played_check CHECK (games_played >= 0);
alter table public.player_stats add constraint player_stats_high_score_check CHECK (high_score >= 0);
alter table public.player_stats add constraint player_stats_pkey PRIMARY KEY (player_id);
alter table public.player_stats add constraint player_stats_total_correct_check CHECK (total_correct >= 0);
alter table public.player_stats add constraint player_stats_total_incorrect_check CHECK (total_incorrect >= 0);
alter table public.player_stats add constraint player_stats_total_questions_check CHECK (total_questions >= 0);
alter table public.player_stats add constraint player_stats_total_response_ms_check CHECK (total_response_ms >= 0);
alter table public.player_stats add constraint player_stats_total_score_check CHECK (total_score >= 0);
alter table public.profiles add constraint profiles_display_name_length CHECK (char_length(btrim(display_name)) >= 3 AND char_length(btrim(display_name)) <= 24);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_auth_length CHECK (char_length(auth_secret) >= 8 AND char_length(auth_secret) <= 256);
alter table public.push_subscriptions add constraint push_endpoint_length CHECK (char_length(endpoint) >= 20 AND char_length(endpoint) <= 2048);
alter table public.push_subscriptions add constraint push_p256dh_length CHECK (char_length(p256dh) >= 20 AND char_length(p256dh) <= 512);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_user_agent_length CHECK (user_agent IS NULL OR char_length(user_agent) <= 512);
alter table public.question_categories add constraint question_categories_color_valid CHECK (color ~ '^#[0-9A-F]{6}$'::text);
alter table public.question_categories add constraint question_categories_icon_key_valid CHECK (icon_key = lower(btrim(icon_key)) AND icon_key ~ '^[a-z][a-z0-9_]{1,39}$'::text);
alter table public.question_categories add constraint question_categories_id_valid CHECK (id = lower(btrim(id)) AND id ~ '^[a-z][a-z0-9_]{1,39}$'::text);
alter table public.question_categories add constraint question_categories_label_valid CHECK (char_length(btrim(label)) >= 2 AND char_length(btrim(label)) <= 40);
alter table public.question_categories add constraint question_categories_pkey PRIMARY KEY (id);
alter table public.question_categories add constraint question_categories_sort_order_key UNIQUE (sort_order);
alter table public.question_categories add constraint question_categories_sort_order_valid CHECK (sort_order >= 1 AND sort_order <= 1000);
alter table public.trivia_questions add constraint trivia_questions_answers_array CHECK (jsonb_typeof(answers) = 'array'::text AND jsonb_array_length(answers) = 3);
alter table public.trivia_questions add constraint trivia_questions_answers_valid CHECK (trivia_private.question_answers_are_valid(answers));
alter table public.trivia_questions add constraint trivia_questions_correct_index_valid CHECK (correct_index >= 0 AND correct_index <= 2);
alter table public.trivia_questions add constraint trivia_questions_difficulty_valid CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]));
alter table public.trivia_questions add constraint trivia_questions_key_valid CHECK (question_key = lower(btrim(question_key)) AND question_key ~ '^[a-z][a-z0-9_-]{2,79}$'::text);
alter table public.trivia_questions add constraint trivia_questions_pkey PRIMARY KEY (id);
alter table public.trivia_questions add constraint trivia_questions_question_key_key UNIQUE (question_key);
alter table public.trivia_questions add constraint trivia_questions_source_name_valid CHECK (char_length(btrim(source_name)) >= 2 AND char_length(btrim(source_name)) <= 120);
alter table public.trivia_questions add constraint trivia_questions_source_url_valid CHECK (source_url ~ '^https://'::text AND char_length(source_url) <= 500);
alter table public.trivia_questions add constraint trivia_questions_text_valid CHECK (char_length(btrim(question_text)) >= 10 AND char_length(btrim(question_text)) <= 240);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_error_valid CHECK (char_length(error_code) >= 1 AND char_length(error_code) <= 20 AND char_length(error_message) >= 1 AND char_length(error_message) <= 1000);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_pkey PRIMARY KEY (id);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_resolution_valid CHECK (resolved_at IS NULL AND resolution_run_id IS NULL OR resolved_at IS NOT NULL AND resolution_run_id IS NOT NULL);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_run_id_game_session_id_key UNIQUE (run_id, game_session_id);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_source_valid CHECK (source_kind = ANY (ARRAY['solo'::text, 'live_duel'::text, 'turn_based'::text]));
alter table trivia_private.global_xp_backfill_runs add constraint global_xp_backfill_runs_counts_valid CHECK (solo_candidates >= 0 AND solo_awarded >= 0 AND solo_replayed >= 0 AND live_duel_candidates >= 0 AND live_duel_awarded >= 0 AND live_duel_replayed >= 0 AND turn_based_candidates >= 0 AND turn_based_awarded >= 0 AND turn_based_replayed >= 0 AND failure_count >= 0);
alter table trivia_private.global_xp_backfill_runs add constraint global_xp_backfill_runs_pkey PRIMARY KEY (id);
alter table trivia_private.global_xp_backfill_runs add constraint global_xp_backfill_runs_status_valid CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'completed_with_failures'::text]));
alter table public.category_xp_awards add constraint category_xp_awards_category_id_fkey FOREIGN KEY (category_id) REFERENCES question_categories(id);
alter table public.category_xp_awards add constraint category_xp_awards_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.discord_links add constraint discord_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.duel_answers add constraint duel_answers_match_id_player_id_fkey FOREIGN KEY (match_id, player_id) REFERENCES duel_players(match_id, player_id) ON DELETE CASCADE;
alter table public.duel_answers add constraint duel_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES trivia_questions(id);
alter table public.duel_live_progress add constraint duel_live_progress_match_id_player_id_fkey FOREIGN KEY (match_id, player_id) REFERENCES duel_players(match_id, player_id) ON DELETE CASCADE;
alter table public.duel_match_questions add constraint duel_match_questions_match_id_fkey FOREIGN KEY (match_id) REFERENCES duel_matches(id) ON DELETE CASCADE;
alter table public.duel_match_questions add constraint duel_match_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES trivia_questions(id);
alter table public.duel_matches add constraint duel_matches_game_mode_fkey FOREIGN KEY (game_mode) REFERENCES game_modes(mode);
alter table public.duel_matches add constraint duel_matches_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.duel_matches add constraint duel_matches_host_id_fkey FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.duel_matches add constraint duel_matches_invited_player_id_fkey FOREIGN KEY (invited_player_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.duel_matches add constraint duel_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.duel_players add constraint duel_players_completed_session_id_fkey FOREIGN KEY (completed_session_id) REFERENCES game_sessions(id) ON DELETE SET NULL;
alter table public.duel_players add constraint duel_players_match_id_fkey FOREIGN KEY (match_id) REFERENCES duel_matches(id) ON DELETE CASCADE;
alter table public.duel_players add constraint duel_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.friendships add constraint friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.friendships add constraint friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.game_run_answers add constraint game_run_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES trivia_questions(id);
alter table public.game_run_answers add constraint game_run_answers_run_id_fkey FOREIGN KEY (run_id) REFERENCES game_runs(id) ON DELETE CASCADE;
alter table public.game_run_questions add constraint game_run_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES trivia_questions(id);
alter table public.game_run_questions add constraint game_run_questions_run_id_fkey FOREIGN KEY (run_id) REFERENCES game_runs(id) ON DELETE CASCADE;
alter table public.game_runs add constraint game_runs_completed_session_id_fkey FOREIGN KEY (completed_session_id) REFERENCES game_sessions(id) ON DELETE SET NULL;
alter table public.game_runs add constraint game_runs_game_mode_fkey FOREIGN KEY (game_mode) REFERENCES game_modes(mode);
alter table public.game_runs add constraint game_runs_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.game_sessions add constraint game_sessions_duel_match_fkey FOREIGN KEY (duel_match_id) REFERENCES duel_matches(id) ON DELETE RESTRICT;
alter table public.game_sessions add constraint game_sessions_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.global_xp_awards add constraint global_xp_awards_game_session_id_fkey FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE RESTRICT;
alter table public.global_xp_awards add constraint global_xp_awards_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notification_deliveries add constraint notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
alter table public.notification_deliveries add constraint notification_deliveries_push_subscription_id_fkey FOREIGN KEY (push_subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_duel_match_id_fkey FOREIGN KEY (duel_match_id) REFERENCES duel_matches(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_friendship_id_fkey FOREIGN KEY (friendship_id) REFERENCES friendships(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.player_category_progress add constraint player_category_progress_category_id_fkey FOREIGN KEY (category_id) REFERENCES question_categories(id);
alter table public.player_category_progress add constraint player_category_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.player_global_progress add constraint player_global_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.player_stats add constraint player_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_player_id_fkey FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.trivia_questions add constraint trivia_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES question_categories(id);
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_resolution_run_id_fkey FOREIGN KEY (resolution_run_id) REFERENCES trivia_private.global_xp_backfill_runs(id) ON DELETE SET NULL;
alter table trivia_private.global_xp_backfill_failures add constraint global_xp_backfill_failures_run_id_fkey FOREIGN KEY (run_id) REFERENCES trivia_private.global_xp_backfill_runs(id) ON DELETE CASCADE;

CREATE INDEX category_xp_awards_player_category_idx ON public.category_xp_awards USING btree (player_id, category_id, awarded_at DESC);
CREATE INDEX category_xp_awards_player_source_idx ON public.category_xp_awards USING btree (player_id, source_kind, source_id);
CREATE UNIQUE INDEX discord_links_user_id_unique ON public.discord_links USING btree (user_id);
CREATE INDEX duel_matches_due_idx ON public.duel_matches USING btree (ends_at) WHERE (status = ANY (ARRAY['countdown'::text, 'active'::text]));
CREATE INDEX duel_matches_guest_created_idx ON public.duel_matches USING btree (guest_id, created_at DESC) WHERE (guest_id IS NOT NULL);
CREATE INDEX duel_matches_host_created_idx ON public.duel_matches USING btree (host_id, created_at DESC);
CREATE INDEX duel_matches_invited_waiting_idx ON public.duel_matches USING btree (invited_player_id, created_at DESC) WHERE ((status = 'waiting'::text) AND (invited_player_id IS NOT NULL));
CREATE INDEX duel_matches_turn_host_open_idx ON public.duel_matches USING btree (host_id, created_at DESC) WHERE ((match_format = 'turn_based'::text) AND (status = ANY (ARRAY['host_turn'::text, 'awaiting_response'::text, 'guest_turn'::text])));
CREATE INDEX duel_matches_turn_incoming_idx ON public.duel_matches USING btree (guest_id, response_expires_at) WHERE ((match_format = 'turn_based'::text) AND (status = 'awaiting_response'::text));
CREATE UNIQUE INDEX duel_matches_turn_open_pair_unique ON public.duel_matches USING btree (LEAST((host_id)::text, (guest_id)::text), GREATEST((host_id)::text, (guest_id)::text)) WHERE ((match_format = 'turn_based'::text) AND (status = ANY (ARRAY['host_turn'::text, 'awaiting_response'::text, 'guest_turn'::text])));
CREATE INDEX duel_players_player_updated_idx ON public.duel_players USING btree (player_id, updated_at DESC);
CREATE INDEX duel_players_turn_due_idx ON public.duel_players USING btree (round_ends_at) WHERE ((round_status = ANY (ARRAY['countdown'::text, 'active'::text])) AND (round_ends_at IS NOT NULL));
CREATE INDEX friendships_addressee_idx ON public.friendships USING btree (addressee_id, status, updated_at DESC);
CREATE UNIQUE INDEX friendships_pair_unique ON public.friendships USING btree (LEAST((requester_id)::text, (addressee_id)::text), GREATEST((requester_id)::text, (addressee_id)::text));
CREATE INDEX friendships_requester_idx ON public.friendships USING btree (requester_id, status, updated_at DESC);
CREATE INDEX game_runs_expiry_idx ON public.game_runs USING btree (ends_at) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX game_runs_one_active_solo_per_player_idx ON public.game_runs USING btree (player_id) WHERE (status = 'active'::text);
CREATE INDEX game_runs_player_created_idx ON public.game_runs USING btree (player_id, created_at DESC);
CREATE UNIQUE INDEX game_sessions_duel_player_unique ON public.game_sessions USING btree (duel_match_id, player_id) WHERE (duel_match_id IS NOT NULL);
CREATE INDEX game_sessions_leaderboard_category_period_idx ON public.game_sessions USING btree (lower(btrim(category)), played_at DESC);
CREATE INDEX game_sessions_leaderboard_period_idx ON public.game_sessions USING btree (played_at DESC);
CREATE INDEX game_sessions_leaderboard_player_period_idx ON public.game_sessions USING btree (player_id, played_at DESC);
CREATE INDEX global_xp_awards_player_created_idx ON public.global_xp_awards USING btree (player_id, created_at DESC);
CREATE INDEX notification_deliveries_due_idx ON public.notification_deliveries USING btree (next_attempt_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text, 'processing'::text]));
CREATE UNIQUE INDEX notification_email_delivery_unique ON public.notification_deliveries USING btree (notification_id) WHERE (channel = 'email'::text);
CREATE UNIQUE INDEX notification_push_delivery_unique ON public.notification_deliveries USING btree (notification_id, push_subscription_id) WHERE (channel = 'push'::text);
CREATE INDEX notifications_recipient_created_idx ON public.notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipient_id, created_at DESC) WHERE (read_at IS NULL);
CREATE INDEX player_category_progress_category_rank_idx ON public.player_category_progress USING btree (category_id, level DESC, xp DESC);
CREATE INDEX player_category_progress_player_rank_idx ON public.player_category_progress USING btree (player_id, level DESC, xp DESC);
CREATE INDEX player_global_progress_level_xp_idx ON public.player_global_progress USING btree (level DESC, total_xp DESC);
CREATE UNIQUE INDEX profiles_account_number_unique ON public.profiles USING btree (account_number);
CREATE UNIQUE INDEX profiles_display_name_unique ON public.profiles USING btree (lower(btrim(display_name)));
CREATE INDEX push_subscriptions_player_active_idx ON public.push_subscriptions USING btree (player_id, updated_at DESC) WHERE is_active;
CREATE INDEX trivia_questions_active_category_difficulty_idx ON public.trivia_questions USING btree (category_id, difficulty, id) WHERE is_active;
CREATE UNIQUE INDEX trivia_questions_normalised_text_unique ON public.trivia_questions USING btree (lower(regexp_replace(btrim(question_text), '\s+'::text, ' '::text, 'g'::text)));
CREATE INDEX global_xp_backfill_failures_unresolved_idx ON trivia_private.global_xp_backfill_failures USING btree (source_kind, game_session_id, created_at) WHERE (resolved_at IS NULL);
CREATE UNIQUE INDEX global_xp_backfill_one_running_idx ON trivia_private.global_xp_backfill_runs USING btree ((1)) WHERE (status = 'running'::text);

create or replace view public.leaderboard as
 SELECT p.display_name,
    s.games_played,
    s.total_questions,
    s.total_correct,
    s.total_incorrect,
    s.total_score,
    s.high_score,
    s.best_streak,
        CASE
            WHEN s.total_questions = 0 THEN 0::numeric
            ELSE round(100.0 * s.total_correct::numeric / s.total_questions::numeric, 1)
        END AS accuracy_percent,
        CASE
            WHEN s.total_questions = 0 THEN NULL::numeric
            ELSE round(s.total_response_ms::numeric / s.total_questions::numeric)
        END AS average_response_ms,
    dense_rank() OVER (ORDER BY s.total_score DESC, s.total_correct DESC) AS leaderboard_rank,
    p.account_number
   FROM profiles p
     JOIN player_stats s ON s.player_id = p.id
  WHERE s.games_played > 0;;

CREATE TRIGGER award_live_duel_global_xp_after_completion_trigger AFTER UPDATE OF status ON duel_matches FOR EACH ROW WHEN (new.match_format = 'live'::text AND new.status = 'completed'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trivia_private.award_live_duel_global_xp_after_completion();
CREATE TRIGGER award_turn_based_global_xp_after_completion_trigger AFTER UPDATE OF status ON duel_matches FOR EACH ROW WHEN (new.match_format = 'turn_based'::text AND new.status = 'completed'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trivia_private.award_turn_based_global_xp_after_completion();
CREATE TRIGGER duel_matches_category_progression_after_completion AFTER UPDATE OF status ON duel_matches FOR EACH ROW EXECUTE FUNCTION trivia_private.handle_completed_duel_category_progress();
CREATE TRIGGER notify_live_duel_invite_trigger AFTER INSERT ON duel_matches FOR EACH ROW EXECUTE FUNCTION trivia_private.notify_live_duel_invite();
CREATE TRIGGER sync_duel_live_progress_trigger AFTER INSERT OR UPDATE OF score, questions_answered ON duel_players FOR EACH ROW EXECUTE FUNCTION trivia_private.sync_duel_live_progress();
CREATE TRIGGER notify_friend_request_trigger AFTER INSERT OR UPDATE OF status, requester_id, addressee_id ON friendships FOR EACH ROW EXECUTE FUNCTION trivia_private.notify_friend_request();
CREATE TRIGGER award_solo_global_xp_after_completion_trigger AFTER UPDATE OF completed_session_id ON game_runs FOR EACH ROW EXECUTE FUNCTION trivia_private.award_solo_global_xp_after_completion();
CREATE TRIGGER game_runs_category_progression_after_completion AFTER UPDATE OF completed_session_id, status ON game_runs FOR EACH ROW EXECUTE FUNCTION trivia_private.handle_completed_solo_category_progress();
CREATE TRIGGER update_player_stats_trigger AFTER INSERT ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_player_stats_after_game();
CREATE TRIGGER queue_notification_deliveries_trigger AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION trivia_private.queue_notification_deliveries();
CREATE TRIGGER create_player_stats_trigger AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION create_player_stats();
CREATE TRIGGER normalise_profile_trigger BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION normalise_profile();

alter table public.category_level_thresholds enable row level security;
alter table public.category_xp_awards enable row level security;
alter table public.discord_links enable row level security;
alter table public.duel_answers enable row level security;
alter table public.duel_live_progress enable row level security;
alter table public.duel_match_questions enable row level security;
alter table public.duel_matches enable row level security;
alter table public.duel_players enable row level security;
alter table public.friendships enable row level security;
alter table public.game_modes enable row level security;
alter table public.game_run_answers enable row level security;
alter table public.game_run_questions enable row level security;
alter table public.game_runs enable row level security;
alter table public.game_sessions enable row level security;
alter table public.global_level_thresholds enable row level security;
alter table public.global_xp_awards enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.player_category_progress enable row level security;
alter table public.player_global_progress enable row level security;
alter table public.player_stats enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.question_categories enable row level security;
alter table public.trivia_questions enable row level security;
alter table trivia_private.global_xp_backfill_failures enable row level security;
alter table trivia_private.global_xp_backfill_runs enable row level security;

create policy "Live participants see safe duel progress" on public.duel_live_progress as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM duel_matches dm
  WHERE ((dm.id = duel_live_progress.match_id) AND (dm.match_format = 'live'::text) AND ((auth.uid() = dm.host_id) OR (auth.uid() = dm.guest_id))))));
create policy "Participants see their duel matches" on public.duel_matches as PERMISSIVE for SELECT to authenticated using (((auth.uid() = host_id) OR (auth.uid() = guest_id) OR (auth.uid() = invited_player_id)));
create policy "Players see their friendships" on public.friendships as PERMISSIVE for SELECT to authenticated using (((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));
create policy "Players read their own game history" on public.game_sessions as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = player_id));
create policy "Players see their notifications" on public.notifications as PERMISSIVE for SELECT to authenticated using ((auth.uid() = recipient_id));
create policy "Public leaderboard stats are readable" on public.player_stats as PERMISSIVE for SELECT to anon, authenticated using (true);
create policy "Players create their own profile" on public.profiles as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = id));
create policy "Players update their own profile" on public.profiles as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "Public profiles are readable" on public.profiles as PERMISSIVE for SELECT to anon, authenticated using (true);

revoke all on table public.category_level_thresholds from public, anon, authenticated;
revoke all on table public.category_xp_awards from public, anon, authenticated;
revoke all on table public.discord_links from public, anon, authenticated;
revoke all on table public.duel_answers from public, anon, authenticated;
revoke all on table public.duel_live_progress from public, anon, authenticated;
revoke all on table public.duel_match_questions from public, anon, authenticated;
revoke all on table public.duel_matches from public, anon, authenticated;
revoke all on table public.duel_players from public, anon, authenticated;
revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.game_modes from public, anon, authenticated;
revoke all on table public.game_run_answers from public, anon, authenticated;
revoke all on table public.game_run_questions from public, anon, authenticated;
revoke all on table public.game_runs from public, anon, authenticated;
revoke all on table public.game_sessions from public, anon, authenticated;
revoke all on table public.global_level_thresholds from public, anon, authenticated;
revoke all on table public.global_xp_awards from public, anon, authenticated;
revoke all on table public.leaderboard from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;
revoke all on table public.notification_preferences from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.player_category_progress from public, anon, authenticated;
revoke all on table public.player_global_progress from public, anon, authenticated;
revoke all on table public.player_stats from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.question_categories from public, anon, authenticated;
revoke all on table public.trivia_questions from public, anon, authenticated;
revoke all on table trivia_private.global_xp_backfill_failures from public, anon, authenticated;
revoke all on table trivia_private.global_xp_backfill_runs from public, anon, authenticated;
grant references, trigger, truncate on table public.discord_links to anon;
grant references, trigger, truncate on table public.discord_links to authenticated;
grant select on table public.duel_live_progress to authenticated;
grant select on table public.duel_matches to authenticated;
grant select on table public.friendships to authenticated;
grant select on table public.game_sessions to authenticated;
grant select on table public.leaderboard to anon;
grant select on table public.leaderboard to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.player_stats to anon;
grant select on table public.player_stats to authenticated;
grant select on table public.profiles to anon;
grant select on table public.profiles to authenticated;

revoke all on sequence public.profile_account_number_seq from public, anon, authenticated;
grant usage, select on sequence public.profile_account_number_seq to authenticated;

revoke all on function public.cancel_duel(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.cancel_turn_challenge(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries(p_limit integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(p_delivery_id uuid, p_success boolean, p_error text, p_permanent_failure boolean, p_deactivate_subscription boolean) from public, anon, authenticated;
revoke all on function public.create_duel(p_category text, p_duration_seconds integer, p_invited_account_number bigint) from public, anon, authenticated;
revoke all on function public.create_player_stats() from public, anon, authenticated;
revoke all on function public.create_turn_challenge(p_category text, p_duration_seconds integer, p_invited_account_number bigint) from public, anon, authenticated;
revoke all on function public.decline_turn_challenge(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.finish_solo_game(p_run_id uuid) from public, anon, authenticated;
revoke all on function public.get_current_solo_question(p_run_id uuid) from public, anon, authenticated;
revoke all on function public.get_duel_category_xp_summary(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.get_duel_invitations() from public, anon, authenticated;
revoke all on function public.get_duel_leaderboard(p_limit integer) from public, anon, authenticated;
revoke all on function public.get_duel_leaderboard_v2(p_match_format text, p_limit integer) from public, anon, authenticated;
revoke all on function public.get_duel_match_history(p_opponent_account_number bigint, p_limit integer) from public, anon, authenticated;
revoke all on function public.get_duel_match_history_v2(p_opponent_account_number bigint, p_match_format text, p_limit integer) from public, anon, authenticated;
revoke all on function public.get_duel_state(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.get_leaderboard_v2(p_period text, p_category text, p_limit integer) from public, anon, authenticated;
revoke all on function public.get_live_duel_global_xp_summary(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.get_my_category_progression() from public, anon, authenticated;
revoke all on function public.get_my_duel_rank() from public, anon, authenticated;
revoke all on function public.get_my_global_progression() from public, anon, authenticated;
revoke all on function public.get_my_leaderboard_rank_v2(p_period text, p_category text) from public, anon, authenticated;
revoke all on function public.get_notification_preferences() from public, anon, authenticated;
revoke all on function public.get_notifications(p_limit integer) from public, anon, authenticated;
revoke all on function public.get_question_categories() from public, anon, authenticated;
revoke all on function public.get_social_dashboard() from public, anon, authenticated;
revoke all on function public.get_solo_category_xp_summary(p_run_id uuid) from public, anon, authenticated;
revoke all on function public.get_solo_global_xp_summary(p_run_id uuid) from public, anon, authenticated;
revoke all on function public.get_turn_based_global_xp_summary(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.get_turn_challenge_state(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.get_turn_challenges(p_limit integer) from public, anon, authenticated;
revoke all on function public.get_unread_notification_count() from public, anon, authenticated;
revoke all on function public.join_duel(p_room_code text) from public, anon, authenticated;
revoke all on function public.lookup_duel_player(p_account_number bigint) from public, anon, authenticated;
revoke all on function public.mark_notification_read(p_notification_id uuid) from public, anon, authenticated;
revoke all on function public.normalise_profile() from public, anon, authenticated;
revoke all on function public.prepare_notification_dispatch() from public, anon, authenticated;
revoke all on function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth_secret text, p_user_agent text) from public, anon, authenticated;
revoke all on function public.remove_friend(p_friend_id uuid) from public, anon, authenticated;
revoke all on function public.remove_push_subscription(p_endpoint text) from public, anon, authenticated;
revoke all on function public.respond_friend_request(p_friendship_id uuid, p_accept boolean) from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.send_friend_request(p_account_number bigint) from public, anon, authenticated;
revoke all on function public.start_solo_game(p_game_mode text, p_category text) from public, anon, authenticated;
revoke all on function public.start_turn_challenge(p_match_id uuid) from public, anon, authenticated;
revoke all on function public.submit_duel_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) from public, anon, authenticated;
revoke all on function public.submit_game_result(p_questions_answered integer, p_correct_answers integer, p_incorrect_answers integer, p_score integer, p_best_streak integer, p_average_response_ms integer, p_duration_seconds integer, p_game_mode text, p_category text) from public, anon, authenticated;
revoke all on function public.submit_solo_answer(p_run_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) from public, anon, authenticated;
revoke all on function public.submit_turn_challenge_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) from public, anon, authenticated;
revoke all on function public.update_notification_preferences(p_push_enabled boolean, p_email_enabled boolean, p_challenge_notifications boolean, p_friend_request_notifications boolean) from public, anon, authenticated;
revoke all on function public.update_player_stats_after_game() from public, anon, authenticated;
revoke all on function trivia_private.advance_due_turn_challenges(p_now timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.award_duel_category_progress(p_match_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_live_duel_global_xp(p_match_id uuid, p_player_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_live_duel_global_xp_after_completion() from public, anon, authenticated;
revoke all on function trivia_private.award_solo_category_progress(p_run_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_solo_global_xp(p_run_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_solo_global_xp_after_completion() from public, anon, authenticated;
revoke all on function trivia_private.award_turn_based_global_xp(p_match_id uuid, p_player_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.award_turn_based_global_xp_after_completion() from public, anon, authenticated;
revoke all on function trivia_private.calculate_global_answer_xp(p_difficulty text, p_is_correct boolean, p_response_ms integer, p_current_streak integer) from public, anon, authenticated;
revoke all on function trivia_private.calculate_global_game_xp(p_base_xp integer, p_answer_xp integer, p_score integer, p_max_possible_score integer, p_outcome text, p_result_reason text) from public, anon, authenticated;
revoke all on function trivia_private.calculate_live_duel_global_xp(p_match_id uuid, p_player_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.calculate_multiplayer_global_xp(p_match_id uuid, p_player_id uuid, p_expected_format text) from public, anon, authenticated;
revoke all on function trivia_private.calculate_solo_global_xp(p_run_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.calculate_turn_based_global_xp(p_match_id uuid, p_player_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.category_level_for_xp(p_xp bigint) from public, anon, authenticated;
revoke all on function trivia_private.category_progress_summary(p_source_kind text, p_source_id uuid, p_player_id uuid) from public, anon, authenticated;
revoke all on function trivia_private.category_xp_for_answer(p_difficulty text, p_is_correct boolean) from public, anon, authenticated;
revoke all on function trivia_private.duel_question_payload(p_match_id uuid, p_position integer) from public, anon, authenticated;
revoke all on function trivia_private.duel_rankings() from public, anon, authenticated;
revoke all on function trivia_private.duel_rankings_v2(p_match_format text) from public, anon, authenticated;
revoke all on function trivia_private.enqueue_notification(p_recipient_id uuid, p_notification_type text, p_actor_id uuid, p_duel_match_id uuid, p_friendship_id uuid, p_title text, p_body text, p_data jsonb, p_dedupe_key text, p_expires_at timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.finalise_duel(p_match_id uuid, p_now timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.finalise_solo_game(p_run_id uuid, p_now timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.finalise_turn_challenge(p_match_id uuid, p_now timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.finish_turn_round(p_match_id uuid, p_player_id uuid, p_now timestamp with time zone) from public, anon, authenticated;
revoke all on function trivia_private.game_run_question_payload(p_run_id uuid, p_position integer) from public, anon, authenticated;
revoke all on function trivia_private.global_base_xp(p_difficulty text, p_is_correct boolean) from public, anon, authenticated;
revoke all on function trivia_private.global_level_for_xp(p_total_xp bigint) from public, anon, authenticated;
revoke all on function trivia_private.global_live_duel_max_possible_score(p_questions_answered integer) from public, anon, authenticated;
revoke all on function trivia_private.global_multiplayer_max_possible_score(p_questions_answered integer) from public, anon, authenticated;
revoke all on function trivia_private.global_result_multiplier(p_outcome text, p_result_reason text) from public, anon, authenticated;
revoke all on function trivia_private.global_score_multiplier(p_score_efficiency numeric) from public, anon, authenticated;
revoke all on function trivia_private.global_solo_max_possible_score(p_questions_answered integer) from public, anon, authenticated;
revoke all on function trivia_private.global_speed_multiplier(p_response_ms integer) from public, anon, authenticated;
revoke all on function trivia_private.global_streak_multiplier(p_current_streak integer) from public, anon, authenticated;
revoke all on function trivia_private.global_turn_based_max_possible_score(p_questions_answered integer) from public, anon, authenticated;
revoke all on function trivia_private.handle_completed_duel_category_progress() from public, anon, authenticated;
revoke all on function trivia_private.handle_completed_solo_category_progress() from public, anon, authenticated;
revoke all on function trivia_private.leaderboard_rankings_v2(p_period text, p_category text) from public, anon, authenticated;
revoke all on function trivia_private.new_room_code() from public, anon, authenticated;
revoke all on function trivia_private.notify_friend_request() from public, anon, authenticated;
revoke all on function trivia_private.notify_live_duel_invite() from public, anon, authenticated;
revoke all on function trivia_private.question_answers_are_valid(p_answers jsonb) from public, anon, authenticated;
revoke all on function trivia_private.queue_notification_deliveries() from public, anon, authenticated;
revoke all on function trivia_private.record_category_answer_progress(p_player_id uuid, p_source_kind text, p_source_id uuid, p_answer_key text, p_category_id text, p_difficulty text, p_is_correct boolean) from public, anon, authenticated;
revoke all on function trivia_private.record_global_xp_award(p_player_id uuid, p_game_session_id uuid, p_source_kind text, p_source_id uuid, p_base_xp integer, p_answer_xp integer, p_score integer, p_max_possible_score integer, p_outcome text, p_result_reason text, p_breakdown jsonb) from public, anon, authenticated;
revoke all on function trivia_private.require_permanent_player() from public, anon, authenticated;
revoke all on function trivia_private.run_global_xp_historical_backfill() from public, anon, authenticated;
revoke all on function trivia_private.sync_duel_live_progress() from public, anon, authenticated;
grant execute on function public.cancel_duel(p_match_id uuid) to authenticated;
grant execute on function public.cancel_turn_challenge(p_match_id uuid) to authenticated;
grant execute on function public.create_duel(p_category text, p_duration_seconds integer, p_invited_account_number bigint) to authenticated;
grant execute on function public.create_turn_challenge(p_category text, p_duration_seconds integer, p_invited_account_number bigint) to authenticated;
grant execute on function public.decline_turn_challenge(p_match_id uuid) to authenticated;
grant execute on function public.finish_solo_game(p_run_id uuid) to authenticated;
grant execute on function public.get_current_solo_question(p_run_id uuid) to authenticated;
grant execute on function public.get_duel_category_xp_summary(p_match_id uuid) to authenticated;
grant execute on function public.get_duel_invitations() to authenticated;
grant execute on function public.get_duel_leaderboard(p_limit integer) to anon;
grant execute on function public.get_duel_leaderboard(p_limit integer) to authenticated;
grant execute on function public.get_duel_leaderboard_v2(p_match_format text, p_limit integer) to anon;
grant execute on function public.get_duel_leaderboard_v2(p_match_format text, p_limit integer) to authenticated;
grant execute on function public.get_duel_match_history(p_opponent_account_number bigint, p_limit integer) to authenticated;
grant execute on function public.get_duel_match_history_v2(p_opponent_account_number bigint, p_match_format text, p_limit integer) to authenticated;
grant execute on function public.get_duel_state(p_match_id uuid) to authenticated;
grant execute on function public.get_leaderboard_v2(p_period text, p_category text, p_limit integer) to anon;
grant execute on function public.get_leaderboard_v2(p_period text, p_category text, p_limit integer) to authenticated;
grant execute on function public.get_live_duel_global_xp_summary(p_match_id uuid) to authenticated;
grant execute on function public.get_my_category_progression() to authenticated;
grant execute on function public.get_my_duel_rank() to authenticated;
grant execute on function public.get_my_global_progression() to authenticated;
grant execute on function public.get_my_leaderboard_rank_v2(p_period text, p_category text) to authenticated;
grant execute on function public.get_notification_preferences() to authenticated;
grant execute on function public.get_notifications(p_limit integer) to authenticated;
grant execute on function public.get_question_categories() to anon;
grant execute on function public.get_question_categories() to authenticated;
grant execute on function public.get_social_dashboard() to authenticated;
grant execute on function public.get_solo_category_xp_summary(p_run_id uuid) to authenticated;
grant execute on function public.get_solo_global_xp_summary(p_run_id uuid) to authenticated;
grant execute on function public.get_turn_based_global_xp_summary(p_match_id uuid) to authenticated;
grant execute on function public.get_turn_challenge_state(p_match_id uuid) to authenticated;
grant execute on function public.get_turn_challenges(p_limit integer) to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.join_duel(p_room_code text) to authenticated;
grant execute on function public.lookup_duel_player(p_account_number bigint) to authenticated;
grant execute on function public.mark_notification_read(p_notification_id uuid) to authenticated;
grant execute on function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth_secret text, p_user_agent text) to authenticated;
grant execute on function public.remove_friend(p_friend_id uuid) to authenticated;
grant execute on function public.remove_push_subscription(p_endpoint text) to authenticated;
grant execute on function public.respond_friend_request(p_friendship_id uuid, p_accept boolean) to authenticated;
grant execute on function public.rls_auto_enable() to anon;
grant execute on function public.rls_auto_enable() to authenticated;
grant execute on function public.send_friend_request(p_account_number bigint) to authenticated;
grant execute on function public.start_solo_game(p_game_mode text, p_category text) to authenticated;
grant execute on function public.start_turn_challenge(p_match_id uuid) to authenticated;
grant execute on function public.submit_duel_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) to authenticated;
grant execute on function public.submit_solo_answer(p_run_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) to authenticated;
grant execute on function public.submit_turn_challenge_answer(p_match_id uuid, p_position integer, p_selected_index integer, p_request_id uuid) to authenticated;
grant execute on function public.update_notification_preferences(p_push_enabled boolean, p_email_enabled boolean, p_challenge_notifications boolean, p_friend_request_notifications boolean) to authenticated;
grant execute on function trivia_private.handle_completed_duel_category_progress() to anon;
grant execute on function trivia_private.handle_completed_duel_category_progress() to authenticated;
grant execute on function trivia_private.handle_completed_solo_category_progress() to anon;
grant execute on function trivia_private.handle_completed_solo_category_progress() to authenticated;

alter publication supabase_realtime add table public.duel_live_progress;
alter publication supabase_realtime add table public.duel_matches;
alter publication supabase_realtime add table public.notifications;

grant usage on schema trivia_private to service_role;
grant all on all tables in schema public, trivia_private to service_role;
grant all on all sequences in schema public, trivia_private to service_role;
grant execute on all functions in schema public, trivia_private to service_role;

set check_function_bodies = true;
