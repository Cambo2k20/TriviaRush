import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const appJs = readFileSync("./app.js", "utf8");

const dom = new JSDOM(html, {
  url: "https://example.github.io/trivia-rush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});

const { window } = dom;

// --- Stubs the real page gets from CDN scripts ---
const rpcCalls = [];
const categories = [
  ["science", "Science"],
  ["history", "History"],
  ["geography", "Geography"],
  ["entertainment", "Entertainment"],
  ["sport", "Sport"],
  ["technology", "Technology"],
  ["gaming", "Gaming"]
].map(([category_id, label]) => ({
  category_id,
  label,
  question_count: 100
}));

window.supabase = {
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({
        data: { session: { user: { id: "user-1", is_anonymous: false, user_metadata: { password_setup_complete: true } } } },
        error: null
      }),
      signInAnonymously: async () => ({
        data: { session: { user: { id: "user-1", is_anonymous: false, user_metadata: { password_setup_complete: true } } } },
        error: null
      })
    },
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({
        data: { id: "user-1", display_name: "Tester", account_number: 7 },
        error: null
      })
    }),
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      if (name === "get_question_categories") {
        return { data: categories, error: null };
      }
      if (name === "create_duel") {
        return {
          data: {
            match_id: "77777777-7777-4777-8777-777777777777",
            room_code: "AB12CD34",
            status: "waiting",
            game_mode: "duel_60",
            duration_seconds: 60,
            category_id: "gaming"
          },
          error: null
        };
      }
      if (name === "get_duel_state") {
        return {
          data: {
            match_id: "77777777-7777-4777-8777-777777777777",
            room_code: "AB12CD34",
            status: "waiting",
            category_id: "gaming",
            game_mode: "duel_60",
            server_now: new Date().toISOString(),
            self: { score: 0, questions_answered: 0 },
            opponent: null
          },
          error: null
        };
      }
      return { data: [], error: null };
    }
  })
};

window.alert = () => {};
window.speechSynthesis = { cancel() {}, speak() {} };
window.AudioContext = class { get state() { return "suspended"; } };
window.requestAnimationFrame = () => 0;
window.cancelAnimationFrame = () => {};
// jsdom already provides window.performance
window.scrollTo = () => {};

// --- Run the real app ---
window.eval(appJs);

await new Promise((resolve) => setTimeout(resolve, 50));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

// 1. Category filters generated from the controlled category RPC
const buttons = [
  ...window.document.querySelectorAll(
    "#leaderboardCategoryFilters [data-leaderboard-category]"
  )
];
const ids = buttons.map((b) => b.dataset.leaderboardCategory);
assert("filters include overall", ids.includes("overall"));
assert("filters include mixed", ids.includes("mixed"));
assert("filters include science", ids.includes("science"));
assert("filters include history", ids.includes("history"));
for (const cat of ["geography", "entertainment", "sport", "technology", "gaming"]) {
  assert(`filters include ${cat}`, ids.includes(cat));
}
assert("no duplicate science button", ids.filter((i) => i === "science").length === 1);
assert(
  "labels keep original casing",
  buttons.some((b) => b.textContent === "Technology")
);

// 2. Clicking a generated filter triggers the v2 RPCs with the right category
buttons.find((b) => b.dataset.leaderboardCategory === "science").click();
await new Promise((resolve) => setTimeout(resolve, 20));
const lbCall = rpcCalls.find((c) => c.name === "get_leaderboard_v2");
assert("get_leaderboard_v2 called on filter click", Boolean(lbCall));
assert(
  "RPC receives normalised category id",
  lbCall?.params?.p_category === "science"
);
assert(
  "rank RPC also called",
  rpcCalls.some((c) => c.name === "get_my_leaderboard_rank_v2")
);

// 3. Retry-save button exists and is hidden by default
const retry = window.document.querySelector("#retrySaveButton");
assert("retry save button present and hidden", retry && retry.hidden === true);

// 4. Start-screen select is built from the same controlled category source
const options = [
  ...window.document.querySelectorAll("#categorySelect option")
].map((o) => o.value);
assert(
  "game select and filters share the category source",
  options.includes("science") && options.includes("technology") && options.includes("gaming")
);
assert("question bank RPC called", rpcCalls.some((c) => c.name === "get_question_categories"));
assert("start enabled after complete bank loads", window.document.querySelector("#startButton")?.disabled === false);
assert("static questions script retired", !html.includes("questions.js"));
assert("authoritative game start RPC used", appJs.includes('"start_solo_game"'));
assert("per-answer validation RPC used", appJs.includes('"submit_solo_answer"'));
assert("server finalisation RPC used", appJs.includes('"finish_solo_game"'));
assert("legacy client score RPC unused", !appJs.includes('"submit_game_result"'));

// 5. Permanent players can open the complete social/duel dashboard.
window.document.querySelector("#duelButton").click();
await new Promise((resolve) => setTimeout(resolve, 30));
assert("friends and duels screen opens", window.document.querySelector("#socialScreen")?.classList.contains("active"));
assert("permanent account sees social content", window.document.querySelector("#socialContent")?.hidden === false);
assert("social dashboard RPC called", rpcCalls.some((c) => c.name === "get_social_dashboard"));
assert("direct challenge RPC called", rpcCalls.some((c) => c.name === "get_duel_invitations"));
assert("private match history RPC called", rpcCalls.some((c) => c.name === "get_duel_match_history"));
assert("separate duel leaderboard RPC called", rpcCalls.some((c) => c.name === "get_duel_leaderboard"));
assert("duel category selector includes gaming", [...window.document.querySelectorAll("#duelCategorySelect option")].some((option) => option.value === "gaming"));
assert("live duel state RPC implemented", appJs.includes('"get_duel_state"'));
assert("authoritative duel answer RPC implemented", appJs.includes('"submit_duel_answer"'));

window.document.querySelector("#duelCategorySelect").value = "gaming";
window.document.querySelector("#createDuelButton").click();
await new Promise((resolve) => setTimeout(resolve, 30));
const createDuelCall = rpcCalls.find((call) => call.name === "create_duel");
assert("duel creator sends selected category", createDuelCall?.params?.p_category === "gaming");
assert("duel creator sends optional length", createDuelCall?.params?.p_duration_seconds === 60);
assert("waiting room opens after creation", window.document.querySelector("#duelWaitingScreen")?.classList.contains("active"));
assert("waiting room shows share code", window.document.querySelector("#duelWaitingCode")?.textContent === "AB12CD34");
window.document.querySelector("#cancelDuelButton").click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert("waiting room cancellation RPC used", rpcCalls.some((call) => call.name === "cancel_duel"));

console.log(results.join("\n"));
