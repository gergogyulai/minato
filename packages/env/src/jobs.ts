import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(import.meta.dir, "../../../.env") });
import { createEnv } from "@t3-oss/env-core";
import { sharedSchema, tmdbAccessTokenSchema } from "./schema";

export const env = createEnv({
	server: {
		...sharedSchema,
		...tmdbAccessTokenSchema,
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
