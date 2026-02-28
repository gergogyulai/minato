import { db, runMigrations } from "@project-minato/db"
import { initConfig, setupConfigSubscriber, getConfig } from "@project-minato/config"
import { applyGlobalSearchProfile } from "@project-minato/meilisearch"
import { housekeeperQueue, HOUSEKEEPER_JOBS } from "@project-minato/queue"

export async function startup(): Promise<void> {
  let requiresReindex = false;
  try {
    const migrationResult = await runMigrations();
    requiresReindex = migrationResult.requiresReindex;
  } catch (err) {
    console.error("[Startup] Migration failed — aborting startup:", err);
    process.exit(1);
  }

  await initConfig(db)
  setupConfigSubscriber(db)

  const config = getConfig();
  await applyGlobalSearchProfile(config.search.profile);

  if (requiresReindex) {
    try {
      await housekeeperQueue.add(
        HOUSEKEEPER_JOBS.FORCE_REINDEX,
        {},
        {
          jobId: "post-migration-reindex",
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      console.log("[Startup] Full Meilisearch reindex job enqueued.");
    } catch (err) {
      console.error("[Startup] Failed to enqueue reindex job:", err);
    }
  }
}
