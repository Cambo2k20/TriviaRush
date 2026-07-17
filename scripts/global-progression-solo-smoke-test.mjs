import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ONE = "22222222-2222-4222-8222-222222222222";
const SESSION_TWO = "33333333-3333-4333-8333-333333333333";
const RUN_ONE = "44444444-4444-4444-8444-444444444444";
const RUN_TWO = "55555555-5555-4555-8555-555555555555";

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
  "  player_id uuid not null references public.profiles(id) on delete cascade",
  ");",
  "create table public.trivia_questions (",
  "  id bigint primary key,",
  "  difficulty text not null",
  ");",
  "create table public.game_runs (",
  "  id uuid primary key,",
  "  player_id uuid not null references public.profiles(id) on delete cascade,",
  "  status text not null,",
  "  completed_session_id uuid null references public.game_sessions(id),",
  "  score integer not null default 0,",
  "  questions_answered integer not null default 0,",
  "  updated_at timestamptz not null default now()",
  ");",
  "create table public.game_run_answers (",
  "  run_id uuid not null references public.game_runs(id) on delete cascade,",
  "  position integer not null,",
  "  question_id bigint not null references public.trivia_questions(id),",
  "  is_correct boolean not null,",
  "  response_ms integer not null,",
  "  points_awarded integer not null,",
  "  primary key (run_id, position)",
  ");"
].join("\n"));

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-foundation.sql"),
    "utf8"
  )
);
await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-solo.sql"),
    "utf8"
  )
);

await db.query(
  "insert into public.profiles (id, display_name, account_number) values ($1, 'Solo Tester', 1)",
  [PLAYER_ID]
);
await db.query(
  "insert into public.game_sessions (id, player_id) values ($1, $3), ($2, $3)",
  [SESSION_ONE, SESSION_TWO, PLAYER_ID]
);
await db.exec([
  "insert into public.trivia_questions (id, difficulty) values",
  "  (1, 'easy'),",
  "  (2, 'medium'),",
  "  (3, 'hard'),",
  "  (4, 'hard'),",
  "  (5, 'hard'),",
  "  (6, 'hard');"
].join("\n"));

await db.query(
  [
    "insert into public.game_runs (",
    "  id, player_id, status, score, questions_answered",
    ") values ($1, $2, 'active', 648, 5)"
  ].join("\n"),
  [RUN_ONE, PLAYER_ID]
);
await db.query(
  [
    "insert into public.game_run_answers (",
    "  run_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values",
    "  ($1, 1, 1, true, 1000, 184),",
    "  ($1, 2, 2, true, 2500, 159),",
    "  ($1, 3, 3, true, 4500, 125),",
    "  ($1, 4, 4, false, 2000, 0),",
    "  ($1, 5, 5, true, 1200, 180)"
  ].join("\n"),
  [RUN_ONE]
);

const maxScores = await db.query(
  [
    "select",
    "  trivia_private.global_solo_max_possible_score(0) as zero_questions,",
    "  trivia_private.global_solo_max_possible_score(5) as five_questions"
  ].join("\n")
);
assert(Number(maxScores.rows[0].zero_questions) === 0, "Zero answers must have zero maximum score.");
assert(Number(maxScores.rows[0].five_questions) === 1200, "Five answers must have a 1,200 maximum score.");

await db.query(
  [
    "update public.game_runs",
    "set status = 'completed', completed_session_id = $2, updated_at = now()",
    "where id = $1"
  ].join("\n"),
  [RUN_ONE, SESSION_ONE]
);

const firstAward = await db.query(
  "select * from public.global_xp_awards where game_session_id = $1",
  [SESSION_ONE]
);
assert(firstAward.rows.length === 1, "Completing a solo run must create one XP ledger row.");
assert(firstAward.rows[0].source_kind === "solo", "Solo award must use the solo source kind.");
assert(firstAward.rows[0].source_id === RUN_ONE, "Solo award must retain the authoritative run ID.");
assert(firstAward.rows[0].base_xp === 75, "First run must calculate 75 base XP.");
assert(firstAward.rows[0].answer_xp === 89, "Speed and streak bonuses must calculate 89 answer XP.");
assert(Number(firstAward.rows[0].score_efficiency) === 0.54, "Score efficiency must be normalised against the trusted maximum.");
assert(Number(firstAward.rows[0].score_multiplier) === 1.03, "A 54% score efficiency must use the 1.03 multiplier.");
assert(firstAward.rows[0].xp_awarded === 92, "First completed solo run must award 92 XP.");

