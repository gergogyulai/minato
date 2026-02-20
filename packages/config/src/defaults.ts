import type { AppConfig } from "./schema"

export const defaults: AppConfig = {
  setup: {
    setupCompleted: false,
    flareSolverrUrl: "http://localhost:8191",
    enabledScrapers: ["1337x", "thepiratebay", "knaben", "eztv", "yts"],
    setupProgress: {
      currentStep: "admin",
      completedSteps: [],
    },
  },
  scraper: {
    proxy: {
      strategy: "round_robin",
      list: [],
    },
    mirrors: {},
  },
  workers: {
    ingest: {
      concurrency: 5,
    },
    enrichment: {
      concurrency: 5,
    },
  },
  features: {
    torznab: true,
    rss: true,
  },
}
