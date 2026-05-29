import { auth } from "@project-minato/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	const rawKey =
		context.req.header("X-Minato-Key") ?? context.req.query("apikey") ?? null;

	let apiKey: Awaited<ReturnType<typeof auth.api.verifyApiKey>>["key"] = null;
	if (rawKey) {
		const result = await auth.api.verifyApiKey({ body: { key: rawKey } });
		if (result.valid) apiKey = result.key;
	}

	const scraperId =
		(apiKey?.metadata as { scraperId?: string } | null)?.scraperId ?? null;

	return {
		session,
		honoContext: context,
		apiKey,
		scraperId,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
