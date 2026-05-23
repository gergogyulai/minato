#!/usr/bin/env bun
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

// Local dev convenience: when this CLI is invoked from `packages/db`, env vars
// live in `apps/server/.env`. In prod (Docker) the file doesn't exist and env
// is provided by the container — dotenv.config silently no-ops in that case.
const devEnv = path.resolve(__dirname, "../../../../apps/server/.env");
if (fs.existsSync(devEnv)) {
  dotenv.config({ path: devEnv });
}

const { runMigrations } = await import("../migrate");

try {
  await runMigrations();
  process.exit(0);
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exit(1);
}
