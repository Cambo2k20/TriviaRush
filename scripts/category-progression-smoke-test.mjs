import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const db = new PGlite();
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, "data", "questions.json"), "utf8")
);

const PLAYER_ID = "11111111-1111-4111-8111-111111111111";
const OPPONENT_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ONE = "30000000-0000-4000-8000-000000000001";
const RUN_TWO = "30000000-0000-4000-8000-000000000002";
const SESSION_ONE = "40000000-0000-4000-8000-000000000001";
const SESSION_TWO = "40000000-0000-4000-8000-000000000002";
const LIVE_MATCH = "50000000-0000-4000-8000-000000000001";
const TURN_MATCH = "50000000-0000-4000-8000-000000000002";

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
  "create table public.question_categories (",
  "  id text primary key,",
  "  label text not null,",
  "  sort_order integer not null,",
  "  icon_key text not null,",
  "  color text not null,",
  "  is_active boolean not null default true",
  ");",
  "create table public.trivia_questions (",
  "  id bigint primary key,",
  "  category_id text not null references public.question_categories(id),",
  "  difficulty text not null,",
  "  is_active boolean not null default true",
  ");",
  "create table public.game_sessions (",
  "  id uuid primary key,",
  "  player_id uuid not null references public.profiles(id)",
  ");",
  "create table public.game_runs (",
  "  id uuid primary key,",
  "  player_id uuid not null references public.profiles(id),",
  "  status text not null,",
  "  completed_session_id uuid null references public.game_sessions(id)",
  ");",
  "create table public.game_run_answers (",
  "  run_id uuid not null references public.game_runs(id),",
  "  position integer not null,",
  "  question_id bigint not null references public.trivia_questions(id),",
  "  is_correct boolean not null,",
  "  primary key (run_id, position)",
  ");",
  "create table public.duel_matches (",
  "  id uuid primary key,",
  "  host_id uuid not null references public.profiles(id),",
  "  guest_id uuid null references public.profiles(id),",
  "  match_format text not null default 'live',",
  "  status text not null",
  ");",
  "create table public.duel_players (",
  "  match_id uuid not null references public.duel_matches(id),",
  "  player_id uuid not null references public.profiles(id),",
  "  primary key (match_id, player_id)",
  ");",
  "create table public.duel_answers (",
  "  id uuid primary key default gen_random_uuid(),",
  "  match_id uuid not null,",
  "  player_id uuid not null,",
  "  position integer not null,",
  "  question_id bigint not null references public.trivia_questions(id),",
  "  is_correct boolean not null,",
  "  foreign key (match_id, player_id)",
  "    references public.duel_players(match_id, player_id)",
  ");"
].join("\n"));

await db.exec(
  readFileSync(
    resolve(ROOT, "supabase/sql/phase-5-category-levelling.sql"),
    "utf8"
  )
);

const thresholds = await db.query(
  "select level, cumulative_xp from public.category_level_thresholds order by level"
);
assert(thresholds.rows.length === 50, "Category progression must seed 50 levels.");
assert(Number(thresholds.rows[0].cumulative_xp) === 0, "Level 1 must start at zero XP.");
assert(Number(thresholds.rows[4].cumulative_xp) === 1000, "Level 5 must start at 1,000 XP.");
assert(Number(thresholds.rows[49].cumulative_xp) === 122500, "Level 50 must start at 122,500 XP.");

await db.query(
  [
    "insert into public.profiles (id, display_name, account_number) values",
    "  ($1, 'Category Tester', 1001),",
    "  ($2, 'Opponent', 1002)"
  ].join("\n"),
  [PLAYER_ID, OPPONENT_ID]
);

for (const category of manifest.categories) {
  await db.query(
    "insert into public.question_categories (id, label, sort_order, icon_key, color) values ($1, $2, $3, $4, $5)",
    [category.id, category.label, category.sort_order, category.icon_key, category.color]
  );
}

await db.exec([
  "insert into public.trivia_questions (id, category_id, difficulty) values",
  "  (1, 'science', 'easy'),",
  "  (2, 'science', 'medium'),",
  "  (3, 'history', 'hard');"
].join("\n"));

await db.query(
  "insert into public.game_sessions (id, player_id) values ($1, $3), ($2, $3)",
  [SESSION_ONE, SESSION_TWO, PLAYER_ID]
);

