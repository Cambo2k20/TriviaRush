import { readFileSync, writeFileSync } from "node:fs";

const path = "index.html";
let html = readFileSync(path, "utf8");

if (!html.includes('href="progression-ui.css?v=1"')) {
  const stylesheet = '  <link rel="stylesheet" href="styles.css?v=8">';
  if (!html.includes(stylesheet)) {
    throw new Error("Could not find the main stylesheet link.");
  }
  html = html.replace(
    stylesheet,
    `${stylesheet}\n  <link rel="stylesheet" href="progression-ui.css?v=1">`
  );
}

if (!html.includes('src="progression-ui.js?v=1"')) {
  const applicationScript = '  <script src="app.js?v=18"></script>';
  if (!html.includes(applicationScript)) {
    throw new Error("Could not find the main application script.");
  }
  html = html.replace(
    applicationScript,
    `  <script src="progression-ui.js?v=1"></script>\n${applicationScript}`
  );
}

writeFileSync(path, html);
