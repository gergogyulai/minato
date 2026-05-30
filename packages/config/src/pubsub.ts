import type { db } from "@project-minato/db";
import { env } from "@project-minato/env/shared";
import Redis from "ioredis";
import { getVersion, reloadConfig } from "./store";

type DB = typeof db;

const CHANNEL = "minato:config:reload";

const pub = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
	lazyConnect: true,
});

const sub = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
	lazyConnect: true,
});

export async function closePubSub(): Promise<void> {
	await Promise.all([pub.quit(), sub.quit()]);
}

export async function publishReload(version: number): Promise<void> {
	await pub.publish(CHANNEL, JSON.stringify({ version }));
}

export function setupConfigSubscriber(db: DB): void {
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
