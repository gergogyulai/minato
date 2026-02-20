import { z } from "zod"

export const setupStepSchema = z.enum(["admin", "scrapers", "flaresolverr"])
export type SetupStep = z.infer<typeof setupStepSchema>

export const setupProgressSchema = z.object({
  currentStep: setupStepSchema,
  completedSteps: z.array(setupStepSchema),
})

export const configSchema = z.object({
  setup: z.object({
    /** True once the initial wizard has been completed. */
    setupCompleted: z.boolean(),
    /** URL of the FlareSolverr instance used to bypass DDoS protection. */
    flareSolverrUrl: z.string().url(),
    /** IDs of scrapers that are currently enabled. */
    enabledScrapers: z.array(z.string()),
    /** Current position in the first-run wizard (absent after completion). */
    setupProgress: setupProgressSchema.optional(),
  }),
  scraper: z.object({
    proxy: z.object({
      strategy: z.enum(["round_robin", "sticky"]),
      list: z.array(z.string()),
    }),
    mirrors: z.record(z.string(), z.array(z.string())),
  }),
  workers: z.object({
    ingest: z.object({
      concurrency: z.number().int().min(1).max(50),
    }),
    enrichment: z.object({
      concurrency: z.number().int().min(1).max(20),
    }),
  }),
  features: z.object({
    torznab: z.boolean(),
    rss: z.boolean(),
  }),
})

export type AppConfig = z.infer<typeof configSchema>
export type SetupConfig = AppConfig["setup"]
export type SetupProgress = z.infer<typeof setupProgressSchema>
