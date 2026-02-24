import { db } from "@project-minato/db"
import { initConfig, setupConfigSubscriber, getConfig } from "@project-minato/config"
import { applyGlobalSearchProfile } from "@project-minato/meilisearch"

export async function bootstrap(): Promise<void> {
  await initConfig(db)
  setupConfigSubscriber(db)

  const config = getConfig();
  await applyGlobalSearchProfile(config.search.profile);
}
