import { settings, settingsMeta, eq, sql } from "@project-minato/db"
import type { db } from "@project-minato/db"
import { reloadConfig, refreshLocalCache, getVersion } from "./store"
import { publishReload } from "./pubsub"

type DB = typeof db

export interface WriteOptions {
  silent?: boolean
}

export async function writeConfigKey(
  db: DB,
  key: string,
  value: unknown,
  { silent = false }: WriteOptions = {},
): Promise<void> {
  if (silent) {
    await db
      .insert(settings)
      .values({ key, value: value as Record<string, unknown> })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value as Record<string, unknown>, updatedAt: new Date() },
      })
    await refreshLocalCache(db)
    return
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({ key, value: value as Record<string, unknown> })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value as Record<string, unknown>, updatedAt: new Date() },
      })

    await tx
      .update(settingsMeta)
      .set({ version: sql`${settingsMeta.version} + 1` })
      .where(eq(settingsMeta.id, 1))
  })

  await reloadConfig(db)
  await publishReload(getVersion())
}
