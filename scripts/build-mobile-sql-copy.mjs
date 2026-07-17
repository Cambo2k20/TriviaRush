import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "supabase", "sql");
const OUTPUT = "/workspace/trivia-rush-sql-copy.html";
const definitions = [
  ["phase4aPlatform", "1", "Phase 4A platform", "phase-4a-question-platform.sql", false],
  ["phase4aSeed", "2", "700-question seed", "phase-4a-question-seed.sql", false],
  ["phase4aVerify", "3", "Phase 4A verification", "phase-4a-verification.sql", false],
  ["phase4bMultiplayer", "4", "Friends and multiplayer", "phase-4b-multiplayer.sql", false],
  ["phase4bVerify", "5", "Phase 4B verification", "phase-4b-verification.sql", false],
  ["phase4aCutover", "8", "Final cutover", "phase-4a-final-cutover.sql", true]
];

const scripts = {};
const cards = definitions.map(([id, step, label, filename, finalOnly]) => {
  const sql = readFileSync(resolve(ROOT, filename), "utf8");
  scripts[id] = sql;
  const lines = sql.split("\n").length.toLocaleString("en-GB");
  return `
    <div class="card tr-sql-card">
      <div class="viz-row tr-sql-heading">
        <span class="viz-badge">Step ${step}</span>
        ${finalOnly ? '<span class="viz-badge tr-final">After testing only</span>' : ""}
      </div>
      <h3>${label}</h3>
      <code>${filename}</code>
      <p class="text-small text-muted">${lines} lines</p>
      <button class="btn ${finalOnly ? "" : "btn-primary"}" type="button" data-script="${id}">Copy SQL</button>
      <p class="text-small tr-copy-status" aria-live="polite"></p>
    </div>`;
}).join("\n");

const safeJson = JSON.stringify(scripts).replaceAll("<", "\\u003c");
const fragment = `<div id="trivia-rush-sql-copy">
  <style>
    #trivia-rush-sql-copy { display: grid; gap: 16px; color: var(--foreground); }
    #trivia-rush-sql-copy .tr-order { margin: 0; color: var(--muted-foreground); }
    #trivia-rush-sql-copy .tr-sql-card { display: grid; gap: 10px; align-content: start; }
    #trivia-rush-sql-copy .tr-sql-card h3,
    #trivia-rush-sql-copy .tr-sql-card p { margin: 0; }
    #trivia-rush-sql-copy .tr-sql-heading { justify-content: space-between; }
    #trivia-rush-sql-copy .tr-final { color: var(--destructive); }
    #trivia-rush-sql-copy .tr-copy-status { min-height: 1.2em; color: var(--muted-foreground); }
  </style>
  <p class="tr-order text-small">Run steps 1–5, deploy and test the website, then run step 8.</p>
  <div class="viz-grid">
${cards}
  </div>
</div>
<script>
  (() => {
    const root = document.getElementById("trivia-rush-sql-copy");
    const scripts = ${safeJson};

    async function copySql(button) {
      const sql = scripts[button.dataset.script];
      const status = button.parentElement.querySelector(".tr-copy-status");
      try {
        await navigator.clipboard.writeText(sql);
        status.textContent = "Copied. Paste into a new Supabase SQL Editor query.";
      } catch (error) {
        const fallback = document.createElement("textarea");
        fallback.value = sql;
        fallback.setAttribute("readonly", "");
        root.appendChild(fallback);
        fallback.select();
        fallback.setSelectionRange(0, fallback.value.length);
        const copied = document.execCommand("copy");
        fallback.remove();
        status.textContent = copied
          ? "Copied. Paste into a new Supabase SQL Editor query."
          : "Copy was blocked. Open this conversation in Safari and try again.";
      }
    }

    root.querySelectorAll("[data-script]").forEach((button) => {
      button.addEventListener("click", () => copySql(button));
    });
  })();
</script>
`;

writeFileSync(OUTPUT, fragment);
console.log(OUTPUT);
