import { Worker, Job } from "bullmq";
import { connection, QUEUES } from "@project-minato/queue";
import { db } from "@project-minato/db";
import { meiliClient } from "@project-minato/meilisearch";
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
          // 2. Prepare the Query Stream
          const queryText = "SELECT * FROM torrents";
          const stream = client.query(new QueryStream(queryText));

          let batchBuffer: any[] = [];
          let totalProcessed = 0;

          // 3. Iterate the stream
          for await (const row of stream) {
            try {
              const release = ReleaseParser(row.trackerTitle);
              
              batchBuffer.push({
                ...row,
                ...release.data,
                size: row.size.toString(),
                indexedAt: new Date(),
              });

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