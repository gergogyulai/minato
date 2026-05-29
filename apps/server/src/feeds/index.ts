import { auth } from "@project-minato/auth";
import { Hono } from "hono";
import { create } from "xmlbuilder2";

export const feeds = new Hono();

function torznabError(message: string): string {
	return create(
		{ version: "1.0", encoding: "UTF-8" },
		{
			error: { "@code": "100", "@description": message },
		},
	).end({ prettyPrint: true });
}

feeds.get("/torznab", async (c) => {
	const apiKeyValue = c.req.query("apikey");
	if (!apiKeyValue) {
		return c.body(torznabError("Missing apikey parameter"), 401, {
			"Content-Type": "application/rss+xml",
		});
	}

	const result = await auth.api.verifyApiKey({ body: { key: apiKeyValue } });
	if (!result.valid) {
		return c.body(torznabError("Invalid or expired API key"), 401, {
			"Content-Type": "application/rss+xml",
		});
	}

	const obj = {
		rss: {
			"@version": "2.0",
			"@xmlns:torznab": "http://torznab.com/schemas/2015/feed",
			channel: {
				title: "Sample Torznab Feed",
				description: "Example Torznab results generated via xmlbuilder2",
				link: "http://localhost",
				item: {
					title: "Example.Movie.2024.1080p.BluRay.x264",
					guid: { "@isPermaLink": "false", "#": "12345" },
					link: "http://example.com/download/12345",
					pubDate: "Mon, 09 Feb 2026 00:00:00 +0100",
					enclosure: {
						"@url": "http://example.com/download/12345",
						"@length": "4500000000",
						"@type": "application/x-bittorrent",
					},
					"torznab:attr": [
						{ "@name": "category", "@value": "2000" },
						{ "@name": "seeders", "@value": "42" },
					],
				},
			},
		},
	};

	const xml = create({ version: "1.0", encoding: "UTF-8" }, obj).end({
		prettyPrint: true,
	});

	return c.body(xml, 200, { "Content-Type": "application/rss+xml" });
});

feeds.get("/rss", async (c) => {
	const root = create({ version: "1.0", encoding: "UTF-8" })
		.ele("rss", { version: "2.0" })
		.ele("channel")
		.ele("title")
		.txt("My Hono RSS Feed")
		.up()
		.ele("link")
		.txt("https://example.com")
		.up()
		.ele("item")
		.ele("title")
		.txt("First Sample Post")
		.up()
		.ele("description")
		.txt("This is the content of the first sample post.")
		.up()
		.ele("pubDate")
		.txt("Mon, 09 Feb 2026 00:00:00 GMT")
		.up()
		.up()
		.up();

	const xml = root.end({ prettyPrint: true });

	return c.body(xml, 200, { "Content-Type": "application/rss+xml" });
});
