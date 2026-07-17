-- Trivia Rush Phase 5 turn-based challenges: read-only production verification
-- Run after phase-5-turn-based-challenges.sql and before deploying the frontend.

with required_objects as (
  select
    to_regclass('public.notifications') is not null
      and to_regclass('public.notification_preferences') is not null
      and to_regclass('public.push_subscriptions') is not null
      and to_regclass('public.notification_deliveries') is not null
      and to_regprocedure(
        'public.create_turn_challenge(text,integer,bigint)'
      ) is not null
      and to_regprocedure(
        'public.start_turn_challenge(uuid)'
      ) is not null
      and to_regprocedure(
        'public.get_turn_challenge_state(uuid)'
      ) is not null
      and to_regprocedure(
        'public.submit_turn_challenge_answer(uuid,integer,integer,uuid)'
      ) is not null
      and to_regprocedure(
        'public.get_notifications(integer)'
      ) is not null
      and to_regprocedure(
        'public.get_duel_leaderboard_v2(text,integer)'
      ) is not null
      and to_regprocedure(
        'public.complete_notification_delivery(uuid,boolean,text,boolean,boolean)'
      ) is not null as ok
),
invalid_turn_rows as (
  select count(*)::bigint as count
  from public.duel_matches dm
  where dm.match_format = 'turn_based'
    and (
      dm.guest_id is null
      or dm.invited_player_id is null
      or dm.guest_id <> dm.invited_player_id
      or dm.status not in (
        'host_turn',
        'awaiting_response',
        'guest_turn',
        'completed',
        'cancelled'
      )
    )
),
leaked_turn_progress as (
  select count(*)::bigint as count
  from public.duel_live_progress dlp
  join public.duel_matches dm on dm.id = dlp.match_id
  where dm.match_format = 'turn_based'
),
bad_completed_history as (
  select count(*)::bigint as count
  from (
    select dm.id
    from public.duel_matches dm
    left join public.game_sessions gs on gs.duel_match_id = dm.id
    where dm.match_format = 'turn_based'
      and dm.status = 'completed'
    group by dm.id
    having count(gs.id) <> 2
  ) invalid
),
too_many_outgoing as (
  select count(*)::bigint as count
  from (
    select host_id
    from public.duel_matches
    where match_format = 'turn_based'
      and status in ('host_turn', 'awaiting_response', 'guest_turn')
    group by host_id
    having count(*) > 5
  ) invalid
),
duplicate_open_pairs as (
  select count(*)::bigint as count
  from (
    select
      least(host_id::text, guest_id::text),
      greatest(host_id::text, guest_id::text)
    from public.duel_matches
    where match_format = 'turn_based'
      and status in ('host_turn', 'awaiting_response', 'guest_turn')
    group by 1, 2
    having count(*) > 1
  ) invalid
),
expired_open as (
  select count(*)::bigint as count
  from public.duel_matches
  where match_format = 'turn_based'
    and status = 'awaiting_response'
    and response_expires_at <= now()
),
invalid_notifications as (
  select count(*)::bigint as count
  from public.notifications n
  where jsonb_typeof(n.data) <> 'object'
     or (n.duel_match_id is not null and not exists (
       select 1 from public.duel_matches dm where dm.id = n.duel_match_id
     ))
),
browser_private_privileges as (
  select count(*)::bigint as count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'notification_preferences',
      'push_subscriptions',
      'notification_deliveries'
    )
    and grantee in ('anon', 'authenticated')
),
browser_write_privileges as (
  select count(*)::bigint as count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'notifications',
      'duel_matches',
      'duel_players',
      'duel_answers',
      'duel_match_questions'
    )
    and grantee in ('anon', 'authenticated')
    and privilege_type <> 'SELECT'
),
private_realtime_tables as (
  select count(*)::bigint as count
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename in (
      'duel_players',
      'duel_answers',
      'duel_match_questions',
      'push_subscriptions',
      'notification_deliveries'
    )
),
notification_realtime as (
  select count(*)::bigint as count
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'notifications'
)
select
  case
    when ro.ok
      and itr.count = 0
      and ltp.count = 0
      and bch.count = 0
      and tmo.count = 0
      and dop.count = 0
      and eo.count = 0
      and ino.count = 0
      and bpp.count = 0
      and bwp.count = 0
      and prt.count = 0
      and nr.count = 1
    then 'PASS'
    else 'FAIL'
  end as verification_status,
  (select count(*) from public.duel_matches where match_format = 'turn_based')
    as turn_based_matches,
  (select count(*) from public.duel_matches
    where match_format = 'turn_based' and status = 'completed')
    as completed_turn_based_matches,
  itr.count as invalid_turn_rows,
  ltp.count as leaked_turn_progress_rows,
  bch.count as completed_matches_without_two_sessions,
  tmo.count as players_over_outgoing_limit,
  dop.count as duplicate_open_pairs,
  eo.count as expired_still_open,
  ino.count as invalid_notification_rows,
  bpp.count as browser_private_table_privileges,
  bwp.count as browser_write_privileges,
  prt.count as private_realtime_tables,
  nr.count as notification_realtime_entries
from required_objects ro
cross join invalid_turn_rows itr
cross join leaked_turn_progress ltp
cross join bad_completed_history bch
cross join too_many_outgoing tmo
cross join duplicate_open_pairs dop
cross join expired_open eo
cross join invalid_notifications ino
cross join browser_private_privileges bpp
cross join browser_write_privileges bwp
cross join private_realtime_tables prt
cross join notification_realtime nr;

-- Expected: authenticated can execute player RPCs, browser roles cannot execute
-- the delivery worker RPCs, and only service_role can claim/complete deliveries.
select
  role_name,
  has_function_privilege(
    role_name,
    'public.create_turn_challenge(text,integer,bigint)',
    'EXECUTE'
  ) as can_create_turn_challenge,
  has_function_privilege(
    role_name,
    'public.claim_notification_deliveries(integer)',
    'EXECUTE'
  ) as can_claim_notification_deliveries,
  has_function_privilege(
    role_name,
    'public.complete_notification_delivery(uuid,boolean,text,boolean,boolean)',
    'EXECUTE'
  ) as can_complete_notification_delivery
from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
order by role_name;

-- Inspect only failed/dead delivery metadata; endpoints and key material are
-- intentionally omitted from this operational query.
select
  channel,
  status,
  count(*) as deliveries,
  max(attempt_count) as max_attempts,
  max(updated_at) as latest_update
from public.notification_deliveries
where status in ('failed', 'dead')
group by channel, status
order by channel, status;
