import { env } from "@project-minato/env/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

export async function runMigrations() {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("Running DB migrations...");

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, "../migrations"),
    });
    console.log("DB migrations completed successfully");
  } catch (error) {
    console.error("DB migrations failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Allow running directly via CLI
if (require.main === module) {
  runMigrations();
}
