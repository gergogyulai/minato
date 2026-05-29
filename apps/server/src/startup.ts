import { randomBytes } from "node:crypto";
import { db, runMigrations } from "@project-minato/db";
import {
  initConfig,
  setupConfigSubscriber,
  getConfig,
  writeConfigKey,
} from "@project-minato/config";
import { applyGlobalSearchProfile, syncMeilisearch } from "@project-minato/meilisearch";
import { housekeeperQueue, HOUSEKEEPER_JOBS } from "@project-minato/queue";

export async function startup(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    console.error("[startup] migrations failed — aborting:", err);
    process.exit(1);
  }

  await initConfig(db);
  setupConfigSubscriber(db);

  // First-run provisioning: the supervisor needs a shared secret to call the
  // internal ensure-key endpoint. Generated once and persisted in `settings`.
  if (!getConfig().internalSupervisorSecret) {
    const secret = randomBytes(32).toString("hex");
    await writeConfigKey(db, "internalSupervisorSecret", secret, { silent: true });
  }

  // syncMeilisearch first — it ensures the index exists and seeds default
  // settings (including a baseline ranking rules set). applyGlobalSearchProfile
  // then overrides ranking rules with the user's chosen profile.
  const searchSync = await syncMeilisearch(db);

  const config = getConfig();
  await applyGlobalSearchProfile(config.search.profile);

  if (searchSync.reindexRequired) {
    console.log(
      `[startup] search index version ${searchSync.previousVersion ?? "none"} → ${searchSync.currentVersion}; scheduling full reindex`,
    );
    try {
      await housekeeperQueue.add(
        HOUSEKEEPER_JOBS.FORCE_REINDEX,
        {},
        {
          jobId: `reindex-v${searchSync.currentVersion}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (err) {
      console.error("[startup] failed to enqueue reindex job:", err);
    }
  }
}
