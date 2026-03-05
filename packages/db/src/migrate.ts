import { env } from "@project-minato/env/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import fs from "node:fs";

const REINDEX_TRIGGER_TABLES = ["torrents", "enrichments"] as const;

export interface MigrationResult {
  appliedCount: number;
  requiresReindex: boolean;
}

interface JournalEntry {
  idx: number;
  tag: string;
}

interface MigrationJournal {
  entries: JournalEntry[];
}

async function getAppliedMigrationCount(client: postgres.Sql): Promise<number> {
  try {
    const rows = await client`
      SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    return rows[0]?.count ?? 0;
  } catch {
    // The drizzle schema or table doesn't exist yet — first run.
    return 0;
  }
}

/**
 * Scans raw SQL for references to any reindex-trigger table.
 * Both quoted (`"torrents"`) and unquoted forms are detected.
 */
function sqlAffectsReindexTables(sql: string): boolean {
  const lower = sql.toLowerCase();
  return REINDEX_TRIGGER_TABLES.some(
    (table) =>
      lower.includes(`"${table}"`) ||
      lower.includes(` ${table} `) ||
      lower.includes(` ${table}\n`) ||
      lower.includes(` ${table};`) ||
      lower.includes(`\t${table} `) ||
      lower.startsWith(table),
  );
}

/**
 * Runs all pending Drizzle-generated migrations against the database.
 *
 * - Safe to call on every server start; skips already-applied migrations.
 * - Uses a dedicated single-connection client that is closed when done.
 * - Returns which migrations were newly applied and whether a Meilisearch
 *   reindex is required.
 * - Throws on any error so the caller can decide how to handle it.
 */
export async function runMigrations(): Promise<MigrationResult> {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const migrationsDir = path.resolve(__dirname, "./migrations");

  // Verify the migrations folder exists before attempting anything.
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(
      `[Migration] Migrations folder not found at: ${migrationsDir}. ` +
        `Run 'drizzle-kit generate' first.`,
    );
  }

  const journalPath = path.join(migrationsDir, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(
      `[Migration] Migration journal not found at: ${journalPath}. ` +
        `Run 'drizzle-kit generate' to create migrations before starting the server.`,
    );
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    const countBefore = await getAppliedMigrationCount(migrationClient);

    console.log(
      `[Migration] ${countBefore} migration(s) already applied. Checking for new ones...`,
    );

    await migrate(db, { migrationsFolder: migrationsDir });

    const countAfter = await getAppliedMigrationCount(migrationClient);
    const appliedCount = countAfter - countBefore;

    if (appliedCount === 0) {
      console.log("[Migration] Database is already up to date.");
      return { appliedCount: 0, requiresReindex: false };
    }

    console.log(`[Migration] Applied ${appliedCount} new migration(s).`);

    // Determine which migrations were newly applied by reading the journal.
    const journal: MigrationJournal = JSON.parse(
      fs.readFileSync(journalPath, "utf-8"),
    );

    // Journal entries are ordered by idx; the last `appliedCount` are new.
    const newEntries = journal.entries.slice(
      countBefore,
      countBefore + appliedCount,
    );

    const requiresReindex = newEntries.some((entry) => {
      const sqlPath = path.join(migrationsDir, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlPath)) {
        console.warn(
          `[Migration] SQL file not found for entry "${entry.tag}", assuming reindex is safe to skip.`,
        );
        return false;
      }
      const sql = fs.readFileSync(sqlPath, "utf-8");
      return sqlAffectsReindexTables(sql);
    });

    if (requiresReindex) {
      console.log(
        "[Migration] One or more migrations affect indexed tables — a full Meilisearch reindex will be scheduled.",
      );
    }

    return { appliedCount, requiresReindex };
  } finally {
    await migrationClient.end();
  }
}
