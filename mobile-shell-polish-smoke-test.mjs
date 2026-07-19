import { readFileSync } from "node:fs";

const styles = readFileSync("./mobile-shell-polish.css", "utf8");
const index = readFileSync("./index.html", "utf8");
const fixture = readFileSync("./tests/social-redesign-visual-fixture.html", "utf8");

const checks = [
  [
    "production loads mobile polish after the unified shell",
    index.includes('href="mobile-shell-polish.css?v=1"') &&
      index.indexOf('unified-shell.css?v=1') < index.indexOf('mobile-shell-polish.css?v=1')
  ],
  [
    "mobile logo text is explicitly preserved",
    styles.includes(".brand > span:last-child") && styles.includes("display: inline !important")
  ],
  [
    "mobile navigation retains real icon spans",
    styles.includes(".duel-button > span:first-child") &&
      styles.includes(".leaderboard-button > span:first-child") &&
      styles.includes(".account-button > span:first-child")
  ],
  [
    "mobile header uses bounded icon controls",
    styles.includes("--tr-mobile-control: 40px") &&
      styles.includes("grid-auto-columns: var(--tr-mobile-control)")
  ],
  [
    "duplicate mobile voice control is hidden",
    styles.includes("#hostToggle") && styles.includes("display: none !important")
  ],
  [
    "social mobile header no longer reserves an empty absolute back-button row",
    styles.includes(".social-back-button") &&
      styles.includes("position: static") &&
      styles.includes("padding-top: 0")
  ],
  [
    "mobile play actions use one spaced and padded card column",
    styles.includes(".social-play-actions") &&
      styles.includes("grid-template-columns: 1fr") &&
      styles.includes("margin-bottom: 26px") &&
      styles.includes("gap: 20px") &&
      styles.includes("padding: 26px 20px")
  ],
  [
    "visual fixture is wired to shared and mobile shell assets",
    fixture.includes('../unified-shell.css?v=1') &&
      fixture.includes('../mobile-shell-polish.css?v=1') &&
      fixture.includes('../unified-shell.js?v=1')
  ]
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed = true;
}

if (failed) process.exitCode = 1;
