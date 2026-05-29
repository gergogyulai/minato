// Everything related to running a scraper's child process: building the
// command line, installing dependencies, spawning, and tearing it down
// gracefully. Kept together because they form one I/O concern.

import { existsSync } from "node:fs";
import { join } from "node:path";

const FORCE_KILL_GRACE_MS = 5_000;

// The skit runner is resolved through the package's exports map. In dev and
// in the Docker image alike this lands on `packages/skit/src/run.ts`.
const SKIT_RUNNER = new URL(
  import.meta.resolve("@project-minato/skit/run"),
).pathname;

export type ChildHandle = {
  pid: number;
  exited: Promise<number>;
  killGracefully: () => Promise<void>;
};

export type ScraperManifest = {
  id: string;
  name: string;
  title: string;
  version: string;
  author?: string;
  entry: string;
  capabilities: string[];
  defaultConfig?: Record<string, unknown>;
};

// First-party scrapers are baked into the Docker image with deps already
// installed; community scrapers ship as source and need `bun install`.
export async function installDependencies(
  scraperDir: string,
  type: "first_party" | "community",
): Promise<void> {
  if (type === "first_party") return;

  const pkgJson = join(scraperDir, "package.json");
  if (!existsSync(pkgJson)) return;

  const proc = Bun.spawn(["bun", "install"], {
    cwd: scraperDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`bun install in ${scraperDir} failed with exit code ${code}`);
  }
}

export function spawnScraper(opts: {
  dir: string;
  manifest: ScraperManifest;
  apiUrl: string;
  apiKey: string;
}): ChildHandle {
  // The runtime reads identity exclusively from these env vars — it never
  // reads package.json directly. Keep this list as the single source of truth.
  const proc = Bun.spawn(["bun", "run", SKIT_RUNNER], {
    cwd: opts.dir,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      MINATO_API_URL: opts.apiUrl,
      MINATO_API_KEY: opts.apiKey,
      MINATO_SCRAPER_ID: opts.manifest.id,
      MINATO_SCRAPER_NAME: opts.manifest.title,
      MINATO_SCRAPER_VERSION: opts.manifest.version,
      MINATO_SCRAPER_DIR: opts.dir,
      MINATO_SCRAPER_ENTRY: opts.manifest.entry,
    },
  });

  return {
    pid: proc.pid,
    exited: proc.exited,
    async killGracefully() {
      if (proc.killed) return;
      proc.kill("SIGTERM");
      const winner = await Promise.race([
        proc.exited.then(() => "exited" as const),
        new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), FORCE_KILL_GRACE_MS),
        ),
      ]);
      if (winner === "timeout" && !proc.killed) {
        proc.kill("SIGKILL");
        await proc.exited.catch(() => {});
      }
    },
  };
}
