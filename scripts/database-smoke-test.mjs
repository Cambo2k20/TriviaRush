import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();
const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const PLAYER_TWO_ID = "44444444-4444-4444-8444-444444444444";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baseline = [
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create schema auth;",
  "create schema trivia_private;",
  "create table auth.users (id uuid primary key, is_anonymous boolean not null);",
  "create publication supabase_realtime;",
  "create function auth.uid() returns uuid language sql stable as $$",
  "  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid",
  "$$;",
  "create table public.profiles (",
  "  id uuid primary key,",
  "  display_name text not null,",
  "  account_number bigint not null unique",
  ");",
  "create table public.player_stats (",
  "  player_id uuid primary key references public.profiles(id) on delete cascade,",
  "  games_played bigint not null default 0,",
  "  total_questions bigint not null default 0,",
  "  total_correct bigint not null default 0,",
  "  total_incorrect bigint not null default 0,",
  "  total_score bigint not null default 0,",
  "  high_score integer not null default 0,",
  "  best_streak integer not null default 0,",
  "  total_response_ms bigint not null default 0,",
  "  updated_at timestamptz not null default now()",
  ");",
  "create table public.game_sessions (",
  "  id uuid primary key default gen_random_uuid(),",
  "  player_id uuid not null references public.profiles(id) on delete cascade,",
  "  game_mode text not null default 'rush_60',",
  "  category text not null default 'mixed',",
  "  questions_answered integer not null constraint game_questions_range check (questions_answered between 1 and 200),",
  "  correct_answers integer not null,",
  "  incorrect_answers integer not null,",
  "  score integer not null,",
  "  best_streak integer not null default 0,",
  "  average_response_ms integer null,",
  "  duration_seconds integer not null default 60,",
  "  played_at timestamptz not null default now(),",
  "  check (correct_answers + incorrect_answers = questions_answered),",
  "  check (best_streak between 0 and correct_answers),",
  "  check (average_response_ms is null or average_response_ms between 50 and 600000)",
  ");",
  "create table public.game_modes (",
  "  mode text primary key,",
  "  label text not null,",
  "  duration_seconds integer null,",
  "  max_questions integer not null,",
  "  max_points_per_question integer not null,",
  "  is_active boolean not null default true,",
  "  created_at timestamptz not null default now()",
  ");",
  "insert into public.game_modes values",
  "  ('rush_60', '60 Second Rush', 60, 80, 600, true, now());",
  "create function public.update_player_stats_after_game()",
  "returns trigger language plpgsql security definer set search_path = '' as $$",
  "begin",
  "  insert into public.player_stats (",
  "    player_id, games_played, total_questions, total_correct, total_incorrect,",
  "    total_score, high_score, best_streak, total_response_ms, updated_at",
  "  ) values (",
  "    new.player_id, 1, new.questions_answered, new.correct_answers,",
  "    new.incorrect_answers, new.score, new.score, new.best_streak,",
  "    coalesce(new.average_response_ms, 0)::bigint * new.questions_answered, now()",
  "  ) on conflict (player_id) do update set",
  "    games_played = public.player_stats.games_played + 1,",
  "    total_questions = public.player_stats.total_questions + excluded.total_questions,",
  "    total_correct = public.player_stats.total_correct + excluded.total_correct,",
  "    total_incorrect = public.player_stats.total_incorrect + excluded.total_incorrect,",
  "    total_score = public.player_stats.total_score + excluded.total_score,",
  "    high_score = greatest(public.player_stats.high_score, excluded.high_score),",
  "    best_streak = greatest(public.player_stats.best_streak, excluded.best_streak),",
  "    total_response_ms = public.player_stats.total_response_ms + excluded.total_response_ms,",
  "    updated_at = now();",
  "  return new;",
  "end;",
  "$$;",
  "create trigger update_player_stats_trigger after insert on public.game_sessions",
  "for each row execute function public.update_player_stats_after_game();",
  "create function public.submit_game_result(",
  "  integer, integer, integer, integer, integer, integer, integer, text, text",
  ") returns uuid language sql security definer set search_path = '' as $$",
  "  select gen_random_uuid()",
  "$$;"
].join("\n");

await db.exec(baseline);
await db.exec(readFileSync(resolve(ROOT, "phase-4a-question-platform.sql"), "utf8"));
await db.exec(readFileSync(resolve(ROOT, "phase-4a-question-seed.sql"), "utf8"));

