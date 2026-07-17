-- Trivia Rush Phase 5: turn-based challenges and notification outbox
--
-- Deploy after phase-4b-multiplayer.sql and the Phase 5 category migration.
-- This migration is additive: the deployed live-duel RPCs remain compatible
-- while turn-based rounds get independent server clocks and private scores.

begin;

do $$
begin
  if to_regclass('public.duel_matches') is null
     or to_regclass('public.duel_players') is null
     or to_regclass('public.duel_answers') is null
     or to_regclass('public.trivia_questions') is null then
    raise exception 'Phase 4B multiplayer must be deployed first';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'duel_matches'
      and column_name = 'match_format'
  ) then
    raise exception 'Phase 5 turn-based challenges are already installed';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend the established duel model. game_sessions remains the only canonical
-- completed-game history table; no parallel match-result history is created.
-- ---------------------------------------------------------------------------

alter table public.duel_matches
add column match_format text not null default 'live';

alter table public.duel_matches
add column response_expires_at timestamptz null;

alter table public.duel_matches
add column closed_at timestamptz null;

alter table public.duel_matches
add column closed_reason text null;

alter table public.duel_matches
drop constraint duel_matches_status_valid;

alter table public.duel_matches
add constraint duel_matches_status_valid check (
  status in (
    'waiting',
    'countdown',
    'active',
    'host_turn',
    'awaiting_response',
    'guest_turn',
    'completed',
    'cancelled'
  )
);

alter table public.duel_matches
add constraint duel_matches_format_valid check (
  match_format in ('live', 'turn_based')
);

alter table public.duel_matches
add constraint duel_matches_closed_reason_valid check (
  closed_reason is null
  or closed_reason in ('host_cancelled', 'declined', 'expired')
);

alter table public.duel_matches
add constraint duel_matches_turn_deadline_valid check (
  response_expires_at is null
  or (
    match_format = 'turn_based'
    and response_expires_at > created_at
  )
);

create index duel_matches_turn_incoming_idx
on public.duel_matches (guest_id, response_expires_at)
where match_format = 'turn_based'
  and status = 'awaiting_response';

create index duel_matches_turn_host_open_idx
on public.duel_matches (host_id, created_at desc)
where match_format = 'turn_based'
  and status in ('host_turn', 'awaiting_response', 'guest_turn');

create unique index duel_matches_turn_open_pair_unique
on public.duel_matches (
  least(host_id::text, guest_id::text),
  greatest(host_id::text, guest_id::text)
)
where match_format = 'turn_based'
  and status in ('host_turn', 'awaiting_response', 'guest_turn');

alter table public.duel_players
add column round_status text not null default 'pending';

alter table public.duel_players
add column round_starts_at timestamptz null;

alter table public.duel_players
add column round_ends_at timestamptz null;

alter table public.duel_players
add column round_completed_at timestamptz null;

alter table public.duel_players
add constraint duel_players_round_status_valid check (
  round_status in ('pending', 'countdown', 'active', 'completed')
);

alter table public.duel_players
add constraint duel_players_round_times_valid check (
  (round_starts_at is null and round_ends_at is null)
  or (
    round_starts_at is not null
    and round_ends_at is not null
    and round_ends_at > round_starts_at
  )
);

create index duel_players_turn_due_idx
on public.duel_players (round_ends_at)
where round_status in ('countdown', 'active')
  and round_ends_at is not null;

-- Async target scores must never enter the participant-readable live progress
-- projection. Defence in depth is applied in both the sync trigger and policy.
create or replace function trivia_private.sync_duel_live_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.sync_duel_live_progress()
from public, anon, authenticated;

drop policy "Participants see safe duel progress"
on public.duel_live_progress;

create policy "Live participants see safe duel progress"
on public.duel_live_progress for select to authenticated
using (
  exists (
    select 1
    from public.duel_matches dm
    where dm.id = match_id
      and dm.match_format = 'live'
      and auth.uid() in (dm.host_id, dm.guest_id)
  )
);

-- ---------------------------------------------------------------------------
-- In-app notifications, private delivery preferences and external outbox.
-- Push endpoints and delivery errors are never browser-readable.
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  notification_type text not null,
  duel_match_id uuid null references public.duel_matches(id) on delete cascade,
  friendship_id uuid null references public.friendships(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  constraint notifications_type_valid check (
    notification_type in (
      'friend_request',
      'live_duel_invite',
      'turn_challenge_ready',
      'turn_challenge_reminder',
      'turn_challenge_result',
      'turn_challenge_expired'
    )
  ),
  constraint notifications_title_length check (
    char_length(title) between 1 and 100
  ),
  constraint notifications_body_length check (
    char_length(body) between 1 and 240
  ),
  constraint notifications_data_object check (
    jsonb_typeof(data) = 'object'
  )
);

