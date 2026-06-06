import type { db } from "@project-minato/db";
import { asc, eq, settings, settingsMeta } from "@project-minato/db";
import defu from "defu";
import { setProperty } from "dot-prop";
import type { AppConfig } from "./schema";
import { configSchema, getEnvConfig } from "./schema";

type DB = typeof db;

export interface LoadedConfig {
	config: AppConfig;
	version: number;
}

export async function loadConfig(db: DB): Promise<LoadedConfig> {
	await db
		.insert(settingsMeta)
		.values({ id: 1, version: 1 })
		.onConflictDoNothing();

	const rows = await db.select().from(settings).orderBy(asc(settings.key));
	const metaRows = await db
		.select()
		.from(settingsMeta)
		.where(eq(settingsMeta.id, 1))
		.limit(1);
	const version = metaRows[0]?.version ?? 1;

	const dbConfig: Record<string, unknown> = {};
	for (const row of rows) {
		setProperty(dbConfig, row.key, row.value);
	}

	const config = configSchema.parse(defu(getEnvConfig(), dbConfig));
	return { config, version };
}
