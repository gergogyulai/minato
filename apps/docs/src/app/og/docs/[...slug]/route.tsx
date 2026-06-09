import { generateOGImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";

import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
	_req: Request,
	{ params }: RouteContext<"/og/docs/[...slug]">,
) {
	const { slug } = await params;
	const page = source.getPage(slug.slice(0, -1));
	if (!page) notFound();

	return generateOGImage({
		title: page.data.title,
		description: page.data.description,
		site: "Minato",
		primaryColor: "rgba(37, 99, 235, 0.3)",
		primaryTextColor: "#2563eb",
	});
}

export function generateStaticParams() {
	return source.getPages().map((page) => ({
		lang: page.locale,
		slug: getPageImage(page).segments,
	}));
}
