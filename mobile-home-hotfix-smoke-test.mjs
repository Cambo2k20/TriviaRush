import { readFileSync } from "node:fs";

const styles = readFileSync("./mobile-home-hotfix.css", "utf8");
const index = readFileSync("./index.html", "utf8");
const headerLogo = readFileSync("./icons/trivia-rush-header-logo.png");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const checks = [
  [
    "production loads the Home mobile hotfix after shell polish",
    index.includes('href="mobile-home-hotfix.css?v=1"') &&
      index.indexOf('mobile-shell-polish.css?v=1') < index.indexOf('mobile-home-hotfix.css?v=1')
  ],
  [
    "labelled mobile navigation icons restore an explicit font size",
    styles.includes(".duel-button > span:first-child") &&
      styles.includes(".leaderboard-button > span:first-child") &&
      styles.includes(".account-button > span:first-child") &&
      styles.includes("font-size: 1.05rem !important")
  ],
  [
    "Home CTA is forced back into normal document flow",
    styles.includes(".home-start-button") &&
      styles.includes("position: static !important") &&
      styles.includes("bottom: auto !important") &&
      styles.includes("z-index: auto !important")
  ],
  [
    "Home quick actions cannot become an overlapping positioned layer",
    styles.includes(".home-quick-actions") &&
      styles.includes("inset: auto !important")
  ],
  [
    "shared header uses the supplied Trivia Rush PNG logo asset",
    styles.includes(".brand-bolt") &&
      styles.includes('url("icons/trivia-rush-header-logo.png")') &&
      styles.includes("font-size: 0 !important") &&
      headerLogo.length > pngSignature.length &&
      headerLogo.subarray(0, pngSignature.length).equals(pngSignature)
  ]
];

let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  if (!passed) failed = true;
}

if (failed) process.exitCode = 1;
