import { Hono } from "hono";
import { db, torrents, NewTorrentSchema, eq, is, sql } from "@project-minato/db";
import { elasticClient } from "@project-minato/meilisearch";
import type { NewTorrent } from "@project-minato/db";
import { ingestQueue } from "@project-minato/queue";

const app = new Hono();

app.get("/", async (c) => {
  const query = c.req.query("q");
  const categories = c.req.queries("categories");
  const sortField = c.req.query("sort") || "createdAt";
  const order = c.req.query("order") || "desc";
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

    console.log("Elasticsearch query executed:", JSON.stringify(response))

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
      data: hits
    });

  } catch (error) {
    console.error(error);
    return c.json({ error: "Search failed" }, 500);
  }});

app.post("/ingest", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({ message: "Invalid JSON in request body" }, 400);
  }

  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return c.json({ message: "Request body is empty" }, 400);
  }

  const rawPayload = Array.isArray(body) ? body : [body];

  const validationResult = NewTorrentSchema.array().safeParse(rawPayload);

  if (rawPayload.length === 0) {
    return c.json({ message: "No torrents provided" }, 400);
  }

  if (!validationResult.success) {
    return c.json({ 
      message: "Invalid torrent data", 
      errors: validationResult.error
    }, 400);
  }

  const torrentsToIngest: NewTorrent[] = validationResult.data.map((item) => ({
    ...item,
    isDirty: true,
  } as NewTorrent));

  const ingestedTorrents = await db
  .insert(torrents)
  .values(torrentsToIngest)
  .onConflictDoUpdate({
    target: torrents.infoHash,
    set: {
      trackerTitle: sql`COALESCE(excluded.tracker_title, torrents.tracker_title)`,
      _trackerCategory: sql`COALESCE(excluded.tracker_category, torrents.tracker_category)`,
      size: sql`COALESCE(excluded.size, torrents.size)`,
      seeders: sql`COALESCE(excluded.seeders, torrents.seeders)`,
      leechers: sql`COALESCE(excluded.leechers, torrents.leechers)`,
      magnet: sql`COALESCE(torrents.magnet, excluded.magnet)`,
      files: sql`COALESCE(torrents.files, excluded.files)`,
      isDirty: true,
      sources: sql`
        CASE 
          WHEN excluded.sources IS NOT NULL 
          THEN (COALESCE(torrents.sources, '[]'::jsonb) || excluded.sources)
          ELSE torrents.sources 
        END`,
      updatedAt: sql`NOW()`,
    },
  })
  .returning();

  // Queue each torrent for immediate indexing (Pass 1)
  for (const torrent of ingestedTorrents) {
    await ingestQueue.add('index', { 
      infoHash: torrent.infoHash,
      _benchmark: {
        ingestedAt: Date.now(),
      }
    });
  }

  console.log(`Queued ${ingestedTorrents.length} torrents for indexing`);
  return c.json({ 
    message: `${ingestedTorrents.length} torrents ingested and queued for indexing` 
  }, 202);
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
