// The runtime side of the SDK — everything the supervisor's spawned child
// does. Reads identity + endpoints from env (the supervisor is the only
// place that reads package.json), imports the scraper module, calls
// register, builds the context, runs the scraper, flushes on exit.
//
// A scraper file knows nothing about any of this. It exports a definition
// and the runtime fills in everything else.

import { resolve } from "node:path";
import { FlareSolverr } from "@project-minato/utils/flaresolverr";
import type {
	IngestClient,
	ScraperDefinition,
	ScraperStatus,
	StatusReporter,
	TorrentInput,
} from "./index";

const INGEST_FLUSH_INTERVAL_MS = 3_000;
const INGEST_BATCH_SIZE = 50;
// Past this many buffered torrents the oldest batch is dropped — a scraper
// outpacing the API degrades predictably instead of growing without bound.
const INGEST_BUFFER_CAP = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [500, 1_000, 2_000];
// Drain budgets under SIGTERM: run() wind-down plus the final flush must stay
// inside the supervisor's 10s SIGKILL grace.
const SIGTERM_RUN_DRAIN_MS = 5_000;
const SIGTERM_FLUSH_DRAIN_MS = 2_500;
const NATURAL_FLUSH_DRAIN_MS = 60_000;

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Env — the only place process.env is read
// ---------------------------------------------------------------------------

type RuntimeEnv = {
	apiUrl: string;
	apiKey: string;
	id: string;
	name: string;
	version: string;
	dir: string;
	entry: string;
};

function readEnv(): RuntimeEnv {
	function require(name: string): string {
		const value = process.env[name];
		if (!value) {
			console.error(`[skit] Missing required env: ${name}`);
			process.exit(1);
		}
		return value;
	}
	return {
		apiUrl: require("MINATO_API_URL"),
		apiKey: require("MINATO_API_KEY"),
		id: require("MINATO_SCRAPER_ID"),
		name: require("MINATO_SCRAPER_NAME"),
		version: require("MINATO_SCRAPER_VERSION"),
		dir: require("MINATO_SCRAPER_DIR"),
		entry: require("MINATO_SCRAPER_ENTRY"),
	};
}

// ---------------------------------------------------------------------------
// API client — one fetch path for register, status, and ingest
// ---------------------------------------------------------------------------

type ApiClient = {
	request<T>(
		path: string,
		body: unknown,
		opts?: { retries?: number; headers?: Record<string, string> },
	): Promise<T>;
};

function createApiClient(env: RuntimeEnv): ApiClient {
	return {
		async request<T>(
			path: string,
			body: unknown,
			opts: { retries?: number; headers?: Record<string, string> } = {},
		): Promise<T> {
			const retries = opts.retries ?? RETRY_DELAYS_MS.length;
			const payload = JSON.stringify(body);
			let lastError = new Error("unreachable");

			for (let attempt = 0; attempt <= retries; attempt++) {
				if (attempt > 0) {
					await sleep(RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? 0);
				}

				// Fresh controller per attempt — a timed-out try must not poison
				// the next one.
				const controller = new AbortController();
				const timeout = setTimeout(
					() => controller.abort(),
					REQUEST_TIMEOUT_MS,
				);
				let res: Response;
				try {
					res = await fetch(`${env.apiUrl}${path}`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Minato-Key": env.apiKey,
							...opts.headers,
						},
						body: payload,
						signal: controller.signal,
					});
				} catch (err) {
					lastError = err as Error;
					continue;
				} finally {
					clearTimeout(timeout);
				}

				if (res.status >= 500) {
					lastError = new Error(`${path}: ${res.status} ${await res.text()}`);
					continue;
				}
				if (!res.ok) {
					// 4xx is our bug, not a transient — retrying won't help.
					throw new Error(`${path}: ${res.status} ${await res.text()}`);
				}
				return (await res.json()) as T;
			}

			throw lastError;
		},
	};
}

// ---------------------------------------------------------------------------
// Ingest buffer
// ---------------------------------------------------------------------------

