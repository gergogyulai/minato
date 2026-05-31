import { ORPCError } from "@orpc/server";
import { FlareSolverr } from "@project-minato/api-clients";
import {
	getConfig,
	getVersion,
	validateConfigKey,
	writeConfigKey,
} from "@project-minato/config";
import { db } from "@project-minato/db";
import { z } from "zod";
import { adminProcedure } from "@/api";

export const adminRouter = {
	checkFlareSolverr: adminProcedure
		.input(z.object({ url: z.string().url("Invalid URL") }))
		.output(
			z.object({
				success: z.boolean(),
				message: z.string(),
				version: z.string().optional(),
			}),
		)
		.handler(async ({ input }) => {
			try {
				const client = new FlareSolverr(input.url);
				const response = await client.listSessions();
				return {
					success: true,
					message: "FlareSolverr is working correctly",
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
					version: (response as any).version as string | undefined,
				};
			} catch (error) {
				return {
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to connect to FlareSolverr",
				};
			}
		}),

	config: {
		update: adminProcedure
			.input(
				z.object({
					key: z.string(),
					value: z.unknown(),
				}),
			)
			.handler(async ({ input }) => {
				const { key, value } = input;

				const result = validateConfigKey(key, value);
				if (!result.ok) {
					throw new ORPCError("BAD_REQUEST", { message: result.error });
				}

				await writeConfigKey(db, key, result.value);
				return { success: true, key, version: getVersion() };
			}),

		get: adminProcedure.handler(() => {
			return { config: getConfig(), version: getVersion() };
		}),
	},
};
