import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ScraperManifest, Capability } from "./types";

export function readManifest(dir: string): ScraperManifest {
  const manifestPath = resolve(dir, "scraper.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    throw new Error(`Failed to read scraper.json at ${manifestPath}`);
  }

  const manifest = raw as Record<string, unknown>;

  const required = ["id", "name", "version", "entry", "capabilities"];
  for (const key of required) {
    if (!manifest[key]) throw new Error(`scraper.json missing required field: ${key}`);
  }

  return {
    id: manifest.id as string,
    name: manifest.name as string,
    version: manifest.version as string,
    author: manifest.author as string | undefined,
    runtime: (manifest.runtime as "bun" | "node" | undefined) ?? "bun",
    entry: manifest.entry as string,
    capabilities: manifest.capabilities as Capability[],
    lifecycle: (manifest.lifecycle as "scheduled" | "daemon" | undefined) ?? "scheduled",
    defaultConfig: manifest.defaultConfig as Record<string, unknown> | undefined,
  };
}
