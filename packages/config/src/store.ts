import type { db } from "@project-minato/db"
import { loadConfig } from "./loader"
import type { AppConfig } from "./schema"

type DB = typeof db

let cfg: AppConfig | undefined
let ver: number | undefined

export async function initConfig(db: DB): Promise<void> {
  const { config, version } = await loadConfig(db)
  cfg = Object.freeze(config)
  ver = version
}

export function getConfig(): AppConfig {
  if (!cfg) throw new Error("Config not initialised. Call initConfig() before getConfig().")
  return cfg
}

export function getVersion(): number {
  if (ver === undefined) throw new Error("Config not initialised. Call initConfig() before getVersion().")
  return ver
}

export async function reloadConfig(db: DB): Promise<void> {
  try {
    const { config, version } = await loadConfig(db)
    if (version === ver) return
    cfg = Object.freeze(config)
    ver = version
    console.log(`[config] reloaded — version ${version}`)
  } catch (err) {
    console.error("[config] reload failed — keeping existing config", err)
  }
}

export async function refreshLocalCache(db: DB): Promise<void> {
  try {
    const { config } = await loadConfig(db)
    cfg = Object.freeze(config)
  } catch (err) {
    console.error("[config] local cache refresh failed — keeping existing config", err)
  }
}
