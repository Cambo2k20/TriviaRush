import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const bridgeScript = readFileSync("./social-rpc-bridge.js", "utf8");
const redesignScript = readFileSync("./social-redesign.js", "utf8");
const styles = readFileSync("./social-redesign.css", "utf8");
const index = readFileSync("./index.html", "utf8");

const html = `<!doctype html>
<html>
<body>
  <button id="duelButton" type="button">Play friends</button>
  <button id="notificationButton" type="button">Notifications</button>
  <button id="leaderboardButton" type="button">Leaderboard</button>
  <button id="resultsLeaderboardButton" type="button">Results leaderboard</button>

  <section id="startScreen" class="screen"></section>
  <section id="socialScreen" class="screen social-screen active" aria-labelledby="socialTitle">
    <div class="social-shell">
      <header class="social-header">
        <div>
          <div class="eyebrow">1 VS 1</div>
          <h1 id="socialTitle">Friends &amp; duels</h1>
          <p>Old description</p>
        </div>
        <button id="closeSocialButton" type="button">Back</button>
      </header>
      <section id="duelAccountGate" hidden>
        <button id="openAccountForDuelButton" type="button">Create or sign in</button>
      </section>
      <div id="socialContent">
        <p id="socialStatus"></p>
        <div class="social-grid">
          <section class="social-card" id="createCard">
            <h2>Create a duel</h2>
            <label for="duelFormatSelect">How to play</label>
            <select id="duelFormatSelect"><option value="live">Live</option><option value="turn_based">Turn-based</option></select>
            <label for="duelCategorySelect">Category</label>
            <select id="duelCategorySelect"><option value="mixed">Mixed</option></select>
            <label for="duelDurationSelect">Duration</label>
            <select id="duelDurationSelect"><option value="60">60</option></select>
            <label id="duelInviteAccountLabel" for="duelInviteAccount">Optional account</label>
            <input id="duelInviteAccount">
            <p id="duelFormatNote"></p>
            <button id="createDuelButton" class="primary-button" type="button">Create duel</button>
          </section>

          <section class="social-card" id="joinCard">
            <h2>Join</h2>
            <input id="duelRoomCode">
            <button id="joinDuelButton" class="primary-button" type="button">Join duel</button>
            <div id="duelInvitations" class="social-list">
              <div class="social-row"><div class="social-row-copy"><strong>Sam</strong><small>60s · Mixed · #1006</small></div><div class="row-actions"><button type="button" data-action="join">Accept</button></div></div>
            </div>
          </section>

          <section class="social-card" id="turnCard">
            <h2>Turn-based challenges</h2>
            <div id="turnChallenges" class="social-list">
              <div class="social-row"><div class="social-row-copy"><strong>Jaketh</strong><small>Your turn · #1003</small></div><div class="row-actions"><button type="button" data-action="play">Play</button><button type="button">Decline</button></div></div>
            </div>
            <div id="turnChallengeActivity" class="social-list"></div>
          </section>

          <section class="social-card" id="friendsCard">
            <h2>Friends</h2>
            <input id="friendAccountNumber">
            <button id="addFriendButton" type="button">Add</button>
            <div id="friendRequests" class="social-list">
              <div class="social-row"><div class="social-row-copy"><strong>Morgan</strong><small>Account #1005</small></div><div class="row-actions"><button type="button" data-action="accept">Accept</button><button type="button">Decline</button></div></div>
            </div>
            <div id="friendsList" class="social-list">
              <div class="social-row"><div class="social-row-copy"><strong>CamboTest</strong><small>Account #1004</small></div><div class="row-actions"><button type="button" data-action="live">Live</button><button type="button">Take turns</button><button type="button">Remove</button></div></div>
            </div>
          </section>

          <section class="social-card" id="historyCard">
            <h2>Match history</h2>
            <input id="historyOpponentFilter">
            <div id="duelHistory" class="social-list"></div>
          </section>

          <section class="social-card" id="duelLeaderboardCard">
            <h2>Duel leaderboard</h2>
            <p class="card-note"></p>
            <div class="compact-filter">
              <button class="active" type="button" data-duel-leaderboard-format="all">All</button>
              <button type="button" data-duel-leaderboard-format="live">Live</button>
              <button type="button" data-duel-leaderboard-format="turn_based">Turn-based</button>
            </div>
            <div id="duelLeaderboard" class="social-list"></div>
          </section>

          <section id="notificationCard" class="social-card">
            <div class="card-title-row"><h2>Notifications</h2><button id="markNotificationsReadButton">Mark all read</button></div>
            <div id="notificationList"></div>
            <div class="notification-settings">
              <label><input id="challengeNotificationsToggle" type="checkbox">Challenges</label>
              <label><input id="friendNotificationsToggle" type="checkbox">Friends</label>
              <label><input id="emailNotificationsToggle" type="checkbox">Email</label>
              <button id="pushNotificationsButton">Enable push</button>
            </div>
            <p id="notificationStatus"></p>
          </section>
        </div>
      </div>
    </div>
  </section>

  <section id="leaderboardScreen" class="screen"><div class="leaderboard-card"></div></section>
</body>
</html>`;