create index notifications_recipient_unread_idx
on public.notifications (recipient_id, created_at desc)
where read_at is null;

create index notifications_recipient_created_idx
on public.notifications (recipient_id, created_at desc);

create table public.notification_preferences (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default false,
  challenge_notifications boolean not null default true,
  friend_request_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz null,
  constraint push_endpoint_length check (
    char_length(endpoint) between 20 and 2048
  ),
  constraint push_p256dh_length check (
    char_length(p256dh) between 20 and 512
  ),
  constraint push_auth_length check (
    char_length(auth_secret) between 8 and 256
  ),
  constraint push_user_agent_length check (
    user_agent is null or char_length(user_agent) <= 512
  )
);

create index push_subscriptions_player_active_idx
on public.push_subscriptions (player_id, updated_at desc)
where is_active;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null,
  push_subscription_id uuid null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz null,
  sent_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_channel_valid check (
    channel in ('push', 'email')
  ),
  constraint notification_delivery_target_valid check (
    (channel = 'push' and push_subscription_id is not null)
    or (channel = 'email' and push_subscription_id is null)
  ),
  constraint notification_delivery_status_valid check (
    status in ('pending', 'processing', 'sent', 'failed', 'dead')
  ),
  constraint notification_delivery_attempts_valid check (
    attempt_count between 0 and 10
  ),
  constraint notification_delivery_error_length check (
    last_error is null or char_length(last_error) <= 1000
  )
);

create unique index notification_push_delivery_unique
on public.notification_deliveries (notification_id, push_subscription_id)
where channel = 'push';

create unique index notification_email_delivery_unique
on public.notification_deliveries (notification_id)
where channel = 'email';

create index notification_deliveries_due_idx
on public.notification_deliveries (next_attempt_at, created_at)
where status in ('pending', 'failed', 'processing');

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.notification_preferences from public, anon, authenticated;
revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.notification_deliveries from public, anon, authenticated;

grant select on public.notifications to authenticated;

