import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { db } from "@project-minato/db";
import * as schema from "@project-minato/db/schema/auth";
import { inferOriginFromRequest } from "@project-minato/env/origin";
import { env } from "@project-minato/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",

		schema: schema,
	}),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	basePath: "/api/v1/auth",
	trustedOrigins: async (request) => {
		const configuredOrigin = env.CORS_ORIGIN ?? env.BETTER_AUTH_URL;
		const inferredOrigin = request ? inferOriginFromRequest(request) : null;
		return [configuredOrigin, inferredOrigin].filter(
			(origin): origin is string => Boolean(origin),
		);
	},
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true,
		},
	},
	plugins: [
		nextCookies(),
		apiKey({
			defaultPrefix: "mk_",
			enableMetadata: true,
			// Machine-to-machine keys (scraper, torznab) call us continuously —
			// the 10-req/day plugin default would brick them within seconds.
			// Apply throttling at the Hono layer if/when needed instead.
			rateLimit: { enabled: false },
		}),
		admin(),
		passkey(),
	],
});
