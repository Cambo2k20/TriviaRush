import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const runtime = readFileSync("./mode-navigation.js", "utf8");
const styles = readFileSync("./mode-navigation.css", "utf8");
const index = readFileSync("./index.html", "utf8");

const dom = new JSDOM(`<!doctype html><html><body>
  <main class="app-shell">
    <header class="topbar">
      <a class="brand" href="./">Trivia Rush</a>
      <div class="header-actions">
        <button id="notificationButton" type="button"><span>bell</span><span id="notificationBadge" class="notification-badge">2</span></button>
        <button id="duelButton" class="duel-button" type="button"><span>swords</span><span id="duelButtonText">Play friends</span></button>
        <button id="leaderboardButton" type="button"><span>trophy</span><span>Leaderboard</span></button>
        <button id="accountButton" type="button"><span>person</span><span>Account</span></button>
        <button id="soundToggle" type="button"><span>sound</span></button>
        <button id="hostToggle" type="button"><span>host</span></button>
      </div>
    </header>
    <section id="startScreen" class="screen active"><select id="categorySelect"></select></section>
    <section id="countdownScreen" class="screen"></section>
    <section id="gameScreen" class="screen"></section>
    <section id="resultsScreen" class="screen"><button id="homeButton">Home</button></section>
    <section id="socialScreen" class="screen"><select id="duelCategorySelect"></select><button id="closeSocialButton">Back</button></section>
    <section id="duelWaitingScreen" class="screen"></section>
    <section id="duelGameScreen" class="screen"></section>
    <section id="duelResultsScreen" class="screen"><button id="duelResultsHomeButton">Online home</button></section>
    <section id="leaderboardScreen" class="screen"><button id="closeLeaderboardButton">Back</button></section>
    <nav class="home-quick-actions"></nav>
  </main>
</body></html>`, {
  runScripts: "outside-only",
  url: "https://example.test/"
});

const { window } = dom;
const { document } = window;
let onlineClicks = 0;

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
}

function flush() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

document.querySelector("#duelButton").addEventListener("click", () => {
  onlineClicks += 1;
  show("socialScreen");
});
document.querySelector("#closeSocialButton").addEventListener("click", () => show("startScreen"));
document.querySelector("#homeButton").addEventListener("click", () => show("startScreen"));
document.querySelector("#duelResultsHomeButton").addEventListener("click", () => show("socialScreen"));
document.querySelector("#closeLeaderboardButton").addEventListener("click", () => show("startScreen"));

window.eval(runtime);
document.dispatchEvent(new window.Event("DOMContentLoaded"));
await flush();

const modeNavigation = document.querySelector("#modeNavigation");
const soloButton = document.querySelector("#soloModeButton");
const onlineButton = document.querySelector("#duelButton");
const soloSelectedAtStartup = soloButton?.classList.contains("is-selected") && soloButton.getAttribute("aria-pressed") === "true";

onlineButton.click();
await flush();
const existingOnlineHandlerWorked = onlineClicks === 1 && document.querySelector("#socialScreen").classList.contains("active");
const onlineSelectedOnSocial = onlineButton.classList.contains("is-selected") && !soloButton.classList.contains("is-selected");

soloButton.click();
await flush();
const soloReturnedThroughExistingBack = document.querySelector("#startScreen").classList.contains("active") && soloButton.classList.contains("is-selected");

show("leaderboardScreen");
await flush();
const leaderboardPreservedMode = soloButton.classList.contains("is-selected");

show("gameScreen");
await flush();
const gameLockedModeSwitch = soloButton.disabled === true;

const unifiedCssIndex = index.search(/unified-shell\.css\?v=\d+/);
const modeCssIndex = index.search(/mode-navigation\.css\?v=\d+/);
const unifiedJsIndex = index.search(/unified-shell\.js\?v=\d+/);
const modeJsIndex = index.search(/mode-navigation\.js\?v=\d+/);

const checks = [
  ["one shared mode navigation is added", Boolean(modeNavigation) && document.querySelectorAll("#modeNavigation").length === 1],
  ["the existing Online button is reused rather than duplicated", modeNavigation?.contains(onlineButton) && document.querySelectorAll("#duelButton").length === 1],
  ["Solo is selected on startup", soloSelectedAtStartup],
  ["the existing Play friends control is relabelled Online", document.querySelector("#duelButtonText")?.textContent === "Online"],
  ["Online still uses the existing click handler", existingOnlineHandlerWorked],
  ["Online remains highlighted across the Online screen", onlineSelectedOnSocial],
  ["Solo returns through the existing social Back handler", soloReturnedThroughExistingBack],
  ["Solo and Online category selectors remain separate", document.querySelector("#categorySelect") !== document.querySelector("#duelCategorySelect")],
  ["leaderboard does not replace the selected game mode", leaderboardPreservedMode],
  ["mode switching is locked while a game is active", gameLockedModeSwitch],
  ["mobile utility controls use the existing buttons", ["notificationButton", "leaderboardButton", "accountButton", "soundToggle"].every((id) => document.querySelector(`#${id}`)?.classList.contains("mobile-utility-button"))],
  ["desktop navigation includes a selected mode treatment", styles.includes(".mode-nav-button.is-selected") && styles.includes("#duelButton.is-selected")],
  ["mobile header keeps the enlarged brand on one line above game modes", styles.includes(".topbar > .brand") && styles.includes("display: inline-flex !important") && styles.includes("white-space: nowrap") && styles.includes("font-size: 1.4rem") && styles.includes("flex: 0 0 48px")],
  ["mobile utilities form a fixed safe-area footer", styles.includes("position: fixed !important") && styles.includes("env(safe-area-inset-bottom)") && styles.includes("data-mobile-label")],
  ["legacy Home quick actions are removed from the menu hierarchy", styles.includes("#startScreen > .home-quick-actions") && styles.includes("display: none !important")],
  ["production loads shared navigation assets after the unified shell", unifiedCssIndex >= 0 && modeCssIndex >= 0 && unifiedJsIndex >= 0 && modeJsIndex >= 0 && unifiedCssIndex < modeCssIndex && unifiedJsIndex < modeJsIndex]
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed = true;
}

if (failed) process.exitCode = 1;