await db.query(
  "insert into public.profiles (id, display_name, account_number) values ($1, 'Smoke Tester', 1)",
  [PLAYER_ID]
);
await db.query(
  "insert into public.profiles (id, display_name, account_number) values ($1, 'Duel Opponent', 2)",
  [PLAYER_TWO_ID]
);
await db.query(
  "insert into auth.users (id, is_anonymous) values ($1, false), ($2, false)",
  [PLAYER_ID, PLAYER_TWO_ID]
);
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);

const categoryResult = await db.query(
  "select * from public.get_question_categories() order by category_id"
);
assert(categoryResult.rows.length === 7, "Category RPC must return seven categories.");
assert(
  categoryResult.rows.every((row) => Number(row.question_count) === 100),
  "Every category must expose exactly 100 active questions."
);

const startedResult = await db.query(
  "select public.start_solo_game('rush_60', 'science') as payload"
);
const started = startedResult.rows[0].payload;
assert(started.run_id, "start_solo_game must return a run ID.");
assert(started.question, "start_solo_game must return the first question.");
assert(!Object.hasOwn(started.question, "correct_index"), "Correct index leaked to client.");

const firstQuestionId = Number(started.question.question_id);
const answerLookup = await db.query(
  "select correct_index from public.trivia_questions where id = $1",
  [firstQuestionId]
);
const correctIndex = Number(answerLookup.rows[0].correct_index);
const requestId = "22222222-2222-4222-8222-222222222222";

const answerResult = await db.query(
  "select public.submit_solo_answer($1, 1, $2, $3) as payload",
  [started.run_id, correctIndex, requestId]
);
const answer = answerResult.rows[0].payload;
assert(answer.is_correct === true, "Correct answer must be accepted.");
assert(answer.points_awarded > 0, "Correct answer must earn points.");
assert(answer.questions_answered === 1, "Answer count must increment once.");

const replayResult = await db.query(
  "select public.submit_solo_answer($1, 1, $2, $3) as payload",
  [started.run_id, correctIndex, requestId]
);
const replay = replayResult.rows[0].payload;
assert(replay.idempotent_replay === true, "Repeated request ID must be idempotent.");
assert(replay.questions_answered === 1, "Idempotent replay must not double count.");
assert(replay.correct_answer, "Idempotent replay must preserve answer feedback.");

await db.query(
  "update public.game_runs set next_question_at = clock_timestamp() - interval '1 ms' where id = $1",
  [started.run_id]
);

const nextResult = await db.query(
  "select public.get_current_solo_question($1) as payload",
  [started.run_id]
);
const next = nextResult.rows[0].payload;
assert(next.status === "active", "Second question must become active.");
assert(next.question.position === 2, "Question position must advance.");

const passRequestId = "33333333-3333-4333-8333-333333333333";
const passResult = await db.query(
  "select public.submit_solo_answer($1, 2, null, $2) as payload",
  [started.run_id, passRequestId]
);
const passed = passResult.rows[0].payload;
assert(passed.is_correct === false, "A pass must be incorrect.");
assert(passed.points_awarded === 0, "A pass must award zero points.");
assert(passed.questions_answered === 2, "A pass must count as answered.");

await db.query(
  [
    "update public.game_runs",
    "set started_at = clock_timestamp() - interval '61 seconds',",
    "    ends_at = clock_timestamp() - interval '1 second'",
    "where id = $1"
  ].join("\n"),
  [started.run_id]
);

const finishResult = await db.query(
  "select public.finish_solo_game($1) as payload",
  [started.run_id]
);
const finished = finishResult.rows[0].payload;
assert(finished.status === "completed", "Finished run must be completed.");
assert(finished.session_id, "Finished run must create a canonical game session.");

const sessionResult = await db.query(
  "select * from public.game_sessions where id = $1",
  [finished.session_id]
);
assert(sessionResult.rows.length === 1, "Exactly one game session must be created.");
assert(sessionResult.rows[0].questions_answered === 2, "Session totals must include the pass.");
assert(sessionResult.rows[0].incorrect_answers === 1, "Pass must be stored as incorrect.");

const statsResult = await db.query(
  "select * from public.player_stats where player_id = $1",
  [PLAYER_ID]
);
assert(statsResult.rows.length === 1, "Existing player stats trigger must still run.");
assert(Number(statsResult.rows[0].games_played) === 1, "Player stats must count one game.");

