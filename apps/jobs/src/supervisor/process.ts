// Everything related to running a scraper's child process: building the
// command line, installing dependencies, spawning, and tearing it down
// gracefully. Kept together because they form one I/O concern.

import { existsSync } from "node:fs";
import { join } from "node:path";

// Longer than the skit runtime's full drain sequence (~7.5s) so a graceful
// child always wins the race against SIGKILL.
const FORCE_KILL_GRACE_MS = 10_000;
const REAP_POLL_INTERVAL_MS = 250;

// The skit runner is resolved through the package's exports map. In dev and
// in the Docker image alike this lands on `packages/skit/src/run.ts`.
const SKIT_RUNNER = new URL(import.meta.resolve("@project-minato/skit/run"))
	.pathname;

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
	scraperType: "scheduled" | "daemon" | "poller";
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
		throw new Error(
			`bun install in ${scraperDir} failed with exit code ${code}`,
		);
	}
}

// Children are spawned detached (own session + process group) so a kill can
// target the whole group — a scraper that spawns its own subprocesses can't
// leak grandchildren past us.
function killGroup(pid: number, signal: "SIGTERM" | "SIGKILL"): void {
	try {
		process.kill(-pid, signal);
	} catch {
		// ESRCH — group already gone
	}
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// Kills a process group we don't own a handle for — a child left behind by a
// previous supervisor run. Since it's not our child we can't await exit;
// instead poll liveness until the grace period runs out, then SIGKILL.
// Accepted risk: the PID may have been reused by an unrelated process in the
// window between supervisor runs; on this appliance that window is tiny.
export async function reapStalePid(pid: number): Promise<void> {
	if (!isAlive(pid)) return;
	killGroup(pid, "SIGTERM");
	const deadline = Date.now() + FORCE_KILL_GRACE_MS;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, REAP_POLL_INTERVAL_MS));
		if (!isAlive(pid)) return;
	}
	killGroup(pid, "SIGKILL");
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
		detached: true,
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
			killGroup(proc.pid, "SIGTERM");
			const winner = await Promise.race([
				proc.exited.then(() => "exited" as const),
				new Promise<"timeout">((resolve) =>
					setTimeout(() => resolve("timeout"), FORCE_KILL_GRACE_MS),
				),
			]);
			if (winner === "timeout") {
				killGroup(proc.pid, "SIGKILL");
				await proc.exited.catch(() => {});
			}
		},
	};
}
