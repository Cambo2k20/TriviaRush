import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "33333333-3333-4333-8333-333333333333";

const HISTORICAL_TURN_MATCH = "40000000-0000-4000-8000-000000000001";
const LIVE_MATCH = "40000000-0000-4000-8000-000000000002";
const TURN_MATCH = "40000000-0000-4000-8000-000000000003";

function sessionId(matchNumber, playerNumber) {
  return `50000000-0000-4000-8000-${String(matchNumber * 10 + playerNumber).padStart(12, "0")}`;
}

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
  "  match_format text not null default 'live',",
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

await db.query(
  [
    "insert into public.profiles (id, display_name, account_number) values",
    "  ($1, 'Host Player', 1001),",
    "  ($2, 'Guest Player', 1002),",
    "  ($3, 'Outside Player', 1003)"
  ].join("\n"),
  [HOST_ID, GUEST_ID, OUTSIDER_ID]
);

await db.exec("insert into public.trivia_questions (id, difficulty) values (1, 'easy');");

async function seedCompletedMatch({ matchId, matchFormat, matchNumber }) {
  const hostSession = sessionId(matchNumber, 1);
  const guestSession = sessionId(matchNumber, 2);

  await db.query(
    [
      "insert into public.duel_matches (",
      "  id, host_id, guest_id, match_format, status, winner_id, result_reason",
      ") values ($1, $2, $3, $4, 'active', null, null)"
    ].join("\n"),
    [matchId, HOST_ID, GUEST_ID, matchFormat]
  );

  await db.query(
    [
      "insert into public.game_sessions (",
      "  id, player_id, game_mode, category, questions_answered, correct_answers,",
      "  incorrect_answers, score, best_streak, average_response_ms,",
      "  duration_seconds, duel_match_id",
      ") values",
      "  ($1, $3, 'duel_60', 'mixed', 1, 1, 0, 180, 1, 1200, 60, $5),",
      "  ($2, $4, 'duel_60', 'mixed', 1, 0, 1, 0, 0, 5000, 60, $5)"
    ].join("\n"),
    [hostSession, guestSession, HOST_ID, GUEST_ID, matchId]
  );

  await db.query(
    [
      "insert into public.duel_players (",
      "  match_id, player_id, player_role, score, questions_answered,",
      "  correct_answers, incorrect_answers, outcome, completed_session_id",
      ") values",
      "  ($1, $2, 'host', 180, 1, 1, 0, 'win', $4),",
      "  ($1, $3, 'guest', 0, 1, 0, 1, 'loss', $5)"
    ].join("\n"),
    [matchId, HOST_ID, GUEST_ID, hostSession, guestSession]
  );

  await db.query(
    [
      "insert into public.duel_answers (",
      "  match_id, player_id, position, question_id, is_correct, response_ms, points_awarded",
      ") values",
      "  ($1, $2, 1, 1, true, 1200, 180),",
      "  ($1, $3, 1, 1, false, 5000, 0)"
    ].join("\n"),
    [matchId, HOST_ID, GUEST_ID]
  );

  await db.query(
    [
      "update public.duel_matches",
      "set status = 'completed', winner_id = $2, result_reason = 'score',",
      "    completed_at = now(), updated_at = now()",
      "where id = $1"
    ].join("\n"),
    [matchId, HOST_ID]
  );
}

// Before the format-aware migration, the live trigger can classify a completed
// turn-based match as live_duel. The new migration must repair that label.
await seedCompletedMatch({
  matchId: HISTORICAL_TURN_MATCH,
  matchFormat: "turn_based",
  matchNumber: 1
});

const preRepair = await db.query(
  "select count(*)::integer as count from public.global_xp_awards where source_kind = 'live_duel' and source_id = $1",
  [HISTORICAL_TURN_MATCH]
);
assert(preRepair.rows[0].count === 2, "Pre-migration turn awards must expose the live-trigger classification gap.");

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-global-progression-turn-based.sql"),
    "utf8"
  )
);

const repaired = await db.query(
  "select count(*)::integer as count from public.global_xp_awards where source_kind = 'turn_based' and source_id = $1",
  [HISTORICAL_TURN_MATCH]
);
assert(repaired.rows[0].count === 2, "Migration must reclassify historical turn-based awards.");

