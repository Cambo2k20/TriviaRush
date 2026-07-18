import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "data", "questions.json"), "utf8"));
const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "did", "do", "does", "for", "from",
  "how", "in", "is", "it", "name", "of", "on", "the", "to", "was", "what",
  "when", "where", "which", "who", "whose"
]);
const AMBIGUITY_TERMS = [
  /\bmain\b/i,
  /\bmost\b/i,
  /\bonly\b/i,
  /\bprimarily\b/i,
  /\bfirst\b/i,
  /\bcommonly\b/i,
  /\btypically\b/i,
  /\bknown as\b/i
];
const SENSITIVITY_TERMS = [
  /\bdeath|dies|died|killed|murder|suicide\b/i,
  /\breligion|god|goddess|deity|sacred\b/i,
  /\bwar|battle|invasion|conquest\b/i,
  /\brace|ethnic|nationality|gender|sexual\b/i
];
const OVERLAP_RULES = [
  { category: "game_of_thrones", pattern: /game of thrones|westeros|targaryen|stark|lannister/i },
  { category: "harry_potter", pattern: /harry potter|hogwarts|dumbledore|voldemort/i },
  { category: "marvel_cinematic_universe", pattern: /marvel cinematic|iron man|tony stark|avengers|thanos/i },
  { category: "mythology", pattern: /mythology|mythological|zeus|odin|\bra\b|\bthor\b/i }
];
const GENERAL_CATEGORIES = new Set([
  "science",
  "history",
  "geography",
  "sports",
  "entertainment",
  "technology",
  "literature",
  "art",
  "nature",
  "food"
]);

function normalise(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalise(value).split(" ").filter((token) => token && !STOP_WORDS.has(token)));
}

function jaccard(left, right) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function isBroadSource(url) {
  const parsed = new URL(url);
  return parsed.pathname === "/" || parsed.pathname === "";
}

const questions = manifest.categories.flatMap((category) => {
  const records = JSON.parse(
    readFileSync(resolve(ROOT, "data", "categories", category.id + ".json"), "utf8")
  );
  return records.map((record) => ({
    key: record[0],
    category: category.id,
    difficulty: record[1],
    question: record[2],
    answer: record[3],
    distractors: [record[4], record[5]],
    sourceKey: record[6],
    questionTokens: tokens(record[2])
  }));
});

const keyHashResults = {};
for (const [category, expectedHash] of Object.entries(manifest.frozen_key_hashes || {})) {
  const keys = questions
    .filter((question) => question.category === category)
    .map((question) => question.key)
    .sort();
  const actualHash = md5(keys.join(","));
  keyHashResults[category] = {
    count: keys.length,
    expected: expectedHash,
    actual: actualHash,
    matches: actualHash === expectedHash
  };
}

const semanticDuplicates = [];
const inversePairs = [];
for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
  const left = questions[leftIndex];
  for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
    const right = questions[rightIndex];
    const sameAnswer = normalise(left.answer) === normalise(right.answer);
    const similarity = sameAnswer ? jaccard(left.questionTokens, right.questionTokens) : 0;
    if (sameAnswer && similarity >= 0.7) {
      semanticDuplicates.push({ left: left.key, right: right.key, similarity });
    }

    const leftAnswer = normalise(left.answer);
    const rightAnswer = normalise(right.answer);
    const leftPrompt = normalise(left.question);
    const rightPrompt = normalise(right.question);
    if (
      leftAnswer.length >= 4 &&
      rightAnswer.length >= 4 &&
      left.category !== right.category &&
      rightPrompt.includes(leftAnswer) &&
      leftPrompt.includes(rightAnswer)
    ) {
      inversePairs.push({ left: left.key, right: right.key });
    }
  }
}

const ambiguityFlags = questions
  .filter((question) => AMBIGUITY_TERMS.some((pattern) => pattern.test(question.question)))
  .map((question) => question.key);
const sensitivityFlags = questions
  .filter((question) => SENSITIVITY_TERMS.some((pattern) => pattern.test(question.question)))
  .map((question) => question.key);
const taxonomyOverlap = questions.flatMap((question) =>
  GENERAL_CATEGORIES.has(question.category) ? OVERLAP_RULES
    .filter((rule) => rule.category !== question.category && rule.pattern.test(question.question))
    .map((rule) => ({ key: question.key, current: question.category, candidate: rule.category }))
    : []
);
const broadSources = Object.entries(manifest.sources)
  .filter(([, source]) => isBroadSource(source.url))
  .map(([sourceKey, source]) => ({ source_key: sourceKey, url: source.url }));

const blockers = [
  ...Object.entries(keyHashResults)
    .filter(([, result]) => !result.matches)
    .map(([category]) => `Frozen key hash changed for ${category}`),
  ...semanticDuplicates.map((pair) => `Semantic duplicate candidate: ${pair.left}/${pair.right}`),
  ...inversePairs.map((pair) => `Inverse fact pair: ${pair.left}/${pair.right}`)
];

const report = {
  questions: questions.length,
  categories: manifest.categories.length,
  frozen_key_hashes: keyHashResults,
  blockers,
  manual_review: {
    ambiguity_flags: ambiguityFlags,
    sensitivity_flags: sensitivityFlags,
    taxonomy_overlap: taxonomyOverlap,
    broad_sources: broadSources
  }
};

const serializedReport = JSON.stringify(report, null, 2) + "\n";
const outputArgIndex = process.argv.indexOf("--output");
if (outputArgIndex !== -1) {
  const outputPath = process.argv[outputArgIndex + 1];
  if (!outputPath) {
    throw new Error("--output requires a file path");
  }
  writeFileSync(resolve(outputPath), serializedReport, "utf8");
}

console.log(serializedReport.trimEnd());
if (blockers.length > 0) {
  process.exitCode = 1;
}
