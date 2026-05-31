import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { TorrentInput } from "@project-minato/skit";
import { defineScheduledScraper } from "@project-minato/skit";

const LOG_DIR = "/tmp/tpb-scraper";

function makeLogger() {
	mkdirSync(LOG_DIR, { recursive: true });
	const file = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
	return {
		log(msg: string) {
			const line = `${new Date().toISOString()} ${msg}\n`;
			process.stdout.write(line);
			appendFileSync(file, line);
		},
		path: file,
	};
}

const ALL_CATEGORIES = [
	{ id: 100, name: "Audio" },
	{ id: 101, name: "Music" },
	{ id: 102, name: "Audio books" },
	{ id: 103, name: "Sound clips" },
	{ id: 104, name: "FLAC" },
	{ id: 199, name: "Other (Audio)" },
	{ id: 200, name: "Video" },
	{ id: 201, name: "Movies" },
	{ id: 202, name: "Movies DVDR" },
	{ id: 203, name: "Music videos" },
	{ id: 204, name: "Movie clips" },
	{ id: 205, name: "TV shows" },
	{ id: 206, name: "Handheld (Video)" },
	{ id: 207, name: "HD - Movies" },
	{ id: 208, name: "HD - TV shows" },
	{ id: 209, name: "3D" },
	{ id: 210, name: "CAM/TS" },
	{ id: 211, name: "UHD/4k - Movies" },
	{ id: 212, name: "UHD/4k - TV shows" },
	{ id: 299, name: "Other (Video)" },
	{ id: 300, name: "Applications" },
	{ id: 301, name: "Windows" },
	{ id: 302, name: "Mac (Applications)" },
	{ id: 303, name: "UNIX" },
	{ id: 304, name: "Handheld (Applications)" },
	{ id: 305, name: "IOS (iPad/iPhone) (Applications)" },
	{ id: 306, name: "Android (Applications)" },
	{ id: 399, name: "Other OS" },
	{ id: 400, name: "Games" },
	{ id: 401, name: "PC" },
	{ id: 402, name: "Mac (Games)" },
	{ id: 403, name: "PSx" },
	{ id: 404, name: "XBOX360" },
	{ id: 405, name: "Wii" },
	{ id: 406, name: "Handheld (Games)" },
	{ id: 407, name: "IOS (iPad/iPhone) (Games)" },
	{ id: 408, name: "Android (Games)" },
	{ id: 499, name: "Other (Games)" },
	{ id: 500, name: "Porn" },
	{ id: 501, name: "Movies (Porn)" },
	{ id: 502, name: "Movies DVDR (Porn)" },
	{ id: 503, name: "Pictures (Porn)" },
	{ id: 504, name: "Games (Porn)" },
	{ id: 505, name: "HD - Movies (Porn)" },
	{ id: 506, name: "Movie clips (Porn)" },
	{ id: 507, name: "UHD/4k - Movies (Porn)" },
	{ id: 599, name: "Other (Porn)" },
	{ id: 600, name: "Other" },
	{ id: 601, name: "E-books" },
	{ id: 602, name: "Comics" },
	{ id: 603, name: "Pictures" },
	{ id: 604, name: "Covers" },
	{ id: 605, name: "Physibles" },
	{ id: 699, name: "Other (Other)" },
];

const CATEGORY_MAP = new Map(ALL_CATEGORIES.map((c) => [c.id, c.name]));

type ApibayTorrent = {
	id: number | string;
	info_hash: string;
	name: string;
	category: number | string;
	seeders: number | string;
	leechers: number | string;
	size: number | string;
	num_files: number | string;
	username: string;
	added: number | string;
	status: string;
	imdb: string | null;
};

type ApibayFile = {
	name: string[];
	size: number[];
};

type PirateBayConfig = {
	apiBaseUrl: string;
	scrapeTop100: boolean;
	scrapeTop100_48h: boolean;
	scrapeCategories: boolean;
	maxCategoryPages: number;
	scrapeRecent: boolean;
	maxRecentPages: number;
	fetchFileDetails: boolean;
};

const TPB_TRACKERS = [
	"udp%3A%2F%2Ftracker.openbittorrent.com%3A80",
	"udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce",
].join("&tr=");

