import type { Metadata } from "next";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

export const metadata: Metadata = {
	title: "Minato — Self-hosted vault for the torrent ecosystem",
	description:
		"Project Minato is a self-hosted vault platform for the torrent ecosystem. It captures infohashes and metadata from trackers and keeps them locally, forever.",
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_SITE_URL ?? "https://projectminato.org",
	),
	openGraph: {
		images: [{ url: "/og" }],
	},
	twitter: {
		card: "summary_large_image",
		images: [{ url: "/og" }],
	},
};

export default function Layout({ children }: LayoutProps<"/">) {
	return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
