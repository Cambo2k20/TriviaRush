import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "supabase", "sql");
const OUTPUT = "/workspace/trivia-rush-phase5-sql-copy.html";
const definitions = [
  ["categoryPlatform", "1", "Category platform", "phase-5-category-platform.sql", false],
  ["questionSeed", "2", "1,000-question seed", "phase-5-question-seed.sql", false],
  ["verification", "3", "Read-only verification", "phase-5-category-verification.sql", false],
  ["rollback", "Fallback", "Reversible rollback", "phase-5-category-rollback.sql", true]
];

const scripts = {};
const cards = definitions.map(([id, step, label, filename, fallbackOnly]) => {
  const sql = readFileSync(resolve(ROOT, filename), "utf8");
  scripts[id] = sql;
  const lines = sql.split("\n").length.toLocaleString("en-GB");

  return `
    <section class="card tr-sql-card">
      <div class="viz-row tr-sql-heading">
        <span class="viz-badge">${step === "Fallback" ? step : `Step ${step}`}</span>
        ${fallbackOnly ? '<span class="viz-badge tr-fallback">Only if needed</span>' : ""}
      </div>
      <h3>${label}</h3>
      <code>${filename}</code>
      <p class="text-small text-muted">${lines} lines</p>
      <button class="btn ${fallbackOnly ? "" : "btn-primary"}" type="button" data-script="${id}">
        Copy SQL
      </button>
      <p class="text-small tr-copy-status" aria-live="polite"></p>
    </section>`;
}).join("\n");

const safeJson = JSON.stringify(scripts).replaceAll("<", "\\u003c");
const fragment = `<div id="trivia-rush-phase5-sql-copy">
  <style>
    #trivia-rush-phase5-sql-copy { display: grid; gap: 16px; color: var(--foreground); }
    #trivia-rush-phase5-sql-copy .tr-order { margin: 0; color: var(--muted-foreground); }
    #trivia-rush-phase5-sql-copy .tr-sql-card { display: grid; gap: 10px; align-content: start; }
    #trivia-rush-phase5-sql-copy .tr-sql-card h3,
    #trivia-rush-phase5-sql-copy .tr-sql-card p { margin: 0; }
    #trivia-rush-phase5-sql-copy .tr-sql-heading { justify-content: space-between; }
    #trivia-rush-phase5-sql-copy .tr-fallback { color: var(--destructive); }
    #trivia-rush-phase5-sql-copy .tr-copy-status { min-height: 1.2em; color: var(--muted-foreground); }
  </style>
  <p class="tr-order text-small">
    Merge and wait for GitHub Pages. Run steps 1–3 in order. Use the fallback only if the expanded bank must be hidden.
  </p>
  <div class="viz-grid">
${cards}
  </div>
</div>
<script>
  (() => {
    const root = document.getElementById("trivia-rush-phase5-sql-copy");
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