await db.query(
  "insert into public.game_runs (id, player_id, status) values ($1, $2, 'active')",
  [RUN_ONE, PLAYER_ID]
);

await db.query(
  [
    "insert into public.game_run_answers (run_id, position, question_id, is_correct) values",
    "  ($1, 1, 1, true),",
    "  ($1, 2, 2, false),",
    "  ($1, 3, 3, true)"
  ].join("\n"),
  [RUN_ONE]
);

await db.query(
  "update public.game_runs set status = 'completed', completed_session_id = $2 where id = $1",
  [RUN_ONE, SESSION_ONE]
);

let progressRows = await db.query(
  [
    "select category_id, xp, level, questions_answered, correct_answers,",
    "       incorrect_answers, solo_questions, duel_questions",
    "from public.player_category_progress",
    "where player_id = $1",
    "order by category_id"
  ].join("\n"),
  [PLAYER_ID]
);

const firstScience = progressRows.rows.find((row) => row.category_id === "science");
const firstHistory = progressRows.rows.find((row) => row.category_id === "history");
assert(Number(firstScience?.xp) === 10, "Science must receive 10 XP for one Easy correct answer.");
assert(Number(firstScience?.questions_answered) === 2, "Incorrect answers must still update Science activity.");
assert(Number(firstScience?.correct_answers) === 1, "Science correct count must be trusted.");
assert(Number(firstScience?.incorrect_answers) === 1, "Science incorrect count must include the wrong answer.");
assert(Number(firstHistory?.xp) === 25, "History must receive 25 XP for one Hard correct answer.");
assert(Number(firstHistory?.solo_questions) === 1, "Solo activity must be tracked separately.");

const replay = await db.query(
  "select trivia_private.award_solo_category_progress($1) as payload",
  [RUN_ONE]
);
assert(replay.rows[0].payload.status === "credited", "A solo retry must remain readable.");

const awardCountAfterReplay = await db.query(
  "select count(*)::integer as count from public.category_xp_awards where source_id = $1",
  [RUN_ONE]
);
assert(awardCountAfterReplay.rows[0].count === 3, "A solo retry must not duplicate per-answer awards.");

await db.query(
  "insert into public.game_runs (id, player_id, status) values ($1, $2, 'active')",
  [RUN_TWO, PLAYER_ID]
);

await db.query(
  [
    "insert into public.game_run_answers (run_id, position, question_id, is_correct)",
    "select $1, position, 1, true",
    "from generate_series(1, 9) positions(position)"
  ].join("\n"),
  [RUN_TWO]
);

await db.query(
  "update public.game_runs set status = 'completed', completed_session_id = $2 where id = $1",
  [RUN_TWO, SESSION_TWO]
);

const scienceLevel = await db.query(
  "select xp, level from public.player_category_progress where player_id = $1 and category_id = 'science'",
  [PLAYER_ID]
);
assert(Number(scienceLevel.rows[0].xp) === 100, "Ten Easy correct answers must total 100 Science XP.");
assert(Number(scienceLevel.rows[0].level) === 2, "100 Science XP must reach category level 2.");

await db.query(
  [
    "insert into public.duel_matches (id, host_id, guest_id, match_format, status) values",
    "  ($1, $3, $4, 'live', 'active'),",
    "  ($2, $3, $4, 'turn_based', 'active')"
  ].join("\n"),
  [LIVE_MATCH, TURN_MATCH, PLAYER_ID, OPPONENT_ID]
);

await db.query(
  [
    "insert into public.duel_players (match_id, player_id) values",
    "  ($1, $3), ($1, $4),",
    "  ($2, $3), ($2, $4)"
  ].join("\n"),
  [LIVE_MATCH, TURN_MATCH, PLAYER_ID, OPPONENT_ID]
);

await db.query(
  [
    "insert into public.duel_answers (match_id, player_id, position, question_id, is_correct) values",
    "  ($1, $3, 1, 3, true),",
    "  ($1, $4, 1, 1, false),",
    "  ($2, $3, 1, 2, true),",
    "  ($2, $4, 1, 3, true)"
  ].join("\n"),
  [LIVE_MATCH, TURN_MATCH, PLAYER_ID, OPPONENT_ID]
);

