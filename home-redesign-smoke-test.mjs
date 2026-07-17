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

const categorySelect = window.document.querySelector("#categorySelect");
[
  ["mixed", "All categories"],
  ["science", "Science"],
  ["history", "History"],
  ["technology", "Technology"]
].forEach(([value, label]) => {
  const option = window.document.createElement("option");
  option.value = value;
  option.textContent = label;
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

assert("redesign stylesheet linked", html.includes('href="home-redesign.css?v=3"'));
assert("redesign runtime linked", html.includes('src="home-redesign.js?v=1"'));
assert("mockup hero markup present", Boolean(window.document.querySelector(".home-hero-v2")));
assert("category browser present", Boolean(window.document.querySelector(".home-category-browser")));
assert("fallback select preserves authoritative category input", Boolean(categorySelect));
assert("category cards generated from select options", window.document.querySelectorAll(".home-category-card").length === 4);
assert("home screen activates redesign body state", window.document.body.classList.contains("home-redesign-active"));
assert("server progression level is mirrored", window.document.querySelector("#homeGlobalLevel")?.textContent === "7");

window.document.querySelector('[data-category-id="science"]').click();
assert("card selection updates authoritative select", categorySelect.value === "science");
assert("selected category copy updates", window.document.querySelector("#selectedCategoryLabel")?.textContent === "Science");
assert("selected card exposes pressed state", window.document.querySelector('[data-category-id="science"]')?.getAttribute("aria-pressed") === "true");

window.document.querySelector("#homeHostToggle").click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert("home voice switch proxies existing host control", hostToggle.getAttribute("aria-pressed") === "true");
assert("home voice switch mirrors host state", window.document.querySelector("#homeHostToggle")?.getAttribute("aria-pressed") === "true");

window.document.querySelector("#homeFriendsShortcut").click();
assert("friends shortcut uses existing navigation control", friendsOpened === 1);
assert("responsive rules included", styles.includes("@media (max-width: 640px)"));
assert("dynamic desktop alignment used", styles.includes("align-items: center") && styles.includes("100dvh"));
assert("fixed category translation removed", !styles.includes("translateY(35px)"));
assert("footer height reserved", styles.includes("--home-footer-height") && styles.includes("--home-main-height"));
assert("short viewport compaction included", styles.includes("max-height: 760px") && styles.includes("7.5dvh"));
assert("reduced-motion handling included", styles.includes("prefers-reduced-motion"));
assert("unimplemented daily and practice modes are not advertised", !html.includes("Daily Challenge") && !html.includes("Practice mode"));

console.log(results.join("\n"));
window.close();
