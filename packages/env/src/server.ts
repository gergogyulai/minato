import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(import.meta.dir, "../../../.env") });
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { sharedSchema, tmdbAccessTokenSchema } from "./schema";

export const env = createEnv({
	server: {
		...sharedSchema,
		...tmdbAccessTokenSchema,
		BETTER_AUTH_SECRET: z.string().min(1),
		PASSKEY_RP_ID: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
