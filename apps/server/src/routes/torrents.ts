import { Hono } from "hono";
import {
  db,
  torrents,
  eq,
  sql,
  blacklistedTorrents,
  blacklistedTrackers,
} from "@project-minato/db";
import { elasticClient } from "@project-minato/meilisearch";
import type { NewTorrent } from "@project-minato/db";
import { ingestQueue } from "@project-minato/queue";
import { IngestTorrentsSchema } from "@/schemas/ingest-torrents.schema";

const app = new Hono();

app.get("/", async (c) => {
  const query = c.req.query("q");
  const categories = c.req.queries("categories");
  // const sortField = c.req.query("sort") || "createdAt";
  // const order = c.req.query("order") || "desc";
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  // 2. Build Elasticsearch Query
  const esQuery: any = {
    bool: {
      must: [],
      filter: [],
    },
  };

  // Fuzzy search on the 'name' field
  if (query) {
    esQuery.bool.must.push({
      multi_match: {
        query: query,
        fields: ["name^3", "description"], // ^3 boosts the name field importance
        fuzziness: "AUTO",
      },
    });
  } else {
    esQuery.bool.must.push({ match_all: {} });
  }

  // Filter by multiple categories (Terms query)
  if (categories && categories.length > 0) {
    esQuery.bool.filter.push({
      terms: { category: categories },
    });
  }

  try {
    const response = await elasticClient.search({
      index: "torrents",
      from: offset,
      size: limit,
      query: esQuery,
    });

    console.log("Elasticsearch query executed:", JSON.stringify(response));

    // 3. Map Results
    // Elasticsearch stores numbers as doubles/longs, but BigInts
    // are usually stored as strings or keywords to prevent precision loss.
    const hits = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
      // Ensure size is a string for JSON
      size: hit._source.size?.toString(),
    }));

    return c.json({
      total: response.hits.total,
      data: hits,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Search failed" }, 500);
  }
});

app.post("/ingest", async (c) => {
  if (c.req.header("X-Minato-Scraper") === undefined) {
    return c.json({ message: "Missing X-Minato-Scraper header" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({ message: "Invalid JSON in request body" }, 400);
  }

  if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
    return c.json({ message: "Request body is empty" }, 400);
  }

  const scraperIdFromHeader = c.req.header("X-Minato-Scraper") as string;

  if (scraperIdFromHeader.trim() === "") {
    return c.json({ message: "Invalid X-Minato-Scraper header" }, 400);
  }

  const rawPayload = Array.isArray(body) ? body : [body];

  if (rawPayload.length === 0) {
    return c.json({ message: "No torrents provided" }, 400);
  }

  const validationResult = IngestTorrentsSchema.array().safeParse(rawPayload);

  if (!validationResult.success) {
    return c.json(
      {
        message: "Invalid torrent data",
        errors: validationResult.error,
      },
      400,
    );
  }

  const torrentsToIngest: NewTorrent[] = validationResult.data.map((item) => ({
    infoHash: item.infoHash.toLocaleLowerCase(),
    trackerTitle: item.title,
    _trackerCategory: item.category || "uncategorized",
    size: BigInt(item.size),
    seeders: item.seeders,
    leechers: item.leechers,
    magnet: item.magnet,
    files: item.files,
    isDirty: true,
    sources: [
      {
        name: item.source.name,
        url: item.source.url || null,
        scraper: scraperIdFromHeader,
      },
    ],
  }));

  const blacklistedHashes = await db
    .select({ infoHash: blacklistedTorrents.infoHash })
    .from(blacklistedTorrents);

  const blacklistedTrackersList = await db
    .select({ urls: blacklistedTrackers.url })
    .from(blacklistedTrackers);

  const blacklistedHashSet = new Set(blacklistedHashes.map((h) => h.infoHash));
  const blacklistedTrackerUrls = new Set(
    blacklistedTrackersList
      .flatMap((t) => t.urls)
      .filter((url): url is string => url !== null),
  );

  const blacklistTrackerUrlsArray = Array.from(blacklistedTrackerUrls);
  const filteredTorrents = torrentsToIngest.filter((torrent) => {
    if (blacklistedHashSet.has(torrent.infoHash)) {
      return false;
    }

    if (torrent.sources && Array.isArray(torrent.sources)) {
      const hasBlacklistedSource = (torrent.sources as any[]).some((source) => {
        if (!source.url) return false;
        return blacklistTrackerUrlsArray.some((blacklistedUrl) =>
          source.url.includes(blacklistedUrl),
        );
      });

      if (hasBlacklistedSource) {
        return false;
      }
    }

    return true;
  });

  if (filteredTorrents.length === 0) {
    return c.json({ message: "All torrents were blacklisted" }, 200);
  }

  const deduplicatedTorrents = Array.from(
    filteredTorrents.reduce((map, torrent) => {
      map.set(torrent.infoHash, torrent);
      return map;
    }, new Map<string, NewTorrent>()).values()
  );

  const ingestedTorrents = await db
    .insert(torrents)
    .values(deduplicatedTorrents)
    .onConflictDoUpdate({
      target: torrents.infoHash,
      set: {
        trackerTitle: sql`COALESCE(excluded.tracker_title, ${torrents.trackerTitle})`,
        _trackerCategory: sql`COALESCE(excluded.tracker_category, ${torrents._trackerCategory})`,
        size: sql`COALESCE(excluded.size, ${torrents.size})`,
        seeders: sql`excluded.seeders`,
        leechers: sql`excluded.leechers`,
        magnet: sql`COALESCE(excluded.magnet, ${torrents.magnet})`,
        files: sql`COALESCE(excluded.files, ${torrents.files})`,
        isDirty: true,
        sources: sql`(SELECT jsonb_agg(DISTINCT e) FROM jsonb_array_elements(${torrents.sources} || excluded.sources) AS e)`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  // Queue each torrent for immediate indexing (Pass 1)
  for (const torrent of ingestedTorrents) {
    await ingestQueue.add("index", {
      infoHash: torrent.infoHash,
      _benchmark: {
        ingestedAt: Date.now(),
      },
    });
  }

  console.log(`Queued ${ingestedTorrents.length} torrents for indexing`);
  return c.json(
    {
      message: `${ingestedTorrents.length} torrents ingested and queued for indexing`,
    },
    202,
  );
});

app.get("/query/:infoHash", async (c) => {
  const infoHash = c.req.param("infoHash");

  const [torrent] = await db
    .select()
    .from(torrents)
    .where(eq(torrents.infoHash as any, infoHash) as any)
    .limit(1);

  if (!torrent) {
    return c.json({ message: "Torrent not found" }, 404);
  }

  return c.json({
    ...torrent,
    size: torrent.size.toString(), // Convert BigInt to string for JSON serialization
  });
});

export default app;