function buildMagnet(infoHash: string, name: string): string {
	return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}&tr=${TPB_TRACKERS}`;
}

function categoryName(id: number | string): string | undefined {
	return CATEGORY_MAP.get(Number(id));
}

async function fetchJson<T>(
	url: string,
	signal: AbortSignal,
	log: (msg: string) => void,
): Promise<T> {
	log(`FETCH ${url}`);
	const res = await fetch(url, { signal });
	if (!res.ok) {
		log(`ERROR HTTP ${res.status} from ${url}`);
		throw new Error(`HTTP ${res.status} from ${url}`);
	}
	const data = (await res.json()) as T;
	const count = Array.isArray(data) ? data.length : "?";
	log(`OK    ${url} → ${count} items`);
	return data;
}

async function fetchFileList(
	id: number | string,
	apiBaseUrl: string,
	signal: AbortSignal,
	log: (msg: string) => void,
): Promise<Array<{ filename: string; size: number }>> {
	try {
		const url = `${apiBaseUrl}/f.php?id=${id}`;
		const data = await fetchJson<ApibayFile[]>(url, signal, log);
		const files: Array<{ filename: string; size: number }> = [];
		for (const f of data) {
			const filename = f.name?.[0];
			const size = f.size?.[0];
			if (filename != null && size != null) files.push({ filename, size });
		}
		return files;
	} catch {
		return [];
	}
}

function transformTorrent(t: ApibayTorrent, apiBaseUrl: string): TorrentInput {
	const infoHash = t.info_hash.toLowerCase();
	return {
		infoHash,
		title: t.name,
		size: Number(t.size),
		seeders: Number(t.seeders),
		leechers: Number(t.leechers),
		magnet: buildMagnet(infoHash, t.name),
		category: categoryName(t.category),
		publishedAt: new Date(Number(t.added) * 1000).toISOString(),
		source: {
			name: "The Pirate Bay",
			url: apiBaseUrl,
			originUrl: `https://www.thepiratebay.org/torrent/${t.id}`,
		},
	};
}

