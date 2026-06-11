import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { auth } from "@project-minato/auth";
import { closePubSub } from "@project-minato/config";
import { closeDb } from "@project-minato/db";
import { inferOriginFromRequest } from "@project-minato/env/origin";
import { env } from "@project-minato/env/server";
import { mediaRoot } from "@project-minato/env/paths";
import { connection as redis } from "@project-minato/queue";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "@/api/context";
import { appRouter } from "@/api/app";
import { handleExports } from "@/api/endpoints/exports";
import { handleTorznab } from "@/api/endpoints/torznab";
import { handleRss } from "@/api/endpoints/rss";
import { handleHealth } from "@/api/endpoints/health";
import { proxy } from "@/api/endpoints/proxy";
import {
	handleCommandAck,
	handleCommandStream,
	handleEnsureKey,
} from "@/api/features/scraper/routes";
import { startup } from "./startup";
const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin, c) => {
			if (origin === "null") return origin;
			// In development the Vite dev server runs on a different port — allow any origin.
			if (env.NODE_ENV === "development") return origin;
			// In production nginx serves everything from one origin, so only echo
			// back the inferred same-origin (cross-origin requests shouldn't arrive).
			const inferredOrigin = inferOriginFromRequest(c.req.raw);
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

app.get("/api/v1/exports/:filename", (c) => handleExports(c));

app.all("/api/v1/auth/*", (c) => auth.handler(c.req.raw));

// Supervisor-only endpoint for first-run key provisioning. Authenticates via
// the internal supervisor secret, not a session or API key.
app.post("/api/v1/internal/scraper/ensure-key", (c) => handleEnsureKey(c));

// Sidecar command channel — long-lived SSE stream plus ack, authenticated by
// a sidecar-bound API key. Registered before the oRPC catch-all so the
// streaming route wins.
app.get("/api/v1/scraper/commands", (c) => handleCommandStream(c));
app.post("/api/v1/scraper/commands/ack", (c) => handleCommandAck(c));

app.get("/api/v1/feeds/torznab", (c) => handleTorznab(c));
app.get("/api/v1/feeds/rss", (c) => handleRss(c));

app.route("/api/v1/proxy", proxy)

app.get("/api/v1/health", (c) => handleHealth(c));

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
	port: process.env.PORT ? Number(process.env.PORT) : 3000,
});

async function shutdown(signal: string) {
	console.log(`[server] ${signal} received — shutting down...`);
	server.stop(true);
	await Promise.allSettled([closeDb(), redis.quit(), closePubSub()]);
	process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