const misclassified = await db.query(
  [
    "select count(*)::integer as count",
    "from public.global_xp_awards award",
    "join public.duel_matches match on match.id = award.source_id",
    "where award.source_kind = 'live_duel' and match.match_format = 'turn_based'"
  ].join("\n")
);
assert(misclassified.rows[0].count === 0, "No turn-based award may remain classified as live_duel.");

await seedCompletedMatch({ matchId: LIVE_MATCH, matchFormat: "live", matchNumber: 2 });
await seedCompletedMatch({ matchId: TURN_MATCH, matchFormat: "turn_based", matchNumber: 3 });

const sourceCounts = await db.query(
  [
    "select source_id, source_kind, count(*)::integer as count",
    "from public.global_xp_awards",
    "group by source_id, source_kind",
    "order by source_id, source_kind"
  ].join("\n")
);

const liveRows = sourceCounts.rows.find(
  (row) => row.source_id === LIVE_MATCH && row.source_kind === "live_duel"
);
const turnRows = sourceCounts.rows.find(
  (row) => row.source_id === TURN_MATCH && row.source_kind === "turn_based"
);
assert(liveRows?.count === 2, "A completed live duel must create two live_duel awards.");
assert(turnRows?.count === 2, "A completed turn-based challenge must create two turn_based awards.");

const turnHostAward = await db.query(
  [
    "select base_xp, answer_xp, score_multiplier, result_multiplier, xp_awarded",
    "from public.global_xp_awards",
    "where source_id = $1 and player_id = $2"
  ].join("\n"),
  [TURN_MATCH, HOST_ID]
);
const award = turnHostAward.rows[0];
assert(award.base_xp === 10, "Turn-based host base XP must be reconstructed as 10.");
assert(award.answer_xp === 13, "Turn-based host answer XP must include the speed bonus.");
assert(Number(award.score_multiplier) === 1.1, "Turn-based score efficiency must apply 1.10.");
assert(Number(award.result_multiplier) === 1.1, "Turn-based score winner must receive 1.10.");
assert(award.xp_awarded === 15, "Turn-based host award must respect the 150% cap.");

let formatGuardWorked = false;
try {
  await db.query(
    "select trivia_private.calculate_live_duel_global_xp($1, $2)",
    [TURN_MATCH, HOST_ID]
  );
} catch {
  formatGuardWorked = true;
}
assert(formatGuardWorked, "Live-duel calculation must reject a turn-based match.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [HOST_ID]);
const summary = await db.query(
  "select public.get_turn_based_global_xp_summary($1) as payload",
  [TURN_MATCH]
);
assert(summary.rows[0].payload.status === "credited", "Participant summary must report credited.");
assert(summary.rows[0].payload.xp_awarded === 15, "Participant summary must report the turn-based award.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [OUTSIDER_ID]);
let outsiderBlocked = false;
try {
  await db.query(
    "select public.get_turn_based_global_xp_summary($1) as payload",
    [TURN_MATCH]
  );
} catch {
  outsiderBlocked = true;
}
assert(outsiderBlocked, "Non-participant must not read a turn-based XP summary.");

const privileges = await db.query([
  "select",
  "  has_function_privilege('authenticated', 'public.get_turn_based_global_xp_summary(uuid)', 'EXECUTE') as can_read,",
  "  has_function_privilege('authenticated', 'trivia_private.award_turn_based_global_xp(uuid,uuid)', 'EXECUTE') as can_award,",
  "  has_function_privilege('authenticated', 'trivia_private.calculate_turn_based_global_xp(uuid,uuid)', 'EXECUTE') as can_calculate"
].join("\n"));
assert(privileges.rows[0].can_read === true, "Authenticated participants must call the safe summary RPC.");
assert(privileges.rows[0].can_award === false, "Browser role must not award turn-based XP.");
assert(privileges.rows[0].can_calculate === false, "Browser role must not call private turn calculation.");

console.log(
  JSON.stringify(
    {
      repaired_turn_awards: repaired.rows[0].count,
      live_awards: liveRows.count,
      new_turn_awards: turnRows.count,
      turn_host_xp: award.xp_awarded,
      status: "ok"
    },
    null,
    2
  )
);