const dom = new JSDOM(html, {
  url: "https://example.github.io/TriviaRush/?social=play",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;

window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
window.cancelAnimationFrame = (identifier) => window.clearTimeout(identifier);
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
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

const rpcData = {
  get_social_dashboard: {
    friends: [{ player_id: "friend-1", display_name: "CamboTest", account_number: 1004, is_online: true }],
    incoming: [{ friendship_id: "request-1", display_name: "Morgan", account_number: 1005 }],
    outgoing: []
  },
  get_duel_invitations: [{ host_display_name: "Sam", host_account_number: 1006, room_code: "AB12CD34" }],
  get_turn_challenges: {
    active: [{
      match_id: "match-turn-1",
      opponent_display_name: "Jaketh",
      opponent_account_number: 1003,
      status: "guest_turn",
      self_round_status: "pending",
      can_start: true,
      can_decline: true,
      can_cancel: false
    }],
    recent_closed: [{ opponent_display_name: "Alex", closed_reason: "cancelled" }]
  },
  get_duel_match_history_v2: [
    { outcome: "win", opponent_display_name: "CamboTest", player_score: 734, opponent_score: 0, match_format: "live", completed_at: "2026-07-17T10:00:00Z", category_id: "mixed", duration_seconds: 60 },
    { outcome: "loss", opponent_display_name: "Jaketh", player_score: 769, opponent_score: 1229, match_format: "turn_based", completed_at: "2026-07-16T10:00:00Z", category_id: "history", duration_seconds: 60 },
    { outcome: "win", opponent_display_name: "Sam", player_score: 682, opponent_score: 0, match_format: "live", completed_at: "2026-07-14T10:00:00Z", category_id: "science", duration_seconds: 60 },
    { outcome: "cancelled", opponent_display_name: "Alex", match_format: "turn_based", completed_at: "2026-07-13T10:00:00Z" },
    { outcome: "win", opponent_display_name: "CamboTest", player_score: 540, opponent_score: 320, match_format: "live", completed_at: "2026-07-12T10:00:00Z" },
    { outcome: "loss", opponent_display_name: "Morgan", player_score: 200, opponent_score: 450, match_format: "live", completed_at: "2026-07-11T10:00:00Z" },
    { outcome: "draw", opponent_display_name: "Sam", player_score: 500, opponent_score: 500, match_format: "turn_based", completed_at: "2026-07-10T10:00:00Z" }
  ],
  get_duel_leaderboard_v2: [{ leaderboard_rank: 1, display_name: "Cambo", wins: 7, draws: 1, losses: 4 }],
  get_notifications: [],
  get_notification_preferences: { challenge_notifications: true }
};

const originalClient = {
  rpc: async (name, parameters = {}) => ({ data: rpcData[name] ?? null, error: null, parameters })
};
window.supabase = { createClient: () => originalClient };

window.eval(bridgeScript);
const bridgedClient = window.supabase.createClient("url", "key");
for (const name of Object.keys(rpcData)) {
  const parameters = name === "get_duel_match_history_v2"
    ? { p_match_format: "all", p_limit: 30 }
    : {};
  await bridgedClient.rpc(name, parameters);
}

let joinClicks = 0;
let playClicks = 0;
let liveClicks = 0;
let acceptClicks = 0;
let leaderboardRefreshClicks = 0;
window.document.querySelector('[data-action="join"]').addEventListener("click", () => { joinClicks += 1; });
window.document.querySelector('[data-action="play"]').addEventListener("click", () => { playClicks += 1; });
window.document.querySelector('[data-action="live"]').addEventListener("click", () => { liveClicks += 1; });
window.document.querySelector('[data-action="accept"]').addEventListener("click", () => { acceptClicks += 1; });
window.document.querySelector('[data-duel-leaderboard-format="all"]').addEventListener("click", () => { leaderboardRefreshClicks += 1; });
window.document.querySelector("#joinDuelButton").addEventListener("click", () => { joinClicks += 1; });

window.eval(redesignScript);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise((resolve) => window.setTimeout(resolve, 60));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

const tabs = [...window.document.querySelectorAll('[role="tab"]')];
assert("three accessible social tabs are created", tabs.length === 3 && tabs.every((tab) => tab.hasAttribute("aria-controls")));
assert("Play is the default selected tab", window.document.querySelector('[data-social-tab="play"]')?.getAttribute("aria-selected") === "true");
assert("Play view owns the existing join controls", Boolean(window.document.querySelector('#socialPanel-play #duelRoomCode')) && Boolean(window.document.querySelector('#socialPanel-play #joinDuelButton')));
assert("Active challenges appear before the Host and Join cards", window.document.querySelector('#socialPanel-play')?.firstElementChild?.classList.contains("social-active-section") === true);
assert("Host and Join share the Online cyan action theme", window.document.querySelector(".social-host-action .social-action-icon-teal") !== null && window.document.querySelector("#openDuelConfigButton")?.classList.contains("social-outline-action") === true);
assert("Play with friends heading is centred at every width", styles.includes(".social-tabs-redesign .social-page-heading") && styles.includes("justify-self: center") && styles.includes("text-align: center"));

window.document.querySelector("#openDuelConfigButton").click();
assert("Create room opens the existing duel configuration in a dialog", window.document.querySelector("#duelConfigDialog")?.open === true && Boolean(window.document.querySelector("#duelConfigDialog #createDuelButton")));
window.document.querySelector("#duelConfigDialog").close();

window.document.querySelector("#joinDuelButton").click();
assert("Join game keeps the existing join action", joinClicks === 1);

const playChallenge = [...window.document.querySelectorAll("#activeChallengesList button")]
  .find((button) => button.textContent.trim() === "Play");
playChallenge?.click();
assert("Active challenge Play proxies the existing turn action", playClicks === 1);

const emptyReceivedAt = Date.now() + 10_000;
window.triviaRushSocialRpcCache.set("get_duel_invitations:empty-test", {
  functionName: "get_duel_invitations",
  parameters: {},
  data: [],
  receivedAt: emptyReceivedAt
});
window.triviaRushSocialRpcCache.set("get_turn_challenges:empty-test", {
  functionName: "get_turn_challenges",
  parameters: {},
  data: { active: [], recent_closed: [] },
  receivedAt: emptyReceivedAt
});
window.dispatchEvent(new window.CustomEvent("trivia-rush:social-rpc"));
await new Promise((resolve) => window.setTimeout(resolve, 20));
assert("Empty challenges use the intentional call-to-action panel", window.document.querySelector("#activeChallengesList.is-empty .social-empty-challenge-action")?.textContent === "Challenge a friend");
window.document.querySelector(".social-empty-challenge-action")?.click();
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("Challenge a friend opens the Friends tab and focuses the account field", window.document.querySelector('[data-social-tab="friends"]')?.getAttribute("aria-selected") === "true" && window.document.activeElement === window.document.querySelector("#friendAccountNumber"));
window.triviaRushSocialRpcCache.delete("get_duel_invitations:empty-test");
window.triviaRushSocialRpcCache.delete("get_turn_challenges:empty-test");

const playTab = window.document.querySelector('[data-social-tab="play"]');
playTab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("keyboard navigation selects Friends", window.document.querySelector('[data-social-tab="friends"]')?.getAttribute("aria-selected") === "true");
assert("tab state is preserved in the URL", new URL(window.location.href).searchParams.get("social") === "friends");

const challengeButton = window.document.querySelector("#friendsCompactList .primary-small");
challengeButton?.click();
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("Friend Challenge proxies the existing live-duel preparation", liveClicks === 1);
assert("destructive friend removal is only inside the more menu", Boolean(window.document.querySelector("#friendsCompactList .social-more-menu-popover .destructive")) && ![...window.document.querySelectorAll("#friendsCompactList > button")].some((button) => button.textContent.includes("Remove")));

const acceptButton = window.document.querySelector("#friendRequestsCompactList .accept");
acceptButton?.click();
assert("friend request acceptance preserves the existing handler", acceptClicks === 1);

window.document.querySelector('[data-social-tab="history"]').click();
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("History summary is derived from real RPC rows", window.document.querySelector("#socialTotalMatches")?.textContent === "7" && window.document.querySelector("#socialTotalWins")?.textContent === "3");
assert("History initially limits rendered matches", window.document.querySelectorAll("#recentMatchesList .social-history-row").length === 5 && window.document.querySelector(".social-load-older")?.hidden === false);
window.document.querySelector(".social-load-older").click();
assert("Load older matches reveals the next cached page", window.document.querySelectorAll("#recentMatchesList .social-history-row").length === 7);

window.document.querySelector('[data-history-format="turn_based"]').click();
assert("history format filter updates its accessible state", window.document.querySelector('[data-history-format="turn_based"]')?.getAttribute("aria-pressed") === "true");
assert("history format filter restricts rows", window.document.querySelectorAll("#recentMatchesList .social-history-row").length === 3);
window.document.querySelector("#recentMatchesList .social-row-button")?.click();
assert("history View opens focused match details", window.document.querySelector("#historyMatchDialog")?.open === true);

window.document.querySelector("#leaderboardButton").click();
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("duel leaderboard is moved to the main Leaderboard page", Boolean(window.document.querySelector("#leaderboardScreen #duelLeaderboard")) && !window.document.querySelector("#socialScreen #duelLeaderboard"));
assert("opening Leaderboard refreshes existing duel rankings", leaderboardRefreshClicks === 1);

window.document.querySelector("#notificationButton").click();
await new Promise((resolve) => window.setTimeout(resolve, 0));
assert("notification settings are moved to the notification dialog", window.document.querySelector("#notificationDialog")?.open === true && Boolean(window.document.querySelector("#notificationDialog #notificationCard")) && !window.document.querySelector("#socialScreen #notificationCard"));

const bridgeIndex = index.indexOf("social-rpc-bridge.js?v=2");
const appIndex = index.search(/app\.js\?v=\d+/);
const redesignIndex = index.indexOf("social-redesign.js?v=2");
assert("social RPC bridge caches existing data contracts", window.triviaRushSocialRpcCache instanceof window.Map && window.triviaRushSocialRpcCache.size === Object.keys(rpcData).length);
assert(
  "production page links the social assets in execution order",
  index.includes('href="social-redesign.css?v=2"') &&
    bridgeIndex >= 0 &&
    appIndex >= 0 &&
    redesignIndex >= 0 &&
    bridgeIndex < appIndex &&
    appIndex < redesignIndex
);
assert("responsive desktop and mobile rules are included", styles.includes("@media (max-width: 760px)") && styles.includes("@media (max-width: 560px)"));
assert("restrained teal and violet depth gradients are included", styles.includes("radial-gradient(circle at 14% 50%") && styles.includes("radial-gradient(circle at 85% 42%"));
assert("tabs use correct ARIA panel relationships", tabs.every((tab) => window.document.getElementById(tab.getAttribute("aria-controls"))?.getAttribute("role") === "tabpanel"));

console.log(results.join("\n"));
window.close();
