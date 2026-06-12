import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@project-minato/api/routers";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	isRedirect,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { link, type orpc } from "@/utils/orpc";

import "../index.css";
import { CommandMenu } from "@/components/command-menu";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	beforeLoad: async ({ location, context }) => {
		if (
			location.pathname.startsWith("/setup") ||
			location.pathname.startsWith("/welcome")
		) {
			return;
		}

		try {
			const setupStatus = await context.queryClient.ensureQueryData(
				context.orpc.setup.getStatus.queryOptions(),
			);

			if (!setupStatus.setupCompleted) {
				throw redirect({ to: "/welcome" });
			}
		} catch (error) {
			if (isRedirect(error)) throw error;
			// Allow access if the API is unreachable so the app doesn't hard-block.
			console.error("Failed to check setup status:", error);
		}
	},
	head: () => ({
		meta: [
			{
				title: "Minato",
			},
			{
				name: "description",
				content: "Minato — torrent indexing & scraping control panel",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

const commandMenuHiddenPaths = ["/setup", "/welcome"];

function RootComponent() {
	const [client] = useState<AppRouterClient>(() => createORPCClient(link));
	const [orpcUtils] = useState(() => createTanstackQueryUtils(client));
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const showCommandMenu = !commandMenuHiddenPaths.some((p) =>
		pathname.startsWith(p),
	);

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="min-h-screen">
					<main>
						<Outlet />
						{showCommandMenu && <CommandMenu />}
					</main>
				</div>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	);
}
