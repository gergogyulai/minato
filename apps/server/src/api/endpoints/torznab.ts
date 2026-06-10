import { auth } from "@project-minato/auth";
import type { MeiliTorrentDocument } from "@project-minato/meilisearch";
import { meiliClient } from "@project-minato/meilisearch";
import type { Context } from "hono";
import { create } from "xmlbuilder2";

const TYPE_TO_CATEGORY: Record<string, number> = {
	movie: 2000,
	tv: 5000,
	anime: 5070,
	music: 3000,
	book: 7000,
};

function getItemCategories(hit: MeiliTorrentDocument): number[] {
	const type = hit.enrichment?.mediaType ?? hit.type;
	if (!type || !TYPE_TO_CATEGORY[type]) return [8000];
	const cat = TYPE_TO_CATEGORY[type];
	// Include parent category for subcategories (e.g. anime → [5070, 5000])
	return cat === 5070 ? [5070, 5000] : [cat];
}

// Map Torznab cat param values back to internal type strings for filtering
function catParamToTypes(cats: number[]): string[] {
	const types = new Set<string>();
	for (const cat of cats) {
		if (cat >= 2000 && cat < 3000) types.add("movie");
		else if (cat >= 5070 && cat < 5080) {
			types.add("anime");
			types.add("tv");
		} else if (cat >= 5000 && cat < 6000) types.add("tv");
		else if (cat >= 3000 && cat < 4000) types.add("music");
		else if (cat >= 7000 && cat < 8000) types.add("book");
	}
	return [...types];
}

