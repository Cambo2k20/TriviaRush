import { readFileSync, writeFileSync } from "node:fs";

const indexPath = "index.html";
let html = readFileSync(indexPath, "utf8");

if (html.includes('href="home-redesign.css?v=3"')) {
  html = html.replace(
    'href="home-redesign.css?v=3"',
    'href="home-redesign.css?v=4"'
  );
}

if (!html.includes('href="home-redesign.css?v=4"')) {
  throw new Error("The current home redesign stylesheet version could not be resolved.");
}

writeFileSync(indexPath, html);
