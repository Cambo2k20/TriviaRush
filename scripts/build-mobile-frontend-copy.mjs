import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUTPUT = "/workspace/trivia-rush-frontend-copy.html";
const definitions = [
  ["indexHtml", "1", "Page structure", "index.html"],
  ["appJs", "2", "Application code", "app.js"],
  ["stylesCss", "3", "Site styling", "styles.css"]
];

const files = {};
const cards = definitions.map(([id, step, label, filename]) => {
  const content = readFileSync(resolve(ROOT, filename), "utf8");
  files[id] = content;
  return `
    <div class="card tr-front-card">
      <span class="viz-badge">File ${step}</span>
      <h3>${label}</h3>
      <code>${filename}</code>
      <p class="text-small text-muted">${content.split("\n").length.toLocaleString("en-GB")} lines</p>
      <button class="btn btn-primary" type="button" data-file="${id}">Copy complete file</button>
      <p class="text-small tr-front-status" aria-live="polite"></p>
    </div>`;
}).join("\n");

const safeJson = JSON.stringify(files).replaceAll("<", "\\u003c");
const fragment = `<div id="trivia-rush-frontend-copy">
  <style>
    #trivia-rush-frontend-copy { display: grid; gap: 16px; color: var(--foreground); }
    #trivia-rush-frontend-copy .tr-front-note { margin: 0; color: var(--muted-foreground); }
    #trivia-rush-frontend-copy .tr-front-card { display: grid; gap: 10px; align-content: start; }
    #trivia-rush-frontend-copy .tr-front-card h3,
    #trivia-rush-frontend-copy .tr-front-card p { margin: 0; }
    #trivia-rush-frontend-copy .tr-front-status { min-height: 1.2em; color: var(--muted-foreground); }
  </style>
  <p class="tr-front-note text-small">In GitHub, switch to <code>phase-4-multiplayer</code>. Edit each existing file, select all of its old contents, paste the copied replacement, and commit to that branch.</p>
  <div class="viz-grid">
${cards}
  </div>
</div>
<script>
  (() => {
    const root = document.getElementById("trivia-rush-frontend-copy");
    const files = ${safeJson};

    async function copyFile(button) {
      const content = files[button.dataset.file];
      const status = button.parentElement.querySelector(".tr-front-status");
      try {
        await navigator.clipboard.writeText(content);
        status.textContent = "Copied. Replace the complete matching GitHub file.";
      } catch (error) {
        const fallback = document.createElement("textarea");
        fallback.value = content;
        fallback.setAttribute("readonly", "");
        root.appendChild(fallback);
        fallback.select();
        fallback.setSelectionRange(0, fallback.value.length);
        const copied = document.execCommand("copy");
        fallback.remove();
        status.textContent = copied
          ? "Copied. Replace the complete matching GitHub file."
          : "Copy was blocked. Open this conversation in Safari and try again.";
      }
    }

    root.querySelectorAll("[data-file]").forEach((button) => {
      button.addEventListener("click", () => copyFile(button));
    });
  })();
</script>
`;

writeFileSync(OUTPUT, fragment);
console.log(OUTPUT);
