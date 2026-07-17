import { readFileSync, writeFileSync } from "node:fs";

const indexPath = "index.html";
const testPath = "social-redesign-smoke-test.mjs";

let html = readFileSync(indexPath, "utf8");
html = html
  .replace('href="social-redesign.css?v=1"', 'href="social-redesign.css?v=2"')
  .replace('src="social-rpc-bridge.js?v=1"', 'src="social-rpc-bridge.js?v=2"')
  .replace('src="social-redesign.js?v=1"', 'src="social-redesign.js?v=2"');

if (
  !html.includes('href="social-redesign.css?v=2"') ||
  !html.includes('src="social-rpc-bridge.js?v=2"') ||
  !html.includes('src="social-redesign.js?v=2"')
) {
  throw new Error("Social asset cache keys could not be updated.");
}

let smokeTest = readFileSync(testPath, "utf8");
smokeTest = smokeTest
  .replace('href="social-redesign.css?v=1"', 'href="social-redesign.css?v=2"')
  .replaceAll('social-rpc-bridge.js?v=1', 'social-rpc-bridge.js?v=2')
  .replaceAll('social-redesign.js?v=1', 'social-redesign.js?v=2');

writeFileSync(indexPath, html);
writeFileSync(testPath, smokeTest);
