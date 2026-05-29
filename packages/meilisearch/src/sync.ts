import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { meiliClient } from "./client";
import { setupTorrentIndex } from "./torrents";

/**
 * Version of the Meilisearch index payload + settings shape.
 *
 * Bump this whenever a change requires existing deployments to re-ingest data
 * into Meilisearch — e.g. the indexed document schema gains/loses a field, an
 * attribute moves between searchable/filterable/sortable, or the primary key
 * changes. Settings-only changes (ranking rules, stop words) do NOT require a
 * bump because they're applied idempotently on every boot.
 */
export const SEARCH_INDEX_VERSION = 1;

const META_KEY = "search_index_version";

export interface SearchSyncResult {
	/** True when the persisted version trailed the current one (or there was no version yet). */
	reindexRequired: boolean;
	previousVersion: number | null;
	currentVersion: number;
}

/**
 * Brings Meilisearch in line with the running code:
 *   1. Applies index settings (idempotent — safe to call every boot).
 *   2. Decides whether a full reindex is needed by comparing the persisted
 *      `SEARCH_INDEX_VERSION` to the one baked into this build.
 *
 * Callers are expected to enqueue a FORCE_REINDEX job when `reindexRequired`
 * is true. The persisted version is bumped only after that decision is
 * captured, so a crashed boot will re-trigger on the next attempt.
 */
export async function syncMeilisearch(
	db: NodePgDatabase<any>,
): Promise<SearchSyncResult> {
	await ensureMetaTable(db);

	await setupTorrentIndex();

	const previousVersion = await readVersion(db);
	const currentVersion = SEARCH_INDEX_VERSION;
	const reindexRequired =
		previousVersion === null || previousVersion < currentVersion;

	await writeVersion(db, currentVersion);

	return { reindexRequired, previousVersion, currentVersion };
}

async function ensureMetaTable(db: NodePgDatabase<any>): Promise<void> {
	await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __minato_meta (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function readVersion(db: NodePgDatabase<any>): Promise<number | null> {
	const result = await db.execute<{ value: string }>(sql`
    SELECT value FROM __minato_meta WHERE key = ${META_KEY}
  `);
	const value = result.rows[0]?.value;
	if (value === undefined) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

async function writeVersion(
	db: NodePgDatabase<any>,
	version: number,
): Promise<void> {
	await db.execute(sql`
    INSERT INTO __minato_meta (key, value)
    VALUES (${META_KEY}, ${String(version)})
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
  `);
}

export { meiliClient };
