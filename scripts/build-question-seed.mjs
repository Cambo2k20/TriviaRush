import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INPUT = resolve(ROOT, "data", "questions.json");
const OUTPUT = resolve(ROOT, "phase-4a-question-seed.sql");

const CATEGORY_ORDER = [
  "science",
  "history",
  "geography",
  "entertainment",
  "sport",
  "technology",
  "gaming"
];

const EXPECTED_DIFFICULTY = {
  easy: 40,
  medium: 40,
  hard: 20
};

const bank = JSON.parse(readFileSync(INPUT, "utf8"));

assertBankShape();

const questions = CATEGORY_ORDER.flatMap((category) => {
  const records = JSON.parse(
    readFileSync(resolve(ROOT, "data", "categories", category + ".json"), "utf8")
  );

  assert(Array.isArray(records), category + ": category file must contain an array.");

  return records.map((record, categoryIndex) => {
    assert(
      Array.isArray(record) && record.length === 6,
      category + " question " + (categoryIndex + 1) +
        " must contain difficulty, question, answer, two distractors and source key."
    );

    const [difficulty, question, answer, distractorOne, distractorTwo, sourceKey] = record;
    const source = bank.sources[sourceKey];
    assert(source, category + " question " + (categoryIndex + 1) + ": unknown source " + sourceKey + ".");

    return {
      key: category + "-" + String(categoryIndex + 1).padStart(3, "0"),
      category,
      difficulty,
      question,
      answer,
      distractors: [distractorOne, distractorTwo],
      source_name: source.name,
      source_url: source.url,
      verified_at: bank.verified_at
    };
  });
});

function assertBankShape() {
  assert(bank && typeof bank === "object", "questions.json must contain an object.");
  assert(bank.sources && typeof bank.sources === "object", "A source registry is required.");
  assert(
    typeof bank.verified_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bank.verified_at),
    "verified_at must use YYYY-MM-DD."
  );

  for (const [sourceKey, source] of Object.entries(bank.sources)) {
    assert(source && typeof source.name === "string", sourceKey + ": source name is required.");
    assert(
      typeof source.url === "string" && source.url.startsWith("https://"),
      sourceKey + ": source URL must use HTTPS."
    );
  }

}

