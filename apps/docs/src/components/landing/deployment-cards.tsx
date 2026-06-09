import { Boxes, DatabaseZap, Server } from "lucide-react";
import type { ElementType } from "react";
import { Reveal, SectionRule, Stagger, StaggerItem } from "./motion";

interface CardProps {
	icon: ElementType;
	title: string;
	body: string;
	color: string;
	tag?: string | null;
}

function BentoCard({ icon: Icon, title, body, color, tag }: CardProps) {
	return (
		<div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-web-line bg-web-card p-6 transition-colors duration-300 hover:border-web-line-strong">
			{/* Gradient top line */}
			<div
				className="absolute inset-x-0 top-0 h-px"
				style={{
					background: `linear-gradient(to right, transparent, ${color}90, transparent)`,
				}}
			/>
			<div>
				<div
					className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
					style={{ backgroundColor: `${color}18`, color }}
				>
					<Icon size={16} />
				</div>
				<h3 className="mb-2 text-sm font-semibold text-web-fg">{title}</h3>
				<p className="text-sm leading-relaxed text-web-muted">{body}</p>
			</div>
			{tag && (
				<p
					className="mt-5 font-mono text-[11px] tracking-[0.15em] uppercase"
					style={{ color: `${color}60` }}
				>
					{tag}
				</p>
			)}
		</div>
	);
}

export function DeploymentCards() {
	return (
		<section className="border-t border-web-line py-24 md:py-32">
			<div className="mx-auto max-w-5xl px-6">
				<SectionRule label="05 / Deploy" />

				<Reveal>
					<h2
						className="mb-16 font-display font-bold leading-none tracking-tight text-web-fg"
						style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
					>
						One container.
						<br />
						<span className="text-web-muted">One port. Done.</span>
					</h2>
				</Reveal>

				{/* Bento grid: tall left + two stacked right */}
				<Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2 md:[grid-template-rows:1fr_1fr]">
					{/* Tall left card — spans 2 rows */}
					<StaggerItem className="md:row-span-2">
						<div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-web-line bg-web-card p-6 transition-colors duration-300 hover:border-web-line-strong">
							{/* Gradient top line */}
							<div
								className="absolute inset-x-0 top-0 h-px"
								style={{
									background:
										"linear-gradient(to right, transparent, #60a5fa90, transparent)",
								}}
							/>
							{/* Subtle bg glow */}
							<div
								className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full opacity-20 transition-opacity duration-500 group-hover:opacity-40"
								style={{
									background:
										"radial-gradient(circle, #60a5fa40 0%, transparent 70%)",
								}}
							/>
							<div className="relative">
								<div
									className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
									style={{ backgroundColor: "#60a5fa18", color: "#60a5fa" }}
								>
									<Server size={18} />
								</div>
								<h3 className="mb-3 text-sm font-semibold text-web-fg">
									One entry point
								</h3>
								<p className="text-sm leading-relaxed text-web-muted">
									API, dashboard, Torznab feeds, and background workers all run
									through a single docker-compose.yaml on one port: 7271. Postgres,
									Redis, and Meilisearch come bundled.
								</p>
							</div>
							<p
								className="relative mt-6 font-mono text-[11px] tracking-[0.15em] uppercase"
								style={{ color: "#60a5fa60" }}
							>
								Port 7271
							</p>
						</div>
					</StaggerItem>

					{/* Top right */}
					<StaggerItem className="md:col-span-2">
						<BentoCard
							icon={DatabaseZap}
							title="Migrations on boot"
							body="Migrations live in the repo and run automatically at startup. No manual psql sessions, no scripts to remember."
							color="#34d399"
						/>
					</StaggerItem>

					{/* Bottom right */}
					<StaggerItem className="md:col-span-2">
						<BentoCard
							icon={Boxes}
							title="Multi-arch native builds"
							body="Pre-built for linux/amd64 and linux/arm64. Runs identically on your x86 tower or a Raspberry Pi 5."
							color="#f59e0b"
							tag="amd64 · arm64"
						/>
					</StaggerItem>
				</Stagger>
			</div>
		</section>
	);
}
