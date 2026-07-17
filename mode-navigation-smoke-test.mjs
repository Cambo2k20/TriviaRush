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
await new Promise((resolve) => window.setTimeout(resolve, 0));

const modeNavigation = document.querySelector("#modeNavigation");
const soloButton = document.querySelector("#soloModeButton");
const onlineButton = document.querySelector("#duelButton");

const checks = [
  ["one shared mode navigation is added", Boolean(modeNavigation) && document.querySelectorAll("#modeNavigation").length === 1],
  ["the existing Online button is reused rather than duplicated", modeNavigation?.contains(onlineButton) && document.querySelectorAll("#duelButton").length === 1],
  ["Solo is selected on startup", soloButton?.classList.contains("is-selected") && soloButton.getAttribute("aria-pressed") === "true"],
  ["the existing Play friends control is relabelled Online", document.querySelector("#duelButtonText")?.textContent === "Online"],
  ["Online still uses the existing click handler", (() => {
    onlineButton.click();
    return onlineClicks === 1 && document.querySelector("#socialScreen").classList.contains("active");
  })()],
  ["Online remains highlighted across the Online screen", onlineButton.classList.contains("is-selected") && !soloButton.classList.contains("is-selected")],
  ["Solo returns through the existing social Back handler", (() => {
    soloButton.click();
    return document.querySelector("#startScreen").classList.contains("active") && soloButton.classList.contains("is-selected");
  })()],
  ["Solo and Online category selectors remain separate", document.querySelector("#categorySelect") !== document.querySelector("#duelCategorySelect")],
  ["leaderboard does not replace the selected game mode", (() => {
    show("leaderboardScreen");
    return soloButton.classList.contains("is-selected");
  })()],
  ["mode switching is locked while a game is active", (() => {
    show("gameScreen");
    return soloButton.disabled === true;
  })()],
  ["mobile utility controls use the existing buttons", ["notificationButton", "leaderboardButton", "accountButton", "soundToggle"].every((id) => document.querySelector(`#${id}`)?.classList.contains("mobile-utility-button"))],
  ["desktop navigation includes a selected mode treatment", styles.includes(".mode-nav-button.is-selected") && styles.includes("#duelButton.is-selected")],
  ["mobile header contains only mode navigation controls", styles.includes(".topbar > .brand") && styles.includes("display: none !important")],
  ["mobile utilities form a fixed safe-area footer", styles.includes("position: fixed !important") && styles.includes("env(safe-area-inset-bottom)") && styles.includes("data-mobile-label")],
  ["legacy Home quick actions are removed from the menu hierarchy", styles.includes("#startScreen > .home-quick-actions") && styles.includes("display: none !important")],
  ["production loads shared navigation assets after the unified shell", index.includes('href="mode-navigation.css?v=1"') && index.includes('src="mode-navigation.js?v=1"') && index.indexOf('unified-shell.css?v=1') < index.indexOf('mode-navigation.css?v=1') && index.indexOf('unified-shell.js?v=1') < index.indexOf('mode-navigation.js?v=1')]
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed = true;
}

if (failed) process.exitCode = 1;
