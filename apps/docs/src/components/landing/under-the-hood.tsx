import { Reveal, SectionRule, Stagger, StaggerItem } from "./motion";
import { PipelineGraph } from "./pipeline-graph";

const FEATURES = [
	{
		title: "Zero-overhead runtime",
		body: "Scrapers and the API layer both run on Bun. Cold start in milliseconds, not seconds.",
		stat: "< 300ms",
	},
	{
		title: "Concurrent, non-blocking ingestion",
		body: "BullMQ distributes parsing, metadata enrichment, and deduplication across isolated workers. One slow source never stalls the rest.",
		stat: "parallel",
	},
	{
		title: "Sub-millisecond search",
		body: "Meilisearch with custom ranking profiles tuned for release quality, seed health, and freshness. Results before your finger leaves the key.",
		stat: "< 3ms",
	},
];

export function UnderTheHood() {
	return (
		<section className="border-t border-web-line py-24 md:py-32">
			<div className="mx-auto max-w-5xl px-6">
				<SectionRule label="03 / Engine" />

				<Reveal>
					<h2
						className="mb-20 font-display font-bold leading-none tracking-tight text-web-fg"
						style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
					>
						Performance
						<br />
						<span className="text-web-muted">is a feature.</span>
					</h2>
				</Reveal>

				<div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:items-start">
					{/* Pipeline graph */}
					<Reveal className="flex justify-center md:justify-start" delay={0.1}>
						<PipelineGraph />
					</Reveal>

					{/* Feature list — oxc.rs stat+text style */}
					<Stagger className="flex flex-col divide-y divide-web-line">
						{FEATURES.map((f) => (
							<StaggerItem key={f.title} className="py-6 first:pt-0 last:pb-0">
								<div className="mb-2 flex items-baseline justify-between gap-4">
									<p className="text-sm font-semibold text-web-fg">{f.title}</p>
									<span className="shrink-0 font-mono text-[11px] tracking-wider text-web-primary/60">
										{f.stat}
									</span>
								</div>
								<p className="text-sm leading-relaxed text-web-muted">{f.body}</p>
							</StaggerItem>
						))}
					</Stagger>
				</div>
			</div>
		</section>
	);
}
