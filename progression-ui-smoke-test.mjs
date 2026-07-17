import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const progressionUiJs = readFileSync("./progression-ui.js", "utf8");
const rpcCalls = [];
let progressionPayload = {
  total_xp: 860,
  level: 4,
  credited_games: 8,
  current_level_xp: 600,
  next_level: 5,
  next_level_xp: 1000,
  xp_into_level: 260,
  xp_to_next_level: 140,
  progress_percent: 65
};

const dom = new JSDOM(html, {
  url: "https://example.github.io/trivia-rush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;

window.supabase = {
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      if (name === "get_my_global_progression") {
        return { data: progressionPayload, error: null };
      }
      if (name === "finish_solo_game") {
        progressionPayload = {
          ...progressionPayload,
          total_xp: 971,
          credited_games: 9,
          xp_into_level: 371,
          xp_to_next_level: 29,
          progress_percent: 92.8
        };
        return {
          data: {
            status: "completed",
            session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          },
          error: null
        };
      }
      if (name === "get_solo_global_xp_summary") {
        return {
          data: {
            status: "credited",
            run_id: params?.p_run_id,
            xp_awarded: 111,
            base_xp: 95,
            answer_xp: 111,
            score_multiplier: 1,
            result_multiplier: 1,
            total_xp: 971,
            level: 4,
            credited_games: 9
          },
          error: null
        };
      }
      if (name === "get_duel_state") {
        progressionPayload = {
          ...progressionPayload,
          total_xp: 1039,
          level: 5,
          credited_games: 10,
          current_level_xp: 1000,
          next_level: 6,
          next_level_xp: 1500,
          xp_into_level: 39,
          xp_to_next_level: 461,
          progress_percent: 7.8
        };
        return {
          data: {
            match_id: params?.p_match_id,
            match_format: "live",
            status: "completed"
          },
          error: null
        };
      }
      if (name === "get_live_duel_global_xp_summary") {
        return {
          data: {
            status: "credited",
            match_id: params?.p_match_id,
            xp_awarded: 68,
            base_xp: 50,
            answer_xp: 58,
            score_multiplier: 1.06,
            result_multiplier: 1.1,
            total_xp: 1039,
            level: 5,
            credited_games: 10
          },
          error: null
        };
      }
      if (name === "get_turn_challenge_state") {
        progressionPayload = {
          ...progressionPayload,
          total_xp: 1091,
          level: 5,
          credited_games: 11,
          xp_into_level: 91,
          xp_to_next_level: 409,
          progress_percent: 18.2
        };
        return {
          data: {
            match_id: params?.p_match_id,
            match_format: "turn_based",
            status: "completed"
          },
          error: null
        };
      }
      if (name === "get_turn_based_global_xp_summary") {
        return {
          data: {
            status: "credited",
            match_id: params?.p_match_id,
            xp_awarded: 52,
            base_xp: 45,
            answer_xp: 48,
            score_multiplier: 1.03,
            result_multiplier: 1.05,
            total_xp: 1091,
            level: 5,
            credited_games: 11
          },
          error: null
        };
      }
      return { data: null, error: null };
    }
  })
};

window.eval(progressionUiJs);
const client = window.supabase.createClient("https://example.supabase.co", "publishable-key");
await new Promise((resolve) => setTimeout(resolve, 180));

const results = [];
function assert(name, condition) {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) {
    process.exitCode = 1;
  }
}

assert("progression stylesheet linked", html.includes("progression-ui.css?v=1"));
assert("progression script loaded before app", html.indexOf("progression-ui.js?v=1") < html.indexOf("app.js?v=18"));
assert("global progression RPC called", rpcCalls.some((call) => call.name === "get_my_global_progression"));
assert("header progression chip is visible", window.document.querySelector("#globalProgressionChip")?.hidden === false);
assert("header shows server level", window.document.querySelector("#globalProgressionChipLevel")?.textContent === "4");
assert("header shows server XP", window.document.querySelector("#globalProgressionChipXp")?.textContent === "860 XP");
assert("account progression panel is visible", window.document.querySelector("#accountProgressionPanel")?.hidden === false);
assert("account shows XP to next level", window.document.querySelector("#accountProgressionNext")?.textContent === "140 XP to Level 5");
assert(
  "browser contains no XP rule formula",
  !progressionUiJs.includes("calculate_global_answer_xp") &&
    !progressionUiJs.includes("global_level_for_xp") &&
    !progressionUiJs.includes("<= 1500")
);

await client.rpc("finish_solo_game", {
  p_run_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
});
await new Promise((resolve) => setTimeout(resolve, 40));
assert("solo XP summary follows authoritative finish", rpcCalls.some((call) => call.name === "get_solo_global_xp_summary"));
assert("solo result shows exact server XP", window.document.querySelector("#soloProgressionResult [data-progression-award]")?.textContent === "+111 XP");
assert("solo result uses server answer XP", window.document.querySelector("#soloProgressionResult [data-progression-breakdown]")?.textContent.includes("111 answer XP"));

await client.rpc("get_duel_state", {
  p_match_id: "77777777-7777-4777-8777-777777777777"
});
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  "live duel summary uses completed match id",
  rpcCalls.some((call) =>
    call.name === "get_live_duel_global_xp_summary" &&
    call.params?.p_match_id === "77777777-7777-4777-8777-777777777777"
  )
);
assert("duel result shows exact participant XP", window.document.querySelector("#duelProgressionResult [data-progression-award]")?.textContent === "+68 XP");
assert("duel result shows server result multiplier", window.document.querySelector("#duelProgressionResult [data-progression-breakdown]")?.textContent.includes("result ×1.10"));

await client.rpc("get_turn_challenge_state", {
  p_match_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
});
await new Promise((resolve) => setTimeout(resolve, 40));
assert(
  "turn-based summary uses completed challenge id",
  rpcCalls.some((call) =>
    call.name === "get_turn_based_global_xp_summary" &&
    call.params?.p_match_id === "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  )
);
assert("turn-based result shows exact participant XP", window.document.querySelector("#duelProgressionResult [data-progression-award]")?.textContent === "+52 XP");
assert("turn-based result shows draw multiplier", window.document.querySelector("#duelProgressionResult [data-progression-breakdown]")?.textContent.includes("result ×1.05"));

console.log(results.join("\n"));
window.close();
