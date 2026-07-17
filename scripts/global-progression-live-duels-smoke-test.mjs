import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "33333333-3333-4333-8333-333333333333";
const MATCH_ID = "44444444-4444-4444-8444-444444444444";
const HOST_SESSION_ID = "55555555-5555-4555-8555-555555555555";
const GUEST_SESSION_ID = "66666666-6666-4666-8666-666666666666";

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

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-foundation.sql"),
    "utf8"
  )
);

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-live-duels.sql"),
    "utf8"
  )
);

const maximumScores = await db.query([
  "select",
  "  trivia_private.global_live_duel_max_possible_score(0) as zero_questions,",
  "  trivia_private.global_live_duel_max_possible_score(1) as one_question,",
  "  trivia_private.global_live_duel_max_possible_score(5) as five_questions,",
  "  trivia_private.global_live_duel_max_possible_score(10) as ten_questions"
].join("\n"));

assert(maximumScores.rows[0].zero_questions === 0, "Zero questions must have zero maximum score.");
assert(maximumScores.rows[0].one_question === 200, "One question maximum score must be 200.");
assert(maximumScores.rows[0].five_questions === 1200, "Five question maximum score must be 1,200.");
assert(maximumScores.rows[0].ten_questions === 3200, "Ten question maximum score must be 3,200.");

await db.query(
  [
    "insert into public.profiles (id, display_name, account_number) values",
    "  ($1, 'Host Player', 1001),",
    "  ($2, 'Guest Player', 1002),",
    "  ($3, 'Outside Player', 1003)"
  ].join("\n"),
  [HOST_ID, GUEST_ID, OUTSIDER_ID]
);

await db.exec([
  "insert into public.trivia_questions (id, difficulty) values",
  "  (1, 'easy'), (2, 'medium'), (3, 'hard');"
].join("\n"));

await db.query(
  [
    "insert into public.duel_matches (",
    "  id, host_id, guest_id, status, winner_id, result_reason",
    ") values ($1, $2, $3, 'active', null, null)"
  ].join("\n"),
  [MATCH_ID, HOST_ID, GUEST_ID]
);

await db.query(
  [
    "insert into public.game_sessions (",
    "  id, player_id, game_mode, category, questions_answered, correct_answers,",
    "  incorrect_answers, score, best_streak, average_response_ms,",
    "  duration_seconds, duel_match_id",
    ") values",
    "  ($1, $3, 'duel_60', 'mixed', 3, 3, 0, 470, 3, 2600, 60, $5),",
    "  ($2, $4, 'duel_60', 'mixed', 2, 1, 1, 147, 1, 4100, 60, $5)"
  ].join("\n"),
  [HOST_SESSION_ID, GUEST_SESSION_ID, HOST_ID, GUEST_ID, MATCH_ID]
);

await db.query(
  [
    "insert into public.duel_players (",
    "  match_id, player_id, player_role, score, questions_answered,",
    "  correct_answers, incorrect_answers, outcome, completed_session_id",
    ") values",
    "  ($1, $2, 'host', 470, 3, 3, 0, 'win', $4),",
    "  ($1, $3, 'guest', 147, 2, 1, 1, 'loss', $5)"
  ].join("\n"),
  [MATCH_ID, HOST_ID, GUEST_ID, HOST_SESSION_ID, GUEST_SESSION_ID]
);

await db.query(
  [
    "insert into public.duel_answers (",
    "  match_id, player_id, position, question_id, is_correct, response_ms, points_awarded",
    ") values",
    "  ($1, $2, 1, 1, true, 1200, 180),",
    "  ($1, $2, 2, 2, true, 2400, 160),",
    "  ($1, $2, 3, 3, true, 4200, 130),",
    "  ($1, $3, 1, 2, true, 3200, 147),",
    "  ($1, $3, 2, 3, false, 5000, 0)"
  ].join("\n"),
  [MATCH_ID, HOST_ID, GUEST_ID]
);

await db.query(
  [
    "update public.duel_matches",
    "set status = 'completed', winner_id = $2, result_reason = 'score',",
    "    completed_at = now(), updated_at = now()",
    "where id = $1"
  ].join("\n"),
  [MATCH_ID, HOST_ID]
);

const awards = await db.query(
  [
    "select player_id, base_xp, answer_xp, score_multiplier, result_multiplier,",
    "       xp_awarded, source_kind, source_id",
    "from public.global_xp_awards",
    "order by player_id"
  ].join("\n")
);

assert(awards.rows.length === 2, "Completed live duel must create two XP awards.");

