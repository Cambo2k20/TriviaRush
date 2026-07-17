import { createServer } from "node:http";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const port = 4174;
const outputDirectory = join(root, "artifacts", "mobile-mode-menu");
mkdirSync(outputDirectory, { recursive: true });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  const relativePath = requestUrl.pathname === "/"
    ? "tests/mobile-mode-menu-visual-fixture.html"
    : requestUrl.pathname.replace(/^\/+/, "");
  const filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const content = readFileSync(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});

function findChrome() {
  const candidates = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
  for (const candidate of candidates) {
    const result = spawnSync("bash", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome or Chromium is not installed on the runner.");
}

function runChrome(chrome, argumentsList, filename) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, argumentsList, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Chrome timed out while capturing ${filename}.`));
    }, 30_000);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`Chrome failed for ${filename}: ${stderr || stdout}`));
    });
  });
}

const chrome = findChrome();
const captures = [
  ["modes", 390, 844, "modes-390.png"],
  ["solo", 390, 844, "solo-390.png"],
  ["modes", 430, 932, "modes-430.png"]
];

try {
  for (const [stage, width, height, filename] of captures) {
    const outputPath = join(outputDirectory, filename);
    const stageQuery = stage === "solo" ? "?stage=solo" : "";
    const url = `http://127.0.0.1:${port}/tests/mobile-mode-menu-visual-fixture.html${stageQuery}`;
    await runChrome(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=1800",
      `--screenshot=${outputPath}`,
      url
    ], filename);

    if (statSync(outputPath).size < 10_000) {
      throw new Error(`Screenshot ${filename} was unexpectedly small.`);
    }

    console.log(`Captured ${filename}`);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
