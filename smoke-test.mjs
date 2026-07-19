import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const appJs = readFileSync("./app.js", "utf8");
const runtimeConfigJs = readFileSync("./runtime-config.js", "utf8");

const dom = new JSDOM(html, {
  url: "https://example.github.io/trivia-rush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});

const { window } = dom;

// --- Stubs the real page gets from CDN scripts ---
const rpcCalls = [];
const categories = [
  ["science", "Science", "flask", "#41E28C"],
  ["history", "History", "landmark", "#FFD54A"],
  ["geography", "Geography", "globe", "#3EE7DB"],
  ["entertainment", "Entertainment", "film", "#FF4F9B"],
  ["sport", "Sport", "trophy", "#FF8A4C"],
  ["technology", "Technology", "cpu", "#7C83FF"],
  ["gaming", "Gaming", "gamepad", "#B66CFF"],
  ["food_drink", "Food & Drink", "utensils", "#FFB347"],
  ["nature_animals", "Nature & Animals", "paw", "#62D26F"],
  ["art_literature", "Art & Literature", "palette_book", "#F47CD4"],
  ["game_of_thrones", "Game of Thrones", "dragon", "#9B1C1C"],
  ["mythology", "Mythology", "thunderbolt", "#C9A227"],
  ["harry_potter", "Harry Potter", "wand", "#4B2E83"],
  ["marvel_cinematic_universe", "Marvel Cinematic Universe", "shield", "#ED1D24"]
].map(([category_id, label, icon_key, color], index) => ({
  category_id,
  label,
  question_count: 100,
  icon_key,
  color,
  sort_order: (index + 1) * 10
}));

window.supabase = {
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({
        data: { session: { user: { id: "user-1", email: "tester@example.com", is_anonymous: false, user_metadata: { password_setup_complete: true } } } },
        error: null
      }),
      signInAnonymously: async () => ({
        data: { session: { user: { id: "user-1", email: "tester@example.com", is_anonymous: false, user_metadata: { password_setup_complete: true } } } },
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
      if (name === "create_turn_challenge") {
        return {
          data: {
            match_id: "99999999-9999-4999-8999-999999999999",
            match_format: "turn_based",
            status: "host_turn",
            game_mode: "duel_60",
            duration_seconds: 60,
            category_id: "science",
            starts_at: new Date(Date.now() + 5000).toISOString(),
            ends_at: new Date(Date.now() + 65000).toISOString(),
            server_now: new Date().toISOString()
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
      if (name === "get_turn_challenge_state") {
        return {
          data: {
            match_id: "99999999-9999-4999-8999-999999999999",
            match_format: "turn_based",
            status: "host_turn",
            category_id: "science",
            game_mode: "duel_60",
            server_now: new Date().toISOString(),
            starts_at: new Date(Date.now() + 5000).toISOString(),
            ends_at: new Date(Date.now() + 65000).toISOString(),
            self: { round_status: "countdown", score: 0, questions_answered: 0 },
            opponent: { display_name: "Opponent", score: null, questions_answered: null }
          },
          error: null
        };
      }
      if (name === "get_turn_challenges") {
        return { data: { active: [], recent_closed: [] }, error: null };
      }
      if (name === "get_notification_preferences") {
        return {
          data: [{
            push_enabled: false,
            email_enabled: false,
            challenge_notifications: true,
            friend_request_notifications: true,
            active_push_subscriptions: 0
          }],
          error: null
        };
      }
      if (name === "get_unread_notification_count") {
        return { data: 2, error: null };
      }
      if (name === "get_leaderboard_v2") {
        return {
          data: [
            { leaderboard_rank: 1, display_name: "Cambo", account_number: 1001, high_score: 4519, accuracy_percent: 83.1, best_streak: 15, games_played: 16 },
            { leaderboard_rank: 2, display_name: "Jaketh", account_number: 1003, high_score: 2728, accuracy_percent: 81.3, best_streak: 8, games_played: 1 },
            { leaderboard_rank: 3, display_name: "Tester", account_number: 7, high_score: 1029, accuracy_percent: 59.3, best_streak: 4, games_played: 4, is_current_player: true },
            { leaderboard_rank: 4, display_name: "Cambo Phone", account_number: 1000, high_score: 955, accuracy_percent: 63.6, best_streak: 3, games_played: 1 },
            { leaderboard_rank: 5, display_name: "jon", account_number: 1007, high_score: 489, accuracy_percent: 100, best_streak: 4, games_played: 1 }
          ],
          error: null
        };
      }
      if (name === "get_my_leaderboard_rank_v2") {
        return {
          data: { leaderboard_rank: 3, high_score: 1029, accuracy_percent: 59.3, best_streak: 4 },
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
window.eval(runtimeConfigJs);
window.eval(appJs);

await new Promise((resolve) => setTimeout(resolve, 50));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

// 1. Category filters generated from the controlled category RPC
const leaderboardCategorySelect = window.document.querySelector(
  "#leaderboardCategorySelect"
);
const categoryOptions = [
  ...leaderboardCategorySelect.options
];
const ids = categoryOptions.map((option) => option.value);
assert("filters include overall", ids.includes("overall"));
assert("filters include mixed", ids.includes("mixed"));
assert("filters include science", ids.includes("science"));
assert("filters include history", ids.includes("history"));
for (const cat of [
  "geography",
  "entertainment",
  "sport",
  "technology",
  "gaming",
  "food_drink",
  "nature_animals",
  "art_literature",
  "game_of_thrones",
  "mythology",
  "harry_potter",
  "marvel_cinematic_universe"
]) {
  assert(`filters include ${cat}`, ids.includes(cat));
}
assert("no duplicate science option", ids.filter((i) => i === "science").length === 1);
assert(
  "labels keep original casing",
  categoryOptions.some((option) => option.textContent === "Technology")
);
assert(
  "custom category menu mirrors controlled categories",
  window.document.querySelectorAll(
    "#leaderboardCategoryMenu [data-leaderboard-category]"
  ).length === categoryOptions.length
);

// 2. Changing the generated select triggers the v2 RPCs with the right category
leaderboardCategorySelect.value = "science";
leaderboardCategorySelect.dispatchEvent(new window.Event("change", { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 20));
assert(
  "custom category trigger reflects native selection",
  window.document.querySelector("#leaderboardCategoryButtonText")?.textContent === "Science" &&
    window.document.querySelector(
      '#leaderboardCategoryMenu [data-leaderboard-category="science"]'
    )?.getAttribute("aria-selected") === "true"
);
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
assert(
  "top three render as podium cards",
  window.document.querySelectorAll("#leaderboardPodium .leaderboard-podium-card").length === 3
);
assert(
  "current player has a YOU badge",
  window.document.querySelector("#leaderboardList .current-player .leaderboard-you-badge")?.textContent === "YOU"
);
assert(
  "player ID is secondary information under the player name",
  window.document.querySelector("#leaderboardList .leaderboard-player small")?.textContent.includes("#1001") &&
    !window.document.querySelector("#leaderboardList .leaderboard-id")
);
assert(
  "current rank summary uses four stat cells",
  window.document.querySelectorAll("#currentPlayerRank .current-player-stat").length === 4
);
assert(
  "leaderboard count is a muted caption",
  window.document.querySelector("#leaderboardStatus")?.textContent === "5 ranked players"
);

const categoryButton = window.document.querySelector(
  "#leaderboardCategoryButton"
);
categoryButton.click();
assert(
  "custom category menu opens from the trigger",
  categoryButton.getAttribute("aria-expanded") === "true" &&
    window.document.querySelector("#leaderboardCategoryMenu")?.hidden === false
);
window.document.querySelector(
  '#leaderboardCategoryMenu [data-leaderboard-category="technology"]'
).click();
await new Promise((resolve) => setTimeout(resolve, 20));
assert(
  "custom category menu updates the authoritative select",
  leaderboardCategorySelect.value === "technology" &&
    categoryButton.getAttribute("aria-expanded") === "false" &&
    window.document.querySelector("#leaderboardCategoryButtonText")?.textContent === "Technology"
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
  options.includes("science") &&
    options.includes("technology") &&
    options.includes("gaming") &&
    options.includes("food_drink") &&
    options.includes("nature_animals") &&
    options.includes("art_literature") &&
    options.includes("game_of_thrones") &&
    options.includes("mythology") &&
    options.includes("harry_potter") &&
    options.includes("marvel_cinematic_universe")
);
const mcuOption = window.document.querySelector('#categorySelect option[value="marvel_cinematic_universe"]');
assert(
  "category options preserve RPC icon and color metadata",
  mcuOption?.dataset.iconKey === "shield" && mcuOption?.dataset.color === "#ED1D24"
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
assert("private match history v2 RPC called", rpcCalls.some((c) => c.name === "get_duel_match_history_v2"));
assert("filtered duel leaderboard RPC called", rpcCalls.some((c) => c.name === "get_duel_leaderboard_v2"));
assert("turn-based challenge dashboard RPC called", rpcCalls.some((c) => c.name === "get_turn_challenges"));
assert("in-app notifications RPC called", rpcCalls.some((c) => c.name === "get_notifications"));
assert("notification preferences RPC called", rpcCalls.some((c) => c.name === "get_notification_preferences"));
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

// 6. Turn-based creation requires a named opponent and starts a private host round.
window.document.querySelector("#duelFormatSelect").value = "turn_based";
window.document.querySelector("#duelFormatSelect").dispatchEvent(new window.Event("change"));
window.document.querySelector("#duelCategorySelect").value = "science";
window.document.querySelector("#duelInviteAccount").value = "2";
window.document.querySelector("#createDuelButton").click();
await new Promise((resolve) => setTimeout(resolve, 30));
const createTurnCall = rpcCalls.find((call) => call.name === "create_turn_challenge");
assert("turn-based creator uses dedicated authoritative RPC", Boolean(createTurnCall));
assert("turn-based creator sends opponent account", createTurnCall?.params?.p_invited_account_number === 2);
assert("turn-based host round opens", window.document.querySelector("#duelGameScreen")?.classList.contains("active"));
assert("turn-based answer RPC implemented", appJs.includes('"submit_turn_challenge_answer"'));
assert("target score hiding implemented", appJs.includes("Hidden until finish"));

// 7. Installable web app and notification controls ship with the UI.
assert("web app manifest linked", html.includes('rel="manifest"'));
assert("notification bell is visible for permanent accounts", window.document.querySelector("#notificationButton")?.hidden === false);
assert("unread notification badge updates", window.document.querySelector("#notificationBadge")?.textContent === "2");
assert("push opt-in control exists", Boolean(window.document.querySelector("#pushNotificationsButton")));

console.log(results.join("\n"));
window.close();
