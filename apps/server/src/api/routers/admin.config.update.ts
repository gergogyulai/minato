import { ORPCError } from "@orpc/server";
import { FlareSolverr } from "@project-minato/utils/flaresolverr";
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

	checkOllama: adminProcedure
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
				const res = await fetch(`${input.url}/api/version`, {
					signal: AbortSignal.timeout(5000),
				});
				if (!res.ok) {
					return { success: false, message: `Ollama returned HTTP ${res.status}` };
				}
				const data = (await res.json()) as { version?: string };
				return {
					success: true,
					message: "Ollama is reachable",
					version: data.version,
				};
			} catch (error) {
				return {
					success: false,
					message:
						error instanceof Error ? error.message : "Failed to connect to Ollama",
				};
			}
		}),

	checkProxy: adminProcedure
		.input(z.object({ url: z.string().min(1, "URL is required") }))
		.output(
			z.object({
				success: z.boolean(),
				message: z.string(),
				ip: z.string().optional(),
			}),
		)
		.handler(async ({ input }) => {
			try {
				const res = await (fetch as typeof fetch & ((url: string, init: RequestInit & { proxy?: string }) => Promise<Response>))(
					"https://api.ipify.org?format=json",
					{
						proxy: input.url,
						signal: AbortSignal.timeout(10000),
					},
				);
				if (!res.ok) {
					return { success: false, message: `Proxy returned HTTP ${res.status}` };
				}
				const data = (await res.json()) as { ip?: string };
				return {
					success: true,
					message: data.ip ? `Connected via ${data.ip}` : "Proxy is reachable",
					ip: data.ip,
				};
			} catch (error) {
				return {
					success: false,
					message: error instanceof Error ? error.message : "Failed to connect through proxy",
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
