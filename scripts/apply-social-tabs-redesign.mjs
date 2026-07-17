import { readFileSync, writeFileSync } from "node:fs";

const indexPath = "index.html";
const packagePath = "package.json";
const runtimePath = "social-redesign.js";

let html = readFileSync(indexPath, "utf8");

if (!html.includes('href="social-redesign.css?v=1"')) {
  const stylesheetMarker = '  <link rel="stylesheet" href="home-redesign.css?v=3">';
  if (!html.includes(stylesheetMarker)) {
    throw new Error("Could not locate the home redesign stylesheet marker.");
  }
  html = html.replace(
    stylesheetMarker,
    `${stylesheetMarker}\n  <link rel="stylesheet" href="social-redesign.css?v=1">`
  );
}

if (!html.includes('src="social-rpc-bridge.js?v=1"')) {
  const supabaseMarker = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
  if (!html.includes(supabaseMarker)) {
    throw new Error("Could not locate the Supabase script marker.");
  }
  html = html.replace(
    supabaseMarker,
    `${supabaseMarker}\n  <script src="social-rpc-bridge.js?v=1"></script>`
  );
}

if (!html.includes('src="social-redesign.js?v=1"')) {
  const applicationMarker = '  <script src="app.js?v=18"></script>';
  if (!html.includes(applicationMarker)) {
    throw new Error("Could not locate the application script marker.");
  }
  html = html.replace(
    applicationMarker,
    `${applicationMarker}\n  <script src="social-redesign.js?v=1"></script>`
  );
}

writeFileSync(indexPath, html);

const packageDocument = JSON.parse(readFileSync(packagePath, "utf8"));
const frontendCommand = packageDocument.scripts?.["test:frontend"] || "";
if (!frontendCommand.includes("social-redesign-smoke-test.mjs")) {
  packageDocument.scripts["test:frontend"] = `${frontendCommand} && node social-redesign-smoke-test.mjs`.trim();
}
writeFileSync(packagePath, `${JSON.stringify(packageDocument, null, 2)}\n`);

let runtime = readFileSync(runtimePath, "utf8");
const oldProxyLookup = `  function findProxyButton(proxyId) {
    return proxyId
      ? document.querySelector(\`[data-social-proxy-id="\${CSS.escape(proxyId)}"]\`)
      : null;
  }`;
const newProxyLookup = `  function findProxyButton(proxyId) {
    if (!proxyId) return null;
    return [...document.querySelectorAll("[data-social-proxy-id]")]
      .find((element) => element.dataset.socialProxyId === proxyId) || null;
  }`;
if (runtime.includes(oldProxyLookup)) {
  runtime = runtime.replace(oldProxyLookup, newProxyLookup);
}
writeFileSync(runtimePath, runtime);
