import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INPUT = resolve(ROOT, "data", "questions.json");
const OUTPUT = resolve(ROOT, "phase-5-question-seed.sql");
const VERIFICATION_OUTPUT = resolve(ROOT, "phase-5-category-verification.sql");
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
    bank.default_target && typeof bank.default_target === "object",
    "A default difficulty target is required."
  );
  assert(
    bank.legacy_key_ranges && typeof bank.legacy_key_ranges === "object",
    "Explicit legacy key ranges are required."
  );
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

function isAllowedQuestionKey(key, category) {
  if (/^[a-z0-9_]+-\d{3,}$/.test(key)) {
    return true;
  }

  for (const [prefix, range] of Object.entries(bank.legacy_key_ranges)) {
    if (!key.startsWith(prefix) || range.category !== category) {
      continue;
    }

    const suffix = key.slice(prefix.length);
    const value = /^\d{3}$/.test(suffix) ? Number.parseInt(suffix, 10) : NaN;
    return Number.isInteger(value) && value >= range.min && value <= range.max;
  }

  return false;
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
    isAllowedQuestionKey(question.key, question.category),
    question.key + ": use the canonical hyphen key convention or an explicit legacy range."
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
const categoryManifestRows = categories.map((category) =>
  "  (" + [
    sqlString(category.id),
    sqlString(category.label),
    category.sort_order,
    sqlString(category.icon_key),
    sqlString(category.color),
    category.status === "active" ? "true" : "false"
  ].join(", ") + ")"
);
const verificationExpectationRows = activeCategories.map((category) => {
  const total = Object.values(category.target).reduce((sum, count) => sum + count, 0);
  return "    (" + [
    sqlString(category.id),
    sqlString(category.label),
    category.sort_order,
    sqlString(category.icon_key),
    sqlString(category.color),
    category.target.easy,
    category.target.medium,
    category.target.hard,
    total
  ].join(", ") + ")";
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
  "  if to_regclass('public.question_categories') is null then",
  "    raise exception 'Run phase-4a-question-platform.sql before this seed.';",
  "  end if;",
  "",
  "  if to_regclass('public.trivia_questions') is null then",
  "    raise exception 'Run phase-4a-question-platform.sql before this seed.';",
  "  end if;",
  "end;",
  "$$;",
  "",
  "insert into public.question_categories (",
  "  id, label, sort_order, icon_key, color, is_active",
  ")",
  "values",
  categoryManifestRows.join(",\n"),
  "on conflict (id) do update",
  "set",
  "  label = excluded.label,",
  "  sort_order = excluded.sort_order,",
  "  icon_key = excluded.icon_key,",
  "  color = excluded.color,",
  "  is_active = excluded.is_active;",
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

const verificationSql = [
  "-- Trivia Rush manifest-derived category and question verification",
  "-- Generated by scripts/build-question-seed.mjs. Do not edit this SQL by hand.",
  "-- Every query is read-only.",
  "",
  "with expected(category_id, label, sort_order, icon_key, color, easy, medium, hard, total) as (",
  "  values",
  verificationExpectationRows.join(",\n"),
  "), actual as (",
  "  select",
  "    qc.id as category_id,",
  "    qc.label,",
  "    qc.sort_order,",
  "    qc.icon_key,",
  "    qc.color,",
  "    count(q.id) filter (where q.is_active and q.difficulty = 'easy')::integer as easy,",
  "    count(q.id) filter (where q.is_active and q.difficulty = 'medium')::integer as medium,",
  "    count(q.id) filter (where q.is_active and q.difficulty = 'hard')::integer as hard,",
  "    count(q.id) filter (where q.is_active)::integer as total",
  "  from public.question_categories qc",
  "  left join public.trivia_questions q on q.category_id = qc.id",
  "  where qc.is_active",
  "  group by qc.id, qc.label, qc.sort_order, qc.icon_key, qc.color",
  ")",
  "select",
  "  expected.* ,",
  "  actual.easy as actual_easy,",
  "  actual.medium as actual_medium,",
  "  actual.hard as actual_hard,",
  "  actual.total as actual_total,",
  "  actual.category_id is not null",
  "    and actual.label = expected.label",
  "    and actual.sort_order = expected.sort_order",
  "    and actual.icon_key = expected.icon_key",
  "    and actual.color = expected.color",
  "    and actual.easy = expected.easy",
  "    and actual.medium = expected.medium",
  "    and actual.hard = expected.hard",
  "    and actual.total = expected.total as matches_manifest",
  "from expected",
  "left join actual using (category_id)",
  "order by expected.sort_order;",
  "",
  "select",
  "  count(*) filter (where is_active) = " + activeCategories.length + " as active_category_count_matches,",
  "  (select count(*) from public.trivia_questions where is_active) = " + expectedTotal + " as active_question_count_matches",
  "from public.question_categories;",
  "",
  "select correct_index, count(*) as questions",
  "from public.trivia_questions",
  "where is_active",
  "group by correct_index",
  "order by correct_index;",
  "",
  "select",
  "  count(*) filter (where char_length(btrim(question_text)) not between 10 and 240) as invalid_question_text,",
  "  count(*) filter (where not trivia_private.question_answers_are_valid(answers)) as invalid_answers,",
  "  count(*) filter (where correct_index not between 0 and 2) as invalid_indexes,",
  "  count(*) filter (where source_url !~ '^https://') as invalid_source_urls,",
  "  count(*) filter (where verified_at is null) as missing_verified_at",
  "from public.trivia_questions",
  "where is_active;",
  "",
  "select count(*) as duplicate_normalised_questions",
  "from (",
  "  select lower(regexp_replace(btrim(question_text), '\\s+', ' ', 'g'))",
  "  from public.trivia_questions",
  "  where is_active",
  "  group by lower(regexp_replace(btrim(question_text), '\\s+', ' ', 'g'))",
  "  having count(*) > 1",
  ") duplicates;",
  "",
  "select count(*) = 400 as frozen_legacy_key_count_matches",
  "from public.trivia_questions",
  "where question_key ~ '^(got|myth|hp|mcu)_[0-9]{3}$';",
  "",
  "select * from public.get_question_categories();",
  "",
  "select grantee, table_name, privilege_type",
  "from information_schema.role_table_grants",
  "where table_schema = 'public'",
  "  and table_name in ('question_categories', 'trivia_questions')",
  "  and grantee in ('anon', 'authenticated')",
  "order by table_name, grantee, privilege_type;",
  ""
].join("\n");

if (WRITE_OUTPUT) {
  writeFileSync(OUTPUT, sql, "utf8");
  writeFileSync(VERIFICATION_OUTPUT, verificationSql, "utf8");
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
      output: basename(OUTPUT),
      verification_output: basename(VERIFICATION_OUTPUT)
    },
    null,
    2
  )
);
