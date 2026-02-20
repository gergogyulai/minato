import Redis from "ioredis"

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"

export const pub = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

export const sub = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})
