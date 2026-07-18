import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCloudflareDist,
  collectLocalReferences,
  DIST_DIR,
  ROOT_DIR
} from "./build-cloudflare.mjs";

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function listDistributionEntries(directory, baseDirectory = directory) {
  const entries = [];
  const children = await readdir(directory, { withFileTypes: true });

  for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, child.name);
    const relativePath = toPosix(path.relative(baseDirectory, absolutePath));
    const fileStat = await lstat(absolutePath);

    if (fileStat.isSymbolicLink()) {
      throw new Error(`Distribution contains a symbolic link: ${relativePath}`);
    }

    if (fileStat.isDirectory()) {
      entries.push(...await listDistributionEntries(absolutePath, baseDirectory));
    } else if (fileStat.isFile()) {
      entries.push(relativePath);
    } else {
      throw new Error(`Distribution contains an unsupported filesystem entry: ${relativePath}`);
    }
  }

  return entries;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isForbiddenDistributionPath(relativePath) {
  const pathSegments = relativePath.split("/");
  const basename = path.posix.basename(relativePath);
  const forbiddenSegments = new Set([
    ".git",
    ".github",
    ".supabase",
    ".wrangler",
    "artifacts",
    "docs",
    "node_modules",
    "scripts",
    "supabase",
    "tests"
  ]);
  const forbiddenFiles = new Set([
    ".assetsignore",
    ".gitignore",
    "package-lock.json",
    "package.json",
    "README.md",
    "wrangler.json",
    "wrangler.jsonc",
    "wrangler.toml"
  ]);

  return pathSegments.some((segment) => forbiddenSegments.has(segment))
    || forbiddenFiles.has(basename)
    || basename === ".env"
    || basename.startsWith(".env.")
    || basename === ".dev.vars"
    || basename.startsWith(".dev.vars.")
    || relativePath.endsWith(".sql")
    || relativePath.endsWith(".mjs")
    || relativePath.endsWith(".yml")
    || relativePath.endsWith(".yaml");
}

async function assertLocalReferencesExist(files) {
  const fileSet = new Set(files);

  for (const relativePath of files) {
    const extension = path.posix.extname(relativePath).toLowerCase();
    if (![".html", ".css", ".json", ".webmanifest"].includes(extension)) continue;

    const content = await readFile(path.join(DIST_DIR, relativePath), "utf8");
    for (const reference of collectLocalReferences(content, relativePath)) {
      assert(
        fileSet.has(reference),
        `${relativePath} references missing distribution asset ${reference}`
      );
    }
  }
}

async function main() {
  const builtFiles = await buildCloudflareDist();
  const files = await listDistributionEntries(DIST_DIR);

  assert(
    JSON.stringify(files) === JSON.stringify([...builtFiles].sort()),
    "Build result and on-disk distribution inventory differ"
  );

  const requiredFiles = [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "app.js",
    "styles.css",
    "vendor/supabase.js",
    "vendor/discord-embedded-app-sdk.js",
    "icons/trivia-rush-192.png",
    "icons/trivia-rush-512.png",
    "icons/trivia-rush-header-logo.png"
  ];

  for (const requiredFile of requiredFiles) {
    assert(files.includes(requiredFile), `Distribution is missing required asset ${requiredFile}`);
  }

  const forbiddenFiles = files.filter(isForbiddenDistributionPath);
  assert(
    forbiddenFiles.length === 0,
    `Distribution contains forbidden files: ${forbiddenFiles.join(", ")}`
  );

  await assertLocalReferencesExist(files);

  const wrangler = JSON.parse(await readFile(path.join(ROOT_DIR, "wrangler.jsonc"), "utf8"));
  assert(
    wrangler?.assets?.directory === "./dist",
    "wrangler.jsonc must deploy only ./dist"
  );

  const packageJson = JSON.parse(await readFile(path.join(ROOT_DIR, "package.json"), "utf8"));
  assert(
    packageJson?.scripts?.["build:cloudflare"] === "node scripts/build-cloudflare.mjs",
    "package.json is missing the expected build:cloudflare command"
  );
  assert(
    packageJson?.scripts?.["test:cloudflare"] === "node scripts/cloudflare-dist-smoke-test.mjs",
    "package.json is missing the expected test:cloudflare command"
  );

  console.log(`Cloudflare distribution verified: ${files.length} files, no forbidden deployment content.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
