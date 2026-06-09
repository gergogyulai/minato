import { generateOGImage } from "fumadocs-ui/og";

export const revalidate = false;

export async function GET() {
	return generateOGImage({
		title: "Minato",
		description:
			"Self-hosted vault for the torrent ecosystem. Permanent infohash & metadata indexing from trackers.",
		site: "projectminato.org",
		primaryColor: "rgba(37, 99, 235, 0.3)",
		primaryTextColor: "#2563eb",
	});
}
