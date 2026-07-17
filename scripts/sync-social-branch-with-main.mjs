import { readFileSync, writeFileSync } from "node:fs";

const indexPath = "index.html";
let html = readFileSync(indexPath, "utf8");

if (html.includes('href="home-redesign.css?v=3"')) {
  html = html.replace('href="home-redesign.css?v=3"', 'href="home-redesign.css?v=4"');
}

const styleMarker = '  <link rel="stylesheet" href="home-redesign.css?v=4">';
if (!/href="social-redesign\.css\?v=\d+"/.test(html)) {
  if (!html.includes(styleMarker)) throw new Error("Home stylesheet marker not found.");
  html = html.replace(styleMarker, `${styleMarker}\n  <link rel="stylesheet" href="social-redesign.css?v=1">`);
}

if (!/href="unified-shell\.css\?v=\d+"/.test(html)) {
  const socialStyleMatch = html.match(/  <link rel="stylesheet" href="social-redesign\.css\?v=\d+">/);
  if (!socialStyleMatch) throw new Error("Social stylesheet marker not found.");
  html = html.replace(
    socialStyleMatch[0],
    `${socialStyleMatch[0]}\n  <link rel="stylesheet" href="unified-shell.css?v=1">`
  );
}

const supabaseMarker = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
if (!/src="social-rpc-bridge\.js\?v=\d+"/.test(html)) {
  if (!html.includes(supabaseMarker)) throw new Error("Supabase script marker not found.");
  html = html.replace(supabaseMarker, `${supabaseMarker}\n  <script src="social-rpc-bridge.js?v=1"></script>`);
}

const appMarker = '  <script src="app.js?v=18"></script>';
if (!/src="social-redesign\.js\?v=\d+"/.test(html)) {
  if (!html.includes(appMarker)) throw new Error("Application script marker not found.");
  html = html.replace(appMarker, `${appMarker}\n  <script src="social-redesign.js?v=1"></script>`);
}

if (!/src="unified-shell\.js\?v=\d+"/.test(html)) {
  const homeScriptMatch = html.match(/  <script src="home-redesign\.js\?v=\d+"><\/script>/);
  if (!homeScriptMatch) throw new Error("Home runtime marker not found.");
  html = html.replace(
    homeScriptMatch[0],
    `${homeScriptMatch[0]}\n  <script src="unified-shell.js?v=1"></script>`
  );
}

writeFileSync(indexPath, html);
