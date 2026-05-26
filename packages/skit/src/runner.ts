import { resolve, dirname } from "node:path";
import { FlareSolverr } from "@project-minato/api-clients";
import { readManifest } from "./manifest";
import { register } from "./register";
import { mergeConfig } from "./config";
import { createIngestClient } from "./ingest";
import { createStatusReporter } from "./status";
import { createCommandSignal } from "./commands";
import type { ScraperDefinition } from "./types";

export async function run() {
  const apiUrl = process.env.MINATO_API_URL;
  const apiKey = process.env.MINATO_API_KEY;
  const scraperId = process.env.MINATO_SCRAPER_ID;

  if (!apiUrl || !apiKey || !scraperId) {
    console.error(
      "[skit] Missing required env: MINATO_API_URL, MINATO_API_KEY, MINATO_SCRAPER_ID",
    );
    process.exit(1);
  }

  // scraper.json sits next to the entrypoint
  const scraperDir = dirname(resolve(process.argv[1] ?? "."));
  const manifest = readManifest(scraperDir);

  // Dynamically import the definition — entrypoint exports a ScraperDefinition
  const mod = (await import(resolve(scraperDir, manifest.entry))) as {
    default: ScraperDefinition;
  };
  const definition = mod.default;

  const { config: serverConfig, flareSolverrUrl } = await register(apiUrl, apiKey, manifest);
  const config = mergeConfig(definition.config, serverConfig);

  const ingest = createIngestClient(apiUrl, apiKey);
  const status = createStatusReporter(apiUrl, apiKey);
  const signal = createCommandSignal(apiUrl, apiKey, scraperId);
  const flaresolverr = new FlareSolverr(flareSolverrUrl);

  process.on("uncaughtException", async (err) => {
    status.update({ phase: "error", message: err.message });
    await ingest.flush();
    process.exit(1);
  });

  process.on("SIGTERM", async () => {
    await ingest.flush();
    process.exit(0);
  });

  await definition.run({
    ingest,
    config,
    signal,
    status,
    flaresolverr,
    meta: { id: manifest.id, name: manifest.name, version: manifest.version },
  });

  await ingest.flush();
  process.exit(0);
}
