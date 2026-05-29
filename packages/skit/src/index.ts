// Public surface for scraper authors. A scraper module is the dumb side of
// the contract: it declares what it is (scheduled vs daemon, its default
// config, an optional recommended cron) and a single `run` function. The
// supervisor and the runtime do everything else.

import type { FlareSolverr } from "@project-minato/api-clients";

export type {
	Cookie,
	FlareSolverrResponse,
	ProxyConfig,
	RequestOptions,
	Solution,
} from "@project-minato/api-clients";
export { FlareSolverr } from "@project-minato/api-clients";

// ---------------------------------------------------------------------------
// Types — the contract between a scraper and the Minato runtime.
// ---------------------------------------------------------------------------

export type Capability = "ingest" | "status" | "commands";
export type Lifecycle = "scheduled" | "daemon";

export type TorrentInput = {
	infoHash: string;
	title: string;
	size: number;
	seeders?: number;
	leechers?: number;
	magnet?: string;
	category?: string;
	publishedAt?: string;
	files?: Array<{ filename: string; size: number }>;
	source: {
		name: string;
		url?: string;
		origin?: string;
		originUrl?: string;
	};
};

export type IngestResult = {
	count: number;
	message: string;
};

export type ScraperStatus = {
	phase?: "idle" | "running" | "paused" | "error";
	progress?: { current: number; total?: number };
	message?: string;
};

export type ScraperMeta = {
	id: string;
	name: string;
	version: string;
};

export type IngestClient = {
	add(torrent: TorrentInput): void;
	flush(): Promise<void>;
};

export type StatusReporter = {
	update(status: ScraperStatus): void;
};

export type ScraperContext<TConfig = Record<string, unknown>> = {
	ingest: IngestClient;
	config: TConfig;
	signal: AbortSignal;
	status: StatusReporter;
	meta: ScraperMeta;
	/** FlareSolverr client pre-configured with Minato's registered instance URL. */
	flaresolverr: FlareSolverr;
};

type BaseDefinition<TConfig> = {
	config?: TConfig;
	run(ctx: ScraperContext<TConfig>): Promise<void>;
};

export type ScheduledScraperDefinition<TConfig = Record<string, unknown>> =
	BaseDefinition<TConfig> & {
		/**
		 * Recommended cron expression (5-field, UTC). Shown in the dashboard as
		 * the default; admins may override per instance without changing code.
		 */
		recommendedSchedule?: string;
	};

export type DaemonScraperDefinition<TConfig = Record<string, unknown>> =
	BaseDefinition<TConfig>;

export type ScraperDefinition<TConfig = Record<string, unknown>> =
	| ({
			lifecycle: "scheduled";
			recommendedSchedule?: string;
	  } & BaseDefinition<TConfig>)
	| ({ lifecycle: "daemon" } & BaseDefinition<TConfig>);

// ---------------------------------------------------------------------------
// Factory functions — the entry points scrapers export by default.
// ---------------------------------------------------------------------------

export function defineScheduledScraper<TConfig>(
	definition: ScheduledScraperDefinition<TConfig>,
): ScraperDefinition<TConfig> {
	return { lifecycle: "scheduled", ...definition };
}

export function defineDaemonScraper<TConfig>(
	definition: DaemonScraperDefinition<TConfig>,
): ScraperDefinition<TConfig> {
	return { lifecycle: "daemon", ...definition };
}

// ---------------------------------------------------------------------------
// FlareSolverr fetch helper — utility for scrapers that need a real browser.
// ---------------------------------------------------------------------------

type FlareSolverrCtx = { flaresolverr: FlareSolverr };

/**
 * Browser-bypassing replacement for `fetch`. Routes the request through the
 * `flaresolverr` client on the scraper context. GET and POST only.
 */
export async function ffetch(
	ctx: FlareSolverrCtx,
	url: string | URL,
	init?: RequestInit,
): Promise<Response> {
	const urlStr = url.toString();
	const method = (init?.method ?? "GET").toUpperCase();

	let result: Awaited<ReturnType<FlareSolverr["get"]>>;

	if (method === "POST") {
		result = await ctx.flaresolverr.post({
			url: urlStr,
			postData: init?.body != null ? String(init.body) : "",
		});
	} else if (method === "GET") {
		result = await ctx.flaresolverr.get({ url: urlStr });
	} else {
		throw new Error(
			`ffetch: unsupported method "${method}" — FlareSolverr only supports GET and POST`,
		);
	}

	if (result.status !== "ok" || !result.solution) {
		throw new Error(`ffetch: FlareSolverr error — ${result.message}`);
	}

	const { solution } = result;
	return new Response(solution.response, {
		status: solution.status,
		headers: solution.headers,
	});
}

export const flareFetch = ffetch;
