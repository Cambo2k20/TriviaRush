import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import {
  createRuntimeConfigSource,
  parseSupabaseStatus,
  startLocalServer
} from "./serve-local.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const parsed = parseSupabaseStatus([
  'API_URL="http://127.0.0.1:54321"',
  'ANON_KEY="local-public-key"'
].join("\n"));
assert(parsed.supabaseUrl === "http://127.0.0.1:54321", "Local API URL was not parsed");
assert(parsed.supabasePublishableKey === "local-public-key", "Local public key was not parsed");

const localSource = createRuntimeConfigSource(parsed);
assert(localSource.includes('"environment":"local"'), "Injected config is not marked local");
assert(!localSource.includes("kgdnuzasbeavpqharbpf"), "Local config leaked the production project ref");

const [index, app, runtimeConfig, gitignore, packageJson] = await Promise.all([
  readFile(path.join(ROOT, "index.html"), "utf8"),
  readFile(path.join(ROOT, "app.js"), "utf8"),
  readFile(path.join(ROOT, "runtime-config.js"), "utf8"),
  readFile(path.join(ROOT, ".gitignore"), "utf8"),
  readFile(path.join(ROOT, "package.json"), "utf8").then(JSON.parse)
]);

assert(index.includes('src="runtime-config.js?v=1"'), "Production page does not load runtime config");
assert(index.indexOf("runtime-config.js") < index.indexOf("app.js"), "Runtime config must load before app.js");
assert(app.includes("window.TRIVIA_RUSH_CONFIG"), "App does not consume runtime config");
assert(!app.includes("https://kgdnuzasbeavpqharbpf.supabase.co"), "App still hardcodes production Supabase");
assert(runtimeConfig.includes("kgdnuzasbeavpqharbpf.supabase.co"), "Production runtime config is incomplete");
const localDom = new JSDOM("", { url: "http://127.0.0.1:9000", runScripts: "outside-only" });
localDom.window.eval(runtimeConfig);
assert(
  localDom.window.TRIVIA_RUSH_CONFIG.environment === "local-unconfigured"
    && !localDom.window.TRIVIA_RUSH_CONFIG.supabaseUrl,
  "Generic localhost serving must fail closed instead of using production"
);
assert(gitignore.includes("supabase/.branches/"), "Supabase branch state is not ignored");
assert(gitignore.includes("supabase/.temp/"), "Supabase temporary state is not ignored");
assert(packageJson.scripts["dev:local"] === "node scripts/serve-local.mjs", "Local server command is missing");

process.env.TRIVIA_RUSH_LOCAL_SUPABASE_URL = parsed.supabaseUrl;
process.env.TRIVIA_RUSH_LOCAL_SUPABASE_KEY = parsed.supabasePublishableKey;
const { server, url } = await startLocalServer({ port: 0 });
try {
  const [configResponse, pageResponse] = await Promise.all([
    fetch(`${url}/runtime-config.js?v=1`),
    fetch(`${url}/`)
  ]);
  const servedConfig = await configResponse.text();
  const servedPage = await pageResponse.text();
  assert(configResponse.ok, "Local runtime config request failed");
  assert(configResponse.headers.get("cache-control") === "no-store", "Local config may be cached");
  assert(servedConfig.includes("local-public-key"), "Local server did not inject the local key");
  assert(!servedConfig.includes("kgdnuzasbeavpqharbpf"), "Local server returned production config");
  assert(pageResponse.ok && servedPage.includes("Trivia Rush"), "Local page request failed");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(JSON.stringify({ status: "passed", local_api: parsed.supabaseUrl }, null, 2));
