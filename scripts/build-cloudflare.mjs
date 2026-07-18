import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(SCRIPT_FILE), "..");
export const DIST_DIR = path.join(ROOT_DIR, "dist");

const ENTRYPOINTS = [
  "index.html",
  "manifest.webmanifest",
  "sw.js"
];

const ALLOWLIST_DIRECTORIES = [
  "icons",
  "vendor"
];

const OPTIONAL_ROOT_FILES = [
  "favicon.ico",
  "robots.txt"
];

const FORBIDDEN_SOURCE_ROOTS = new Set([
  ".git",
  ".github",
  ".supabase",
  ".wrangler",
  "artifacts",
  "dist",
  "docs",
  "node_modules",
  "scripts",
  "supabase",
  "tests"
]);

const FORBIDDEN_SOURCE_FILES = new Set([
  ".assetsignore",
  ".dev.vars",
  ".gitignore",
  "package-lock.json",
  "package.json",
  "README.md",
  "wrangler.json",
  "wrangler.jsonc",
  "wrangler.toml"
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
}

export function normaliseLocalReference(value, fromFile) {
  const trimmed = String(value || "").trim();

  if (
    !trimmed
    || trimmed.startsWith("#")
    || isExternalReference(trimmed)
  ) {
    return null;
  }

  const withoutQuery = trimmed.split("#", 1)[0].split("?", 1)[0];

  if (
    !withoutQuery
    || withoutQuery === "."
    || withoutQuery === "./"
    || withoutQuery.endsWith("/")
  ) {
    return null;
  }

  const baseDirectory = path.posix.dirname(toPosix(fromFile));
  const candidate = withoutQuery.startsWith("/")
    ? withoutQuery.slice(1)
    : path.posix.normalize(path.posix.join(baseDirectory, withoutQuery));

  if (
    !candidate
    || candidate === "."
    || candidate === ".."
    || candidate.startsWith("../")
    || path.posix.isAbsolute(candidate)
  ) {
    throw new Error(`Unsafe local asset reference '${trimmed}' in ${fromFile}`);
  }

  return candidate;
}

function collectHtmlReferences(content, fromFile) {
  const references = [];
  const tagPattern = /<(?:link|script|img|source)\b[^>]*?\b(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of content.matchAll(tagPattern)) {
    const reference = normaliseLocalReference(match[1], fromFile);
    if (reference) references.push(reference);
  }

  return references;
}

function collectCssReferences(content, fromFile) {
  const references = [];
  const urlPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;

  for (const match of content.matchAll(urlPattern)) {
    const reference = normaliseLocalReference(match[2], fromFile);
    if (reference) references.push(reference);
  }

  return references;
}

function collectManifestReferences(content, fromFile) {
  const references = [];
  const manifest = JSON.parse(content);

  function visit(value, key = "") {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key);
      return;
    }

    if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, childKey);
      }
      return;
    }

    if (key === "src" && typeof value === "string") {
      const reference = normaliseLocalReference(value, fromFile);
      if (reference) references.push(reference);
    }
  }

  visit(manifest);
  return references;
}

export function collectLocalReferences(content, fromFile) {
  const extension = path.posix.extname(toPosix(fromFile)).toLowerCase();

  if (extension === ".html") {
    return collectHtmlReferences(content, fromFile);
  }

  if (extension === ".css") {
    return collectCssReferences(content, fromFile);
  }

  if (extension === ".webmanifest" || extension === ".json") {
    return collectManifestReferences(content, fromFile);
  }

  return [];
}

function assertSourceAllowed(relativePath) {
  const posixPath = toPosix(relativePath);
  const firstSegment = posixPath.split("/", 1)[0];
  const basename = path.posix.basename(posixPath);

  if (FORBIDDEN_SOURCE_ROOTS.has(firstSegment)) {
    throw new Error(`Refusing to publish forbidden source directory: ${posixPath}`);
  }

  if (
    FORBIDDEN_SOURCE_FILES.has(posixPath)
    || FORBIDDEN_SOURCE_FILES.has(basename)
    || basename === ".env"
    || basename.startsWith(".env.")
    || basename === ".dev.vars"
    || basename.startsWith(".dev.vars.")
    || posixPath.endsWith(".sql")
    || posixPath.endsWith(".mjs")
  ) {
    throw new Error(`Refusing to publish forbidden source file: ${posixPath}`);
  }
}

function resolveInside(baseDirectory, relativePath) {
  const resolved = path.resolve(baseDirectory, relativePath);
  const relative = path.relative(baseDirectory, resolved);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes expected directory: ${relativePath}`);
  }

  return resolved;
}

async function copyFileToDist(relativePath) {
  const posixPath = toPosix(relativePath);
  assertSourceAllowed(posixPath);

  const sourcePath = resolveInside(ROOT_DIR, posixPath);
  const destinationPath = resolveInside(DIST_DIR, posixPath);
  const sourceStat = await lstat(sourcePath);

  if (sourceStat.isSymbolicLink()) {
    throw new Error(`Refusing to publish symbolic link: ${posixPath}`);
  }

  if (!sourceStat.isFile()) {
    throw new Error(`Expected a file while building Cloudflare assets: ${posixPath}`);
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

async function copyDirectoryToDist(relativeDirectory) {
  assertSourceAllowed(relativeDirectory);
  const sourceDirectory = resolveInside(ROOT_DIR, relativeDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(toPosix(relativeDirectory), entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to publish symbolic link: ${relativePath}`);
    }

    if (entry.isDirectory()) {
      await copyDirectoryToDist(relativePath);
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(`Unsupported filesystem entry in allowlisted directory: ${relativePath}`);
    }

    await copyFileToDist(relativePath);
  }
}

async function fileExists(filePath) {
  try {
    const fileStat = await lstat(filePath);
    return fileStat.isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(directory, baseDirectory = directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath, baseDirectory));
    } else if (entry.isFile()) {
      files.push(toPosix(path.relative(baseDirectory, absolutePath)));
    }
  }

  return files;
}

export async function buildCloudflareDist() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const queue = [...ENTRYPOINTS];
  const discovered = new Set();

  while (queue.length > 0) {
    const relativePath = queue.shift();
    if (discovered.has(relativePath)) continue;

    discovered.add(relativePath);
    await copyFileToDist(relativePath);

    const sourceContent = await readFile(resolveInside(ROOT_DIR, relativePath), "utf8");
    for (const reference of collectLocalReferences(sourceContent, relativePath)) {
      if (!discovered.has(reference)) queue.push(reference);
    }
  }

  for (const relativeDirectory of ALLOWLIST_DIRECTORIES) {
    await copyDirectoryToDist(relativeDirectory);
  }

  for (const optionalFile of OPTIONAL_ROOT_FILES) {
    if (await fileExists(resolveInside(ROOT_DIR, optionalFile))) {
      await copyFileToDist(optionalFile);
    }
  }

  const files = await listFiles(DIST_DIR);
  console.log(`Built Cloudflare distribution with ${files.length} allowlisted files.`);
  return files;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === SCRIPT_FILE;

if (isDirectRun) {
  buildCloudflareDist().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
