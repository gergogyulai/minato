import type { db } from "@project-minato/db";
import { env } from "@project-minato/env/shared";
import Redis from "ioredis";
import type { AppConfig } from "./schema";
import { loadConfig } from "./loader";

type DB = typeof db;

let cfg: AppConfig | undefined;
let ver: number | undefined;

type ConfigChangeListener = (config: AppConfig) => void;
const changeListeners = new Set<ConfigChangeListener>();

export function onConfigChange(listener: ConfigChangeListener): () => void {
	changeListeners.add(listener);
	return () => changeListeners.delete(listener);
}

export async function initConfig(db: DB): Promise<void> {
	const { config, version } = await loadConfig(db);
	cfg = Object.freeze(config);
	ver = version;
}

export function getConfig(): AppConfig {
	if (!cfg)
		throw new Error(
			"Config not initialised. Call initConfig() before getConfig().",
		);
	return cfg;
}

export function getVersion(): number {
	if (ver === undefined)
		throw new Error(
			"Config not initialised. Call initConfig() before getVersion().",
		);
	return ver;
}

export async function reloadConfig(db: DB): Promise<void> {
	try {
		const { config, version } = await loadConfig(db);
		if (version === ver) return;
		cfg = Object.freeze(config);
		ver = version;
		console.log(`[config] reloaded — version ${version}`);
		for (const listener of changeListeners) {
			try {
				listener(cfg);
			} catch (err) {
				console.error("[config] change listener threw:", err);
			}
		}
	} catch (err) {
		console.error("[config] reload failed — keeping existing config", err);
	}
}

export async function refreshLocalCache(db: DB): Promise<void> {
	try {
		const { config } = await loadConfig(db);
		cfg = Object.freeze(config);
	} catch (err) {
		console.error(
			"[config] local cache refresh failed — keeping existing config",
			err,
		);
	}
}

// ─── Redis pub/sub ────────────────────────────────────────────────────────────

const CHANNEL = "minato:config:reload";

let _clients: { pub: Redis; sub: Redis } | null = null;

function getClients(): { pub: Redis; sub: Redis } {
	if (!_clients) {
		_clients = {
			pub: new Redis(env.REDIS_URL, {
				maxRetriesPerRequest: null,
				lazyConnect: true,
			}),
			sub: new Redis(env.REDIS_URL, {
				maxRetriesPerRequest: null,
				lazyConnect: true,
			}),
		};
	}
	return _clients;
}

export async function closePubSub(): Promise<void> {
	if (!_clients) return;
	await Promise.all([_clients.pub.quit(), _clients.sub.quit()]);
	_clients = null;
}

export async function publishReload(version: number): Promise<void> {
	await getClients().pub.publish(CHANNEL, JSON.stringify({ version }));
}

export function setupConfigSubscriber(db: DB): void {
	const { sub } = getClients();

	sub.subscribe(CHANNEL, (err) => {
		if (err) console.error("[config] Redis subscribe error:", err);
	});

	sub.on("message", (_channel: string, message: string) => {
		try {
			const { version } = JSON.parse(message) as { version: number };
			if (version !== getVersion()) void reloadConfig(db);
		} catch (err) {
			console.error("[config] Failed to handle reload message:", err);
		}
	});
}
