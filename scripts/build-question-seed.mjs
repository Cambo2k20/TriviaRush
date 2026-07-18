import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GENERATED_OUTPUT = resolve(ROOT, "phase-5-question-seed.sql");
const GENERATED_VERIFICATION = resolve(ROOT, "phase-5-category-verification.sql");
const SQL_DIRECTORY = resolve(ROOT, "supabase", "sql");
const STORED_OUTPUT = resolve(SQL_DIRECTORY, "phase-5-question-seed.sql");
const STORED_VERIFICATION = resolve(SQL_DIRECTORY, "phase-5-category-verification.sql");
const LOCAL_SEED = resolve(ROOT, "supabase", "seed.sql");
const LOCAL_REFERENCE_SEED = `-- Sanitized local reference data. No production users, sessions or progression rows.\n\ninsert into public.game_modes (\n  mode, label, duration_seconds, max_questions, max_points_per_question, is_active, mode_family\n)\nvalues\n  ('rush_60', '60 Second Rush', 60, 80, 600, true, 'solo'),\n  ('duel_30', '30 Second Duel', 30, 40, 600, true, 'duel'),\n  ('duel_60', '60 Second Duel', 60, 80, 600, true, 'duel'),\n  ('duel_90', '90 Second Duel', 90, 100, 600, true, 'duel')\non conflict (mode) do update set\n  label = excluded.label,\n  duration_seconds = excluded.duration_seconds,\n  max_questions = excluded.max_questions,\n  max_points_per_question = excluded.max_points_per_question,\n  is_active = excluded.is_active,\n  mode_family = excluded.mode_family;\n\ninsert into public.global_level_thresholds (level, cumulative_xp)\nselect level_number::smallint, (50::bigint * (level_number - 1) * level_number)::bigint\nfrom generate_series(1, 50) as levels(level_number)\non conflict (level) do update set cumulative_xp = excluded.cumulative_xp;\n\ninsert into public.category_level_thresholds (level, cumulative_xp)\nselect level_number::smallint, (50::bigint * (level_number - 1) * level_number)::bigint\nfrom generate_series(1, 50) as levels(level_number)\non conflict (level) do update set cumulative_xp = excluded.cumulative_xp;\n\n`;

try {
  await import("./build-question-seed-core.mjs");

  if (process.argv.includes("--write") && existsSync(GENERATED_OUTPUT)) {
    mkdirSync(SQL_DIRECTORY, { recursive: true });
    rmSync(STORED_OUTPUT, { force: true });
    renameSync(GENERATED_OUTPUT, STORED_OUTPUT);
    writeFileSync(
      LOCAL_SEED,
      LOCAL_REFERENCE_SEED + readFileSync(STORED_OUTPUT, "utf8"),
      "utf8"
    );
    rmSync(STORED_VERIFICATION, { force: true });
    renameSync(GENERATED_VERIFICATION, STORED_VERIFICATION);
  }
} finally {
  rmSync(GENERATED_OUTPUT, { force: true });
  rmSync(GENERATED_VERIFICATION, { force: true });
}
