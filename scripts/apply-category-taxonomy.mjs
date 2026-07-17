import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "data");
const BANK_PATH = resolve(DATA, "questions.json");
const DIFFICULTY_ORDER = new Map([
  ["easy", 0],
  ["medium", 1],
  ["hard", 2]
]);

const moves = new Map([
  [
    "art_literature",
    new Set([
      "entertainment-006",
      "entertainment-007",
      "entertainment-009",
      "entertainment-010",
      "entertainment-011",
      "entertainment-012",
      "entertainment-013",
      "entertainment-014",
      "entertainment-015",
      "entertainment-016",
      "entertainment-017",
      "entertainment-018",
      "entertainment-019",
      "entertainment-020",
      "entertainment-041",
      "entertainment-042",
      "entertainment-043",
      "entertainment-044",
      "entertainment-045",
      "entertainment-046",
      "entertainment-047",
      "entertainment-048",
      "entertainment-049",
      "entertainment-050",
      "entertainment-081",
      "entertainment-082",
      "entertainment-083",
      "entertainment-084",
      "entertainment-085"
    ])
  ],
  ["nature_animals", new Set(["science-039"])]
]);

const bank = JSON.parse(readFileSync(BANK_PATH, "utf8"));
const categoryIds = bank.categories.map((category) => category.id);
const recordsByCategory = new Map();

for (const categoryId of categoryIds) {
  const path = resolve(DATA, "categories", categoryId + ".json");

  try {
    recordsByCategory.set(categoryId, JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      recordsByCategory.set(categoryId, []);
    } else {
      throw error;
    }
  }
}

const destinationByKey = new Map();

for (const [destination, keys] of moves) {
  for (const key of keys) {
    if (destinationByKey.has(key)) {
      throw new Error(key + ": listed in more than one taxonomy destination.");
    }

    destinationByKey.set(key, destination);
  }
}

const foundMoves = new Set();
const nextRecords = new Map(categoryIds.map((categoryId) => [categoryId, []]));

for (const [currentCategory, records] of recordsByCategory) {
  for (const record of records) {
    const key = record[0];
    const destination = destinationByKey.get(key) || currentCategory;

    if (destinationByKey.has(key)) {
      foundMoves.add(key);
    }

    nextRecords.get(destination).push(record);
  }
}

for (const key of destinationByKey.keys()) {
  if (!foundMoves.has(key)) {
    throw new Error(key + ": taxonomy move key was not found in any category file.");
  }
}

for (const [categoryId, records] of nextRecords) {
  records.sort((left, right) => {
    const difficulty = DIFFICULTY_ORDER.get(left[1]) - DIFFICULTY_ORDER.get(right[1]);
    return difficulty || left[0].localeCompare(right[0]);
  });

  const path = resolve(DATA, "categories", categoryId + ".json");
  writeFileSync(path, JSON.stringify(records, null, 2) + "\n", "utf8");
}

console.log(
  JSON.stringify(
    {
      moved_questions: destinationByKey.size,
      categories: Object.fromEntries(
        [...nextRecords].map(([categoryId, records]) => [categoryId, records.length])
      )
    },
    null,
    2
  )
);
