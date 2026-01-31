import { Hono } from "hono";

import { db, torrents, enrichments, eq, and, ilike, desc, inArray } from "@project-minato/db";
import { create } from "xmlbuilder2";
import { categoryMap } from "@project-minato/utils/categories/standard";

const app = new Hono();

const caps = {
  server: {
    "@version": "1.0",
    "@title": "Minato Torznab",
    "@strapline": "Minato Indexer",
    "@url": "https://github.com/gergogyulai/minato",
  },
  limits: {
    "@max": "100",
    "@default": "50",
  },
  searching: {
    search: { "@available": "yes", "@supportedParams": "q" },
    "tv-search": { "@available": "yes", "@supportedParams": "q,rid,tvdbid,tmdbid,season,ep" },
    "movie-search": { "@available": "yes", "@supportedParams": "q,imdbid,tmdbid" },
  },
  categories: {
    category: Object.entries(categoryMap)
      .filter(([id]) => parseInt(id) % 1000 === 0)
      .map(([id, name]) => ({
        "@id": id,
        "@name": name,
        subcat: Object.entries(categoryMap)
          .filter(([subId]) => subId.startsWith(id.substring(0, 1)) && subId !== id)
          .map(([subId, subName]) => ({
            "@id": subId,
            "@name": subName.split("/")[1] || subName,
          })),
      })),
  },
};

app.get("/", async (c) => {
  const t = c.req.query("t");

  if (t === "caps") {
    const xml = create({ version: "1.0", encoding: "UTF-8" })
      .ele("caps")
      .ele(caps)
      .end({ prettyPrint: true });
    return c.body(xml, 200, { "Content-Type": "application/xml" });
  }

  if (t === "search" || t === "tvsearch" || t === "movie") {
    const q = c.req.query("q");
    const cat = c.req.query("cat");
    const imdbId = c.req.query("imdbid");
    const tvdbId = c.req.query("tvdbid");
    const tmdbId = c.req.query("tmdbid");
    const season = c.req.query("season");
    const ep = c.req.query("ep");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);
    const offset = parseInt(c.req.query("offset") ?? "0");

    const conditions: any[] = [];

    if (q) {
      conditions.push(ilike(torrents.trackerTitle, `%${q}%`));
    }

    if (imdbId) {
      const cleanImdb = imdbId.startsWith("tt") ? imdbId : `tt${imdbId}`;
      conditions.push(eq(enrichments.imdbId, cleanImdb));
    }
    if (tvdbId) conditions.push(eq(enrichments.tvdbId, parseInt(tvdbId)));
    if (tmdbId) conditions.push(eq(enrichments.tmdbId, parseInt(tmdbId)));

    if (season) {
      conditions.push(sql`${torrents.releaseData}->>'season' = ${season}`);
    }
    if (ep) {
      conditions.push(sql`${torrents.releaseData}->>'episode' = ${ep}`);
    }

    if (cat) {
      const catList = cat.split(",").map((id) => parseInt(id));
      const types: string[] = [];
      if (catList.some((id) => id >= 2000 && id < 3000)) types.push("movie");
      if (catList.some((id) => id >= 5000 && id < 6000)) types.push("tv");
      if (catList.some((id) => id >= 3000 && id < 4000)) types.push("music");
      if (catList.some((id) => id >= 7000 && id < 8000)) types.push("book");

      if (types.length > 0) {
        conditions.push(inArray(enrichments.mediaType, types as any));
      }
    }

    const results = await db
      .select({
        infoHash: torrents.infoHash,
        trackerTitle: torrents.trackerTitle,
        size: torrents.size,
        seeders: torrents.seeders,
        leechers: torrents.leechers,
        magnet: torrents.magnet,
        createdAt: torrents.createdAt,
        type: torrents.type,
        releaseData: torrents.releaseData,
        enrichment: enrichments,
      })
      .from(torrents)
      .leftJoin(enrichments, eq(torrents.enrichmentId, enrichments.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(torrents.createdAt))
      .limit(limit)
      .offset(offset);

    const feed = create({ version: "1.0", encoding: "UTF-8" })
      .ele("rss", {
        version: "2.0",
        "xmlns:torznab": "http://torznab.com/schemas/2015/feed",
      })
      .ele("channel");

    feed.ele("title").txt("Minato Torznab Search");
    feed.ele("description").txt("Minato Torznab Search Results");
    feed.ele("link").txt("https://github.com/gergogyulai/minato");
    feed.ele("language").txt("en-us");

    feed.ele("newznab:response", { offset: offset.toString(), total: results.length.toString() });

    for (const torrent of results) {
      const item = feed.ele("item");
      item.ele("title").txt(torrent.trackerTitle);
      item.ele("guid", { isPermaLink: "false" }).txt(torrent.infoHash);
      item.ele("link").txt(torrent.magnet ?? "");
      item.ele("pubDate").txt(torrent.createdAt.toUTCString());
      item.ele("size").txt(torrent.size.toString());

      if (torrent.magnet) {
        item.ele("enclosure", {
          url: torrent.magnet,
          length: torrent.size,
          type: "application/x-bittorrent",
        });
      }

      item.ele("torznab:attr", { name: "infohash", value: torrent.infoHash });
      item.ele("torznab:attr", { name: "size", value: torrent.size });
      item.ele("torznab:attr", { name: "seeders", value: (torrent.seeders ?? 0).toString() });
      item.ele("torznab:attr", { name: "leechers", value: (torrent.leechers ?? 0).toString() });

      let category = 8000;
      if (torrent.enrichment?.mediaType === "movie") category = 2000;
      if (torrent.enrichment?.mediaType === "tv") category = 5000;
      if (torrent.enrichment?.mediaType === "music") category = 3000;
      if (torrent.enrichment?.mediaType === "book") category = 7000;

      item.ele("torznab:attr", { name: "category", value: category.toString() });

      if (torrent.enrichment?.imdbId) {
        const cleanImdb = torrent.enrichment.imdbId.replace("tt", "");
        item.ele("torznab:attr", { name: "imdb", value: cleanImdb });
      }
      if (torrent.enrichment?.tvdbId) {
        item.ele("torznab:attr", {
          name: "tvdbid",
          value: torrent.enrichment.tvdbId.toString(),
        });
      }
      if (torrent.enrichment?.tmdbId) {
        item.ele("torznab:attr", {
          name: "tmdbid",
          value: torrent.enrichment.tmdbId.toString(),
        });
      }

      const rd = torrent.releaseData as any;
      if (rd?.season) {
        item.ele("torznab:attr", { name: "season", value: rd.season.toString() });
      }
      if (rd?.episode) {
        item.ele("torznab:attr", { name: "episode", value: rd.episode.toString() });
      }
    }

    return c.body(feed.end({ prettyPrint: true }), 200, {
      "Content-Type": "application/xml",
    });
  }

  return c.json({ error: "t parameter is required or invalid" }, 400);
});



export default app;