function torznabError(code: number, description: string): Response {
	const xml = create(
		{ version: "1.0", encoding: "UTF-8" },
		{ error: { "@code": String(code), "@description": description } },
	).end({ prettyPrint: true });
	return new Response(xml, {
		status: 200,
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}

function buildCaps(): string {
	return create(
		{ version: "1.0", encoding: "UTF-8" },
		{
			caps: {
				server: {
					"@version": "1.3",
					"@title": "Minato",
					"@url": "",
					"@email": "",
				},
				limits: { "@max": "100", "@default": "50" },
				searching: {
					search: {
						"@available": "yes",
						"@supportedParams": "q,cat,limit,offset",
					},
					"tv-search": {
						"@available": "yes",
						"@supportedParams": "q,season,ep,tvdbid,cat,limit,offset",
					},
					"movie-search": {
						"@available": "yes",
						"@supportedParams": "q,imdbid,cat,limit,offset",
					},
					"audio-search": {
						"@available": "yes",
						"@supportedParams": "q,cat,limit,offset",
					},
					"book-search": {
						"@available": "yes",
						"@supportedParams": "q,cat,limit,offset",
					},
				},
				categories: {
					category: [
						{
							"@id": "2000",
							"@name": "Movies",
							subcat: [
								{ "@id": "2040", "@name": "HD" },
								{ "@id": "2045", "@name": "UHD" },
							],
						},
						{ "@id": "3000", "@name": "Audio" },
						{
							"@id": "5000",
							"@name": "TV",
							subcat: [
								{ "@id": "5040", "@name": "HD" },
								{ "@id": "5070", "@name": "Anime" },
							],
						},
						{ "@id": "7000", "@name": "Books" },
						{ "@id": "8000", "@name": "Other" },
					],
				},
			},
		},
	).end({ prettyPrint: true });
}

function torrentLink(hit: MeiliTorrentDocument): string {
	return hit.magnet ?? hit.sources?.[0]?.url ?? "";
}

function buildTorznabAttrs(
	hit: MeiliTorrentDocument,
): Array<{ "@name": string; "@value": string }> {
	const cats = getItemCategories(hit);
	const attrs: Array<{ "@name": string; "@value": string }> = [
		...cats.map((c) => ({ "@name": "category", "@value": String(c) })),
		{ "@name": "seeders", "@value": String(hit.seeders ?? 0) },
		{ "@name": "leechers", "@value": String(hit.leechers ?? 0) },
		{ "@name": "infohash", "@value": hit.infoHash.toLowerCase() },
		{ "@name": "size", "@value": hit.size },
		{ "@name": "downloadvolumefactor", "@value": "0" },
		{ "@name": "uploadvolumefactor", "@value": "1" },
	];

	if (hit.magnet) {
		attrs.push({ "@name": "magneturl", "@value": hit.magnet });
	}

	const e = hit.enrichment;
	if (e) {
		if (e.year) attrs.push({ "@name": "year", "@value": String(e.year) });
		if (e.posterUrl) attrs.push({ "@name": "coverurl", "@value": e.posterUrl });

		const type = e.mediaType ?? hit.type;
		if (type === "movie" || type === "anime") {
			if (e.imdbId) attrs.push({ "@name": "imdb", "@value": e.imdbId });
		}
		if (type === "tv" || type === "anime") {
			if (e.seriesDetails?.seasonNumber != null) {
				attrs.push({
					"@name": "season",
					"@value": String(e.seriesDetails.seasonNumber),
				});
			}
			if (e.seriesDetails?.episodeNumber != null) {
				attrs.push({
					"@name": "episode",
					"@value": String(e.seriesDetails.episodeNumber),
				});
			}
			if (e.tvdbId) {
				attrs.push({ "@name": "tvdbid", "@value": String(e.tvdbId) });
			}
		}
		if (type === "music") {
			if (e.musicDetails?.artist) {
				attrs.push({ "@name": "artist", "@value": e.musicDetails.artist });
			}
			if (e.musicDetails?.albumArtist ?? e.title) {
				attrs.push({
					"@name": "album",
					"@value": (e.musicDetails?.albumArtist ?? e.title)!,
				});
			}
		}
	}

	return attrs;
}

function buildSearchResults(hits: MeiliTorrentDocument[]): string {
	const obj = {
		rss: {
			"@version": "2.0",
			"@xmlns:torznab": "http://torznab.com/schemas/2015/feed",
			channel: {
				title: "Minato",
				description: "Torznab feed powered by Minato",
				link: "",
				item: hits.map((hit) => {
					const link = torrentLink(hit);
					return {
						title: hit.trackerTitle,
						guid: { "@isPermaLink": "false", "#": hit.infoHash },
						pubDate: new Date(hit.publishedAt ?? hit.createdAt).toUTCString(),
						link,
						enclosure: {
							"@url": link,
							"@length": hit.size,
							"@type": "application/x-bittorrent",
						},
						"torznab:attr": buildTorznabAttrs(hit),
					};
				}),
			},
		},
	};

	return create({ version: "1.0", encoding: "UTF-8" }, obj).end({
		prettyPrint: true,
	});
}

export async function handleTorznab(c: Context): Promise<Response> {
	const apiKeyValue = c.req.query("apikey");
	if (!apiKeyValue) {
		return torznabError(200, "Missing apikey parameter");
	}

	const authResult = await auth.api.verifyApiKey({ body: { key: apiKeyValue } });
	if (!authResult.valid) {
		return torznabError(100, "Invalid or expired API key");
	}

	const keyType =
		(authResult.key?.metadata as { type?: string } | null)?.type ?? "custom";
	if (keyType !== "torznab" && keyType !== "custom") {
		return torznabError(100, "This API key is not authorized to access the Torznab feed");
	}

	const t = c.req.query("t") ?? "caps";

	if (t === "caps") {
		return new Response(buildCaps(), {
			status: 200,
			headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
		});
	}

	if (t !== "search" && t !== "tvsearch" && t !== "movie" && t !== "audio" && t !== "book") {
		return torznabError(202, "No such function");
	}

	// Parse common params
	const q = c.req.query("q") ?? "";
	const catParam = c.req.query("cat");
	const limitParam = Number.parseInt(c.req.query("limit") ?? "50", 10);
	const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 100);
	const offsetParam = Number.parseInt(c.req.query("offset") ?? "0", 10);
	const offset = Number.isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);

	const filters: string[] = [];

	// Category filter from `cat` param
	if (catParam) {
		const catIds = catParam
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n));
		const types = catParamToTypes(catIds);
		if (types.length > 0) {
			const typeFilters = types.map((type) => `type = "${type}"`).join(" OR ");
			filters.push(`(${typeFilters})`);
		}
	}

	// TV-specific filters
	if (t === "tvsearch") {
		const season = c.req.query("season");
		const ep = c.req.query("ep");
		const tvdbid = c.req.query("tvdbid");

		if (season !== undefined) {
			const seasonNum = Number.parseInt(season, 10);
			if (!Number.isNaN(seasonNum)) {
				filters.push(`enrichment.seriesDetails.seasonNumber = ${seasonNum}`);
			}
		}
		if (ep !== undefined) {
			const epNum = Number.parseInt(ep, 10);
			if (!Number.isNaN(epNum)) {
				filters.push(`enrichment.seriesDetails.episodeNumber = ${epNum}`);
			}
		}
		if (tvdbid !== undefined) {
			const tvdbNum = Number.parseInt(tvdbid, 10);
			if (!Number.isNaN(tvdbNum)) {
				filters.push(`enrichment.tvdbId = ${tvdbNum}`);
			}
		}

		// Default to TV/anime types if no cat filter was set
		if (!catParam) {
			filters.push('(type = "tv" OR type = "anime")');
		}
	}

	// Movie-specific filters
	if (t === "movie") {
		const imdbid = c.req.query("imdbid");
		if (imdbid) {
			// Normalize: ensure tt prefix
			const normalized = imdbid.startsWith("tt") ? imdbid : `tt${imdbid}`;
			filters.push(`enrichment.imdbId = "${normalized}"`);
		}

		if (!catParam) {
			filters.push('type = "movie"');
		}
	}

	// Audio/book type defaults
	if (t === "audio" && !catParam) {
		filters.push('type = "music"');
	}
	if (t === "book" && !catParam) {
		filters.push('type = "book"');
	}

	const filterString = filters.length > 0 ? filters.join(" AND ") : undefined;

	const index = meiliClient.index("torrents");
	const result = await index.search(q, {
		filter: filterString,
		sort: ["seeders:desc"],
		limit,
		offset,
	});
	const hits = result.hits as MeiliTorrentDocument[];

	return new Response(buildSearchResults(hits), {
		status: 200,
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}
