// apps/jobs/src/services/housekeeping-service.ts
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { db, enrichments, sql } from "@project-minato/db";

/**
 * RESPONSIBILITY: Cleanup sharded local storage.
 * Matches filesystem folders against 'poster_url' or 'backdrop_url' in DB.
 */
export async function cleanupUnusedAssets() {
  const mediaRoot = process.env.MEDIA_ROOT || "../../data/media";
  let foldersDeleted = 0;
  let totalScanned = 0;

  try {
    // 1. Get Shards (e.g., "tm")
    const shards = await readdir(mediaRoot);

    for (const shard of shards) {
      const shardPath = path.join(mediaRoot, shard);
      const shardStat = await stat(shardPath).catch(() => null);
      if (!shardStat?.isDirectory()) continue;

      // 2. Get ID Folders (e.g., "tmdb-1396")
      const idFolders = await readdir(shardPath);
      
      const batchSize = 500;
      for (let i = 0; i < idFolders.length; i += batchSize) {
        const batch = idFolders.slice(i, i + batchSize);
        totalScanned += batch.length;

        // 3. Reconstruct the DB path string to check for existence eg. "/tm/tmdb-1396/poster.webp"
        const dbPathsToVerify = batch.map(folder => `/${shard}/${folder}/poster.webp`);

        const existingRecords = await db
          .select({ posterUrl: enrichments.posterUrl })
          .from(enrichments)
          .where(sql`${enrichments.posterUrl} IN ${dbPathsToVerify}`);

        const existingSet = new Set(existingRecords.map(r => r.posterUrl));

        for (const folderName of batch) {
          const expectedDbPath = `/${shard}/${folderName}/poster.webp`;
          
          if (!existingSet.has(expectedDbPath)) {
            const pathToDelete = path.join(shardPath, folderName);
            
            try {
              await rm(pathToDelete, { recursive: true, force: true });
              foldersDeleted++;
              console.debug(`[Housekeeper] Deleted orphaned folder: ${pathToDelete}`);
            } catch (err) {
              console.error(`[Housekeeper] Error deleting ${pathToDelete}:`, err);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[Housekeeper] Asset cleanup failed:", error);
    throw error;
  }

  return { totalScanned, foldersDeleted };
}