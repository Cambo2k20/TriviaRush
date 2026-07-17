import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GENERATED_OUTPUT = resolve(ROOT, "phase-5-question-seed.sql");
const SQL_DIRECTORY = resolve(ROOT, "supabase", "sql");
const STORED_OUTPUT = resolve(SQL_DIRECTORY, "phase-5-question-seed.sql");

try {
  await import("./build-question-seed-core.mjs");

  if (process.argv.includes("--write") && existsSync(GENERATED_OUTPUT)) {
    mkdirSync(SQL_DIRECTORY, { recursive: true });
    rmSync(STORED_OUTPUT, { force: true });
    renameSync(GENERATED_OUTPUT, STORED_OUTPUT);
  }
} finally {
  rmSync(GENERATED_OUTPUT, { force: true });
}