export default defineScheduledScraper<PirateBayConfig>({
	recommendedSchedule: "0 3 * * *",
	config: {
		apiBaseUrl: "https://apibay.org",
		scrapeTop100: true,
		scrapeTop100_48h: true,
		scrapeCategories: true,
		maxCategoryPages: 200,
		scrapeRecent: true,
		maxRecentPages: 160,
		fetchFileDetails: false,
	},
	async run({ config, ingest, status, signal }) {
		const { apiBaseUrl } = config;
		const { log, path: logPath } = makeLogger();
		const seenHashes = new Set<string>();

		const total =
			(config.scrapeTop100 ? ALL_CATEGORIES.length : 0) +
			(config.scrapeTop100_48h ? ALL_CATEGORIES.length : 0) +
			(config.scrapeCategories ? ALL_CATEGORIES.length : 0) +
			(config.scrapeRecent ? config.maxRecentPages : 0);

		let done = 0;
		let totalNew = 0;
		let totalDuplicate = 0;
		let totalErrors = 0;

		async function addTorrents(torrents: ApibayTorrent[], phase: string): Promise<number> {
			let newCount = 0;
			let dupCount = 0;
			let sentinelCount = 0;
			for (const t of torrents) {
				if (signal.aborted) break;
				const infoHash = t.info_hash.toLowerCase();
				if (/^0+$/.test(infoHash)) {
					sentinelCount++;
					log(`NO_RESULTS [${phase}] sentinel response skipped`);
					continue;
				}
				if (seenHashes.has(infoHash)) {
					dupCount++;
					continue;
				}
				seenHashes.add(infoHash);
				const torrent = transformTorrent(t, apiBaseUrl);
				if (config.fetchFileDetails) {
					torrent.files = await fetchFileList(t.id, apiBaseUrl, signal, log);
				}
				ingest.add(torrent);
				newCount++;
			}
			totalNew += newCount;
			totalDuplicate += dupCount;
			const real = torrents.length - sentinelCount;
			log(`BATCH [${phase}] fetched=${torrents.length} real=${real} new=${newCount} dup=${dupCount} running_total=${totalNew}`);
			return real;
		}

		log(`START config=${JSON.stringify(config)}`);
		log(`LOG   writing to ${logPath}`);

		if (config.scrapeTop100) {
			log(`PHASE top100 categories=${ALL_CATEGORIES.length}`);
			for (const cat of ALL_CATEGORIES) {
				if (signal.aborted) { log("ABORT signal received in top100"); break; }
				done++;
				status.update({
					phase: "running",
					message: `top100: ${cat.name}`,
					progress: { current: done, total },
				});
				const url = `${apiBaseUrl}/precompiled/data_top100_${cat.id}.json`;
				try {
					const torrents = await fetchJson<ApibayTorrent[]>(url, signal, log);
					await addTorrents(torrents, `top100:${cat.id}`);
				} catch (err) {
					totalErrors++;
					log(`ERROR top100 cat=${cat.id} err=${err}`);
				}
			}
			log(`PHASE_DONE top100`);
		}

		if (config.scrapeTop100_48h) {
			log(`PHASE top100_48h categories=${ALL_CATEGORIES.length}`);
			for (const cat of ALL_CATEGORIES) {
				if (signal.aborted) { log("ABORT signal received in top100_48h"); break; }
				done++;
				status.update({
					phase: "running",
					message: `top100 48h: ${cat.name}`,
					progress: { current: done, total },
				});
				const url = `${apiBaseUrl}/precompiled/data_top100_48h_${cat.id}.json`;
				try {
					const torrents = await fetchJson<ApibayTorrent[]>(url, signal, log);
					await addTorrents(torrents, `top100_48h:${cat.id}`);
				} catch (err) {
					totalErrors++;
					log(`ERROR top100_48h cat=${cat.id} err=${err}`);
				}
			}
			log(`PHASE_DONE top100_48h`);
		}

		if (config.scrapeCategories) {
			log(`PHASE categories categories=${ALL_CATEGORIES.length} maxPages=${config.maxCategoryPages}`);
			for (const cat of ALL_CATEGORIES) {
				if (signal.aborted) break;
				done++;
				let catNew = 0;
				for (let page = 0; page < config.maxCategoryPages; page++) {
					if (signal.aborted) break;
					status.update({
						phase: "running",
						message: `categories: ${cat.name} p${page + 1}`,
						progress: { current: done, total },
					});
					const url = `${apiBaseUrl}/q.php?q=${encodeURIComponent(`category:${cat.id}:${page}`)}`;
					try {
						const torrents = await fetchJson<ApibayTorrent[]>(url, signal, log);
						const real = await addTorrents(torrents, `cat:${cat.id}:${page}`);
						catNew += real;
						if (real === 0) {
							log(`CAT_DONE cat=${cat.id} (${cat.name}) pages=${page} new=${catNew}`);
							break;
						}
					} catch (err) {
						totalErrors++;
						log(`ERROR cat=${cat.id} page=${page} err=${err}`);
						break;
					}
				}
				log(`CAT_SUMMARY cat=${cat.id} (${cat.name}) new=${catNew}`);
			}
			log(`PHASE_DONE categories`);
		}

		if (config.scrapeRecent) {
			log(`PHASE recent max_pages=${config.maxRecentPages}`);
			for (let page = 0; page < config.maxRecentPages; page++) {
				if (signal.aborted) { log(`ABORT signal received in recent at page=${page}`); break; }
				done++;
				status.update({
					phase: "running",
					message: `recent: page ${page + 1}`,
					progress: { current: done, total },
				});
				const url =
					page === 0
						? `${apiBaseUrl}/precompiled/data_top100_recent.json`
						: `${apiBaseUrl}/precompiled/data_top100_recent_${page}.json`;
				try {
					const torrents = await fetchJson<ApibayTorrent[]>(url, signal, log);
					const real = await addTorrents(torrents, `recent:${page}`);
					if (real === 0) {
						log(`EARLY_STOP recent page=${page} no real items`);
						break;
					}
				} catch (err) {
					totalErrors++;
					log(`ERROR recent page=${page} err=${err}`);
				}
			}
			log(`PHASE_DONE recent`);
		}

		log(`DONE new=${totalNew} dup=${totalDuplicate} errors=${totalErrors} unique_total=${seenHashes.size}`);
		status.update({ phase: "idle", message: "Scrape complete" });
	},
});
