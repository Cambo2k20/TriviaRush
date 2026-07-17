import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const runtime = readFileSync("./mobile-mode-menu.js", "utf8");
const styles = readFileSync("./mobile-mode-menu.css", "utf8");
const index = readFileSync("./index.html", "utf8");

const dom = new JSDOM(`<!doctype html><html><body>
  <button id="duelButton" type="button">Friends</button>
  <section id="startScreen" class="screen active home-screen-v2">
    <div class="home-hero-v2">
      <span id="startHighScore">120</span>
      <span id="startBestStreak">7</span>
      <span id="homeGlobalLevel">4</span>
    </div>
    <aside class="home-category-browser"></aside>
    <nav class="home-quick-actions"></nav>
  </section>
  <button id="homeButton" type="button">Change category</button>
</body></html>`, {
  runScripts: "outside-only",
  url: "https://example.test/"
});

const { window } = dom;
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};

let friendClicks = 0;
window.document.getElementById("duelButton").addEventListener("click", () => {
  friendClicks += 1;
});

window.eval(runtime);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise((resolve) => window.setTimeout(resolve, 0));

const startScreen = window.document.getElementById("startScreen");
const soloButton = window.document.getElementById("mobileSoloMode");
const friendsButton = window.document.getElementById("mobileFriendsMode");
const backButton = window.document.getElementById("mobileSoloBack");

const checks = [
  ["mobile mode menu initialises ahead of solo setup", startScreen.dataset.mobileHomeStage === "modes"],
  ["mobile mode menu is inserted into the existing Home screen", Boolean(window.document.getElementById("mobileModeMenu"))],
  ["existing desktop Home content remains in the DOM", Boolean(startScreen.querySelector(".home-hero-v2")) && Boolean(startScreen.querySelector(".home-category-browser"))],
  ["Solo Rush opens the existing solo setup stage", (() => {
    soloButton.click();
    return startScreen.dataset.mobileHomeStage === "solo";
  })()],
  ["Game modes returns from solo setup to mode selection", (() => {
    backButton.click();
    return startScreen.dataset.mobileHomeStage === "modes";
  })()],
  ["Play with friends delegates to the existing duel button", (() => {
    friendsButton.click();
    return friendClicks === 1;
  })()],
  ["Change category returns directly to solo setup", (() => {
    window.document.getElementById("homeButton").click();
    return startScreen.dataset.mobileHomeStage === "solo";
  })()],
  ["unimplemented modes are visibly disabled", window.document.getElementById("mobilePracticeMode").disabled && window.document.getElementById("mobileDailyMode").disabled],
  ["mode menu mirrors real player progress", window.document.getElementById("mobileModeHighScore").textContent === "120" && window.document.getElementById("mobileModeBestStreak").textContent === "7" && window.document.getElementById("mobileModeLevel").textContent === "4"],
  ["desktop remains unchanged because the menu is hidden outside the mobile query", styles.startsWith(".mobile-mode-menu,\n.mobile-solo-back {\n  display: none;") && styles.includes("@media (max-width: 700px)")],
  ["mobile quick actions are removed after mode selection replaces them", styles.includes("#startScreen.home-screen-v2 > .home-quick-actions") && styles.includes("display: none !important")],
  ["production loads the mobile mode assets after the Home hotfix", index.includes('href="mobile-mode-menu.css?v=1"') && index.includes('src="mobile-mode-menu.js?v=1"') && index.indexOf('mobile-home-hotfix.css?v=1') < index.indexOf('mobile-mode-menu.css?v=1')],
  ["mobile mode runtime loads after the shared shell runtime", index.indexOf('unified-shell.js?v=1') < index.indexOf('mobile-mode-menu.js?v=1')]
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed = true;
}

if (failed) process.exitCode = 1;
