import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const runtime = readFileSync("./unified-shell.js", "utf8");
const styles = readFileSync("./unified-shell.css", "utf8");
const index = readFileSync("./index.html", "utf8");

const dom = new JSDOM(`<!doctype html>
<html lang="en">
<body>
  <main class="app-shell">
    <header class="topbar"></header>
    <section id="startScreen" class="screen active"></section>
    <section id="countdownScreen" class="screen"></section>
    <section id="gameScreen" class="screen"></section>
    <section id="resultsScreen" class="screen"></section>
    <section id="socialScreen" class="screen social-screen"></section>
    <section id="duelWaitingScreen" class="screen"></section>
    <section id="duelGameScreen" class="screen"></section>
    <section id="duelResultsScreen" class="screen"></section>
    <section id="leaderboardScreen" class="screen leaderboard-screen"></section>
    <footer></footer>
  </main>
</body>
</html>`, {
  url: "https://example.github.io/TriviaRush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});

const { window } = dom;
window.eval(runtime);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise((resolve) => window.setTimeout(resolve, 0));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

const activate = async (id) => {
  window.document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
};

assert(
  "shared shell initialises on the current page",
  window.document.body.classList.contains("trivia-shell-ready")
);
assert(
  "home is classified as a full page",
  window.document.body.dataset.activeScreen === "startScreen" &&
    window.document.body.classList.contains("trivia-page-active")
);

await activate("socialScreen");
assert(
  "social screen keeps the full-page shell",
  window.document.body.dataset.activeScreen === "socialScreen" &&
    window.document.body.classList.contains("trivia-page-active") &&
    !window.document.body.classList.contains("trivia-game-active")
);

await activate("leaderboardScreen");
assert(
  "leaderboard uses the same full-page classification",
  window.document.body.dataset.activeScreen === "leaderboardScreen" &&
    window.document.body.classList.contains("trivia-page-active")
);

await activate("gameScreen");
assert(
  "solo gameplay receives the focused game classification",
  window.document.body.dataset.activeScreen === "gameScreen" &&
    window.document.body.classList.contains("trivia-game-active") &&
    !window.document.body.classList.contains("trivia-page-active")
);

await activate("duelGameScreen");
assert(
  "duel gameplay uses the same game shell",
  window.document.body.dataset.activeScreen === "duelGameScreen" &&
    window.document.body.classList.contains("trivia-game-active")
);

await activate("resultsScreen");
assert(
  "results use the focused-state shell",
  window.document.body.dataset.activeScreen === "resultsScreen" &&
    window.document.body.classList.contains("trivia-focus-active")
);

assert(
  "outer application shell is full width",
  styles.includes("body.trivia-shell-ready .app-shell") &&
    styles.includes("max-width: none")
);
assert(
  "home, social and leaderboard use centred internal containers",
  styles.includes("body.trivia-shell-ready #startScreen") &&
    styles.includes(".social-tabs-redesign .social-shell") &&
    styles.includes("body.trivia-shell-ready .leaderboard-card")
);
assert(
  "shared header treatment is applied outside the home page",
  styles.includes("body.trivia-shell-ready .topbar") &&
    styles.includes("body.trivia-shell-ready .header-actions > button")
);
assert(
  "social viewport pseudo-background is removed in favour of the shared page background",
  styles.includes("body.trivia-shell-ready.social-redesign-ready .social-screen::before") &&
    styles.includes("content: none")
);
assert(
  "production page loads unified shell CSS after social CSS",
  index.includes('href="unified-shell.css?v=1"') &&
    index.indexOf('social-redesign.css?v=2') < index.indexOf('unified-shell.css?v=1')
);
assert(
  "production page loads unified shell runtime last",
  index.includes('src="unified-shell.js?v=1"') &&
    index.indexOf('home-redesign.js?v=1') < index.indexOf('unified-shell.js?v=1')
);

console.log(results.join("\n"));
window.close();
