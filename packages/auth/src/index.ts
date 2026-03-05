import { db } from "@project-minato/db";
import * as schema from "@project-minato/db/schema/auth";
import { env } from "@project-minato/env/server";
import { inferOriginFromRequest } from "@project-minato/env/origin";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { apiKey } from "@better-auth/api-key"
import { admin } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"

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
  plugins: [nextCookies(), apiKey(), admin(), passkey()],
});
