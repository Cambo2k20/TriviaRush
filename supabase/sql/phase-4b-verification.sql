-- Trivia Rush Phase 4B read-only production verification
-- Run after phase-4b-multiplayer.sql.

-- 1. Required tables and RPCs must all resolve.
select
  to_regclass('public.friendships') as friendships,
  to_regclass('public.duel_matches') as duel_matches,
  to_regclass('public.duel_players') as duel_players,
  to_regclass('public.duel_live_progress') as duel_live_progress,
  to_regclass('public.duel_match_questions') as duel_match_questions,
  to_regclass('public.duel_answers') as duel_answers,
  to_regprocedure('public.create_duel(text,integer,bigint)') as create_duel_rpc,
  to_regprocedure('public.join_duel(text)') as join_duel_rpc,
  to_regprocedure('public.get_duel_state(uuid)') as duel_state_rpc,
  to_regprocedure('public.submit_duel_answer(uuid,integer,integer,uuid)') as answer_rpc,
  to_regprocedure('public.get_social_dashboard()') as social_rpc,
  to_regprocedure('public.get_duel_match_history(bigint,integer)') as history_rpc,
  to_regprocedure('public.get_duel_leaderboard(integer)') as leaderboard_rpc;

-- 2. Duel modes must be isolated from the solo family.
select mode, label, mode_family, duration_seconds, max_questions, is_active
from public.game_modes
order by mode_family, duration_seconds;

-- 3. Only participant-visible aggregate tables belong to Realtime.
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;

-- Expected Phase 4B additions: duel_matches and duel_live_progress.
-- duel_answers and duel_match_questions must not appear.

-- 4. RLS and participant-only SELECT policies.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'friendships',
    'duel_matches',
    'duel_players',
    'duel_live_progress',
    'duel_match_questions',
    'duel_answers'
  )
order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('friendships', 'duel_matches', 'duel_live_progress')
order by tablename, policyname;

-- 5. Browser roles must have no write privilege on multiplayer tables.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'friendships',
    'duel_matches',
    'duel_players',
    'duel_live_progress',
    'duel_match_questions',
    'duel_answers'
  )
  and grantee in ('anon', 'authenticated')
  and privilege_type <> 'SELECT'
order by table_name, grantee, privilege_type;

-- Expected: no rows.

-- 6. Completed matches must have exactly two canonical player sessions.
select dm.id, count(gs.id) as canonical_sessions
from public.duel_matches dm
left join public.game_sessions gs on gs.duel_match_id = dm.id
where dm.status = 'completed'
group by dm.id
having count(gs.id) <> 2;

-- Expected: no rows.

-- 7. Duel sessions must use registered duel modes; solo rows must have no link.
select count(*) as invalid_mode_links
from public.game_sessions gs
left join public.game_modes gm on gm.mode = gs.game_mode
where (gs.duel_match_id is not null and gm.mode_family <> 'duel')
   or (gs.duel_match_id is null and gm.mode_family = 'duel');

-- Expected: zero.

-- 8. Friend pairs and match participants must not duplicate.
select count(*) as duplicate_friend_pairs
from (
  select
    least(requester_id::text, addressee_id::text),
    greatest(requester_id::text, addressee_id::text)
  from public.friendships
  group by 1, 2
  having count(*) > 1
) duplicates;

select match_id, count(*) as participants
from public.duel_players
group by match_id
having count(*) > 2;

-- Both expected: zero/no rows.

-- 9. Inspect unfinished matches and heartbeat recency.
select
  dm.id,
  dm.room_code,
  dm.status,
  dm.starts_at,
  dm.ends_at,
  p.display_name,
  dp.player_role,
  dp.last_seen_at,
  dp.score,
  dp.questions_answered
from public.duel_matches dm
join public.duel_players dp on dp.match_id = dm.id
join public.profiles p on p.id = dp.player_id
where dm.status in ('waiting', 'countdown', 'active')
order by dm.created_at desc, dp.player_role;
