import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { db, enrichments, sql } from "@project-minato/db";
import { mediaRoot } from "@project-minato/env/paths";
import { logger } from "@project-minato/utils/logger";

const log = logger.child({ task: "cleanup-unused-assets" });

export async function cleanupUnusedAssets() {
	let foldersDeleted = 0;
	let totalScanned = 0;

	try {
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

				const dbPathsToVerify = batch.map(
					(folder) => `/${shard}/${folder}/poster.webp`,
				);

				const existingRecords = await db
					.select({ posterUrl: enrichments.posterUrl })
					.from(enrichments)
					.where(sql`${enrichments.posterUrl} IN ${dbPathsToVerify}`);

				const existingSet = new Set(existingRecords.map((r) => r.posterUrl));

				for (const folderName of batch) {
					const expectedDbPath = `/${shard}/${folderName}/poster.webp`;

					if (!existingSet.has(expectedDbPath)) {
						const pathToDelete = path.join(shardPath, folderName);

						try {
							await rm(pathToDelete, { recursive: true, force: true });
							foldersDeleted++;
							log.debug({ path: pathToDelete }, "Deleted orphaned folder");
						} catch (err) {
							log.error({ err, path: pathToDelete }, "Error deleting folder");
						}
					}
				}
			}
		}
	} catch (err) {
		log.error({ err }, "Asset cleanup failed");
		throw err;
	}

	return { totalScanned, foldersDeleted };
}
