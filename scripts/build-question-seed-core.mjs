import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INPUT = resolve(ROOT, "data", "questions.json");
const OUTPUT = resolve(ROOT, "phase-5-question-seed.sql");
const WRITE_OUTPUT = process.argv.includes("--write");
const ALLOWED_STATUSES = new Set(["active", "planned"]);
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const bank = JSON.parse(readFileSync(INPUT, "utf8"));
const categories = validateBankAndCategories();
const activeCategories = categories.filter((category) => category.status === "active");
const activeCategoryIds = new Set(activeCategories.map((category) => category.id));

const questions = activeCategories.flatMap((category) => {
  const records = JSON.parse(
    readFileSync(
      resolve(ROOT, "data", "categories", category.id + ".json"),
      "utf8"
    )
  );

  assert(Array.isArray(records), category.id + ": category file must contain an array.");

  return records.map((record, categoryIndex) => {
    assert(
      Array.isArray(record) && record.length === 7,
      category.id + " question " + (categoryIndex + 1) +
        " must contain a stable key, difficulty, question, answer, two distractors and source key."
    );

    const [
      key,
      difficulty,
      question,
      answer,
      distractorOne,
      distractorTwo,
      sourceKey
    ] = record;
    const source = bank.sources[sourceKey];

    assert(
      source,
      category.id + " question " + (categoryIndex + 1) +
        ": unknown source " + sourceKey + "."
    );

    return {
      key,
      category: category.id,
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

function validateBankAndCategories() {
  assert(bank && typeof bank === "object", "questions.json must contain an object.");
  assert(bank.sources && typeof bank.sources === "object", "A source registry is required.");
  assert(Array.isArray(bank.categories), "A category manifest array is required.");
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

  const ids = new Set();
  const labels = new Set();
  const sortOrders = new Set();

  for (const category of bank.categories) {
    assert(category && typeof category === "object", "Every category must be an object.");
    assert(
      typeof category.id === "string" && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(category.id),
      "Category IDs must use lowercase snake_case."
    );
    assert(
      typeof category.label === "string" && category.label.trim(),
      category.id + ": label is required."
    );
    assert(
      Number.isInteger(category.sort_order) && category.sort_order > 0,
      category.id + ": sort_order must be a positive integer."
    );
    assert(
      typeof category.icon_key === "string" && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(category.icon_key),
      category.id + ": icon_key must use lowercase snake_case."
    );
    assert(
      typeof category.color === "string" && /^#[0-9A-F]{6}$/.test(category.color),
      category.id + ": color must be an uppercase six-digit hex value."
    );
    assert(
      ALLOWED_STATUSES.has(category.status),
      category.id + ": status must be active or planned."
    );
    assert(
      category.target && typeof category.target === "object",
      category.id + ": difficulty target is required."
    );

    for (const difficulty of ALLOWED_DIFFICULTIES) {
      assert(
        Number.isInteger(category.target[difficulty]) && category.target[difficulty] >= 0,
        category.id + "/" + difficulty + ": target must be a non-negative integer."
      );
    }

    const targetTotal = Object.values(category.target).reduce((sum, count) => sum + count, 0);
    assert(
      targetTotal >= 80,
      category.id + ": target must contain at least 80 questions for rush_60."
    );
    assert(!ids.has(category.id), category.id + ": duplicate category ID.");
    assert(!labels.has(normalise(category.label)), category.label + ": duplicate category label.");
    assert(!sortOrders.has(category.sort_order), category.id + ": duplicate sort_order.");

    ids.add(category.id);
    labels.add(normalise(category.label));
    sortOrders.add(category.sort_order);
  }

  assert(
    bank.categories.some((category) => category.status === "active"),
    "At least one category must be active."
  );

  return [...bank.categories].sort((left, right) => left.sort_order - right.sort_order);
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

const expectedTotal = activeCategories.reduce(
  (sum, category) =>
    sum + Object.values(category.target).reduce((categorySum, count) => categorySum + count, 0),
  0
);

assert(
  questions.length === expectedTotal,
  "Expected " + expectedTotal + " active questions, found " + questions.length + "."
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
    /^[a-z0-9_]+-\d{3,}$/.test(question.key),
    question.key + ": stable keys must end in a numeric suffix of at least three digits."
  );
  assert(
    activeCategoryIds.has(question.category),
    question.key + ": unknown or inactive category " + question.category + "."
  );
  assert(
    ALLOWED_DIFFICULTIES.has(question.difficulty),
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

  const answerSet = new Set([question.answer, ...question.distractors].map(normalise));
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

for (const category of activeCategories) {
  const expectedCategoryTotal = Object.values(category.target).reduce(
    (sum, count) => sum + count,
    0
  );
  const actualCategoryTotal = categoryCounts.get(category.id) || 0;

  assert(
    actualCategoryTotal === expectedCategoryTotal,
    category.id + ": expected " + expectedCategoryTotal +
      " questions, found " + actualCategoryTotal + "."
  );

  for (const [difficulty, expected] of Object.entries(category.target)) {
    const actual = difficultyCounts.get(category.id + ":" + difficulty) || 0;
    assert(
      actual === expected,
      category.id + "/" + difficulty + ": expected " + expected +
        ", found " + actual + "."
    );
  }
}

assert(
  Math.max(...positionCounts) - Math.min(...positionCounts) <= 1,
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

const categoryExpectationRows = activeCategories.map((category) => {
  const expected = Object.values(category.target).reduce((sum, count) => sum + count, 0);
  return "      (" + sqlString(category.id) + ", " + expected + ")";
});
const activeCategoryIdList = activeCategories
  .map((category) => sqlString(category.id))
  .join(", ");

const sql = [
  "-- Trivia Rush Phase 5 verified " + expectedTotal + "-question seed",
  "-- Generated by scripts/build-question-seed.mjs. Do not edit this SQL by hand.",
  "",
  "begin;",
  "",
  "do $$",
  "begin",
  "  if to_regclass('public.trivia_questions') is null then",
  "    raise exception 'Run phase-4a-question-platform.sql before this seed.';",
  "  end if;",
  "",
  "  if exists (",
  "    select 1",
  "    from (values",
  categoryExpectationRows.join(",\n"),
  "    ) as expected(category_id, expected_count)",
  "    left join public.question_categories qc",
  "      on qc.id = expected.category_id",
  "    where qc.id is null",
  "  ) then",
  "    raise exception 'Run phase-5-category-platform.sql before this seed.';",
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
  "  v_invalid_categories text;",
  "begin",
  "  select string_agg(",
  "    expected.category_id || '=' || coalesce(actual.actual_count, 0)::text,",
  "    ', ' order by expected.category_id",
  "  )",
  "  into v_invalid_categories",
  "  from (values",
  categoryExpectationRows.join(",\n"),
  "  ) as expected(category_id, expected_count)",
  "  left join (",
  "    select category_id, count(*)::integer as actual_count",
  "    from public.trivia_questions",
  "    where is_active",
  "    group by category_id",
  "  ) actual",
  "    on actual.category_id = expected.category_id",
  "  where coalesce(actual.actual_count, 0) <> expected.expected_count;",
  "",
  "  if v_invalid_categories is not null then",
  "    raise exception 'Category question counts are invalid: %.', v_invalid_categories;",
  "  end if;",
  "",
  "  update public.question_categories",
  "  set is_active = true",
  "  where id in (" + activeCategoryIdList + ");",
  "end;",
  "$$;",
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
  "  if v_total <> " + expectedTotal + " then",
  "    raise exception 'Expected exactly " + expectedTotal +
    " active questions after seed, found %.', v_total;",
  "  end if;",
  "end;",
  "$$;",
  "",
  "commit;",
  "",
  "notify pgrst, 'reload schema';",
  ""
].join("\n");

if (WRITE_OUTPUT) {
  writeFileSync(OUTPUT, sql, "utf8");
}

console.log(
  JSON.stringify(
    {
      questions: prepared.length,
      active_categories: Object.fromEntries(categoryCounts),
      planned_categories: categories
        .filter((category) => category.status === "planned")
        .map((category) => category.id),
      correct_positions: positionCounts,
      wrote_output: WRITE_OUTPUT,
      output: basename(OUTPUT)
    },
    null,
    2
  )
);
