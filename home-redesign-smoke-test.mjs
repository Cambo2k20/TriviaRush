import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("./index.html", "utf8");
const script = readFileSync("./home-redesign.js", "utf8");
const styles = readFileSync("./home-redesign.css", "utf8");

const dom = new JSDOM(html, {
  url: "https://example.github.io/trivia-rush/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.matchMedia = () => ({
  matches: true,
  addEventListener() {},
  addListener() {}
});

const categorySelect = window.document.querySelector("#categorySelect");
[
  ["mixed", "All categories", "brain", "#FFD335"],
  ["science", "Science", "flask", "#41E28C"],
  ["history", "History", "landmark", "#FFD54A"],
  ["technology", "Technology", "cpu", "#7C83FF"],
  ["game_of_thrones", "Game of Thrones", "dragon", "#9B1C1C"],
  ["mythology", "Mythology", "thunderbolt", "#C9A227"],
  ["harry_potter", "Harry Potter", "wand", "#4B2E83"],
  ["marvel_cinematic_universe", "Marvel Cinematic Universe", "shield", "#ED1D24"]
].forEach(([value, label, iconKey, color]) => {
  const option = window.document.createElement("option");
  option.value = value;
  option.textContent = label;
  option.dataset.iconKey = iconKey;
  option.dataset.color = color;
  categorySelect.appendChild(option);
});

const hostToggle = window.document.querySelector("#hostToggle");
hostToggle.addEventListener("click", () => {
  const next = hostToggle.getAttribute("aria-pressed") !== "true";
  hostToggle.setAttribute("aria-pressed", String(next));
});

let friendsOpened = 0;
window.document.querySelector("#duelButton").addEventListener("click", () => {
  friendsOpened += 1;
});

const level = window.document.createElement("span");
level.id = "globalProgressionChipLevel";
level.textContent = "7";
window.document.body.appendChild(level);

window.eval(script);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise((resolve) => setTimeout(resolve, 40));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=6"'));
assert("redesign runtime linked", html.includes('src="home-redesign.js?v=3"'));
assert("mockup hero markup present", Boolean(window.document.querySelector(".home-hero-v2")));
assert("desktop hero uses the Solo 60-second framing", window.document.querySelector(".home-hero-v2 .eyebrow")?.textContent.replace(/\s+/g, " ").trim() === "SOLO · 60 SECONDS");
assert("desktop hero uses the two-line challenge title", window.document.querySelector("#startTitle")?.innerHTML === "How many can you<br><span>get right?</span>");
assert("primary action names the round length", window.document.querySelector("#startButton span")?.textContent === "Start 60-second round");
assert("keyboard control hints are removed from the hero", !window.document.querySelector(".home-controls-hint"));
assert("category browser present", Boolean(window.document.querySelector(".home-category-browser")));
assert("fallback select preserves authoritative category input", Boolean(categorySelect));
assert("category cards generated from select options", window.document.querySelectorAll(".home-category-card").length === 8);
assert("mobile category control is wired to the card grid", window.document.querySelector("#mobileCategoryToggle")?.getAttribute("aria-controls") === "categoryCardGrid");
assert("home screen activates redesign body state", window.document.body.classList.contains("home-redesign-active"));
assert("server progression level is mirrored", window.document.querySelector("#homeGlobalLevel")?.textContent === "7");
assert("All categories uses the global level in the centred heading", window.document.querySelector("#homeCategoryTitle")?.textContent === "All categories" && window.document.querySelector("#homeCategoryLevel")?.textContent === "Global level 7");

window.dispatchEvent(new window.CustomEvent("trivia-rush:category-progression", {
  detail: {
    categories: [
      { id: "science", level: 4, progressPercent: 64 },
      { id: "history", level: 2 },
      { id: "marvel_cinematic_universe", level: 3 }
    ]
  }
}));

window.document.querySelector("#mobileCategoryToggle").click();
assert("mobile category control expands the themed cards", window.document.querySelector(".home-category-browser")?.classList.contains("mobile-category-browser-open") && window.document.querySelector("#mobileCategoryToggle")?.getAttribute("aria-expanded") === "true");
window.document.querySelector('[data-category-id="science"]').click();
assert("card selection updates authoritative select", categorySelect.value === "science");
assert("mobile card selection closes the category list", !window.document.querySelector(".home-category-browser")?.classList.contains("mobile-category-browser-open"));
assert("selected category copy updates", window.document.querySelector("#selectedCategoryLabel")?.textContent === "Science");
assert("mobile category control mirrors the selected category", window.document.querySelector("#mobileCategoryToggleLabel")?.textContent === "Science" && Boolean(window.document.querySelector("#mobileCategoryToggleIcon svg")));
assert("selected card exposes pressed state", window.document.querySelector('[data-category-id="science"]')?.getAttribute("aria-pressed") === "true");
assert("mobile category cards show trusted level and progress", window.document.querySelector('[data-category-id="science"] .home-category-card-level')?.textContent === "Category LV 4" && window.document.querySelector('[data-category-id="science"] .home-category-card-progress-fill')?.style.width === "64%");
assert("selected category replaces the category heading", window.document.querySelector("#homeCategoryTitle")?.textContent === "Science");
assert("selected category shows its trusted category level", window.document.querySelector("#homeCategoryLevel")?.textContent === "Category level 4");
assert("selected category icon replaces the placeholder mark", Boolean(window.document.querySelector("#homeCategoryMark svg")));

window.document.querySelector('[data-category-id="marvel_cinematic_universe"]').click();
assert("new category uses RPC label", window.document.querySelector("#homeCategoryTitle")?.textContent === "Marvel Cinematic Universe");
assert("new category uses RPC color", window.document.querySelector(".home-category-browser")?.style.getPropertyValue("--selected-category-accent") === "#ED1D24");
assert("new category uses its shield implementation", window.document.querySelector("#homeCategoryMark svg path")?.getAttribute("d")?.startsWith("M24 5"));

window.document.querySelector("#homeHostToggle").click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert("home voice switch proxies existing host control", hostToggle.getAttribute("aria-pressed") === "true");
assert("home voice switch mirrors host state", window.document.querySelector("#homeHostToggle")?.getAttribute("aria-pressed") === "true");

window.document.querySelector("#homeFriendsShortcut").click();
assert("friends shortcut uses existing navigation control", friendsOpened === 1);
assert("responsive rules included", styles.includes("@media (max-width: 640px)"));
assert("dynamic desktop alignment used", styles.includes("align-items: center") && styles.includes("100dvh"));
assert("desktop category heading centres its icon and selection copy inline", styles.includes("flex-direction: row") && styles.includes("text-align: center") && styles.includes("justify-items: center"));
assert("fixed category translation removed", !styles.includes("translateY(35px)"));
assert("footer height reserved", styles.includes("--home-footer-height") && styles.includes("--home-main-height"));
assert("short viewport compaction included", styles.includes("max-height: 760px") && styles.includes("7.5dvh"));
assert("reduced-motion handling included", styles.includes("prefers-reduced-motion"));
assert("unimplemented daily and practice modes are not advertised", !html.includes("Daily Challenge") && !html.includes("Practice mode"));

console.log(results.join("\n"));
window.close();
