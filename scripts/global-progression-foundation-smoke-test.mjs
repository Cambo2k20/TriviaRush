import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();
const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ONE = "22222222-2222-4222-8222-222222222222";
const SESSION_TWO = "33333333-3333-4333-8333-333333333333";

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
  "  played_at timestamptz not null default now()",
  ");"
].join("\n"));

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-foundation.sql"),
    "utf8"
  )
);

const thresholds = await db.query(
  "select level, cumulative_xp from public.global_level_thresholds order by level"
);
assert(thresholds.rows.length === 50, "Global progression must seed 50 levels.");
assert(Number(thresholds.rows[0].cumulative_xp) === 0, "Level 1 must start at zero XP.");
assert(
  Number(thresholds.rows[24].cumulative_xp) === 30000,
  "Level 25 threshold must be 30,000 XP."
);
assert(
  Number(thresholds.rows[49].cumulative_xp) === 122500,
  "Level 50 threshold must be 122,500 XP."
);

const answerExample = await db.query(
  "select trivia_private.calculate_global_answer_xp('hard', true, 1200, 6) as payload"
);
assert(answerExample.rows[0].payload.base_xp === 25, "Hard correct answer must start at 25 XP.");
assert(
  Number(answerExample.rows[0].payload.speed_multiplier) === 1.25,
  "A 1.2 second answer must receive the 1.25 speed multiplier."
);
assert(
  Number(answerExample.rows[0].payload.streak_multiplier) === 1.1,
  "A six-answer streak must receive the 1.10 streak multiplier."
);
assert(answerExample.rows[0].payload.answer_xp === 34, "Answer XP must round once to 34.");

const cappedExample = await db.query(
  "select trivia_private.calculate_global_game_xp(200, 258, 540, 600, 'win', 'score') as payload"
);
assert(cappedExample.rows[0].payload.uncapped_xp === 312, "Combined multipliers must produce 312 uncapped XP.");
assert(cappedExample.rows[0].payload.cap_xp === 300, "Game cap must be 150% of base XP.");
assert(cappedExample.rows[0].payload.xp_awarded === 300, "Final XP must respect the game cap.");

await db.query(
  "insert into public.profiles (id, display_name, account_number) values ($1, 'Progress Tester', 1)",
  [PLAYER_ID]
);
await db.query(
  [
    "insert into public.game_sessions (",
    "  id, player_id, game_mode, category, questions_answered, correct_answers,",
    "  incorrect_answers, score, best_streak, average_response_ms, duration_seconds",
    ") values",
    "  ($1, $3, 'rush_60', 'mixed', 10, 8, 2, 540, 6, 1800, 60),",
    "  ($2, $3, 'rush_60', 'science', 1, 1, 0, 180, 1, 1200, 60)"
  ].join("\n"),
  [SESSION_ONE, SESSION_TWO, PLAYER_ID]
);
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);

const firstAward = await db.query(
  [
    "select trivia_private.record_global_xp_award(",
    "  $1, $2, 'solo', null, 200, 258, 540, 600, null, null,",
    "  '{\"test\":\"capped-example\"}'::jsonb",
    ") as payload"
  ].join("\n"),
  [PLAYER_ID, SESSION_ONE]
);
assert(firstAward.rows[0].payload.idempotent_replay === false, "First award must be new.");
assert(firstAward.rows[0].payload.xp_awarded === 300, "First award must credit 300 XP.");
assert(firstAward.rows[0].payload.level === 3, "Exactly 300 total XP must reach level 3.");
assert(firstAward.rows[0].payload.level_up === true, "Crossing thresholds must report a level-up.");

const replayAward = await db.query(
  [
    "select trivia_private.record_global_xp_award(",
    "  $1, $2, 'solo', null, 200, 258, 540, 600, null, null, '{}'::jsonb",
    ") as payload"
  ].join("\n"),
  [PLAYER_ID, SESSION_ONE]
);
assert(replayAward.rows[0].payload.idempotent_replay === true, "Repeated session must be idempotent.");
assert(replayAward.rows[0].payload.total_xp === 300, "Retry must not add XP twice.");

const secondAward = await db.query(
  [
    "select trivia_private.record_global_xp_award(",
    "  $1, $2, 'solo', null, 10, 13, 180, 600, null, null, '{}'::jsonb",
    ") as payload"
  ].join("\n"),
  [PLAYER_ID, SESSION_TWO]
);
assert(secondAward.rows[0].payload.xp_awarded === 13, "Uncapped solo award must retain 13 XP.");
assert(secondAward.rows[0].payload.total_xp === 313, "Second session must raise total XP to 313.");
assert(secondAward.rows[0].payload.level === 3, "313 XP must remain level 3.");

const progression = await db.query("select public.get_my_global_progression() as payload");
assert(progression.rows[0].payload.total_xp === 313, "Read RPC must return trusted total XP.");
assert(progression.rows[0].payload.level === 3, "Read RPC must return derived level.");
assert(progression.rows[0].payload.credited_games === 2, "Read RPC must count credited games.");
assert(progression.rows[0].payload.current_level_xp === 300, "Level 3 must begin at 300 XP.");
assert(progression.rows[0].payload.next_level_xp === 600, "Level 4 must begin at 600 XP.");
assert(progression.rows[0].payload.xp_into_level === 13, "Level progress must retain overflow XP.");
assert(progression.rows[0].payload.xp_to_next_level === 287, "Read RPC must report remaining XP.");

const ledger = await db.query(
  "select count(*)::integer as count from public.global_xp_awards where player_id = $1",
  [PLAYER_ID]
);
assert(ledger.rows[0].count === 2, "Two completed sessions must create two ledger rows.");

const privileges = await db.query(
  [
    "select",
    "  has_table_privilege('anon', 'public.player_global_progress', 'SELECT') as anon_select,",
    "  has_table_privilege('authenticated', 'public.player_global_progress', 'INSERT') as authenticated_insert,",
    "  has_function_privilege('authenticated', 'public.get_my_global_progression()', 'EXECUTE') as can_read,",
    "  has_function_privilege(",
    "    'authenticated',",
    "    'trivia_private.record_global_xp_award(uuid,uuid,text,uuid,integer,integer,integer,integer,text,text,jsonb)',",
    "    'EXECUTE'",
    "  ) as can_write"
  ].join("\n")
);
assert(privileges.rows[0].anon_select === false, "Anonymous browser role must not read progress tables.");
assert(privileges.rows[0].authenticated_insert === false, "Browser role must not insert progress.");
assert(privileges.rows[0].can_read === true, "Authenticated players must read their own progression.");
assert(privileges.rows[0].can_write === false, "Browser role must not call the private award writer.");

console.log(
  JSON.stringify(
    {
      thresholds: thresholds.rows.length,
      capped_example_xp: cappedExample.rows[0].payload.xp_awarded,
      total_xp: progression.rows[0].payload.total_xp,
      level: progression.rows[0].payload.level,
      credited_games: progression.rows[0].payload.credited_games,
      idempotent_replay: replayAward.rows[0].payload.idempotent_replay,
      browser_write_blocked: true
    },
    null,
    2
  )
);

await db.close();
