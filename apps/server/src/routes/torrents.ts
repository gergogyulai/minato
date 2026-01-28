import { Hono } from "hono";
import { db, torrents } from "@project-minato/db";
import { eq } from "drizzle-orm";
import { elasticClient } from "@project-minato/elastic";

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

app.post("/", async (c) => {
  const body = await c.req.json();

  const data = Array.isArray(body) ? body : [body];

  const valuesToInsert = data.map((item) => ({
    infoHash: item.infoHash,
    title: item.title,
    size: BigInt(item.size),
    sourceName: "manual knaben scrape",
    category: item.category || "other",
    magnet: item.magnet || "magnet:?xt=urn:btih:placeholder",
    files: item.files || JSON.stringify([]),
  }));

  if (valuesToInsert.length === 0) {
    return c.json({ message: "No torrents provided" }, 400);
  }

  const insertedTorrents = await db
    .insert(torrents)
    .values(valuesToInsert)
    .onConflictDoNothing()
    .returning();

  // Index torrents into Elasticsearch
  if (insertedTorrents.length > 0) {
    const bulkOperations = insertedTorrents.flatMap((torrent) => [
      { index: { _index: "torrents", _id: torrent.infoHash } },
      {
        name: torrent.title,
        infoHash: torrent.infoHash,
        size: torrent.size.toString(),
        category: torrent.category,
        magnet: torrent.magnet,
        files: torrent.files,
        sourceName: torrent.sourceName,
        createdAt: torrent.createdAt,
      },
    ]);

    try {
      await elasticClient.bulk({ operations: bulkOperations });
    } catch (error) {
      console.error("Failed to index torrents in Elasticsearch:", error);
    }
  }

  return c.json({ message: `${insertedTorrents.length} torrents ingested successfully` }, 202);
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

app.get("/seed", async (c) => {
  const dummyData = Array.from({ length: 10 }).map((_, i) => ({
    // Ensure exactly 40 characters for the infoHash
    infoHash: (crypto.randomUUID() + crypto.randomUUID())
      .replace(/-/g, "")
      .slice(0, 40),
    title: `Dummy Torrent #${i + 1} - ${Math.random()
      .toString(36)
      .substring(7)}`,
    size: BigInt(Math.floor(Math.random() * 1000000000)),
    sourceName: "seeder_script",
    // Providing empty defaults in case your schema requires them
    category: "other",
    magnet: "magnet:?xt=urn:btih:placeholder",
    files: JSON.stringify([]), 
  }));

  try {
    const seededTorrents = await db.insert(torrents).values(dummyData).onConflictDoNothing().returning();
    
    // Index seeded torrents into Elasticsearch
    if (seededTorrents.length > 0) {
      const bulkOperations = seededTorrents.flatMap((torrent) => [
        { index: { _index: "torrents", _id: torrent.infoHash } },
        {
          name: torrent.title,
          infoHash: torrent.infoHash,
          size: torrent.size.toString(),
          category: torrent.category,
          magnet: torrent.magnet,
          files: torrent.files,
          sourceName: torrent.sourceName,
          createdAt: torrent.createdAt,
        },
      ]);

      try {
        await elasticClient.bulk({ operations: bulkOperations });
      } catch (esError) {
        console.error("Failed to index seeded torrents in Elasticsearch:", esError);
      }
    }
    
    return c.json({
      message: `Successfully seeded ${seededTorrents.length} items`,
    });
  } catch (error: any) {
    // This will help see the specific DB error (like "column length exceeded")
    console.error(error);
    return c.json(
      {
        message: "Seeding failed",
        error: error.message,
        detail: error.detail, // Postgres usually provides detail
      },
      500,
    );
  }
});

export default app;
