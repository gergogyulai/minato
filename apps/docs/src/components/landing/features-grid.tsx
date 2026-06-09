import { Archive, Network, Rss } from "lucide-react";
import { Reveal, SectionRule, Stagger, StaggerItem } from "./motion";

const CARDS = [
	{
		icon: Archive,
		number: "01",
		title: "Permanent local storage",
		body: "Not a proxy. Not a router. Every magnet link and infohash Minato captures is written to your own Postgres instance: indexed, deduplicated, and available long after the original source disappears.",
		color: "#22d3ee",
		metric: "∞ retention",
	},
	{
		icon: Network,
		number: "02",
		title: "Aggregation without lock-in",
		body: "Pull from EZTV, Knaben, and a growing list of built-in providers, or mount your own community scrapers via a volume. Minato doesn't care where the data comes from, as long as it gets saved.",
		color: "#a78bfa",
		metric: "15+ sources",
	},
	{
		icon: Rss,
		number: "03",
		title: "Native Torznab compatibility",
		body: "Your existing stack works on day one. Minato serves a spec-compliant Torznab XML and RSS API so Sonarr and Radarr can query your local cache exactly like any remote indexer.",
		color: "#fb923c",
		metric: "100% spec",
	},
];

export function FeaturesGrid() {
	return (
		<section className="border-t border-web-line py-24 md:py-32">
			<div className="mx-auto max-w-5xl px-6">
				<SectionRule label="02 / Why" />

				<Reveal>
					<h2
						className="mb-16 font-display font-bold leading-none tracking-tight text-web-fg"
						style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
					>
						The web is volatile.
						<br />
						<span className="text-web-muted">Your library shouldn't be.</span>
					</h2>
				</Reveal>

				{/* Card grid — vite.dev inspired */}
				<Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
					{CARDS.map((card) => (
						<StaggerItem
							key={card.title}
							className="group relative overflow-hidden rounded-xl border border-web-line bg-web-card p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-web-line-strong hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20"
						>
							{/* Gradient top line — vite.dev signature */}
							<div
								className="absolute inset-x-0 top-0 h-px"
								style={{
									background: `linear-gradient(to right, transparent, ${card.color}90, transparent)`,
								}}
							/>

							{/* Icon + metric row */}
							<div className="mb-6 flex items-center justify-between">
								<div
									className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
									style={{
										backgroundColor: `${card.color}18`,
										color: card.color,
									}}
								>
									<card.icon size={18} />
								</div>
								<span
									className="font-mono text-[11px] font-medium tracking-wider"
									style={{ color: `${card.color}90` }}
								>
									{card.metric}
								</span>
							</div>

							{/* Faded number — background decoration */}
							<div
								className="pointer-events-none absolute right-4 top-4 font-mono text-7xl font-bold leading-none select-none"
								style={{ color: `${card.color}0c` }}
							>
								{card.number}
							</div>

							<h3 className="mb-3 text-sm font-semibold text-web-fg">
								{card.title}
							</h3>
							<p className="text-sm leading-relaxed text-web-muted">
								{card.body}
							</p>
						</StaggerItem>
					))}
				</Stagger>
			</div>
		</section>
	);
}
