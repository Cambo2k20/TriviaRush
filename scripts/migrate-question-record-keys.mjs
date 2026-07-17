import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BANK_PATH = resolve(ROOT, "data", "questions.json");
const bank = JSON.parse(readFileSync(BANK_PATH, "utf8"));

if (!Array.isArray(bank.categories)) {
  throw new Error("data/questions.json must contain the category manifest first.");
}

let changedFiles = 0;
let migratedQuestions = 0;

for (const category of bank.categories) {
  if (category.status !== "active") {
    continue;
  }

  const path = resolve(ROOT, "data", "categories", category.id + ".json");
  const records = JSON.parse(readFileSync(path, "utf8"));
  let changed = false;

  const migrated = records.map((record, index) => {
    if (!Array.isArray(record)) {
      throw new Error(category.id + " question " + (index + 1) + " is not an array.");
    }

    if (record.length === 7) {
      return record;
    }

    if (record.length !== 6) {
      throw new Error(
        category.id + " question " + (index + 1) +
          " must have either the legacy six fields or the keyed seven fields."
      );
    }

    changed = true;
    migratedQuestions += 1;

    return [
      category.id + "-" + String(index + 1).padStart(3, "0"),
      ...record
    ];
  });

  if (changed) {
    writeFileSync(path, JSON.stringify(migrated, null, 2) + "\n", "utf8");
    changedFiles += 1;
  }
}

console.log(
  JSON.stringify(
    {
      changed_files: changedFiles,
      migrated_questions: migratedQuestions
    },
    null,
    2
  )
);
