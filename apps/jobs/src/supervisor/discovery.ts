// Everything that scans the filesystem for installed scrapers: reading the
// manifest, listing the first-party + community directories, and watching
// the community dir for hot-add / hot-remove.

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "@/utils/logger";
import type { ScraperManifest } from "./process";
import type { ScraperSource } from "@project-minato/db";

const REQUIRED_MINATO_FIELDS = ["capabilities"] as const;
const REQUIRED_PKG_FIELDS = ["title", "description", "module", "author", "repository"] as const;
const HOT_RELOAD_DEBOUNCE_MS = 300;

export type Discovered = {
  type: "first_party" | "community";
  dir: string;
  manifest: ScraperManifest;
  source: ScraperSource;
};

export function readManifest(dir: string): ScraperManifest {
  const pkgPath = resolve(dir, "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `package.json at ${pkgPath} is not valid JSON: ${(err as Error).message}`,
    );
  }

  for (const key of REQUIRED_PKG_FIELDS) {
    if (!pkg[key]) {
      throw new Error(`package.json at ${pkgPath} is missing required field "${key}"`);
    }
  }

  const minato = pkg.minato as Record<string, unknown> | undefined;
  if (!minato) {
    throw new Error(`package.json at ${pkgPath} is missing "minato" key`);
  }

  for (const key of REQUIRED_MINATO_FIELDS) {
    if (!minato[key]) {
      throw new Error(`package.json at ${pkgPath} is missing "minato.${key}"`);
    }
  }

  // npm allows author to be a string or a Person object; normalise to string.
  const rawAuthor = pkg.author;
  const author =
    typeof rawAuthor === "string"
      ? rawAuthor
      : typeof rawAuthor === "object" && rawAuthor !== null && "name" in rawAuthor
        ? (rawAuthor as { name: string }).name
        : undefined;

  return {
    id: pkg.name as string,
    name: pkg.name as string,
    title: pkg.title as string,
    version: (pkg.version as string | undefined) ?? "0.0.0",
    author,
    entry: pkg.module as string,
    capabilities: minato.capabilities as string[],
    defaultConfig: minato.defaultConfig as Record<string, unknown> | undefined,
  };
}

function hasMinatoManifest(dir: string): boolean {
  try {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
    return !!pkg.minato;
  } catch {
    return false;
  }
}

function listScraperDirs(parent: string): string[] {
  if (!existsSync(parent)) return [];
  return readdirSync(parent)
    .map((name) => join(parent, name))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory() && hasMinatoManifest(dir);
      } catch {
        return false;
      }
    });
}

export function discoverAll(
  internalDir: string,
  communityDir: string,
): Discovered[] {
  const out: Discovered[] = [];

  for (const dir of listScraperDirs(internalDir)) {
    try {
      out.push({
        type: "first_party",
        dir,
        manifest: readManifest(dir),
        source: { kind: "first_party" },
      });
    } catch (err) {
      logger.warn(`Skipping ${dir}: ${(err as Error).message}`);
    }
  }

  for (const dir of listScraperDirs(communityDir)) {
    try {
      // A community scraper installed via the API has its source recorded
      // in the DB row already; for hot-added directories we leave the URL
      // blank — the orchestrator preserves any existing DB source rather
      // than overwriting it.
      out.push({
        type: "community",
        dir,
        manifest: readManifest(dir),
        source: { kind: "git", url: "" },
      });
    } catch (err) {
      logger.warn(`Skipping ${dir}: ${(err as Error).message}`);
    }
  }

  return out;
}

export type WatcherCallbacks = {
  onAdded: (dir: string) => void;
  onRemoved: (dir: string) => void;
};

export function watchCommunityDir(
  communityDir: string,
  callbacks: WatcherCallbacks,
): FSWatcher | null {
  if (!existsSync(communityDir)) return null;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  function debounce(path: string, fn: () => void) {
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        fn();
      }, HOT_RELOAD_DEBOUNCE_MS),
    );
  }

  return watch(communityDir, { recursive: false }, (_event, filename) => {
    if (!filename) return;
    const candidate = join(communityDir, filename);
    debounce(candidate, () => {
      if (hasMinatoManifest(candidate)) {
        callbacks.onAdded(candidate);
      } else if (!existsSync(candidate)) {
        callbacks.onRemoved(candidate);
      }
    });
  });
}
