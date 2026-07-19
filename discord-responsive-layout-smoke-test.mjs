import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const styles = readFileSync("./discord-responsive.css", "utf8");
const homeStyles = readFileSync("./home-redesign.css", "utf8");
const script = readFileSync("./discord-layout.js", "utf8");
const appScript = readFileSync("./app.js", "utf8");

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

const cssLinks = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)]
  .map((match) => match[1]);
const responsiveIndex = cssLinks.findIndex((href) => href.startsWith("discord-responsive.css"));
const modeIndex = cssLinks.findIndex((href) => href.startsWith("mode-navigation.css"));

assert("responsive stylesheet exists and is linked", styles.length > 0 && responsiveIndex >= 0);
assert("responsive stylesheet loads after mode navigation", responsiveIndex > modeIndex);
assert("responsive stylesheet is the final CSS layer", responsiveIndex === cssLinks.length - 1);
assert("Discord layout runtime is loaded", html.includes('src="discord-layout.js?v=1"'));
assert("desktop Home layout only displays while active", /#startScreen\.home-screen-v2\.active\s*\{[^}]*display:\s*grid/s.test(styles));
assert("mobile Home layout only displays while active", /max-width:\s*759px[\s\S]*?#startScreen\.home-screen-v2\.active\s*\{[^}]*display:\s*flex/s.test(styles));
assert("inactive Home screen is never forced visible", !/#startScreen\.home-screen-v2(?!\.active)[^{]*\{[^}]*display:/s.test(styles));
assert("hero title can wrap", /\.home-hero-v2 h1\s*\{[^}]*white-space:\s*normal/s.test(homeStyles));
assert("rigid 540px home column minimum is removed", !homeStyles.includes("minmax(540px"));
assert("compact width breakpoint exists", styles.includes("max-width: 1279px"));
assert("short-height breakpoint exists", styles.includes("max-height: 619px"));
assert("category panel uses min-height zero", /\.home-category-browser\s*\{[^}]*min-height:\s*0/s.test(styles));
assert("header actions never wrap", /\.header-actions\s*\{[^}]*flex-wrap:\s*nowrap/s.test(styles));
assert("grid layout selector exists", styles.includes('data-discord-layout="grid"'));
assert("PIP layout selector exists", styles.includes('data-discord-layout="pip"'));
assert("Discord safe-area variables exist", styles.includes("--discord-safe-area-inset-bottom"));
assert("short focused layout hides the footer", /max-height:\s*620px[\s\S]*?footer\s*\{\s*display:\s*none/s.test(styles));
assert("very short landscape compacts the header", /max-height:\s*440px[\s\S]*?\.topbar\s*\{[^}]*padding-block:\s*0/s.test(styles));
assert("very short landscape removes the optional voice toggle", /max-height:\s*440px[\s\S]*?\.home-host-toggle\s*\{\s*display:\s*none/s.test(styles));
assert("mobile removes the nested category scrollbar", /max-width:\s*759px[\s\S]*?\.home-category-grid\s*\{[^}]*overflow:\s*visible/s.test(styles));
assert("solo HUD is inside the question card", /<article class="question-card">\s*<div class="game-header">/s.test(html));
assert("solo answers stack in one column", /#gameScreen \.answer-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s.test(styles));
assert("solo actions use two equal columns", /#gameScreen \.game-actions\s*\{[^}]*repeat\(2,/s.test(styles));
assert("answer choices use letter markers", appScript.includes("String.fromCharCode(65 + index)"));
assert("timer uses a full track and progress ring", html.includes('class="timer-track"') && html.includes('class="timer-progress"'));
assert("timer starts green before warning states", appScript.includes('elements.timerProgress.style.stroke = "var(--green)"'));
assert("post-match summary has a dedicated overview", html.includes('class="result-overview"'));
assert("post-match card uses the compact reference width", /#resultsScreen \.result-card\s*\{[^}]*width:\s*min\(720px,/s.test(styles));
assert("post-match card follows one vertical column", /#resultsScreen \.result-card\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s.test(styles));
assert("hidden retry control cannot be forced visible", /#resultsScreen \.retry-save-button\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s.test(styles));
assert("post-match actions use three equal columns", /#resultsScreen \.result-actions\s*\{[^}]*repeat\(3,/s.test(styles));
assert("mobile post-match removes the nested scrollbar", /max-width:\s*759px[\s\S]*?#resultsScreen \.result-card\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible/s.test(styles));
assert("leaderboard uses a themed category menu backed by its native select", html.includes('id="leaderboardCategorySelect"') && html.includes('id="leaderboardCategoryButton"') && html.includes('id="leaderboardCategoryMenu"') && !html.includes('id="leaderboardCategoryFilters"'));
assert("leaderboard filters and personal rank share a dashboard row", /leaderboard-dashboard-row[\s\S]*?leaderboard-filter-panel[\s\S]*?currentPlayerRank/s.test(html));
assert("leaderboard includes a top-three podium", html.includes('id="leaderboardPodium"') && styles.includes(".leaderboard-podium-card"));
assert("leaderboard category menu has an internal themed scrollbar", /\.leaderboard-category-menu\)::-webkit-scrollbar-thumb[\s\S]*?linear-gradient/s.test(styles));
assert("first place has a dedicated gold surface", /\.leaderboard-podium-card\.podium-rank-1\s*\{[^}]*border-color:\s*rgba\(255, 213, 74, 0\.9\);[^}]*radial-gradient/s.test(styles));
assert("leaderboard desktop table removes the ID column", /leaderboard-table-header[\s\S]*?<span>Player<\/span>\s*<span>High score<\/span>/s.test(html));
assert("leaderboard table uses five readable columns", /\.leaderboard-table-header,[\s\S]*?\.leaderboard-row\s*\{[^}]*grid-template-columns:[^}]*minmax\(78px,/s.test(styles));
assert("mobile leaderboard entries use a two-row card layout", /max-width:\s*850px[\s\S]*?grid-template-areas:\s*"rank player score"\s*"rank accuracy streak"/s.test(styles));
assert("mobile podium cards retain three balanced content columns", /max-width:\s*580px[\s\S]*?\.leaderboard-podium-card\s*\{[^}]*grid-template-columns:\s*46px minmax\(0, 1fr\) minmax\(82px, auto\)/s.test(styles));

const dom = new JSDOM(html, {
  url: "https://triviarush.discordsays.com/?frame_id=test&instance_id=test&platform=desktop",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;
const visualViewport = new window.EventTarget();
visualViewport.width = 1024;
visualViewport.height = 600;
window.visualViewport = visualViewport;

let layoutHandler = null;
let interactivePipEnabled = false;
window.DiscordEmbeddedApp = {
  Common: {
    LayoutModeTypeObject: { FOCUSED: 0, PIP: 1, GRID: 2 }
  },
  Events: {
    ACTIVITY_LAYOUT_MODE_UPDATE: "ACTIVITY_LAYOUT_MODE_UPDATE"
  }
};
window.__discordSdk = {
  async subscribeToLayoutModeUpdatesCompat(handler) {
    layoutHandler = handler;
  },
  commands: {
    async setConfig(config) {
      interactivePipEnabled = config.use_interactive_pip === true;
    }
  }
};

window.eval(script);
await new Promise((resolve) => window.setTimeout(resolve, 0));

const root = window.document.documentElement;
assert("viewport density initialises from actual dimensions", root.dataset.viewportDensity === "tight");
assert("screen orientation is exposed", root.dataset.screenOrientation === "landscape");
assert("Discord host is detected", root.dataset.discordHost === "activity");
assert("layout compatibility subscription is registered", typeof layoutHandler === "function");
assert("interactive PIP is enabled", interactivePipEnabled);

layoutHandler?.({ layout_mode: 2 });
assert("grid layout updates the root attribute", root.dataset.discordLayout === "grid");
layoutHandler?.({ layout_mode: 1 });
assert("PIP layout updates the root attribute", root.dataset.discordLayout === "pip");

visualViewport.width = 390;
visualViewport.height = 844;
visualViewport.dispatchEvent(new window.Event("resize"));
assert("visual viewport resize updates density", root.dataset.viewportDensity === "mobile");
assert("visual viewport resize updates orientation", root.dataset.screenOrientation === "portrait");
assert("window resize listener exists", script.includes('window.addEventListener("resize"'));
assert("layout mode updates are integrated", script.includes("subscribeToLayoutModeUpdatesCompat"));

console.log(results.join("\n"));
window.close();