function createIngestClient(api: ApiClient): IngestClient {
	const buffer: TorrentInput[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;
	let dropped = 0;

	function scheduleFlush() {
		flushTimer ??= setTimeout(() => {
			flushTimer = null;
			void flush();
		}, INGEST_FLUSH_INTERVAL_MS);
	}

	async function drain(): Promise<void> {
		while (buffer.length > 0) {
			const batch = buffer.splice(0, INGEST_BATCH_SIZE);
			try {
				await api.request("/api/v1/torrents/ingest", batch, {
					headers: { "X-Minato-Scraper": batch[0]?.source.name ?? "skit" },
				});
			} catch (err) {
				console.error(
					`[skit] ingest batch of ${batch.length} failed: ${(err as Error).message}`,
				);
			}
		}
	}

	// One drain at a time; items added mid-drain are picked up by its loop.
	function flush(): Promise<void> {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
		inFlight ??= drain().finally(() => {
			inFlight = null;
		});
		return inFlight;
	}

	return {
		add(torrent: TorrentInput) {
			if (buffer.length >= INGEST_BUFFER_CAP) {
				buffer.splice(0, INGEST_BATCH_SIZE);
				dropped += INGEST_BATCH_SIZE;
				if (dropped % 1_000 === 0) {
					console.warn(
						`[skit] ingest buffer full — dropped ${dropped} torrents so far`,
					);
				}
			}
			buffer.push(torrent);
			if (buffer.length >= INGEST_BATCH_SIZE) {
				void flush();
			} else {
				scheduleFlush();
			}
		},
		flush,
	};
}

// ---------------------------------------------------------------------------
// Status reporter (fire-and-forget)
// ---------------------------------------------------------------------------

function createStatusReporter(api: ApiClient): StatusReporter {
	return {
		update(status: ScraperStatus) {
			void api
				.request("/api/v1/scraper/status", status, { retries: 0 })
				.catch(() => {});
		},
	};
}

// ---------------------------------------------------------------------------
// Runner — the function `run.ts` calls. The supervisor injects everything
// this needs via env vars; nothing is read from package.json here.
// ---------------------------------------------------------------------------

type RegisterResult = {
	config: Record<string, unknown>;
	flareSolverrUrl: string;
};

export async function run(): Promise<void> {
	const env = readEnv();

	const mod = (await import(resolve(env.dir, env.entry))) as {
		default: ScraperDefinition;
	};
	const definition = mod.default;

	const api = createApiClient(env);
	const { config: serverConfig, flareSolverrUrl } =
		await api.request<RegisterResult>("/api/v1/scraper/register", {
			version: env.version,
			pid: process.pid,
			capabilities: ["ingest", "status"],
			lifecycle: definition.lifecycle,
			recommendedSchedule:
				definition.lifecycle === "scheduled"
					? definition.recommendedSchedule
					: undefined,
		});

	const config = {
		...(definition.config ?? {}),
		...serverConfig,
	} as Record<string, unknown>;

	const controller = new AbortController();
	const ingest = createIngestClient(api);
	const status = createStatusReporter(api);
	const flaresolverr = new FlareSolverr(flareSolverrUrl);

	const runPromise = definition.run({
		ingest,
		config,
		signal: controller.signal,
		status,
		flaresolverr,
		meta: { id: env.id, name: env.name, version: env.version },
	});

	// Every exit funnels through here, in order: abort the scraper, give its
	// run() a bounded window to wind down, report a final status, flush the
	// ingest tail, exit. The once-flag means whichever path fires first
	// (SIGTERM, crash, natural completion) drives the sequence alone.
	let shuttingDown = false;
	async function shutdown(
		code: number,
		opts: { runDrainMs: number; flushDrainMs: number; status?: ScraperStatus },
	): Promise<void> {
		if (shuttingDown) return;
		shuttingDown = true;
		controller.abort();
		await Promise.race([runPromise.catch(() => {}), sleep(opts.runDrainMs)]);
		if (opts.status) status.update(opts.status);
		await Promise.race([ingest.flush(), sleep(opts.flushDrainMs)]);
		process.exit(code);
	}

	process.on("SIGTERM", () => {
		void shutdown(0, {
			runDrainMs: SIGTERM_RUN_DRAIN_MS,
			flushDrainMs: SIGTERM_FLUSH_DRAIN_MS,
		});
	});

	process.on("uncaughtException", (err) => {
		console.error(`[skit] uncaught exception: ${err.stack ?? err.message}`);
		void shutdown(1, {
			runDrainMs: 0,
			flushDrainMs: SIGTERM_FLUSH_DRAIN_MS,
			status: { phase: "error", message: err.message },
		});
	});

	try {
		await runPromise;
	} catch (err) {
		const message = (err as Error).message;
		console.error(`[skit] run failed: ${message}`);
		await shutdown(1, {
			runDrainMs: 0,
			flushDrainMs: SIGTERM_FLUSH_DRAIN_MS,
			status: { phase: "error", message },
		});
		return;
	}
	await shutdown(0, { runDrainMs: 0, flushDrainMs: NATURAL_FLUSH_DRAIN_MS });
}