await db.exec(readFileSync(resolve(ROOT, "phase-4a-final-cutover.sql"), "utf8"));
const legacyPrivilegeResult = await db.query(
  [
    "select has_function_privilege(",
    "  'authenticated',",
    "  'public.submit_game_result(integer,integer,integer,integer,integer,integer,integer,text,text)',",
    "  'EXECUTE'",
    ") as allowed"
  ].join("\n")
);
assert(
  legacyPrivilegeResult.rows[0].allowed === false,
  "Final cutover must close the legacy client-computed score RPC."
);

await db.exec(readFileSync(resolve(ROOT, "phase-4b-multiplayer.sql"), "utf8"));

const friendRequestResult = await db.query(
  "select public.send_friend_request(2) as friendship_id"
);
assert(friendRequestResult.rows[0].friendship_id, "Friend request must be created.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_TWO_ID]);
const socialResult = await db.query("select public.get_social_dashboard() as payload");
assert(socialResult.rows[0].payload.incoming.length === 1, "Incoming friend request must be private and visible.");
await db.query(
  "select public.respond_friend_request($1, true)",
  [friendRequestResult.rows[0].friendship_id]
);

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);
const duelCreateResult = await db.query(
  "select public.create_duel('science', 30, 2) as payload"
);
const duelCreated = duelCreateResult.rows[0].payload;
assert(duelCreated.match_id && duelCreated.room_code, "Reserved duel must be created.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_TWO_ID]);
const invitationResult = await db.query("select * from public.get_duel_invitations()");
assert(invitationResult.rows.length === 1, "Reserved player must receive the duel invitation.");
await db.query("select public.join_duel($1)", [duelCreated.room_code]);

await db.query(
  "update public.duel_matches set status = 'active', starts_at = clock_timestamp() - interval '1 second', ends_at = clock_timestamp() + interval '30 seconds' where id = $1",
  [duelCreated.match_id]
);
await db.query(
  "update public.duel_players set current_question_started_at = clock_timestamp() - interval '200 milliseconds' where match_id = $1",
  [duelCreated.match_id]
);

const playerTwoStateResult = await db.query(
  "select public.get_duel_state($1) as payload",
  [duelCreated.match_id]
);
const playerTwoState = playerTwoStateResult.rows[0].payload;
assert(playerTwoState.question, "Joined player must receive an active question.");
assert(!Object.hasOwn(playerTwoState.question, "correct_index"), "Duel answer key leaked to client.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);
const playerOneStateResult = await db.query(
  "select public.get_duel_state($1) as payload",
  [duelCreated.match_id]
);
const playerOneState = playerOneStateResult.rows[0].payload;
assert(
  playerOneState.question.question_id === playerTwoState.question.question_id,
  "Both duel players must receive the same question in the same position."
);

const duelCorrectLookup = await db.query(
  "select correct_index from public.trivia_questions where id = $1",
  [playerOneState.question.question_id]
);
const duelAnswerResult = await db.query(
  "select public.submit_duel_answer($1, 1, $2, $3) as payload",
  [duelCreated.match_id, Number(duelCorrectLookup.rows[0].correct_index), "55555555-5555-4555-8555-555555555555"]
);
assert(duelAnswerResult.rows[0].payload.is_correct === true, "Server must validate the duel answer.");

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_TWO_ID]);
const duelPassResult = await db.query(
  "select public.submit_duel_answer($1, 1, null, $2) as payload",
  [duelCreated.match_id, "66666666-6666-4666-8666-666666666666"]
);
assert(duelPassResult.rows[0].payload.is_correct === false, "Duel pass must count as incorrect.");

const liveProgressResult = await db.query(
  "select * from public.duel_live_progress where match_id = $1 order by player_id",
  [duelCreated.match_id]
);
assert(liveProgressResult.rows.length === 2, "Safe live progress must contain both participants.");
assert(
  !Object.hasOwn(liveProgressResult.rows[0], "correct_answers") &&
    !Object.hasOwn(liveProgressResult.rows[0], "incorrect_answers"),
  "Realtime progress must not expose opponent correctness."
);
const realtimePublicationResult = await db.query(
  "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename"
);
const realtimeTables = realtimePublicationResult.rows.map((row) => row.tablename);
assert(realtimeTables.includes("duel_live_progress"), "Safe progress projection must be in Realtime.");
assert(!realtimeTables.includes("duel_players"), "Internal duel player state must not be in Realtime.");