const replay = await db.query(
  "select trivia_private.award_solo_global_xp($1) as payload",
  [RUN_ONE]
);
assert(replay.rows[0].payload.idempotent_replay === true, "Re-awarding the same run must be idempotent.");

const afterReplay = await db.query(
  "select total_xp, credited_games from public.player_global_progress where player_id = $1",
  [PLAYER_ID]
);
assert(Number(afterReplay.rows[0].total_xp) === 92, "Idempotent replay must not add XP twice.");
assert(Number(afterReplay.rows[0].credited_games) === 1, "Idempotent replay must not increase credited games.");

await db.query(
  "insert into public.game_runs (id, player_id, status, score, questions_answered) values ($1, $2, 'active', 180, 1)",
  [RUN_TWO, PLAYER_ID]
);
await db.query(
  [
    "insert into public.game_run_answers (",
    "  run_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values ($1, 1, 6, true, 1200, 180)"
  ].join("\n"),
  [RUN_TWO]
);
await db.query(
  "update public.game_runs set status = 'completed', completed_session_id = $2 where id = $1",
  [RUN_TWO, SESSION_TWO]
);

const progression = await db.query(
  "select total_xp, level, credited_games from public.player_global_progress where player_id = $1",
  [PLAYER_ID]
);
assert(Number(progression.rows[0].total_xp) === 126, "Two solo runs must total 126 XP.");
assert(Number(progression.rows[0].level) === 2, "126 XP must reach global level 2.");
assert(Number(progression.rows[0].credited_games) === 2, "Two unique sessions must be credited.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);
const summary = await db.query(
  "select public.get_solo_global_xp_summary($1) as payload",
  [RUN_ONE]
);
assert(summary.rows[0].payload.status === "credited", "Owner summary must report a credited run.");
assert(summary.rows[0].payload.xp_awarded === 92, "Owner summary must expose the run's XP award.");
assert(summary.rows[0].payload.total_xp === 126, "Owner summary must expose current trusted global XP.");
assert(summary.rows[0].payload.level === 2, "Owner summary must expose the current global level.");

const ledger = await db.query(
  "select count(*)::integer as count from public.global_xp_awards where player_id = $1",
  [PLAYER_ID]
);
assert(ledger.rows[0].count === 2, "Exactly two unique solo sessions must exist in the ledger.");

const privileges = await db.query([
  "select",
  "  has_function_privilege('authenticated', 'public.get_solo_global_xp_summary(uuid)', 'EXECUTE') as can_read,",
  "  has_function_privilege('authenticated', 'trivia_private.award_solo_global_xp(uuid)', 'EXECUTE') as can_award,",
  "  has_function_privilege('anon', 'public.get_solo_global_xp_summary(uuid)', 'EXECUTE') as anon_can_read"
].join("\n"));
assert(privileges.rows[0].can_read === true, "Authenticated players must read their own solo XP summary.");
assert(privileges.rows[0].can_award === false, "Browser roles must not invoke the private solo award writer.");
assert(privileges.rows[0].anon_can_read === false, "Unauthenticated browser role must not read solo XP summaries.");

console.log(
  JSON.stringify(
    {
      five_question_max_score: Number(maxScores.rows[0].five_questions),
      first_run_base_xp: firstAward.rows[0].base_xp,
      first_run_answer_xp: firstAward.rows[0].answer_xp,
      first_run_xp_awarded: firstAward.rows[0].xp_awarded,
      total_xp: Number(progression.rows[0].total_xp),
      level: Number(progression.rows[0].level),
      credited_games: Number(progression.rows[0].credited_games),
      idempotent_replay: replay.rows[0].payload.idempotent_replay,
      browser_award_blocked: true
    },
    null,
    2
  )
);

await db.close();
