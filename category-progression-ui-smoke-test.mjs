import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const categoryUiJs = readFileSync("./category-progression-ui.js", "utf8");
const rpcCalls = [];

let progressionPayload = {
  total_xp: 140,
  categories: [
    {
      category_id: "science",
      label: "Science",
      icon_key: "flask",
      color: "#41E28C",
      xp: 115,
      level: 2,
      current_level_xp: 100,
      next_level: 3,
      next_level_xp: 300,
      xp_into_level: 15,
      xp_to_next_level: 185,
      progress_percent: 7.5,
      questions_answered: 12,
      correct_answers: 11,
      incorrect_answers: 1,
      accuracy_percent: 91.7,
      solo_questions: 11,
      duel_questions: 1
    },
    {
      category_id: "history",
      label: "History",
      icon_key: "landmark",
      color: "#FFD54A",
      xp: 25,
      level: 1,
      current_level_xp: 0,
      next_level: 2,
      next_level_xp: 100,
      xp_into_level: 25,
      xp_to_next_level: 75,
      progress_percent: 25,
      questions_answered: 2,
      correct_answers: 1,
      incorrect_answers: 1,
      accuracy_percent: 50,
      solo_questions: 2,
      duel_questions: 0
    },
    ...[
      ["game_of_thrones", "Game of Thrones", "dragon", "#9B1C1C"],
      ["mythology", "Mythology", "thunderbolt", "#C9A227"],
      ["harry_potter", "Harry Potter", "wand", "#4B2E83"],
      ["marvel_cinematic_universe", "Marvel Cinematic Universe", "shield", "#ED1D24"]
    ].map(([category_id, label, icon_key, color]) => ({
      category_id,
      label,
      icon_key,
      color,
      xp: 0,
      level: 1,
      current_level_xp: 0,
      next_level: 2,
      next_level_xp: 100,
      xp_into_level: 0,
      xp_to_next_level: 100,
      progress_percent: 0,
      questions_answered: 0,
      correct_answers: 0,
      incorrect_answers: 0,
      accuracy_percent: 0,
      solo_questions: 0,
      duel_questions: 0
    }))
  ]
};

const dom = new JSDOM(html, {
  url: "https://example.github.io/TriviaRush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;
const progressionEvents = [];

window.addEventListener("trivia-rush:category-progression", (event) => {
  progressionEvents.push(event.detail);
});

window.supabase = {
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    rpc: async (name, parameters) => {
      rpcCalls.push({ name, parameters });

      if (name === "get_my_category_progression") {
        return { data: progressionPayload, error: null };
      }

      if (name === "finish_solo_game") {
        progressionPayload = {
          total_xp: 175,
          categories: progressionPayload.categories.map((category) => {
            if (category.category_id === "science") {
              return { ...category, xp: 125, xp_into_level: 25, xp_to_next_level: 175, progress_percent: 12.5, questions_answered: 13, correct_answers: 12, accuracy_percent: 92.3 };
            }
            return { ...category, xp: 50, xp_into_level: 50, xp_to_next_level: 50, progress_percent: 50, questions_answered: 3, correct_answers: 2, accuracy_percent: 66.7 };
          })
        };
        return { data: { status: "completed" }, error: null };
      }

      if (name === "get_solo_category_xp_summary") {
        return {
          data: {
            status: "credited",
            source_kind: "solo",
            source_id: parameters?.p_run_id,
            total_xp_awarded: 35,
            categories: [
              {
                category_id: "science",
                label: "Science",
                color: "#41E28C",
                xp_awarded: 10,
                questions_answered: 1,
                correct_answers: 1,
                level_before: 1,
                level_after: 2,
                current_xp: 125,
                current_level: 2
              },
              {
                category_id: "history",
                label: "History",
                color: "#FFD54A",
                xp_awarded: 25,
                questions_answered: 1,
                correct_answers: 1,
                level_before: 1,
                level_after: 1,
                current_xp: 50,
                current_level: 1
              }
            ]
          },
          error: null
        };
      }

      if (name === "get_duel_state") {
        return {
          data: {
            status: "completed",
            match_id: parameters?.p_match_id,
            match_format: "live"
          },
          error: null
        };
      }

      if (name === "get_duel_category_xp_summary") {
        return {
          data: {
            status: "credited",
            source_kind: "live_duel",
            source_id: parameters?.p_match_id,
            total_xp_awarded: 25,
            categories: [
              {
                category_id: "history",
                label: "History",
                color: "#FFD54A",
                xp_awarded: 25,
                questions_answered: 1,
                correct_answers: 1,
                level_before: 1,
                level_after: 1,
                current_xp: 50,
                current_level: 1
              }
            ]
          },
          error: null
        };
      }

      return { data: null, error: null };
    }
  })
};

