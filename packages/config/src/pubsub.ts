import Redis from "ioredis"
import type { db } from "@project-minato/db"
import { getVersion, reloadConfig } from "./store"

type DB = typeof db

const CHANNEL = "minato:config:reload"
const REDIS_OPTS = { maxRetriesPerRequest: null, lazyConnect: true } as const
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"

const pub = new Redis(redisUrl, REDIS_OPTS)
const sub = new Redis(redisUrl, REDIS_OPTS)

export async function publishReload(version: number): Promise<void> {
  await pub.publish(CHANNEL, JSON.stringify({ version }))
}

export function setupConfigSubscriber(db: DB): void {
  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error("[config] Redis subscribe error:", err)
  })

  sub.on("message", (_channel: string, message: string) => {
    try {
      const { version } = JSON.parse(message) as { version: number }
      if (version !== getVersion()) void reloadConfig(db)
    } catch (err) {
      console.error("[config] Failed to handle reload message:", err)
    }
  })
}
