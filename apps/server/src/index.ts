import { env } from "@project-minato/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "./api/context";
import { appRouter } from "./api/routers/index";
import { feeds } from "./feeds";
import { db } from "@project-minato/db";
import { redis } from "@project-minato/queue";
import { meiliClient } from "@project-minato/meilisearch";
import { sql } from "@project-minato/db";

const app = new Hono()

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.on(["POST", "GET"], "/api/v1/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/v1/feeds", feeds);

app.get("/api/v1/health", async (c) => {
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

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/api/v1*", async (c, next) => {
	const context = await createContext({ context: c });

	// RPC API at /api/v1/rpc
	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/api/v1/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body as any, rpcResult.response);
	}

	// REST API at /api/v1
	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api/v1",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body as any, apiResult.response);
	}

	await next();
});

export default app;
