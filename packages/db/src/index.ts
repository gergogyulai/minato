import { env } from "@project-minato/env/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import type {
	BuildQueryResult,
	ExtractTablesWithRelations,
} from "drizzle-orm/relations";
import { Pool } from "pg";
import * as schema from "./schema";

type Schema = typeof schema;
type TTables = ExtractTablesWithRelations<Schema>;

export type TorrentWithRelations = BuildQueryResult<
	TTables,
	TTables["torrents"],
	{ with: { enrichment: true } }
>;

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	max: 50,
	min: 5,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
export async function closeDb(): Promise<void> {
	await pool.end();
}

export * from "drizzle-orm";
export type { MigrationResult } from "./migrate";
export { runMigrations } from "./migrate";
export * from "./schema";
