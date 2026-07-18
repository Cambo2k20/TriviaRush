import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(import.meta.dirname, "..");
const MIGRATION = resolve(
  ROOT,
  "supabase",
  "migrations",
  "20260718172854_remote_schema_baseline.sql"
);
const SEED = resolve(ROOT, "supabase", "seed.sql");
const db = new PGlite();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    is_anonymous boolean not null default false,
    email text
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create publication supabase_realtime;
`);

await db.exec(readFileSync(MIGRATION, "utf8"));
await db.exec(readFileSync(SEED, "utf8"));

const counts = await db.query(`
  select
    (select count(*)::integer from public.question_categories where is_active) as categories,
    (select count(*)::integer from public.trivia_questions where is_active) as questions,
    (select count(*)::integer from public.game_modes where is_active) as game_modes,
    (select count(*)::integer from public.global_level_thresholds) as global_levels,
    (select count(*)::integer from public.category_level_thresholds) as category_levels,
    (select count(*)::integer from auth.users) as users,
    (select count(*)::integer from public.game_sessions) as sessions,
    (select count(*)::integer from public.player_global_progress) as global_progress,
    (select count(*)::integer from public.player_category_progress) as category_progress
`);
const row = counts.rows[0];

assert(row.categories === 14, "Local baseline must seed 14 active categories.");
assert(row.questions === 1400, "Local baseline must seed 1,400 active questions.");
assert(row.game_modes === 4, "Local baseline must seed four active game modes.");
assert(row.global_levels === 50, "Local baseline must seed 50 global levels.");
assert(row.category_levels === 50, "Local baseline must seed 50 category levels.");
assert(row.users === 0, "Local seed must not contain production users.");
assert(row.sessions === 0, "Local seed must not contain production sessions.");
assert(row.global_progress === 0, "Local seed must not contain global progression.");
assert(row.category_progress === 0, "Local seed must not contain category progression.");

const legacyKeys = await db.query(`
  select count(*)::integer as count
  from public.trivia_questions
  where question_key ~ '^(got|myth|hp|mcu)_[0-9]{3}$'
`);
assert(legacyKeys.rows[0].count === 400, "Local seed must preserve all 400 legacy keys.");

const categoryRpc = await db.query("select * from public.get_question_categories()");
assert(categoryRpc.rows.length === 14, "Category RPC must return all 14 categories after reset.");
assert(
  categoryRpc.rows.every((category) => category.icon_key && category.color),
  "Category RPC metadata must include icon and color values."
);

for (const categoryId of [
  "game_of_thrones",
  "mythology",
  "harry_potter",
  "marvel_cinematic_universe"
]) {
  await db.query(
    "select * from public.get_leaderboard_v2('all'::text, $1::text, 5)",
    [categoryId]
  );
}

console.log(JSON.stringify({ status: "passed", ...row, legacy_keys: 400 }, null, 2));
