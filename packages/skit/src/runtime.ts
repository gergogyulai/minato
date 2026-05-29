// The runtime side of the SDK — everything the supervisor's spawned child
// does. Reads identity + endpoints from env (the supervisor is the only
// place that reads package.json), imports the scraper module, calls
// register, builds the context, runs the scraper, flushes on exit.
//
// A scraper file knows nothing about any of this. It exports a definition
// and the runtime fills in everything else.

import { resolve } from "node:path";
import { FlareSolverr } from "@project-minato/api-clients";
import type {
	IngestClient,
	IngestResult,
	Lifecycle,
	ScraperDefinition,
	ScraperStatus,
	StatusReporter,
	TorrentInput,
} from "./index";

const INGEST_FLUSH_INTERVAL_MS = 3_000;
const INGEST_FLUSH_BATCH_SIZE = 50;
const INGEST_REQUEST_TIMEOUT_MS = 30_000;
const COMMANDS_RECONNECT_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// Ingest buffer
// ---------------------------------------------------------------------------

function createIngestClient(apiUrl: string, apiKey: string): IngestClient {
	const buffer: TorrentInput[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleFlush() {
		if (flushTimer) return;
		flushTimer = setTimeout(() => {
			flushTimer = null;
			flush().catch(() => {});
		}, INGEST_FLUSH_INTERVAL_MS);
	}

	async function sendBatch(batch: TorrentInput[]): Promise<IngestResult> {
		const headers = {
			"Content-Type": "application/json",
			"X-Minato-Key": apiKey,
			"X-Minato-Scraper": batch[0]?.source.name ?? "skit",
		};
		const body = JSON.stringify(batch);

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			INGEST_REQUEST_TIMEOUT_MS,
		);

		try {
			const res = await fetch(`${apiUrl}/api/v1/torrents/ingest`, {
				method: "POST",
				headers,
				body,
				signal: controller.signal,
			});

			// Single retry on 5xx
			if (res.status >= 500) {
				const retry = await fetch(`${apiUrl}/api/v1/torrents/ingest`, {
					method: "POST",
					headers,
					body,
					signal: controller.signal,
				});
				return (await retry.json()) as IngestResult;
			}

			return (await res.json()) as IngestResult;
		} finally {
			clearTimeout(timeout);
		}
	}

	async function flush(): Promise<void> {
		if (flushTimer) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}

		while (buffer.length > 0) {
			const batch = buffer.splice(0, INGEST_FLUSH_BATCH_SIZE);
			// Never throw — individual rejections are counted but don't crash
			await sendBatch(batch).catch(() => {});
		}
	}

	return {
		add(torrent: TorrentInput) {
			buffer.push(torrent);
			if (buffer.length >= INGEST_FLUSH_BATCH_SIZE) {
				flush().catch(() => {});
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

function createStatusReporter(apiUrl: string, apiKey: string): StatusReporter {
	return {
		update(status: ScraperStatus) {
			fetch(`${apiUrl}/api/v1/scraper/status`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Minato-Key": apiKey,
				},
				body: JSON.stringify(status),
			}).catch(() => {});
		},
	};
}

// ---------------------------------------------------------------------------
// Commands signal
// ---------------------------------------------------------------------------

// Uses fetch + ReadableStream instead of EventSource because the EventSource
// constructor doesn't accept custom request headers.
function createCommandSignal(
	apiUrl: string,
	apiKey: string,
	scraperId: string,
): AbortSignal {
	const controller = new AbortController();

	async function connect(lastEventId?: string) {
		if (controller.signal.aborted) return;

		try {
			const headers: Record<string, string> = {
				Accept: "text/event-stream",
				"Cache-Control": "no-cache",
				"X-Minato-Key": apiKey,
			};
			if (lastEventId) headers["Last-Event-ID"] = lastEventId;

			const res = await fetch(
				`${apiUrl}/api/v1/scraper/commands/${scraperId}`,
				{ headers, signal: controller.signal },
			);

			if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = "";
			let seenEventId: string | undefined;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buf += decoder.decode(value, { stream: true });
				const lines = buf.split("\n");
				buf = lines.pop() ?? "";

				let eventId: string | undefined;
				let eventType: string | undefined;
				let data: string | undefined;

				for (const line of lines) {
					if (line.startsWith("id: ")) {
						eventId = line.slice(4);
					} else if (line.startsWith("event: ")) {
						eventType = line.slice(7);
					} else if (line.startsWith("data: ")) {
						data = line.slice(6);
					} else if (line === "") {
						if (eventId) seenEventId = eventId;
						if (eventType === "command" && data) {
							const { command } = JSON.parse(data) as { command: string };
							if (command === "pause" || command === "stop") {
								controller.abort();
								reader.cancel();
								return;
							}
						}
						eventId = undefined;
						eventType = undefined;
						data = undefined;
					}
				}
			}

			// Stream ended cleanly — reconnect
			reconnect(seenEventId);
		} catch {
			reconnect(undefined);
		}
	}

	function reconnect(lastEventId?: string) {
		if (controller.signal.aborted) return;
		setTimeout(() => connect(lastEventId), COMMANDS_RECONNECT_DELAY_MS);
	}

	connect();
	return controller.signal;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

type RegisterResult = {
	config: Record<string, unknown>;
	flareSolverrUrl: string;
};

async function register(
	apiUrl: string,
	apiKey: string,
	payload: {
		version: string;
		pid: number;
		capabilities: string[];
		lifecycle: Lifecycle;
		recommendedSchedule?: string;
	},
): Promise<RegisterResult> {
	const res = await fetch(`${apiUrl}/api/v1/scraper/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Minato-Key": apiKey,
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		throw new Error(
			`Scraper registration failed: ${res.status} ${await res.text()}`,
		);
	}
	return (await res.json()) as RegisterResult;
}

// ---------------------------------------------------------------------------
// Runner — the function `run.ts` calls. The supervisor injects everything
// this needs via env vars; nothing is read from `scraper.json` here.
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`[skit] Missing required env: ${name}`);
		process.exit(1);
	}
	return value;
}

export async function run(): Promise<void> {
	const apiUrl = requireEnv("MINATO_API_URL");
	const apiKey = requireEnv("MINATO_API_KEY");
	const scraperId = requireEnv("MINATO_SCRAPER_ID");
	const scraperName = requireEnv("MINATO_SCRAPER_NAME");
	const scraperVersion = requireEnv("MINATO_SCRAPER_VERSION");
	const scraperDir = requireEnv("MINATO_SCRAPER_DIR");
	const scraperEntry = requireEnv("MINATO_SCRAPER_ENTRY");

	const mod = (await import(resolve(scraperDir, scraperEntry))) as {
		default: ScraperDefinition;
	};
	const definition = mod.default;

	const { config: serverConfig, flareSolverrUrl } = await register(
		apiUrl,
		apiKey,
		{
			version: scraperVersion,
			pid: process.pid,
			capabilities: ["ingest", "status", "commands"],
			lifecycle: definition.lifecycle,
			recommendedSchedule:
				definition.lifecycle === "scheduled"
					? definition.recommendedSchedule
					: undefined,
		},
	);

	const config = {
		...(definition.config ?? {}),
		...serverConfig,
	} as Record<string, unknown>;

	const ingest = createIngestClient(apiUrl, apiKey);
	const status = createStatusReporter(apiUrl, apiKey);
	const signal = createCommandSignal(apiUrl, apiKey, scraperId);
	const flaresolverr = new FlareSolverr(flareSolverrUrl);

	process.on("uncaughtException", async (err) => {
		status.update({ phase: "error", message: err.message });
		await ingest.flush();
		process.exit(1);
	});

	process.on("SIGTERM", async () => {
		await ingest.flush();
		process.exit(0);
	});

	await definition.run({
		ingest,
		config,
		signal,
		status,
		flaresolverr,
		meta: { id: scraperId, name: scraperName, version: scraperVersion },
	});

	await ingest.flush();
	process.exit(0);
}
