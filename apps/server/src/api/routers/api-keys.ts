import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import {
	apiKeyCreateContract,
	apiKeyDeleteContract,
	apiKeyListContract,
} from "@/api/contracts/api-keys.contracts";

export const apiKeysRouter = {
	create: apiKeyCreateContract.handler(async ({ input, context }) => {
		const result = await auth.api.createApiKey({
			body: {
				name: input.name,
				metadata: { type: input.type },
				expiresIn: input.expiresIn ?? null,
			},
			headers: context.honoContext.req.raw.headers,
		});

		return result;
	}),

	list: apiKeyListContract.handler(async ({ context }) => {
		const result = await auth.api.listApiKeys({
			headers: context.honoContext.req.raw.headers,
		});

		return { apiKeys: result.apiKeys };
	}),

	delete: apiKeyDeleteContract.handler(async ({ input, context }) => {
		try {
			await auth.api.deleteApiKey({
				body: { keyId: input.keyId },
				headers: context.honoContext.req.raw.headers,
			});
			return { success: true };
		} catch {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
	}),
};
