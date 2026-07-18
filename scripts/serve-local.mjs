import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildCloudflareDist, DIST_DIR } from "./build-cloudflare.mjs";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const DEFAULT_PORT = 8788;
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

function unquote(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSupabaseStatus(output) {
  const values = new Map();
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values.set(match[1], unquote(match[2]));
  }

  const supabaseUrl = values.get("API_URL") || values.get("SUPABASE_URL");
  const supabasePublishableKey = values.get("PUBLISHABLE_KEY") || values.get("ANON_KEY");
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Could not read API_URL and ANON_KEY/PUBLISHABLE_KEY from `supabase status -o env`");
  }
  return { supabaseUrl, supabasePublishableKey };
}

export function createRuntimeConfigSource(config) {
  return `window.TRIVIA_RUSH_CONFIG = Object.freeze(${JSON.stringify({
    ...config,
    environment: "local"
  })});\n`;
}

async function readLocalSupabaseConfig() {
  const configuredUrl = process.env.TRIVIA_RUSH_LOCAL_SUPABASE_URL;
  const configuredKey = process.env.TRIVIA_RUSH_LOCAL_SUPABASE_KEY;
  if (configuredUrl && configuredKey) {
    return { supabaseUrl: configuredUrl, supabasePublishableKey: configuredKey };
  }

  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const { stdout } = await execFileAsync(
    executable,
    ["--yes", "supabase@latest", "status", "-o", "env"],
    { cwd: path.resolve(DIST_DIR, ".."), windowsHide: true }
  );
  return parseSupabaseStatus(stdout);
}

function safeDistributionPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, "") || "index.html";
  const absolutePath = path.resolve(DIST_DIR, relativePath);
  const relative = path.relative(DIST_DIR, absolutePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}

async function readAsset(requestPath) {
  const candidate = safeDistributionPath(requestPath);
  if (!candidate) return null;
  try {
    if ((await stat(candidate)).isFile()) return candidate;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return path.join(DIST_DIR, "index.html");
}

export async function startLocalServer({ port = DEFAULT_PORT } = {}) {
  const config = await readLocalSupabaseConfig();
  await buildCloudflareDist();
  const runtimeConfig = Buffer.from(createRuntimeConfigSource(config));

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${HOST}:${port}`);
      if (url.pathname === "/runtime-config.js") {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(runtimeConfig);
        return;
      }

      const filePath = await readAsset(url.pathname);
      if (!filePath) {
        response.writeHead(400).end("Bad request");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500).end("Local server error");
      console.error(error instanceof Error ? error.stack : error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, resolve);
  });
  const address = server.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://${HOST}:${listeningPort}`, config };
}

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE;
if (isDirectRun) {
  startLocalServer({ port: Number(process.env.PORT) || DEFAULT_PORT })
    .then(({ url, config }) => {
      console.log(`Trivia Rush local server: ${url}`);
      console.log(`Supabase API: ${config.supabaseUrl}`);
      console.log("Press Ctrl+C to stop.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}