create policy "Players see their notifications"
on public.notifications for select to authenticated
using (auth.uid() = recipient_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create or replace function trivia_private.enqueue_notification(
  p_recipient_id uuid,
  p_notification_type text,
  p_actor_id uuid,
  p_duel_match_id uuid,
  p_friendship_id uuid,
  p_title text,
  p_body text,
  p_data jsonb,
  p_dedupe_key text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.enqueue_notification(
  uuid, text, uuid, uuid, uuid, text, text, jsonb, text, timestamptz
)
from public, anon, authenticated;

create or replace function trivia_private.queue_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.queue_notification_deliveries()
from public, anon, authenticated;

create trigger queue_notification_deliveries_trigger
after insert on public.notifications
for each row execute function trivia_private.queue_notification_deliveries();

create or replace function trivia_private.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.notify_friend_request()
from public, anon, authenticated;

create trigger notify_friend_request_trigger
after insert or update of status, requester_id, addressee_id
on public.friendships
for each row execute function trivia_private.notify_friend_request();

create or replace function trivia_private.notify_live_duel_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.notify_live_duel_invite()
from public, anon, authenticated;

create trigger notify_live_duel_invite_trigger
after insert on public.duel_matches
for each row execute function trivia_private.notify_live_duel_invite();

-- ---------------------------------------------------------------------------
-- Turn-based round helpers. Only server timestamps and validated answers can
-- change scores. Opponent scores remain private until the final result.
-- ---------------------------------------------------------------------------

create or replace function trivia_private.finalise_turn_challenge(
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
$$;

revoke all
on function trivia_private.finalise_turn_challenge(uuid, timestamptz)
from public, anon, authenticated;

create or replace function trivia_private.finish_turn_round(
  p_match_id uuid,
  p_player_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.finish_turn_round(uuid, uuid, timestamptz)
from public, anon, authenticated;

create or replace function trivia_private.advance_due_turn_challenges(
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function trivia_private.advance_due_turn_challenges(timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public turn-based challenge RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.create_turn_challenge(
  p_category text,
  p_duration_seconds integer,
  p_invited_account_number bigint
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
$$;

revoke all
on function public.create_turn_challenge(text, integer, bigint)
from public, anon;
grant execute
on function public.create_turn_challenge(text, integer, bigint)
to authenticated;

create or replace function public.start_turn_challenge(p_match_id uuid)
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
$$;

revoke all
on function public.start_turn_challenge(uuid)
from public, anon;
grant execute
on function public.start_turn_challenge(uuid)
to authenticated;

create or replace function public.cancel_turn_challenge(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.cancel_turn_challenge(uuid)
from public, anon;
grant execute
on function public.cancel_turn_challenge(uuid)
to authenticated;

create or replace function public.decline_turn_challenge(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.decline_turn_challenge(uuid)
from public, anon;
grant execute
on function public.decline_turn_challenge(uuid)
to authenticated;

create or replace function public.get_turn_challenge_state(p_match_id uuid)
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
$$;

revoke all
on function public.get_turn_challenge_state(uuid)
from public, anon;
grant execute
on function public.get_turn_challenge_state(uuid)
to authenticated;

create or replace function public.submit_turn_challenge_answer(
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
$$;

revoke all
on function public.submit_turn_challenge_answer(uuid, integer, integer, uuid)
from public, anon;
grant execute
on function public.submit_turn_challenge_answer(uuid, integer, integer, uuid)
to authenticated;

create or replace function public.get_turn_challenges(p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.get_turn_challenges(integer) from public, anon;
grant execute on function public.get_turn_challenges(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- History and multiplayer rankings gain live/turn-based filters without
-- changing the existing Phase 4 RPC signatures.
-- ---------------------------------------------------------------------------

create or replace function public.get_duel_match_history_v2(
  p_opponent_account_number bigint default null,
  p_match_format text default 'all',
  p_limit integer default 30
)
returns table (
  match_id uuid,
  played_at timestamptz,
  match_format text,
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
$$;

revoke all
on function public.get_duel_match_history_v2(bigint, text, integer)
from public, anon;
grant execute
on function public.get_duel_match_history_v2(bigint, text, integer)
to authenticated;

create or replace function trivia_private.duel_rankings_v2(
  p_match_format text default 'all'
)
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
$$;

revoke all
on function trivia_private.duel_rankings_v2(text)
from public, anon, authenticated;

create or replace function public.get_duel_leaderboard_v2(
  p_match_format text default 'all',
  p_limit integer default 20
)
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
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.get_duel_leaderboard_v2(text, integer)
from public;
grant execute
on function public.get_duel_leaderboard_v2(text, integer)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notification browser RPCs and service-only delivery RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.get_notifications(p_limit integer default 30)
returns table (
  notification_id uuid,
  notification_type text,
  title text,
  body text,
  data jsonb,
  actor_display_name text,
  duel_match_id uuid,
  friendship_id uuid,
  read_at timestamptz,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.get_notifications(integer) from public, anon;
grant execute on function public.get_notifications(integer) to authenticated;

create or replace function public.get_unread_notification_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from public.notifications n
  where n.recipient_id = trivia_private.require_permanent_player()
    and n.read_at is null
    and (n.expires_at is null or n.expires_at > now());
$$;

revoke all on function public.get_unread_notification_count() from public, anon;
grant execute on function public.get_unread_notification_count() to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.get_notification_preferences()
returns table (
  push_enabled boolean,
  email_enabled boolean,
  challenge_notifications boolean,
  friend_request_notifications boolean,
  active_push_subscriptions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.get_notification_preferences() from public, anon;
grant execute on function public.get_notification_preferences() to authenticated;

create or replace function public.update_notification_preferences(
  p_push_enabled boolean,
  p_email_enabled boolean,
  p_challenge_notifications boolean,
  p_friend_request_notifications boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.update_notification_preferences(boolean, boolean, boolean, boolean)
from public, anon;
grant execute
on function public.update_notification_preferences(boolean, boolean, boolean, boolean)
to authenticated;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.register_push_subscription(text, text, text, text)
from public, anon;
grant execute
on function public.register_push_subscription(text, text, text, text)
to authenticated;

create or replace function public.remove_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;

create or replace function public.prepare_notification_dispatch()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.prepare_notification_dispatch() from public, anon, authenticated;
grant execute on function public.prepare_notification_dispatch() to service_role;

create or replace function public.claim_notification_deliveries(
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  channel text,
  recipient_id uuid,
  title text,
  body text,
  data jsonb,
  push_subscription_id uuid,
  push_endpoint text,
  push_p256dh text,
  push_auth_secret text,
  attempt_count integer,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.claim_notification_deliveries(integer)
from public, anon, authenticated;
grant execute
on function public.claim_notification_deliveries(integer)
to service_role;

create or replace function public.complete_notification_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null,
  p_permanent_failure boolean default false,
  p_deactivate_subscription boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all
on function public.complete_notification_delivery(uuid, boolean, text, boolean, boolean)
from public, anon, authenticated;
grant execute
on function public.complete_notification_delivery(uuid, boolean, text, boolean, boolean)
to service_role;

commit;

notify pgrst, 'reload schema';
