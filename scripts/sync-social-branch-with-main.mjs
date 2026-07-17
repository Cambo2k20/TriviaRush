import { readFileSync, writeFileSync } from "node:fs";

const indexPath = "index.html";
let html = readFileSync(indexPath, "utf8");

if (html.includes('href="home-redesign.css?v=3"')) {
  html = html.replace('href="home-redesign.css?v=3"', 'href="home-redesign.css?v=4"');
}

const styleMarker = '  <link rel="stylesheet" href="home-redesign.css?v=4">';
if (!html.includes('href="social-redesign.css')) {
  if (!html.includes(styleMarker)) throw new Error("Home stylesheet marker not found.");
  html = html.replace(styleMarker, `${styleMarker}\n  <link rel="stylesheet" href="social-redesign.css?v=2">`);
} else {
  html = html.replace(/href="social-redesign\.css\?v=\d+"/, 'href="social-redesign.css?v=2"');
}

const supabaseMarker = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
if (!html.includes('src="social-rpc-bridge.js')) {
  if (!html.includes(supabaseMarker)) throw new Error("Supabase script marker not found.");
  html = html.replace(supabaseMarker, `${supabaseMarker}\n  <script src="social-rpc-bridge.js?v=2"></script>`);
} else {
  html = html.replace(/src="social-rpc-bridge\.js\?v=\d+"/, 'src="social-rpc-bridge.js?v=2"');
}

const appMarker = '  <script src="app.js?v=18"></script>';
if (!html.includes('src="social-redesign.js')) {
  if (!html.includes(appMarker)) throw new Error("Application script marker not found.");
  html = html.replace(appMarker, `${appMarker}\n  <script src="social-redesign.js?v=2"></script>`);
} else {
  html = html.replace(/src="social-redesign\.js\?v=\d+"/, 'src="social-redesign.js?v=2"');
}

writeFileSync(indexPath, html);