function normalise(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sqlString(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function orderedAnswers(question, correctIndex) {
  const distractors = [...question.distractors];
  const answers = [];
  let distractorIndex = 0;

  for (let index = 0; index < 3; index += 1) {
    if (index === correctIndex) {
      answers.push(question.answer);
    } else {
      answers.push(distractors[distractorIndex]);
      distractorIndex += 1;
    }
  }

  return answers;
}

assert(
  questions.length === 700,
  "Expected 700 questions, found " + questions.length + "."
);

const keys = new Set();
const prompts = new Set();
const positionCounts = [0, 0, 0];
const categoryCounts = new Map();
const difficultyCounts = new Map();

const prepared = questions.map((question, globalIndex) => {
  const requiredStrings = [
    "key",
    "category",
    "difficulty",
    "question",
    "answer",
    "source_name",
    "source_url",
    "verified_at"
  ];

  for (const field of requiredStrings) {
    assert(
      typeof question[field] === "string" && question[field].trim(),
      "Question " + (globalIndex + 1) + " has an invalid " + field + "."
    );
  }

  assert(
    CATEGORY_ORDER.includes(question.category),
    question.key + ": unknown category " + question.category + "."
  );
  assert(
    Object.hasOwn(EXPECTED_DIFFICULTY, question.difficulty),
    question.key + ": unknown difficulty " + question.difficulty + "."
  );
  assert(
    Array.isArray(question.distractors) && question.distractors.length === 2,
    question.key + ": exactly two distractors are required."
  );
  assert(
    question.source_url.startsWith("https://"),
    question.key + ": source_url must use HTTPS."
  );

  const key = normalise(question.key);
  const prompt = normalise(question.question);
  assert(!keys.has(key), question.key + ": duplicate key.");
  assert(!prompts.has(prompt), question.key + ": duplicate question text.");
  keys.add(key);
  prompts.add(prompt);

  const answerSet = new Set(
    [question.answer, ...question.distractors].map(normalise)
  );
  assert(answerSet.size === 3, question.key + ": answers must be distinct.");

  const correctIndex = globalIndex % 3;
  positionCounts[correctIndex] += 1;

  categoryCounts.set(
    question.category,
    (categoryCounts.get(question.category) || 0) + 1
  );

  const difficultyKey = question.category + ":" + question.difficulty;
  difficultyCounts.set(
    difficultyKey,
    (difficultyCounts.get(difficultyKey) || 0) + 1
  );

  return {
    ...question,
    correct_index: correctIndex,
    answers: orderedAnswers(question, correctIndex)
  };
});

for (const category of CATEGORY_ORDER) {
  assert(
    categoryCounts.get(category) === 100,
    category + ": expected 100 questions, found " +
      (categoryCounts.get(category) || 0) + "."
  );

  for (const [difficulty, expected] of Object.entries(EXPECTED_DIFFICULTY)) {
    const actual = difficultyCounts.get(category + ":" + difficulty) || 0;
    assert(
      actual === expected,
      category + "/" + difficulty + ": expected " + expected +
        ", found " + actual + "."
    );
  }
}

assert(
  positionCounts.join(",") === "234,233,233",
  "Correct answer positions are not balanced: " + positionCounts.join(",") + "."
);

const rows = prepared.map((question) => {
  const answersJson = JSON.stringify(question.answers);

  return [
    "  (",
    "    " + sqlString(question.key) + ",",
    "    " + sqlString(question.category) + ",",
    "    " + sqlString(question.difficulty) + ",",
    "    " + sqlString(question.question) + ",",
    "    " + sqlString(answersJson) + "::jsonb,",
    "    " + question.correct_index + ",",
    "    " + sqlString(question.source_name) + ",",
    "    " + sqlString(question.source_url) + ",",
    "    " + sqlString(question.verified_at) + "::date,",
    "    true",
    "  )"
  ].join("\n");
});

const sql = [
  "-- Trivia Rush Phase 4A verified 700-question seed",
  "-- Generated by scripts/build-question-seed.mjs. Do not edit this SQL by hand.",
  "",
  "begin;",
  "",
  "do $$",
  "begin",
  "  if to_regclass('public.trivia_questions') is null then",
  "    raise exception 'Run phase-4a-question-platform.sql before this seed.';",
  "  end if;",
  "end;",
  "$$;",
  "",
  "insert into public.trivia_questions (",
  "  question_key,",
  "  category_id,",
  "  difficulty,",
  "  question_text,",
  "  answers,",
  "  correct_index,",
  "  source_name,",
  "  source_url,",
  "  verified_at,",
  "  is_active",
  ")",
  "values",
  rows.join(",\n"),
  "on conflict (question_key) do update",
  "set",
  "  category_id = excluded.category_id,",
  "  difficulty = excluded.difficulty,",
  "  question_text = excluded.question_text,",
  "  answers = excluded.answers,",
  "  correct_index = excluded.correct_index,",
  "  source_name = excluded.source_name,",
  "  source_url = excluded.source_url,",
  "  verified_at = excluded.verified_at,",
  "  is_active = excluded.is_active,",
  "  updated_at = now();",
  "",
  "do $$",
  "declare",
  "  v_total integer;",
  "begin",
  "  select count(*)::integer",
  "  into v_total",
  "  from public.trivia_questions",
  "  where is_active;",
  "",
  "  if v_total <> 700 then",
  "    raise exception 'Expected exactly 700 active questions after seed, found %.', v_total;",
  "  end if;",
  "end;",
  "$$;",
  "",
  "commit;",
  "",
  "notify pgrst, 'reload schema';",
  ""
].join("\n");

writeFileSync(OUTPUT, sql, "utf8");

console.log(
  JSON.stringify(
    {
      questions: prepared.length,
      categories: Object.fromEntries(categoryCounts),
      correct_positions: positionCounts,
      output: OUTPUT
    },
    null,
    2
  )
);
