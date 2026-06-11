import { Hono } from "hono";
import { XMLParser } from "fast-xml-parser";
import { processTorrents } from "@/lib/ingest/process-torrents";
import type { IngestInput } from "@/api/features/torrents/schemas";

const REAL_PROWLARR_URL = process.env.PROWLARR_URL || "http://localhost:9696/";

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
});

export const proxy = new Hono();

proxy.all("/prowlarr/*", async (c) => {
	try {
		const url = new URL(c.req.url);
		const targetPath = url.pathname.replace(/^\/api\/v1\/proxy\/prowlarr/, "");
		const targetUrl = `${REAL_PROWLARR_URL}${targetPath}${url.search}`;

		const proxyHeaders = new Headers(c.req.header());
		proxyHeaders.set("host", new URL(REAL_PROWLARR_URL).host);

		const proxyResponse = await fetch(targetUrl, {
			method: c.req.method,
			headers: proxyHeaders,
			tls: { rejectUnauthorized: false },
			body:
				["GET", "HEAD"].includes(c.req.method)
					? undefined
					: await c.req.arrayBuffer(),
		});

		const responseText = await proxyResponse.text();

		const queryType = url.searchParams.get("t");
		if (queryType && queryType !== "caps") {
			ingestXmlInBackground(responseText).catch((err) => {
				console.error("[minato-proxy] Background ingestion failed:", err);
			});
		}

		return c.text(responseText, proxyResponse.status as any, {
			"Content-Type":
				proxyResponse.headers.get("content-type") || "application/xml",
		});
	} catch (error) {
		console.error("[minato-proxy] Connection link disrupted:", error);
		return c.text("Minato Proxy Link Error", 500);
	}
});

function getAttr(
	attrs: Record<string, any> | Record<string, any>[] | undefined,
	name: string,
): string | undefined {
	if (!attrs) return undefined;
	const list = Array.isArray(attrs) ? attrs : [attrs];
	for (const attr of list) {
		if (attr["@_name"] === name) return attr["@_value"];
	}
	return undefined;
}

async function ingestXmlInBackground(xmlText: string) {
	if (!xmlText.includes("<rss")) return;

	const parsed = xmlParser.parse(xmlText);
	const items = parsed?.rss?.channel?.item;
	const normalizedItems = Array.isArray(items)
		? items
		: items
			? [items]
			: [];

	const torrents: IngestInput[] = [];

	for (const item of normalizedItems) {
		const title: string | undefined = item.title;
		const torznabAttrs = item["torznab:attr"];

		const infoHash = getAttr(torznabAttrs, "infohash");
		if (!infoHash || !title) continue;

		const size =
			getAttr(torznabAttrs, "size") ??
			item.enclosure?.["@_length"] ??
			"0";

		const seeders = parseInt(getAttr(torznabAttrs, "seeders") ?? "0", 10);
		const leechers = parseInt(getAttr(torznabAttrs, "peers") ?? "0", 10);

		const category =
			getAttr(torznabAttrs, "category") ??
			item.category ??
			"uncategorized";

		const magnet: string | undefined =
			typeof item.link === "string" && item.link.startsWith("magnet:")
				? item.link
				: undefined;

		const files: { filename: string; size: number }[] | undefined =
			item.files && Array.isArray(item.files)
				? item.files.map((f: any) => ({
						filename: f["@_name"] ?? f.name ?? "unknown",
						size: Number(f["@_size"] ?? f.size ?? 0),
					}))
				: undefined;

		console.log(
			`[minato-proxy] Sniffed: ${title} [${infoHash}]`,
		);

		torrents.push({
			infoHash,
			title,
			size,
			seeders,
			leechers,
			category,
			magnet,
			files,
			source: {
				name: "prowlarr-proxy",
			},
		});
	}

	if (torrents.length === 0) return;

	const result = await processTorrents(torrents, "prowlarr-proxy");

	console.log(
		`[minato-proxy] Ingested ${result.count} torrents from Prowlarr RSS`,
	);
}
