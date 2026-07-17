import {
  copyFileSync,
  existsSync,
  readdirSync,
  rmSync
} from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SQL_DIRECTORY = resolve(ROOT, "supabase", "sql");
const temporaryFiles = [];

for (const filename of readdirSync(SQL_DIRECTORY)) {
  if (!filename.endsWith(".sql")) {
    continue;
  }

  const source = resolve(SQL_DIRECTORY, filename);
  const target = resolve(ROOT, filename);

  if (existsSync(target)) {
    throw new Error(`Refusing to overwrite existing root file: ${filename}`);
  }

  copyFileSync(source, target);
  temporaryFiles.push(target);
}

try {
  await import("./database-smoke-test-core.mjs");
} finally {
  for (const filename of temporaryFiles) {
    rmSync(filename, { force: true });
  }
}
