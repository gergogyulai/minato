import { MeiliSearchTaskTimeOutError } from "meilisearch";
import { meiliClient } from "./client";

export const RANKING_PROFILES_OPTIONS = [
	"quality",
	"health",
	"freshness",
] as const;

export type SearchEngineRankingProfile =
	(typeof RANKING_PROFILES_OPTIONS)[number];

export const RANKING_PROFILES: Record<SearchEngineRankingProfile, string[]> = {
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

export async function applyGlobalSearchProfile(
	profileName: SearchEngineRankingProfile,
): Promise<void> {
	const index = meiliClient.index("torrents");
	const rules = RANKING_PROFILES[profileName];

	console.log(`Reconfiguring index for ${profileName} orientation...`);

	const task = await index.updateRankingRules(rules);

	try {
		await meiliClient.tasks.waitForTask(task.taskUid, { timeout: 30_000 });
	} catch (err) {
		if (err instanceof MeiliSearchTaskTimeOutError) {
			console.warn(
				`[search] ranking rules update timed out waiting for confirmation (task ${task.taskUid}) — Meilisearch will apply it in the background`,
			);
			return;
		}
		throw err;
	}

	console.log(`Index is now ${profileName} oriented.`);
}