const hostAward = awards.rows.find((row) => row.player_id === HOST_ID);
const guestAward = awards.rows.find((row) => row.player_id === GUEST_ID);

assert(hostAward?.source_kind === "live_duel", "Host award must use live_duel source.");
assert(hostAward?.source_id === MATCH_ID, "Host award must reference the duel match.");
assert(hostAward?.base_xp === 50, "Host base XP must be reconstructed as 50.");
assert(hostAward?.answer_xp === 58, "Host answer XP must include speed and streak bonuses.");
assert(Number(hostAward?.score_multiplier) === 1.06, "Host score efficiency must apply 1.06.");
assert(Number(hostAward?.result_multiplier) === 1.1, "Score winner must receive 1.10 result multiplier.");
assert(hostAward?.xp_awarded === 68, "Host final award must be 68 XP.");

assert(guestAward?.base_xp === 15, "Guest base XP must be reconstructed as 15.");
assert(guestAward?.answer_xp === 16, "Guest speed-adjusted answer XP must be 16.");
assert(Number(guestAward?.score_multiplier) === 1, "Guest score efficiency must apply 1.00.");
assert(Number(guestAward?.result_multiplier) === 1, "Loss must apply 1.00 result multiplier.");
assert(guestAward?.xp_awarded === 16, "Guest final award must be 16 XP.");

const progress = await db.query(
  "select player_id, total_xp, level, credited_games from public.player_global_progress order by player_id"
);
const hostProgress = progress.rows.find((row) => row.player_id === HOST_ID);
const guestProgress = progress.rows.find((row) => row.player_id === GUEST_ID);
assert(hostProgress?.total_xp === 68, "Host progression must contain 68 XP.");
assert(hostProgress?.credited_games === 1, "Host must have one credited game.");
assert(guestProgress?.total_xp === 16, "Guest progression must contain 16 XP.");
assert(guestProgress?.credited_games === 1, "Guest must have one credited game.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [HOST_ID]);
const hostSummary = await db.query(
  "select public.get_live_duel_global_xp_summary($1) as payload",
  [MATCH_ID]
);
assert(hostSummary.rows[0].payload.status === "credited", "Host summary must be credited.");
assert(hostSummary.rows[0].payload.xp_awarded === 68, "Host summary must report 68 XP.");
assert(Number(hostSummary.rows[0].payload.result_multiplier) === 1.1, "Host summary must expose win multiplier.");

const replay = await db.query(
  "select trivia_private.award_live_duel_global_xp($1, $2) as payload",
  [MATCH_ID, HOST_ID]
);
assert(replay.rows[0].payload.idempotent_replay === true, "Manual retry must be idempotent.");

await db.query(
  "update public.duel_matches set updated_at = now(), status = 'completed' where id = $1",
  [MATCH_ID]
);
const ledgerAfterReplay = await db.query(
  "select count(*)::integer as count from public.global_xp_awards"
);
assert(ledgerAfterReplay.rows[0].count === 2, "Repeated completed status must not duplicate awards.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [OUTSIDER_ID]);
let outsiderBlocked = false;
try {
  await db.query(
    "select public.get_live_duel_global_xp_summary($1) as payload",
    [MATCH_ID]
  );
} catch {
  outsiderBlocked = true;
}
assert(outsiderBlocked, "Non-participant must not read a live duel XP summary.");

const privileges = await db.query([
  "select",
  "  has_function_privilege('authenticated', 'public.get_live_duel_global_xp_summary(uuid)', 'EXECUTE') as can_read,",
  "  has_function_privilege('authenticated', 'trivia_private.award_live_duel_global_xp(uuid,uuid)', 'EXECUTE') as can_award,",
  "  has_function_privilege('authenticated', 'trivia_private.calculate_live_duel_global_xp(uuid,uuid)', 'EXECUTE') as can_calculate"
].join("\n"));
assert(privileges.rows[0].can_read === true, "Authenticated players must call the safe summary RPC.");
assert(privileges.rows[0].can_award === false, "Browser role must not award live duel XP.");
assert(privileges.rows[0].can_calculate === false, "Browser role must not call private calculation helper.");

console.log(
  JSON.stringify(
    {
      awards: awards.rows.length,
      host_xp: hostAward.xp_awarded,
      guest_xp: guestAward.xp_awarded,
      host_result_multiplier: Number(hostAward.result_multiplier),
      guest_result_multiplier: Number(guestAward.result_multiplier),
      idempotent_replay: replay.rows[0].payload.idempotent_replay,
      outsider_blocked: outsiderBlocked,
      browser_award_blocked: privileges.rows[0].can_award === false
    },
    null,
    2
  )
);

await db.close();