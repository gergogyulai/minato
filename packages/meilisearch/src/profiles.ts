import { meiliClient } from "./client";

export type GlobalProfile = "quality" | "health" | "freshness";

export const RANKING_PROFILES: Record<GlobalProfile, string[]> = {
  /**
   * QUALITY: Oriented towards better quality releases among relevant matches.
   */
  quality: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "size:desc",
    "exactness",
    "seeders:desc",
  ],

  /**
   * HEALTH: Oriented towards the most available torrents among relevant matches.
   */
  health: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "seeders:desc",
    "exactness",
    "size:desc",
  ],

  /**
   * FRESHNESS: Oriented towards the latest releases among relevant matches.
   */
  freshness: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "publishedAt:desc",
    "exactness",
    "seeders:desc",
  ],
};

export async function applyGlobalSearchProfile(profileName: GlobalProfile): Promise<void> {
  const index = meiliClient.index("torrents");
  const rules = RANKING_PROFILES[profileName];

  console.log(`Reconfiguring index for ${profileName} orientation...`);

  const task = await index.updateRankingRules(rules);

  await meiliClient.tasks.waitForTask(task.taskUid);
  
  console.log(`Index is now ${profileName} oriented.`);
}