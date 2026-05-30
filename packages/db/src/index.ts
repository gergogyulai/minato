import { env } from "@project-minato/env/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import type {
	BuildQueryResult,
	ExtractTablesWithRelations,
} from "drizzle-orm/relations";
import * as schema from "./schema";

type Schema = typeof schema;
type TTables = ExtractTablesWithRelations<Schema>;

export type TorrentWithRelations = BuildQueryResult<
	TTables,
	TTables["torrents"],
	{ with: { enrichment: true } }
>;

export const db = drizzle(env.DATABASE_URL, { schema });
export async function closeDb(): Promise<void> {
	await db.$client.end();
}

export * from "drizzle-orm";
export type { MigrationResult } from "./migrate";
export { runMigrations } from "./migrate";
export * from "./schema";