await db.query(
  "update public.duel_matches set status = 'completed' where id in ($1, $2)",
  [LIVE_MATCH, TURN_MATCH]
);

const sourceKinds = await db.query(
  [
    "select source_kind, count(*)::integer as count",
    "from public.category_xp_awards",
    "where source_id in ($1, $2)",
    "group by source_kind",
    "order by source_kind"
  ].join("\n"),
  [LIVE_MATCH, TURN_MATCH]
);
assert(
  sourceKinds.rows.some((row) => row.source_kind === "live_duel" && row.count === 2),
  "Live duel answers must use the live_duel source."
);
assert(
  sourceKinds.rows.some((row) => row.source_kind === "turn_based" && row.count === 2),
  "Turn-based answers must use the turn_based source."
);

await db.query("select set_config('request.jwt.claim.sub', $1, false)", [PLAYER_ID]);

const myProgress = await db.query(
  "select public.get_my_category_progression() as payload"
);
assert(
  myProgress.rows[0].payload.categories.length === 14,
  "Progression RPC must return all 14 manifest categories."
);
assert(
  ["game_of_thrones", "mythology", "harry_potter", "marvel_cinematic_universe"].every(
    (categoryId) => myProgress.rows[0].payload.categories.some(
      (category) => category.category_id === categoryId && category.level === 1
    )
  ),
  "New categories must appear in progression before their first answer."
);
const science = myProgress.rows[0].payload.categories.find(
  (category) => category.category_id === "science"
);
const history = myProgress.rows[0].payload.categories.find(
  (category) => category.category_id === "history"
);
assert(science.level === 2, "Read RPC must return the trusted Science level.");
assert(science.xp === 115, "Read RPC must include solo and turn-based Science XP.");
assert(history.xp === 50, "Read RPC must include solo and live-duel History XP.");
assert(science.questions_answered === 12, "Read RPC must include all trusted Science answers.");
assert(science.accuracy_percent > 90, "Read RPC must calculate Science accuracy from trusted totals.");

const soloSummary = await db.query(
  "select public.get_solo_category_xp_summary($1) as payload",
  [RUN_TWO]
);
assert(soloSummary.rows[0].payload.status === "credited", "Solo category summary must be credited.");
assert(soloSummary.rows[0].payload.total_xp_awarded === 90, "Solo summary must expose exact category XP.");
assert(soloSummary.rows[0].payload.categories[0].level_after === 2, "Solo summary must report the level-up.");

const duelSummary = await db.query(
  "select public.get_duel_category_xp_summary($1) as payload",
  [LIVE_MATCH]
);
assert(duelSummary.rows[0].payload.status === "credited", "Duel category summary must be credited.");
assert(duelSummary.rows[0].payload.total_xp_awarded === 25, "Duel summary must expose only the caller's XP.");

const privileges = await db.query([
  "select",
  "  has_table_privilege('authenticated', 'public.player_category_progress', 'SELECT') as direct_read,",
  "  has_table_privilege('authenticated', 'public.category_xp_awards', 'INSERT') as direct_write,",
  "  has_function_privilege('authenticated', 'public.get_my_category_progression()', 'EXECUTE') as can_read_rpc,",
  "  has_function_privilege(",
  "    'authenticated',",
  "    'trivia_private.record_category_answer_progress(uuid,text,uuid,text,text,text,boolean)',",
  "    'EXECUTE'",
  "  ) as can_award"
].join("\n"));

assert(privileges.rows[0].direct_read === false, "Browser roles must not read category tables directly.");
assert(privileges.rows[0].direct_write === false, "Browser roles must not write category awards directly.");
assert(privileges.rows[0].can_read_rpc === true, "Authenticated players must read their own category progression.");
assert(privileges.rows[0].can_award === false, "Browser roles must not call the private category award writer.");

console.log(
  JSON.stringify(
    {
      thresholds: thresholds.rows.length,
      science_xp: science.xp,
      science_level: science.level,
      history_xp: history.xp,
      solo_summary_xp: soloSummary.rows[0].payload.total_xp_awarded,
      duel_summary_xp: duelSummary.rows[0].payload.total_xp_awarded,
      idempotent_answer_awards: true,
      browser_write_blocked: true
    },
    null,
    2
  )
);

await db.close();
