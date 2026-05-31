import path from "node:path";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { auth } from "@project-minato/auth";
import { closePubSub } from "@project-minato/config";
import { closeDb, db, sql } from "@project-minato/db";
import { inferOriginFromRequest } from "@project-minato/env/origin";
import { env } from "@project-minato/env/server";
import { meiliClient } from "@project-minato/meilisearch";
import { connection as redis } from "@project-minato/queue";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "@/api/context";
import { appRouter } from "@/api/routers/index";
import { feeds } from "@/feeds";
import { handleCommandsSse, handleEnsureKey } from "@/scraper/sse";
import { startup } from "./startup";
import { mediaRoot } from "@project-minato/env/paths";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			if (origin === "null") {
				return origin;
			}
			if (env.CORS_ORIGIN) {
				return origin === env.CORS_ORIGIN ? origin : env.CORS_ORIGIN;
			}

			const inferredOrigin = inferOriginFromRequest(c.req.raw);
			if (!inferredOrigin) {
				return null;
			}

			return origin === inferredOrigin ? origin : null;
		},
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "User-Agent"],
		credentials: true,
	}),
);

app.get(
	"/assets/*",
	serveStatic({
		root: mediaRoot,
		// This strips "/assets" so /assets/tm/poster.webp looks for <root>/tm/poster.webp
		rewriteRequestPath: (path) => path.replace(/^\/assets/, ""),
	}),
);

app.all("/api/v1/auth/*", (c) => auth.handler(c.req.raw));

// Scraper command stream — raw SSE, outside oRPC because the OpenAPI handler
// doesn't support long-lived streams. Validated against scraper API keys.
app.get("/api/v1/scraper/commands/:scraperId", (c) =>
	handleCommandsSse(c, c.req.param("scraperId")),
);

// Supervisor-only endpoint for first-run key provisioning. Authenticates via
// the internal supervisor secret, not a session or API key.
app.post("/api/v1/internal/scraper/ensure-key", (c) => handleEnsureKey(c));

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
			"ℹ [server] System Status Check",
			"",
			`↳ ${"Uptime".padEnd(18)} → ${uptimeStr}`,
			`↳ ${"Database".padEnd(18)} → ${dbStatus.toUpperCase()}`,
			`↳ ${"Redis".padEnd(18)} → ${redisStatus.toUpperCase()}`,
			`↳ ${"MeiliSearch".padEnd(18)} → ${meiliSearchStatus.toUpperCase()}`,
			`↳ ${"Server Time".padEnd(18)} → ${serverTime}`,
			`↳ ${"Memory".padEnd(18)} → ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
			"",
			`${isHealthy ? "✔ System heartbeat stable" : "✖ System issues detected"}`,
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
			if (error instanceof ORPCError && error.data?.issues) {
				console.error(
					`[orpc] ${error.code} — validation issues:\n`,
					JSON.stringify(error.data.issues, null, 2),
				);
			} else {
				console.error(error);
			}
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			if (error instanceof ORPCError && error.data?.issues) {
				console.error(
					`[orpc] ${error.code} — validation issues:\n`,
					JSON.stringify(error.data.issues, null, 2),
				);
			} else {
				console.error(error);
			}
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

await startup();

const server = Bun.serve({
	fetch: app.fetch,
});

async function shutdown(signal: string) {
	console.log(`[server] ${signal} received — shutting down...`);
	server.stop(true);
	await Promise.allSettled([closeDb(), redis.quit(), closePubSub()]);
	process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
