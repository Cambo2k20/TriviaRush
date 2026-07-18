import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const bridgeScript = readFileSync("./social-rpc-bridge.js", "utf8");
const appScript = readFileSync("./app.js", "utf8");
const runtimeConfigScript = readFileSync("./runtime-config.js", "utf8");
const redesignScript = readFileSync("./social-redesign.js", "utf8");

const runtimeErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => runtimeErrors.push(error));
virtualConsole.on("error", (...values) => runtimeErrors.push(new Error(values.join(" "))));

const dom = new JSDOM(html, {
  url: "https://example.github.io/TriviaRush/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole
});

const { window } = dom;
let animationFrameCount = 0;
window.alert = () => {};
window.prompt = () => "Tester";
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.requestAnimationFrame = (callback) => {
  animationFrameCount += 1;
  if (animationFrameCount > 100) {
    runtimeErrors.push(new Error("The social page entered a runaway animation/render loop."));
    return 0;
  }
  return window.setTimeout(() => callback(Date.now()), 0);
};
window.cancelAnimationFrame = (identifier) => window.clearTimeout(identifier);
window.speechSynthesis = { cancel() {}, speak() {} };
window.AudioContext = class {
  get state() { return "suspended"; }
  resume() { return Promise.resolve(); }
};
window.CSS = window.CSS || {};
window.CSS.escape = window.CSS.escape || ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

if (window.HTMLDialogElement) {
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.removeAttribute("open");
  };
}

window.addEventListener("error", (event) => {
  runtimeErrors.push(event.error || new Error(event.message));
});
window.addEventListener("unhandledrejection", (event) => {
  runtimeErrors.push(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

const categories = [{
  category_id: "science",
  label: "Science",
  question_count: 100,
  icon_key: "flask",
  color: "#41E28C",
  sort_order: 10
}];

const rpcData = {
  get_question_categories: categories,
  get_social_dashboard: {
    friends: [{ player_id: "friend-1", display_name: "Sam", account_number: 1002, is_online: true }],
    incoming: [],
    outgoing: []
  },
  get_duel_invitations: [],
  get_turn_challenges: { active: [], recent_closed: [] },
  get_duel_match_history_v2: [],
  get_duel_leaderboard_v2: [],
  get_notifications: [],
  get_notification_preferences: [{
    push_enabled: false,
    email_enabled: false,
    challenge_notifications: true,
    friend_request_notifications: true,
    active_push_subscriptions: 0
  }],
  get_unread_notification_count: 0
};

const client = {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "tester@example.com",
            is_anonymous: false,
            user_metadata: { password_setup_complete: true }
          }
        }
      },
      error: null
    }),
    signInAnonymously: async () => ({ data: null, error: null })
  },
  from: () => ({
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({
      data: { id: "user-1", display_name: "Tester", account_number: 1001 },
      error: null
    })
  }),
  rpc: async (name) => ({ data: rpcData[name] ?? [], error: null })
};

window.supabase = { createClient: () => client };

window.eval(bridgeScript);
window.eval(runtimeConfigScript);
window.eval(appScript);
window.eval(redesignScript);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

await new Promise((resolve) => window.setTimeout(resolve, 100));
window.document.querySelector("#duelButton")?.click();
await new Promise((resolve) => window.setTimeout(resolve, 250));

const failures = [];
const assert = (name, condition) => {
  if (!condition) failures.push(name);
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
};

// The tab structure is covered by social-redesign-smoke-test.mjs. This test
// specifically protects the real inactive-to-active click transition that
// previously triggered a self-sustaining MutationObserver loop.
assert("Play friends opens the social screen", window.document.querySelector("#socialScreen")?.classList.contains("active"));
assert("social rendering settles after the click", animationFrameCount < 100);
assert("the merged runtime raises no browser errors", runtimeErrors.length === 0);

console.log(`INFO  animation frames scheduled: ${animationFrameCount}`);
if (runtimeErrors.length) {
  for (const error of runtimeErrors) {
    console.error(error?.stack || error?.message || String(error));
  }
}

window.close();
process.exit(failures.length ? 1 : 0);
