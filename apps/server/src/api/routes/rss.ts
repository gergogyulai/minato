import { auth } from "@project-minato/auth";
import type { MeiliTorrentDocument } from "@project-minato/meilisearch";
import { meiliClient } from "@project-minato/meilisearch";
import type { Context } from "hono";
import { create } from "xmlbuilder2";

const VALID_SORT_VALUES = new Set([
	"trackerTitle:asc",
	"trackerTitle:desc",
	"seeders:asc",
	"seeders:desc",
	"publishedAt:asc",
	"publishedAt:desc",
	"size:asc",
	"size:desc",
]);

function rssError(message: string, status: 400 | 401 | 403): Response {
	const xml = create(
		{ version: "1.0", encoding: "UTF-8" },
		{
			rss: {
				"@version": "2.0",
				channel: {
					title: "Minato RSS Feed",
					description: message,
					link: "",
				},
			},
		},
	).end({ prettyPrint: true });

	return new Response(xml, {
		status,
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}

function torrentLink(hit: MeiliTorrentDocument): string {
	return hit.magnet ?? hit.sources?.[0]?.url ?? "";
}

export async function handleRss(c: Context): Promise<Response> {
	const apiKeyValue = c.req.query("apikey");
	if (!apiKeyValue) {
		return rssError("Missing apikey parameter", 400);
	}

	const authResult = await auth.api.verifyApiKey({ body: { key: apiKeyValue } });
	if (!authResult.valid) {
		return rssError("Invalid or expired API key", 401);
	}

	const keyType = (authResult.key?.metadata as { type?: string } | null)?.type ?? "custom";
	if (keyType !== "rss" && keyType !== "custom") {
		return rssError("This API key is not authorized to access the RSS feed", 403);
	}

	const q = c.req.query("q") ?? "";
	const type = c.req.query("type");
	const sortParam = c.req.query("sort") ?? "";
	const sort = VALID_SORT_VALUES.has(sortParam) ? sortParam : "publishedAt:desc";
	const limitParam = Number.parseInt(c.req.query("limit") ?? "50", 10);
	const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 100);
	const seedersParam = c.req.query("seeders");
	const seeders = seedersParam !== undefined ? Number.parseInt(seedersParam, 10) : undefined;

	const filters: string[] = [];
	if (type) filters.push(`type = "${type}"`);
	if (seeders !== undefined && !Number.isNaN(seeders)) {
		filters.push(`seeders >= ${seeders}`);
	}
	const filterString = filters.length > 0 ? filters.join(" AND ") : undefined;

	const index = meiliClient.index("torrents");
	const result = await index.search(q, {
		filter: filterString,
		sort: [sort],
		limit,
	});
	const hits = result.hits as MeiliTorrentDocument[];

	const obj = {
		rss: {
			"@version": "2.0",
			channel: {
				title: "Minato RSS Feed",
				description: "Torrent search results from Minato",
				link: "https://github.com/project-minato",
				language: "en-us",
				lastBuildDate: new Date().toUTCString(),
				item: hits.map((hit) => {
					const link = torrentLink(hit);
					return {
						title: hit.trackerTitle,
						guid: { "@isPermaLink": "false", "#": hit.infoHash },
						link,
						pubDate: new Date(hit.publishedAt ?? hit.createdAt).toUTCString(),
						enclosure: {
							"@url": link,
							"@length": hit.size,
							"@type": "application/x-bittorrent",
						},
						description: [
							`Size: ${hit.size}`,
							`Seeders: ${hit.seeders ?? 0}`,
							`Leechers: ${hit.leechers ?? 0}`,
							`Type: ${hit.type ?? "Unknown"}`,
							`Source: ${hit.sources?.[0]?.scraper ?? "Unknown"}`,
						].join("\n"),
						category: hit.type ?? "Other",
					};
				}),
			},
		},
	};

	const xml = create({ version: "1.0", encoding: "UTF-8" }, obj).end({
		prettyPrint: true,
	});

	return c.body(xml, 200, { "Content-Type": "application/rss+xml; charset=utf-8" });
}
