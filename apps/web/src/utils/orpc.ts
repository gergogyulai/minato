import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@project-minato/api/routers";
import { env } from "@project-minato/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(`Error: ${error.message}`, {
				action: {
					label: "retry",
					onClick: query.invalidate,
				},
			});
		},
	}),
});

export const link = new RPCLink({
	url: `${import.meta.env.PROD ? window.location.origin : (env.VITE_SERVER_URL ?? "http://localhost:3000")}/api/v1/rpc`,
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
