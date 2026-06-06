import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Database } from "bun:sqlite";
import { db, torrents } from "@project-minato/db";
import { exportsDir } from "@project-minato/env/paths";
import type { Job } from "bullmq";
import { logger } from "@/utils/logger";

const log = logger.child({ task: "export-sqlite" });
const BATCH_SIZE = 1000;

export async function exportSqlite(job: Job) {
	await mkdir(exportsDir, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -1);
	const filename = `torrents-${timestamp}.sqlite`;
	const filePath = path.join(exportsDir, filename);

	const sqliteDb = new Database(filePath);

	sqliteDb.exec(`CREATE TABLE IF NOT EXISTS torrents (
		info_hash TEXT PRIMARY KEY,
		tracker_title TEXT NOT NULL,
		size INTEGER NOT NULL,
		seeders INTEGER,
		leechers INTEGER,
		tracker_category TEXT,
		standard_category INTEGER,
		files TEXT,
		magnet TEXT,
		sources TEXT NOT NULL,
		type TEXT,
		is_dirty INTEGER,
		release_data TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		published_at TEXT,
		last_seen_at TEXT NOT NULL,
		indexed_at TEXT,
		enriched_at TEXT,
		repaired_at TEXT
	)`);

	const insert = sqliteDb.prepare(`INSERT OR REPLACE INTO torrents VALUES (
		$info_hash, $tracker_title, $size, $seeders, $leechers,
		$tracker_category, $standard_category, $files, $magnet, $sources,
		$type, $is_dirty, $release_data, $created_at, $updated_at,
		$published_at, $last_seen_at, $indexed_at, $enriched_at, $repaired_at
	)`);

	const insertBatch = sqliteDb.transaction(
		(rows: (typeof torrents.$inferSelect)[]) => {
			for (const row of rows) {
				insert.run({
					$info_hash: row.infoHash,
					$tracker_title: row.trackerTitle,
					$size: row.size,
					$seeders: row.seeders ?? null,
					$leechers: row.leechers ?? null,
					$tracker_category: row.trackerCategory ?? null,
					$standard_category: row.standardCategory ?? null,
					$files: row.files != null ? JSON.stringify(row.files) : null,
					$magnet: row.magnet ?? null,
					$sources: JSON.stringify(row.sources),
					$type: row.type ?? null,
					$is_dirty: row.isDirty == null ? null : row.isDirty ? 1 : 0,
					$release_data:
						row.releaseData != null ? JSON.stringify(row.releaseData) : null,
					$created_at: row.createdAt.toISOString(),
					$updated_at: row.updatedAt.toISOString(),
					$published_at: row.publishedAt?.toISOString() ?? null,
					$last_seen_at: row.lastSeenAt.toISOString(),
					$indexed_at: row.indexedAt?.toISOString() ?? null,
					$enriched_at: row.enrichedAt?.toISOString() ?? null,
					$repaired_at: row.repairedAt?.toISOString() ?? null,
				});
			}
		},
	);

	let offset = 0;
	let totalExported = 0;

	log.info({ filename }, "Starting SQLite export...");

	while (true) {
		const rows = await db
			.select()
			.from(torrents)
			.limit(BATCH_SIZE)
			.offset(offset);

		if (rows.length === 0) break;

		insertBatch(rows);
		totalExported += rows.length;
		offset += rows.length;

		await job.updateProgress(totalExported);
		log.info({ totalExported }, "Export progress...");

		if (rows.length < BATCH_SIZE) break;
	}

	sqliteDb.close();
	log.info({ filename, totalExported }, "SQLite export complete.");
	return { filename, totalExported };
}
