import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const bridgeScript = readFileSync("./social-rpc-bridge.js", "utf8");
const guardStyles = readFileSync("./social-auth-guard.css", "utf8");

const dom = new JSDOM(`<!doctype html>
<html><head></head><body>
  <section id="socialScreen" class="screen active">
    <section id="duelAccountGate"><h2>Permanent account required</h2><p>Old explanation.</p><button id="openAccountForDuelButton" class="primary-button">Create or sign in</button></section>
    <div id="socialContent" hidden><button id="joinDuelButton">Join game</button></div>
  </section>
</body></html>`, {
  url: "https://example.github.io/TriviaRush/?social=play",
  runScripts: "outside-only",
  pretendToBeVisual: true
});

const { window } = dom;
window.supabase = { createClient: () => ({ rpc: async () => ({ data: null, error: null }) }) };

if (window.HTMLDialogElement) {
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.removeAttribute("open");
  };
}

let joinClicks = 0;
let accountClicks = 0;
window.document.querySelector("#joinDuelButton").addEventListener("click", () => { joinClicks += 1; });
window.document.querySelector("#openAccountForDuelButton").addEventListener("click", () => { accountClicks += 1; });

window.eval(bridgeScript);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise((resolve) => window.setTimeout(resolve, 20));

const results = [];
const assert = (name, condition) => {
  results.push(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) process.exitCode = 1;
};

assert("signed-out users can see the tab content", window.document.querySelector("#socialContent")?.hidden === false);
assert("the permanent-account explanation is moved into a dialog", Boolean(window.document.querySelector("#socialAccountPromptDialog #duelAccountGate")));
assert("the Play friends header state is exposed on the body", window.document.body.classList.contains("social-page-open"));
assert("the guard stylesheet is loaded", window.document.querySelector('link[data-social-auth-guard="true"]')?.getAttribute("href") === "social-auth-guard.css?v=1");
assert("the social page heading remains centred", guardStyles.includes(".social-tabs-redesign .social-page-heading") && guardStyles.includes("justify-self: center"));
assert("the mobile header uses fixed icon columns", guardStyles.includes("grid-auto-columns: 42px") && guardStyles.includes("body.social-page-open .header-actions"));
assert("mobile navigation labels collapse without losing buttons", guardStyles.includes(".duel-button span:last-child") && guardStyles.includes(".leaderboard-button span:last-child") && guardStyles.includes(".account-button span:last-child"));

window.document.querySelector("#joinDuelButton").click();
assert("restricted actions do not reach the existing mutation handler", joinClicks === 0);
assert("restricted actions open the concise account prompt", window.document.querySelector("#socialAccountPromptDialog")?.open === true);

window.document.querySelector("#openAccountForDuelButton").click();
assert("the existing create-or-sign-in action remains available", accountClicks === 1);

window.document.querySelector("#duelAccountGate").hidden = true;
await new Promise((resolve) => window.setTimeout(resolve, 0));
window.document.querySelector("#joinDuelButton").click();
assert("permanent-account actions continue to the original handler", joinClicks === 1);

console.log(results.join("\n"));
window.close();
