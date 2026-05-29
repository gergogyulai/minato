import fs from "node:fs";
import path from "node:path";
import { env } from "@project-minato/env/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export interface MigrationResult {
	applied: string[];
}

// Stable arbitrary 64-bit key for pg_advisory_lock — serializes concurrent
// boots (server + jobs running migrations at the same time).
const MIGRATION_LOCK_KEY = 7271_2026_0520n;

interface JournalEntry {
	idx: number;
	tag: string;
}

/**
 * Applies any pending Drizzle migrations.
 *
 * Single code path for dev CLI (`bun run db:migrate`), server boot, and jobs
 * boot. Idempotent and safe under concurrency via a Postgres advisory lock.
 */
export async function runMigrations(): Promise<MigrationResult> {
	const migrationsFolder = resolveMigrationsFolder();
	const journal = readJournal(migrationsFolder);

	const client = new Client({ connectionString: env.DATABASE_URL });
	await client.connect();

	try {
		await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

		const beforeCount = await countApplied(client);
		await migrate(drizzle(client), { migrationsFolder });
		const afterCount = await countApplied(client);

		const applied = journal.slice(beforeCount, afterCount).map((e) => e.tag);

		if (applied.length === 0) {
			console.log("[migrate] up to date");
		} else {
			console.log(`[migrate] applied ${applied.length} migration(s):`);
			for (const tag of applied) console.log(`  · ${tag}`);
		}

		return { applied };
	} finally {
		await client
			.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY])
			.catch(() => {});
		await client.end();
	}
}

function resolveMigrationsFolder(): string {
	// __dirname resolves to packages/db/src/ in dev and to the bundle dir in prod
	// (tsdown shims __dirname). The Dockerfile copies the migrations folder next
	// to each bundle so this works in both layouts without environment branching.
	const dir = path.resolve(__dirname, "./migrations");
	if (!fs.existsSync(path.join(dir, "meta", "_journal.json"))) {
		throw new Error(
			`[migrate] migrations folder is empty or missing at ${dir} — run 'bun run db:generate' first`,
		);
	}
	return dir;
}

function readJournal(folder: string): JournalEntry[] {
	const journalPath = path.join(folder, "meta", "_journal.json");
	const raw = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
		entries?: JournalEntry[];
	};
	return [...(raw.entries ?? [])].sort((a, b) => a.idx - b.idx);
}

async function countApplied(client: Client): Promise<number> {
	try {
		const { rows } = await client.query<{ count: string }>(
			"SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations",
		);
		return Number(rows[0]?.count ?? 0);
	} catch {
		return 0;
	}
}
