import type { TorrentInput } from "@project-minato/skit";
import { defineScheduledScraper } from "@project-minato/skit";
import * as cheerio from "cheerio";

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

type PirateBayConfig = {
	baseUrl: string[];
	scrapeTop100: boolean;
	scrapeTop100_48h: boolean;
	scrapeRecent: boolean;
	maxRecentPages: number;
};

function extractInfoHash(magnetUrl: string): string | null {
	const match = magnetUrl.match(/urn:btih:([a-fA-F0-9]{40})/i);
	return match?.[1]?.toLowerCase() ?? null;
}

function parsePublishedAt(
	dateText: string,
	timeTitle: string,
): string | undefined {
	// dateText: "2026-05-29", timeTitle: "12:14:35 GMT+0200 (Central European Summer Time)"
	const timePart = timeTitle.split(" (")[0]; // strip timezone label in parens
	try {
		return new Date(`${dateText} ${timePart}`).toISOString();
	} catch {
		return undefined;
	}
}

function parseRows(html: string, baseUrl: string): TorrentInput[] {
	const $ = cheerio.load(html);
	const results: TorrentInput[] = [];
	const base = baseUrl.replace(/\/$/, "");

	$("ol#torrents li.list-entry").each((_i, el) => {
		const magnetHref = $(el).find("a[href^='magnet:']").attr("href");
		if (!magnetHref) return;

		const infoHash = extractInfoHash(magnetHref);
		if (!infoHash) return;

		const title = $(el).find(".item-name.item-title a").text().trim();
		if (!title) return;

		const sizeBytes = $(el).find("input[name='size']").attr("value");
		const size = sizeBytes ? Number(sizeBytes) : 0;

		const seedersText = $(el).find(".item-seed").text().trim();
		const leechersText = $(el).find(".item-leech").text().trim();
		const seeders = seedersText ? Number.parseInt(seedersText, 10) : undefined;
		const leechers = leechersText
			? Number.parseInt(leechersText, 10)
			: undefined;

		const categoryLinks = $(el).find(".item-type a");
		const category = categoryLinks.last().text().trim() || undefined;

		const uploadedLabel = $(el).find(".item-uploaded label");
		const dateText = uploadedLabel.text().trim();
		const timeTitle = uploadedLabel.attr("title") ?? "";
		const publishedAt = dateText
			? parsePublishedAt(dateText, timeTitle)
			: undefined;

		const detailHref = $(el).find(".item-name.item-title a").attr("href");
		const originUrl = detailHref ? `${base}${detailHref}` : undefined;

		results.push({
			infoHash,
			title,
			size,
			seeders,
			leechers,
			magnet: magnetHref,
			category,
			publishedAt,
			source: {
				name: "The Pirate Bay",
				url: base,
				originUrl,
			},
		});
	});

	return results;
}

async function fetchPage(
	baseUrls: string[],
	query: string,
	signal: AbortSignal,
): Promise<string> {
	const path = `/search.php?q=${encodeURIComponent(query)}`;
	let lastError: unknown;
	for (const base of baseUrls) {
		if (signal.aborted) throw new DOMException("Aborted", "AbortError");
		const url = base.replace(/\/$/, "") + path;
		try {
			const res = await fetch(url, { signal });
			if (res.ok) return res.text();
			lastError = new Error(`HTTP ${res.status} from ${url}`);
		} catch (err) {
			lastError = err;
		}
	}
	throw lastError ?? new Error("All base URLs failed");
}

export default defineScheduledScraper<PirateBayConfig>({
	recommendedSchedule: "0 3 * * *",
	config: {
		baseUrl: ["https://thepiratebay.org"],
		scrapeTop100: true,
		scrapeTop100_48h: false,
		scrapeRecent: true,
		maxRecentPages: 10,
	},
	async run({ config, ingest, status, signal }) {
		const seenHashes = new Set<string>();

		const total =
			(config.scrapeTop100 ? ALL_CATEGORIES.length : 0) +
			(config.scrapeTop100_48h ? ALL_CATEGORIES.length : 0) +
			(config.scrapeRecent ? config.maxRecentPages : 0);

		let done = 0;

		function addRows(rows: TorrentInput[]) {
			for (const row of rows) {
				if (!seenHashes.has(row.infoHash)) {
					seenHashes.add(row.infoHash);
					ingest.add(row);
				}
			}
		}

		if (config.scrapeTop100) {
			for (const cat of ALL_CATEGORIES) {
				if (signal.aborted) break;
				done++;
				status.update({
					phase: "running",
					message: `top100: ${cat.name}`,
					progress: { current: done, total },
				});
				const html = await fetchPage(
					config.baseUrl,
					`top100:${cat.id}`,
					signal,
				);
				addRows(parseRows(html, config.baseUrl[0] ?? ""));
			}
		}

		if (config.scrapeTop100_48h) {
			for (const cat of ALL_CATEGORIES) {
				if (signal.aborted) break;
				done++;
				status.update({
					phase: "running",
					message: `top100 48h: ${cat.name}`,
					progress: { current: done, total },
				});
				const html = await fetchPage(
					config.baseUrl,
					`top100:48h_${cat.id}`,
					signal,
				);
				addRows(parseRows(html, config.baseUrl[0] ?? ""));
			}
		}

		if (config.scrapeRecent) {
			for (let page = 0; page < config.maxRecentPages; page++) {
				if (signal.aborted) break;
				done++;
				status.update({
					phase: "running",
					message: `recent: page ${page + 1}`,
					progress: { current: done, total },
				});
				const query = page === 0 ? "top100:recent" : `top100:recent:${page}`;
				const html = await fetchPage(config.baseUrl, query, signal);
				const rows = parseRows(html, config.baseUrl[0] ?? "");
				addRows(rows);
				if (rows.length < 30) break; // last page
			}
		}

		status.update({ phase: "idle", message: "Scrape complete" });
	},
});
