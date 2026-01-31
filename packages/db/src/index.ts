import { env } from "@project-minato/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import type {
  BuildQueryResult,
  ExtractTablesWithRelations,
} from "drizzle-orm/relations";

type Schema = typeof schema;
type TTables = ExtractTablesWithRelations<Schema>;

export type TorrentWithRelations = BuildQueryResult<
  TTables,
  TTables["torrents"],
  { with: { enrichment: true } }
>;

export const db = drizzle(env.DATABASE_URL, { schema });
export * from "./schema";
export * from "drizzle-orm";