window.eval(categoryUiJs);
const client = window.supabase.createClient("https://example.supabase.co", "publishable-key");
await new Promise((resolve) => window.setTimeout(resolve, 220));

const results = [];
function assert(name, condition) {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
}

const categoryScriptIndex = html.indexOf("category-progression-ui.js?v=3");
const appScriptIndex = html.search(/app\.js\?v=\d+/);

assert("category mastery stylesheet linked", html.includes("category-progression-ui.css?v=1"));
assert(
  "category mastery runtime loads before app",
  categoryScriptIndex >= 0 && appScriptIndex >= 0 && categoryScriptIndex < appScriptIndex
);
assert("category progression RPC called", rpcCalls.some((call) => call.name === "get_my_category_progression"));
assert("normalized category progression is published for the home screen", progressionEvents[0]?.categories?.find((category) => category.id === "science")?.level === 2);
assert("normalized category progress percentage is published for mobile cards", progressionEvents[0]?.categories?.find((category) => category.id === "science")?.progressPercent === 7.5);
assert("account mastery panel is visible", window.document.querySelector("#accountCategoryMasteryPanel")?.hidden === false);
assert("account renders each server category", window.document.querySelectorAll("#accountCategoryMasteryGrid .category-mastery-card").length === 6);
assert(
  "new category icons are implemented",
  ["game_of_thrones", "mythology", "harry_potter", "marvel_cinematic_universe"].every(
    (id) => window.document.querySelector(`[data-category-id="${id}"] .category-mastery-icon`)?.textContent !== "?"
  )
);
assert("Science server level is shown", window.document.querySelector('[data-category-id="science"] .category-mastery-level')?.textContent === "LV 2");
assert("Science XP-to-next copy is shown", window.document.querySelector('[data-category-id="science"] .category-mastery-meta span:last-child')?.textContent === "185 XP to LV 3");
assert("Science trusted accuracy is shown", window.document.querySelector('[data-category-id="science"] .category-mastery-meta span:first-child')?.textContent.includes("91.7% accuracy"));
assert(
  "browser contains no category XP or level formula",
  !categoryUiJs.includes("category_xp_for_answer") &&
    !categoryUiJs.includes("category_level_for_xp") &&
    !categoryUiJs.includes("50 * (level")
);

await client.rpc("finish_solo_game", {
  p_run_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
});
await new Promise((resolve) => window.setTimeout(resolve, 80));

assert("solo category summary follows authoritative finish", rpcCalls.some((call) => call.name === "get_solo_category_xp_summary"));
assert("home progression event refreshes after authoritative solo completion", progressionEvents.length >= 2);
assert("solo result shows exact total category XP", window.document.querySelector("#soloCategoryProgressionResult [data-category-result-total]")?.textContent === "+35 XP");
assert("Mixed solo result renders multiple category rows", window.document.querySelectorAll("#soloCategoryProgressionResult .category-result-row").length === 2);
assert("solo result highlights the trusted level-up", window.document.querySelector("#soloCategoryProgressionResult .category-result-row.level-up .category-result-level")?.textContent === "LV 1 → 2");

await client.rpc("get_duel_state", {
  p_match_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
});
await new Promise((resolve) => window.setTimeout(resolve, 80));

assert("duel category summary follows completed state", rpcCalls.some((call) => call.name === "get_duel_category_xp_summary"));
assert("duel result shows caller-only category XP", window.document.querySelector("#duelCategoryProgressionResult [data-category-result-total]")?.textContent === "+25 XP");
assert("duel result renders its category row", window.document.querySelectorAll("#duelCategoryProgressionResult .category-result-row").length === 1);

console.log(results.join("\n"));
window.close();
