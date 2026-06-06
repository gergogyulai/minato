import type { db } from "@project-minato/db";
import { eq, settings, settingsMeta, sql } from "@project-minato/db";
import { getProperty, hasProperty, setProperty } from "dot-prop";
import type { AppConfig } from "./schema";
import { configSchema } from "./schema";
import { publishReload, refreshLocalCache, reloadConfig, getVersion } from "./store";

type DB = typeof db;

const canonicalConfig = configSchema.parse({}) as Record<string, unknown>;

export type ConfigKeyValidation =
	| { ok: true; value: unknown }
	| { ok: false; error: string };

export function validateConfigKey(
	key: string,
	value: unknown,
): ConfigKeyValidation {
	const parts = key.split(".");
	if (parts.some((p) => p.length === 0)) {
		return { ok: false, error: `"${key}" is not a valid config key.` };
	}

	if (!hasProperty(canonicalConfig, key)) {
		return { ok: false, error: `Unknown config key: "${key}".` };
	}

	const candidate = structuredClone(canonicalConfig);
	setProperty(candidate, key, value);
	const parsed = configSchema.safeParse(candidate);
	if (!parsed.success) {
		const issue =
			parsed.error.issues.find(
				(i) => i.path.slice(0, parts.length).join(".") === key,
			) ?? parsed.error.issues[0];
		const detail = issue
			? `${issue.path.join(".") || key}: ${issue.message}`
			: "value did not match the expected schema";
		return { ok: false, error: `Invalid value for key "${key}": ${detail}` };
	}

	return {
		ok: true,
		value: getProperty(parsed.data as AppConfig, key),
	};
}

export interface WriteOptions {
	silent?: boolean;
}

export async function writeConfigKey(
	db: DB,
	key: string,
	value: unknown,
	{ silent = false }: WriteOptions = {},
): Promise<void> {
	const validation = validateConfigKey(key, value);
	if (!validation.ok) throw new Error(`writeConfigKey: ${validation.error}`);
	type SettingValue = (typeof settings)["$inferInsert"]["value"];
	const safe = validation.value as SettingValue;

	if (silent) {
		await db
			.insert(settings)
			.values({ key, value: safe })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: safe, updatedAt: new Date() },
			});
		await refreshLocalCache(db);
		return;
	}

	await db.transaction(async (tx) => {
		await tx
			.insert(settings)
			.values({ key, value: safe })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: safe, updatedAt: new Date() },
			});

		await tx
			.update(settingsMeta)
			.set({ version: sql`${settingsMeta.version} + 1` })
			.where(eq(settingsMeta.id, 1));
	});

	await reloadConfig(db);
	await publishReload(getVersion());
}
