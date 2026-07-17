import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();

const SOLO_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "22222222-2222-4222-8222-222222222222";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";
const BROKEN_ID = "44444444-4444-4444-8444-444444444444";
const SOLO_RUN_ID = "51111111-1111-4111-8111-111111111111";
const BROKEN_RUN_ID = "54444444-4444-4444-8444-444444444444";
const LIVE_MATCH_ID = "62222222-2222-4222-8222-222222222222";
const TURN_MATCH_ID = "63333333-3333-4333-8333-333333333333";

const SESSION_IDS = {
  solo: "71111111-1111-4111-8111-111111111111",
  liveHost: "72222222-2222-4222-8222-222222222222",
  liveGuest: "73333333-3333-4333-8333-333333333333",
  turnHost: "74444444-4444-4444-8444-444444444444",
  turnGuest: "75555555-5555-4555-8555-555555555555",
  broken: "76666666-6666-4666-8666-666666666666"
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await db.exec([
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create role service_role nologin;",
  "create schema auth;",
  "create schema trivia_private;",
  "create function auth.uid() returns uuid language sql stable as $$",
  "  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid",
  "$$;",
  "create table public.profiles (",
  "  id uuid primary key,",
  "  display_name text not null,",
  "  account_number bigint not null unique",
  ");",
  "create table public.duel_matches (",
  "  id uuid primary key,",
  "  host_id uuid not null references public.profiles(id),",
  "  guest_id uuid null references public.profiles(id),",
  "  match_format text not null,",
  "  status text not null,",
  "  winner_id uuid null references public.profiles(id),",
  "  result_reason text null,",
  "  created_at timestamptz not null default now(),",
  "  updated_at timestamptz not null default now(),",
  "  completed_at timestamptz null",
  ");",
  "create table public.game_sessions (",
  "  id uuid primary key,",
  "  player_id uuid not null references public.profiles(id) on delete cascade,",
  "  game_mode text not null,",
  "  category text not null,",
  "  questions_answered integer not null,",
  "  correct_answers integer not null,",
  "  incorrect_answers integer not null,",
  "  score integer not null,",
  "  best_streak integer not null,",
  "  average_response_ms integer null,",
  "  duration_seconds integer not null,",
  "  played_at timestamptz not null default now(),",
  "  duel_match_id uuid null references public.duel_matches(id)",
  ");",
  "create table public.trivia_questions (",
  "  id bigint primary key,",
  "  difficulty text not null",
  ");",
  "create table public.game_runs (",
  "  id uuid primary key,",
  "  player_id uuid not null references public.profiles(id),",
  "  status text not null,",
  "  questions_answered integer not null default 0,",
  "  score integer not null default 0,",
  "  completed_session_id uuid null references public.game_sessions(id),",
  "  updated_at timestamptz not null default now()",
  ");",
  "create table public.game_run_answers (",
  "  id uuid primary key default gen_random_uuid(),",
  "  run_id uuid not null references public.game_runs(id),",
  "  position integer not null,",
  "  question_id bigint not null references public.trivia_questions(id),",
  "  is_correct boolean not null,",
  "  response_ms integer not null,",
  "  points_awarded integer not null",
  ");",
  "create table public.duel_players (",
  "  match_id uuid not null references public.duel_matches(id),",
  "  player_id uuid not null references public.profiles(id),",
  "  player_role text not null,",
  "  score integer not null default 0,",
  "  questions_answered integer not null default 0,",
  "  correct_answers integer not null default 0,",
  "  incorrect_answers integer not null default 0,",
  "  outcome text null,",
  "  completed_session_id uuid null references public.game_sessions(id),",
  "  primary key (match_id, player_id)",
  ");",
  "create table public.duel_answers (",
  "  id uuid primary key default gen_random_uuid(),",
  "  match_id uuid not null,",
  "  player_id uuid not null,",
  "  position integer not null,",
  "  question_id bigint not null references public.trivia_questions(id),",
  "  is_correct boolean not null,",
  "  response_ms integer not null,",
  "  points_awarded integer not null,",
  "  foreign key (match_id, player_id)",
  "    references public.duel_players(match_id, player_id)",
  ");"
].join("\n"));

for (const filename of [
  "phase-5-global-progression-foundation.sql",
  "phase-5-global-progression-solo.sql",
  "phase-5-global-progression-live-duels.sql",
  "phase-5-global-progression-turn-based.sql"
]) {
  await db.exec(
    readFileSync(resolve(ROOT, "supabase/sql", filename), "utf8")
  );
}

await db.query(
  [
    "insert into public.profiles (id, display_name, account_number) values",
    "  ($1, 'Solo Player', 1001),",
    "  ($2, 'Host Player', 1002),",
    "  ($3, 'Guest Player', 1003),",
    "  ($4, 'Repair Player', 1004)"
  ].join("\n"),
  [SOLO_ID, HOST_ID, GUEST_ID, BROKEN_ID]
);

await db.exec(
  "insert into public.trivia_questions (id, difficulty) values " +
    "(1, 'easy'), (2, 'medium'), (3, 'hard');"
);

await db.query(
  [
    "insert into public.duel_matches (",
    "  id, host_id, guest_id, match_format, status, winner_id, result_reason, completed_at",
    ") values",
    "  ($1, $3, $4, 'live', 'completed', $3, 'score', now() - interval '2 days'),",
    "  ($2, $3, $4, 'turn_based', 'completed', null, 'draw', now() - interval '1 day')"
  ].join("\n"),
  [LIVE_MATCH_ID, TURN_MATCH_ID, HOST_ID, GUEST_ID]
);

await db.query(
  [
    "insert into public.game_sessions (",
    "  id, player_id, game_mode, category, questions_answered, correct_answers,",
    "  incorrect_answers, score, best_streak, average_response_ms, duration_seconds, duel_match_id",
    ") values",
    "  ($1, $7, 'rush_60', 'mixed', 2, 2, 0, 340, 2, 1800, 60, null),",
    "  ($2, $8, 'duel_60', 'mixed', 3, 3, 0, 470, 3, 2600, 60, $11),",
    "  ($3, $9, 'duel_60', 'mixed', 2, 1, 1, 147, 1, 4100, 60, $11),",
    "  ($4, $8, 'duel_60', 'mixed', 1, 1, 0, 180, 1, 1200, 60, $12),",
    "  ($5, $9, 'duel_60', 'mixed', 1, 1, 0, 180, 1, 1200, 60, $12),",
    "  ($6, $10, 'rush_60', 'mixed', 1, 1, 0, 100, 1, 6000, 60, null)"
  ].join("\n"),
  [
    SESSION_IDS.solo,
    SESSION_IDS.liveHost,
    SESSION_IDS.liveGuest,
    SESSION_IDS.turnHost,
    SESSION_IDS.turnGuest,
    SESSION_IDS.broken,
    SOLO_ID,
    HOST_ID,
    GUEST_ID,
    BROKEN_ID,
    LIVE_MATCH_ID,
    TURN_MATCH_ID
  ]
);

await db.query(
  [
    "insert into public.game_runs (",
    "  id, player_id, status, questions_answered, score, completed_session_id, updated_at",
    ") values",
    "  ($1, $3, 'completed', 2, 340, $5, now() - interval '3 days'),",
    "  ($2, $4, 'completed', 1, 100, $6, now() - interval '4 days')"
  ].join("\n"),
  [
    SOLO_RUN_ID,
    BROKEN_RUN_ID,
    SOLO_ID,
    BROKEN_ID,
    SESSION_IDS.solo,
    SESSION_IDS.broken
  ]
);

await db.query(
  [
    "insert into public.game_run_answers (",
    "  run_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values",
    "  ($1, 1, 1, true, 1200, 180),",
    "  ($1, 2, 2, true, 2400, 160)"
  ].join("\n"),
  [SOLO_RUN_ID]
);

await db.query(
  [
    "insert into public.duel_players (",
    "  match_id, player_id, player_role, score, questions_answered,",
    "  correct_answers, incorrect_answers, outcome, completed_session_id",
    ") values",
    "  ($1, $3, 'host', 470, 3, 3, 0, 'win', $5),",
    "  ($1, $4, 'guest', 147, 2, 1, 1, 'loss', $6),",
    "  ($2, $3, 'host', 180, 1, 1, 0, 'draw', $7),",
    "  ($2, $4, 'guest', 180, 1, 1, 0, 'draw', $8)"
  ].join("\n"),
  [
    LIVE_MATCH_ID,
    TURN_MATCH_ID,
    HOST_ID,
    GUEST_ID,
    SESSION_IDS.liveHost,
    SESSION_IDS.liveGuest,
    SESSION_IDS.turnHost,
    SESSION_IDS.turnGuest
  ]
);

await db.query(
  [
    "insert into public.duel_answers (",
    "  match_id, player_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values",
    "  ($1, $3, 1, 1, true, 1200, 180),",
    "  ($1, $3, 2, 2, true, 2400, 160),",
    "  ($1, $3, 3, 3, true, 4200, 130),",
    "  ($1, $4, 1, 2, true, 3200, 147),",
    "  ($1, $4, 2, 3, false, 5000, 0),",
    "  ($2, $3, 1, 1, true, 1200, 180),",
    "  ($2, $4, 1, 1, true, 1200, 180)"
  ].join("\n"),
  [LIVE_MATCH_ID, TURN_MATCH_ID, HOST_ID, GUEST_ID]
);

await db.exec(
  readFileSync(
    resolve(
      ROOT,
      "supabase/sql/phase-5-global-progression-historical-backfill.sql"
    ),
    "utf8"
  )
);

let awards = await db.query(
  "select source_kind, count(*)::integer as count from public.global_xp_awards group by source_kind order by source_kind"
);
const counts = Object.fromEntries(
  awards.rows.map((row) => [row.source_kind, row.count])
);
assert(counts.solo === 1, "The valid historical solo session must be credited.");
assert(counts.live_duel === 2, "Both historical live-duel sessions must be credited.");
assert(counts.turn_based === 2, "Both historical turn-based sessions must be credited.");

let latestRun = await db.query(
  "select * from trivia_private.global_xp_backfill_runs order by started_at desc, id desc limit 1"
);
assert(
  latestRun.rows[0].status === "completed_with_failures",
  "A malformed historical session must be isolated and reported."
);
assert(latestRun.rows[0].failure_count === 1, "Exactly one malformed session must fail.");

let unresolved = await db.query(
  "select count(*)::integer as count from trivia_private.global_xp_backfill_failures where resolved_at is null"
);
assert(unresolved.rows[0].count === 1, "The malformed session must remain unresolved.");

await db.query(
  [
    "insert into public.game_run_answers (",
    "  run_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values ($1, 1, 1, true, 6000, 100)"
  ].join("\n"),
  [BROKEN_RUN_ID]
);

const retry = await db.query(
  "select trivia_private.run_global_xp_historical_backfill() as result"
);
assert(retry.rows[0].result.status === "completed", "A repaired rerun must complete.");
assert(retry.rows[0].result.solo_candidates === 1, "Only the repaired session must be retried.");
assert(retry.rows[0].result.solo_awarded === 1, "The repaired session must be credited.");
assert(retry.rows[0].result.failure_count === 0, "The repaired rerun must have no failures.");

unresolved = await db.query(
  "select count(*)::integer as count from trivia_private.global_xp_backfill_failures where resolved_at is null"
);
assert(unresolved.rows[0].count === 0, "Successful retry must resolve the previous failure.");

awards = await db.query(
  "select count(*)::integer as count from public.global_xp_awards"
);
assert(awards.rows[0].count === 6, "All six historical game sessions must be credited once.");

const tagged = await db.query(
  "select count(*)::integer as count from public.global_xp_awards where breakdown ->> 'credit_path' = 'historical_backfill'"
);
assert(tagged.rows[0].count === 6, "Every historical award must be tagged as backfilled.");

const progress = await db.query(
  "select player_id, total_xp, credited_games from public.player_global_progress order by player_id"
);
const byPlayer = new Map(progress.rows.map((row) => [row.player_id, row]));
assert(byPlayer.get(SOLO_ID)?.total_xp === 33, "Solo player must receive 33 XP.");
assert(byPlayer.get(SOLO_ID)?.credited_games === 1, "Solo player must have one credited game.");
assert(byPlayer.get(HOST_ID)?.total_xp === 83, "Host must receive 83 total XP.");
assert(byPlayer.get(HOST_ID)?.credited_games === 2, "Host must have two credited games.");
assert(byPlayer.get(GUEST_ID)?.total_xp === 31, "Guest must receive 31 total XP.");
assert(byPlayer.get(GUEST_ID)?.credited_games === 2, "Guest must have two credited games.");
assert(byPlayer.get(BROKEN_ID)?.total_xp === 10, "Repaired player must receive 10 XP.");

const replay = await db.query(
  "select trivia_private.run_global_xp_historical_backfill() as result"
);
assert(replay.rows[0].result.status === "completed", "An empty replay must complete.");
assert(replay.rows[0].result.solo_candidates === 0, "Idempotent replay must find no solo candidates.");
assert(replay.rows[0].result.live_duel_candidates === 0, "Idempotent replay must find no live candidates.");
assert(replay.rows[0].result.turn_based_candidates === 0, "Idempotent replay must find no turn candidates.");

const privileges = await db.query([
  "select",
  "  has_function_privilege('anon', 'trivia_private.run_global_xp_historical_backfill()', 'EXECUTE') as anon_can_run,",
  "  has_function_privilege('authenticated', 'trivia_private.run_global_xp_historical_backfill()', 'EXECUTE') as authenticated_can_run"
].join("\n"));
assert(privileges.rows[0].anon_can_run === false, "Anonymous users must not run the backfill.");
assert(privileges.rows[0].authenticated_can_run === false, "Authenticated browsers must not run the backfill.");

console.log(
  JSON.stringify(
    {
      awards: awards.rows[0].count,
      unresolved_failures: unresolved.rows[0].count,
      retry_candidates: retry.rows[0].result.solo_candidates,
      idempotent_replay_candidates:
        replay.rows[0].result.solo_candidates +
        replay.rows[0].result.live_duel_candidates +
        replay.rows[0].result.turn_based_candidates
    },
    null,
    2
  )
);
