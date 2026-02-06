import { env } from "@project-minato/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import torrents from "./routes/torrents";
import { db, sql } from "@project-minato/db";
import { redis } from "@project-minato/queue";
import { meiliClient } from "@project-minato/meilisearch";

const app = new Hono().basePath("/api/v1");

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.route("/auth", authRoutes);
app.route("/torrents", torrents);

app.get("/health", async (c) => {
  const pretty = c.req.query("pretty") !== undefined;

  const uptime = process.uptime();
  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  const memoryUsage = process.memoryUsage();

  let dbStatus = "connected";
  try {
    await db.execute(sql`SELECT 1`);
  } catch (e) {
    dbStatus = "disconnected";
  }

  const redisStatus = redis.status === "ready" ? "connected" : "disconnected";

  let meiliSearchStatus = "disconnected";
  try {
    const health = await meiliClient.health();
    if (health.status === "available") {
      meiliSearchStatus = "connected";
    }
  } catch (e) {
    meiliSearchStatus = "disconnected";
  }

  const serverTime = new Date().toISOString();

  const isHealthy =
    dbStatus === "connected" &&
    redisStatus === "connected" &&
    meiliSearchStatus === "connected";

  const status = isHealthy ? 200 : 503;

  if (pretty) {
    const text = [
      "◢ PROJECT MINATO",
      `ℹ [server] System Status Check`,
      "",
      `↳ ${"Uptime".padEnd(18)} → ${uptimeStr}`,
      `↳ ${"Database".padEnd(18)} → ${dbStatus.toUpperCase()}`,
      `↳ ${"Redis".padEnd(18)} → ${redisStatus.toUpperCase()}`,
      `↳ ${"MeiliSearch".padEnd(18)} → ${meiliSearchStatus.toUpperCase()}`,
      `↳ ${"Server Time".padEnd(18)} → ${serverTime}`,
      `↳ ${"Memory".padEnd(18)} → ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      "",
      `${
        isHealthy ? `✔ System heartbeat stable` : `✖ System issues detected`
      }`,
    ].join("\n");
    return c.text(text, status);
  }

  return c.json(
    {
      status: isHealthy ? "ok" : "error",
      uptime,
      dbStatus,
      redisStatus,
      meiliSearchStatus,
      serverTime,
      memoryUsage,
    },
    status,
  );
});

export default app;
