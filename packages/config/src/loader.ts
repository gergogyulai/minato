import { settings, settingsMeta, eq, asc } from "@project-minato/db"
import type { db } from "@project-minato/db"
import { configSchema } from "./schema"
import { deepMerge, setDeep } from "./utils"
import { readEnvOverrides } from "./env-overrides"
import type { AppConfig } from "./schema"

type DB = typeof db

export interface LoadedConfig {
  config: AppConfig
  version: number
}

export async function loadConfig(db: DB): Promise<LoadedConfig> {
  await db.insert(settingsMeta).values({ id: 1, version: 1 }).onConflictDoNothing()

  const rows = await db.select().from(settings).orderBy(asc(settings.key))
  const metaRows = await db.select().from(settingsMeta).where(eq(settingsMeta.id, 1)).limit(1)
  const version = metaRows[0]?.version ?? 1

  let raw: Record<string, unknown> = {}
  for (const row of rows) {
    raw = setDeep(raw, row.key, row.value)
  }

  // Priority: schema defaults < database rows < environment variables.
  // configSchema.parse({}) already produces full defaults via chained
  // .default(sectionSchema.parse({})) — no structural skeleton needed.
  const envOverrides = readEnvOverrides()
  console.log("[config] Loaded config from database (version %d) with env overrides: %o", version, envOverrides)
  const config = configSchema.parse(deepMerge(raw, envOverrides))
  return { config, version }
}
