-- Trivia Rush Phase 5: notification inbox details and clear-all support
--
-- Deploy after phase-5-turn-based-challenges.sql. This migration is additive.
-- Cleared notifications are retained for deduplication/audit purposes, but are no
-- longer visible through the browser policy or notification RPCs.

begin;

alter table public.notifications
add column if not exists cleared_at timestamptz null;

create index if not exists notifications_recipient_visible_idx
on public.notifications (recipient_id, created_at desc)
where cleared_at is null;

-- Cleared rows should no longer be directly readable through PostgREST either.
drop policy if exists "Players see their notifications"
on public.notifications;

create policy "Players see their notifications"
on public.notifications for select to authenticated
using (
  auth.uid() = recipient_id
  and cleared_at is null
);

create or replace function public.get_notifications(
  p_limit integer default 30
)
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
    and n.cleared_at is null
    and (
      n.expires_at is null
      or n.expires_at > now()
      or n.read_at is not null
    )
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke all
on function public.get_notifications(integer)
from public, anon;

grant execute
on function public.get_notifications(integer)
to authenticated;

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
    and n.cleared_at is null
    and n.read_at is null
    and (n.expires_at is null or n.expires_at > now());
$$;

revoke all
on function public.get_unread_notification_count()
from public, anon;

grant execute
on function public.get_unread_notification_count()
to authenticated;

create or replace function public.clear_notifications()
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
  set
    read_at = coalesce(read_at, now()),
    cleared_at = coalesce(cleared_at, now())
  where recipient_id = v_player_id
    and cleared_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all
on function public.clear_notifications()
from public, anon;

grant execute
on function public.clear_notifications()
to authenticated;

commit;