await db.query(
  "update public.duel_matches set starts_at = clock_timestamp() - interval '31 seconds', ends_at = clock_timestamp() - interval '1 second' where id = $1",
  [duelCreated.match_id]
);
await db.query(
  "update public.duel_players set last_seen_at = clock_timestamp() where match_id = $1",
  [duelCreated.match_id]
);

const completedDuelResult = await db.query(
  "select public.get_duel_state($1) as payload",
  [duelCreated.match_id]
);
assert(completedDuelResult.rows[0].payload.status === "completed", "Expired duel must finalise.");

const duelSessionsResult = await db.query(
  "select * from public.game_sessions where duel_match_id = $1",
  [duelCreated.match_id]
);
assert(duelSessionsResult.rows.length === 2, "Completed duel must create two canonical player sessions.");

const soloStatsAfterDuel = await db.query(
  "select games_played from public.player_stats where player_id = $1",
  [PLAYER_ID]
);
assert(Number(soloStatsAfterDuel.rows[0].games_played) === 1, "Duel must not contaminate solo lifetime stats.");

const historyResult = await db.query(
  "select * from public.get_duel_match_history(1, 30)"
);
assert(historyResult.rows.length === 1, "Opponent-filtered private duel history must return the match.");

// Equal scores are a draw, including a legitimate 0-0 match.
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);
const drawCreateResult = await db.query(
  "select public.create_duel('history', 30, null) as payload"
);
const drawDuel = drawCreateResult.rows[0].payload;
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_TWO_ID]);
await db.query("select public.join_duel($1)", [drawDuel.room_code]);
await db.query(
  "update public.duel_matches set status = 'active', starts_at = clock_timestamp() - interval '31 seconds', ends_at = clock_timestamp() - interval '1 second' where id = $1",
  [drawDuel.match_id]
);
await db.query(
  "update public.duel_players set last_seen_at = clock_timestamp() where match_id = $1",
  [drawDuel.match_id]
);
const drawResult = await db.query(
  "select public.get_duel_state($1) as payload",
  [drawDuel.match_id]
);
assert(drawResult.rows[0].payload.result_reason === "draw", "Equal duel scores must produce a draw.");

// A player absent through the end-of-match heartbeat window forfeits.
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);
const forfeitCreateResult = await db.query(
  "select public.create_duel('gaming', 30, null) as payload"
);
const forfeitDuel = forfeitCreateResult.rows[0].payload;
await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_TWO_ID]);
await db.query("select public.join_duel($1)", [forfeitDuel.room_code]);
await db.query(
  "update public.duel_matches set status = 'active', starts_at = clock_timestamp() - interval '31 seconds', ends_at = clock_timestamp() - interval '1 second' where id = $1",
  [forfeitDuel.match_id]
);
await db.query(
  "update public.duel_players set last_seen_at = case when player_role = 'host' then clock_timestamp() - interval '20 seconds' else clock_timestamp() end where match_id = $1",
  [forfeitDuel.match_id]
);
const forfeitResult = await db.query(
  "select public.get_duel_state($1) as payload",
  [forfeitDuel.match_id]
);
assert(forfeitResult.rows[0].payload.result_reason === "forfeit", "Absent player must forfeit at timer end.");
assert(forfeitResult.rows[0].payload.self.outcome === "win", "Connected opponent must win a forfeit.");

const duelLeaderboardResult = await db.query("select * from public.get_duel_leaderboard(20)");
assert(duelLeaderboardResult.rows.length === 2, "Duel leaderboard must remain separate and include both players.");

console.log(
  JSON.stringify(
    {
      categories: categoryResult.rows.length,
      questions: 700,
      first_points: answer.points_awarded,
      pass_counted_incorrect: true,
      session_id: finished.session_id,
      canonical_history_rows: sessionResult.rows.length,
      player_stats_games: Number(statsResult.rows[0].games_played),
      legacy_score_rpc_closed: true,
      friends_flow: true,
      same_duel_question: true,
      opponent_correctness_private: true,
      duel_sessions: duelSessionsResult.rows.length,
      solo_stats_isolated: true,
      draw_rule: true,
      reconnect_forfeit_rule: true,
      duel_leaderboard_players: duelLeaderboardResult.rows.length
    },
    null,
    2
  )
);

await db.close();
