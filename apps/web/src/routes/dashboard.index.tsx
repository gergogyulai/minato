import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	Boxes,
	Database,
	Layers,
	ShieldBan,
	Sparkles,
	Users as UsersIcon,
} from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { PageHeader } from "@/components/admin/page-header";
import {
	scraperStateLabel,
	scraperStateTone,
} from "@/components/admin/scraper-state";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/")({
	component: OverviewPage,
});

const fmt = (n: number) => n.toLocaleString();

function Panel({
	title,
	description,
	children,
	className = "",
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`rounded-xl border border-border bg-card p-5 ${className}`}
		>
			<div className="mb-4 space-y-0.5">
				<h2 className="font-semibold text-foreground text-sm">{title}</h2>
				{description && (
					<p className="text-muted-foreground text-xs">{description}</p>
				)}
			</div>
			{children}
		</section>
	);
}

function OverviewPage() {
	const stats = useQuery(orpc.stats.overview.queryOptions());
	const activity = useQuery(
		orpc.stats.ingestActivity.queryOptions({ input: { days: 30 } }),
	);
	const queues = useQuery(orpc.queues.status.queryOptions());
	const scrapers = useQuery(orpc.scraper.list.queryOptions());

	const s = stats.data;
	const enrichedPct =
		s && s.torrents.total > 0
			? Math.round((s.torrents.enriched / s.torrents.total) * 100)
			: 0;

	return (
		<div>
			<PageHeader
				title="Overview"
				description="A live snapshot of your Minato instance — ingest health, indexing pipeline, and sources."
			/>

			{/* Stat cards */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard
					label="Torrents"
					value={s ? fmt(s.torrents.total) : "—"}
					sublabel={s ? `${fmt(s.torrents.pending)} pending index` : undefined}
					icon={Database}
					accent
				/>
				<StatCard
					label="Enriched"
					value={s ? `${enrichedPct}%` : "—"}
					sublabel={s ? `${fmt(s.torrents.enriched)} with metadata` : undefined}
					icon={Sparkles}
					accent
				/>
				<StatCard
					label="Scrapers"
					value={s ? `${s.scrapers.running}/${s.scrapers.total}` : "—"}
					sublabel={s ? `${s.scrapers.enabled} enabled` : undefined}
					icon={Boxes}
					accent
				/>
				<StatCard
					label="Users"
					value={s ? fmt(s.users.total) : "—"}
					sublabel={s ? `${s.users.admins} admin` : undefined}
					icon={UsersIcon}
					accent
				/>
			</div>

			{/* Chart + queues */}
			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Panel
					title="Ingest activity"
					description="Torrents added per day, last 30 days"
					className="lg:col-span-2"
				>
					<div className="h-56 w-full">
						{activity.data && (
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart
									data={activity.data.points}
									margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
								>
									<defs>
										<linearGradient id="ingestFill" x1="0" y1="0" x2="0" y2="1">
											<stop
												offset="0%"
												stopColor="var(--primary)"
												stopOpacity={0.35}
											/>
											<stop
												offset="100%"
												stopColor="var(--primary)"
												stopOpacity={0}
											/>
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="var(--border)"
										vertical={false}
									/>
									<XAxis
										dataKey="date"
										tickFormatter={(v: string) => v.slice(5)}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
										tickLine={false}
										axisLine={false}
										minTickGap={24}
									/>
									<YAxis
										allowDecimals={false}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
										tickLine={false}
										axisLine={false}
										width={44}
									/>
									<Tooltip
										cursor={{ stroke: "var(--border)" }}
										contentStyle={{
											background: "var(--popover)",
											border: "1px solid var(--border)",
											borderRadius: "0.625rem",
											fontSize: "12px",
											color: "var(--popover-foreground)",
										}}
										labelStyle={{ color: "var(--muted-foreground)" }}
									/>
									<Area
										type="monotone"
										dataKey="count"
										stroke="var(--primary)"
										strokeWidth={2}
										fill="url(#ingestFill)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						)}
						{activity.isLoading && (
							<div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />
						)}
					</div>
				</Panel>

				<Panel title="Pipeline queues" description="BullMQ workers">
					<div className="space-y-3">
						{queues.data?.queues.map((q) => (
							<div
								key={q.name}
								className="rounded-lg border border-border/70 bg-background/40 p-3"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium text-foreground text-sm capitalize">
										{q.name}
									</span>
									{q.active > 0 ? (
										<StatusPill tone="success" dot pulse>
											{q.active} active
										</StatusPill>
									) : q.failed > 0 ? (
										<StatusPill tone="danger" dot>
											{q.failed} failed
										</StatusPill>
									) : (
										<StatusPill tone="neutral" dot>
											idle
										</StatusPill>
									)}
								</div>
								<div className="mt-2 flex gap-4 text-muted-foreground text-xs">
									<span>
										<span className="text-foreground tabular-nums">
											{fmt(q.waiting)}
										</span>{" "}
										waiting
									</span>
									<span>
										<span className="text-foreground tabular-nums">
											{fmt(q.delayed)}
										</span>{" "}
										delayed
									</span>
									<span>
										<span className="text-foreground tabular-nums">
											{fmt(q.completed)}
										</span>{" "}
										done
									</span>
								</div>
							</div>
						))}
						{queues.isLoading &&
							[0, 1, 2].map((i) => (
								<div
									key={i}
									className="h-16 animate-pulse rounded-lg bg-muted/40"
								/>
							))}
						{queues.isError && (
							<p className="text-muted-foreground text-xs">
								Queue metrics unavailable (Redis offline).
							</p>
						)}
					</div>
				</Panel>
			</div>

			{/* Scrapers + library breakdown */}
			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Panel title="Scraper health" className="lg:col-span-2">
					<div className="divide-y divide-border">
						{scrapers.data?.scrapers.length === 0 && (
							<p className="py-2 text-muted-foreground text-sm">
								No scrapers installed yet.
							</p>
						)}
						{scrapers.data?.scrapers.map((sc) => {
							const total = sc.status?.progressTotal ?? 0;
							const current = sc.status?.progressCurrent ?? 0;
							const pct =
								total > 0 ? Math.round((current / total) * 100) : null;
							return (
								<div
									key={sc.id}
									className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
								>
									<div className="min-w-0">
										<p className="truncate font-medium text-foreground text-sm">
											{sc.name}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{pct !== null
												? `${pct}% · ${fmt(current)}/${fmt(total)}`
												: (sc.status?.message ?? "No activity reported")}
										</p>
									</div>
									<StatusPill
										tone={scraperStateTone(sc.state)}
										dot
										pulse={sc.state === "running"}
									>
										{scraperStateLabel(sc.state)}
									</StatusPill>
								</div>
							);
						})}
						{scrapers.isLoading &&
							[0, 1].map((i) => (
								<div key={i} className="py-3">
									<div className="h-9 animate-pulse rounded-lg bg-muted/40" />
								</div>
							))}
					</div>
				</Panel>

				<Panel title="Library">
					<dl className="space-y-3">
						<div className="flex items-center justify-between text-sm">
							<dt className="flex items-center gap-2 text-muted-foreground">
								<Layers className="size-4" /> Content types
							</dt>
							<dd className="text-foreground tabular-nums">
								{s ? s.byType.length : "—"}
							</dd>
						</div>
						<div className="flex items-center justify-between text-sm">
							<dt className="flex items-center gap-2 text-muted-foreground">
								<Activity className="size-4" /> Pending index
							</dt>
							<dd className="text-foreground tabular-nums">
								{s ? fmt(s.torrents.pending) : "—"}
							</dd>
						</div>
						<div className="flex items-center justify-between text-sm">
							<dt className="flex items-center gap-2 text-muted-foreground">
								<ShieldBan className="size-4" /> Blacklisted
							</dt>
							<dd className="text-foreground tabular-nums">
								{s ? fmt(s.blacklist.torrents + s.blacklist.trackers) : "—"}
							</dd>
						</div>
					</dl>

					{s && s.byType.length > 0 && (
						<div className="mt-5 space-y-2 border-border border-t pt-4">
							{[...s.byType]
								.sort((a, b) => b.count - a.count)
								.slice(0, 5)
								.map((t) => {
									const max = Math.max(...s.byType.map((x) => x.count));
									return (
										<div key={t.type}>
											<div className="mb-1 flex justify-between text-xs">
												<span className="text-muted-foreground capitalize">
													{t.type}
												</span>
												<span className="text-foreground tabular-nums">
													{fmt(t.count)}
												</span>
											</div>
											<div className="h-1.5 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full bg-primary/70"
													style={{
														width: `${max > 0 ? (t.count / max) * 100 : 0}%`,
													}}
												/>
											</div>
										</div>
									);
								})}
						</div>
					)}
				</Panel>
			</div>
		</div>
	);
}
