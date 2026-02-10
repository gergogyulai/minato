import { Worker, Job } from "bullmq";
import { connection, QUEUES } from "@project-minato/queue";
import { db } from "@project-minato/db";
import { meiliClient, formatTorrentForMeilisearch } from "@project-minato/meilisearch";
import ReleaseParser from "release-parser";
import QueryStream from "pg-query-stream";
import { sql } from "drizzle-orm";

const BATCH_SIZE = 5000;

export function startReindexWorker() {
  const worker = new Worker(
    QUEUES.FULLREINDEX,
    async (job: Job) => {
      if (job.name === "FULL_REINDEX_ALL") {
        console.log("[Reindex Worker] Starting Full Postgres Stream...");

        const client = await db.$client.connect();
        
        try {
          // 2. Prepare the Query Stream with enrichment data via LEFT JOIN
          const queryText = `
            SELECT 
              t.*,
              row_to_json(e.*) as enrichment
            FROM torrents t
            LEFT JOIN enrichments e ON t.info_hash = e.torrent_info_hash
          `;
          const stream = client.query(new QueryStream(queryText));

          let batchBuffer: any[] = [];
          let totalProcessed = 0;

          // 3. Iterate the stream
          for await (const row of stream) {
            try {
              const release = ReleaseParser(row.trackerTitle);
              
              const torrentDoc = formatTorrentForMeilisearch({
                ...row,
                ...release.data,
                indexedAt: new Date(),
              });
              
              batchBuffer.push(torrentDoc);

              if (batchBuffer.length >= BATCH_SIZE) {
                await meiliClient
                  .index("torrents")
                  .addDocuments(batchBuffer, { primaryKey: "infoHash" });
                
                totalProcessed += batchBuffer.length;
                batchBuffer = [];
                
                // Keep BullMQ alive
                await job.updateProgress(totalProcessed);
                console.log(`[Reindex Worker] Progress: ${totalProcessed} indexed`);
              }
            } catch (err) {
              continue;
            }
          }

          // 4. Final Flush
          if (batchBuffer.length > 0) {
            await meiliClient.index("torrents").addDocuments(batchBuffer, { primaryKey: "infoHash" });
            totalProcessed += batchBuffer.length;
          }

          // 5. Bulk update DB status (Optional but recommended)
          // Instead of updating 1-by-1, update everything once at the end
          await db.execute(sql`
            UPDATE torrents 
            SET "isDirty" = false, "indexedAt" = NOW() 
            WHERE "indexedAt" IS NULL OR "isDirty" = true
          `);

          console.log(`[Reindex Worker] Completed! Total: ${totalProcessed}`);
          return { totalProcessed };

        } finally {
          client.release(); // Crucial: release the pg client back to the pool
        }
      }
    },
    { 
      connection, 
      concurrency: 1,
      lockDuration: 60000 // 1 minute lock to prevent overlap
    }
  );

  return worker;
}