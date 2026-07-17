import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
let html = readFileSync(path, "utf8");

const stylesheet = '  <link rel="stylesheet" href="progression-ui.css?v=1">';
const redesignStylesheet = '  <link rel="stylesheet" href="home-redesign.css?v=1">';
if (!html.includes(redesignStylesheet)) {
  if (!html.includes(stylesheet)) {
    throw new Error("Could not find the progression stylesheet link.");
  }
  html = html.replace(stylesheet, `${stylesheet}\n${redesignStylesheet}`);
}

const startMarker = '    <section id="startScreen"';
const nextMarker = '    <section id="countdownScreen"';
const startIndex = html.indexOf(startMarker);
const nextIndex = html.indexOf(nextMarker);
if (startIndex === -1 || nextIndex === -1 || nextIndex <= startIndex) {
  throw new Error("Could not locate the home screen section.");
}

const homeMarkup = `    <section id="startScreen" class="screen active home-screen-v2" aria-labelledby="startTitle">
      <div class="home-hero-v2">
        <div class="eyebrow">60 SECONDS. ONE HIGH SCORE.</div>
        <h1 id="startTitle">How many<br>can<br><span>you answer?</span></h1>
        <p class="home-hero-copy">Choose a category and put your knowledge to the test. Race the clock, build your streak and earn global XP.</p>

        <div class="home-selection-row">
          <div class="home-selected-category">Selected:<strong id="selectedCategoryLabel">All categories</strong></div>
          <button id="homeHostToggle" class="home-host-toggle" type="button" aria-pressed="false">
            <span>Voice host</span>
            <span class="home-switch-track" aria-hidden="true"></span>
          </button>
        </div>

        <button id="startButton" class="primary-button home-start-button" type="button" disabled>
          <span>Start the challenge</span>
          <span aria-hidden="true">›</span>
        </button>

        <p id="startStatus" class="start-status home-start-status" role="status" aria-live="polite">Loading the question bank…</p>

        <div class="home-stats-v2" aria-label="Player statistics">
          <div class="home-stat-v2">
            <span>High score</span>
            <strong id="startHighScore">0</strong>
          </div>
          <div class="home-stat-v2">
            <span>Best streak</span>
            <strong id="startBestStreak">0</strong>
          </div>
          <div class="home-stat-v2">
            <span>Global level</span>
            <strong>LV <span id="homeGlobalLevel">1</span></strong>
          </div>
        </div>

        <div class="controls-hint home-controls-hint">
          <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> answer</span>
          <span><kbd>P</kbd> pass</span>
          <span><kbd>V</kbd> voice</span>
        </div>
      </div>

      <aside class="home-category-browser" aria-labelledby="homeCategoryTitle">
        <header class="home-category-heading">
          <span class="home-category-mark" aria-hidden="true">?</span>
          <div>
            <h2 id="homeCategoryTitle">Choose a category</h2>
            <p>Pick one to begin</p>
          </div>
        </header>

        <div id="categoryCardGrid" class="home-category-grid" role="group" aria-label="Question categories"></div>

        <div class="home-category-fallback">
          <label for="categorySelect">Question category</label>
          <select id="categorySelect"></select>
        </div>
      </aside>

      <nav class="home-quick-actions" aria-label="Quick actions">
        <button id="homeChallengeShortcut" class="home-quick-action" type="button" style="--quick-accent:#25e7d1">
          <span aria-hidden="true">◫</span>
          <span>Solo challenge</span>
        </button>
        <button id="homeFriendsShortcut" class="home-quick-action" type="button" style="--quick-accent:#a15cff">
          <span aria-hidden="true">♟</span>
          <span>Play with friends</span>
        </button>
        <button id="homeLeaderboardShortcut" class="home-quick-action" type="button" style="--quick-accent:#8c55ff">
          <span aria-hidden="true">◉</span>
          <span>Leaderboard</span>
        </button>
      </nav>
    </section>

`;

html = `${html.slice(0, startIndex)}${homeMarkup}${html.slice(nextIndex)}`;

const appScript = '  <script src="app.js?v=18"></script>';
const redesignScript = '  <script src="home-redesign.js?v=1"></script>';
if (!html.includes(redesignScript)) {
  if (!html.includes(appScript)) {
    throw new Error("Could not find the main application script.");
  }
  html = html.replace(appScript, `${appScript}\n${redesignScript}`);
}

writeFileSync(path, html);
