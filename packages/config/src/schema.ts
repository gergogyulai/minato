import { z } from "zod"
import { RANKING_PROFILES_OPTIONS } from "@project-minato/meilisearch"

export const setupStepSchema = z.enum(["admin", "scrapers", "flaresolverr"])
export type SetupStep = z.infer<typeof setupStepSchema>

export const setupProgressSchema = z.object({
  currentStep: setupStepSchema,
  completedSteps: z.array(setupStepSchema),
})

const setupSchema = z.object({
  setupCompleted: z.boolean().default(false),
  setupProgress: setupProgressSchema.default({ currentStep: "admin", completedSteps: [] }),
})

const scraperSchema = z.object({
  flareSolverrUrl: z.string().url().default("http://localhost:8191"),
  enabledScrapers: z.array(z.string()).default(["1337x", "thepiratebay", "knaben", "eztv", "yts"]),
})

const ingestSchema = z.object({
  concurrency: z.number().int().min(1).max(50).default(5),
})

const enrichmentSchema = z.object({
  concurrency: z.number().int().min(1).max(20).default(5),
})

const workersSchema = z.object({
  ingest: ingestSchema.default(ingestSchema.parse({})),
  enrichment: enrichmentSchema.default(enrichmentSchema.parse({})),
})

const searchSchema = z.object({
  profile: z.enum(RANKING_PROFILES_OPTIONS).default("health"),
})

/**
 * Full application config schema.
 *
 * configSchema.parse({}) produces canonical defaults — no separate defaults
 * file or structural skeleton required in the loader.
 *
 * Priority when loading: schema defaults < database rows < env var overrides.
 */
export const configSchema = z.object({
  setup:    setupSchema.default(setupSchema.parse({})),
  scraper:  scraperSchema.default(scraperSchema.parse({})),
  search:  searchSchema.default(searchSchema.parse({})),
  workers:  workersSchema.default(workersSchema.parse({})),
})

export type AppConfig = z.infer<typeof configSchema>
export type SetupConfig = AppConfig["setup"]
export type SetupProgress = z.infer<typeof setupProgressSchema>
