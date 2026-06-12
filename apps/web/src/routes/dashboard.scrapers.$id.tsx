import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	CalendarClock,
	CloudDownload,
	Info,
	Loader2,
	Pause,
	Play,
	ScrollText,
	Settings2,
	Square,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { ScraperConfigDialog } from "@/components/admin/scraper-config-dialog";
import { ScraperScheduleDialog } from "@/components/admin/scraper-schedule-dialog";
import {
	scraperStateLabel,
	scraperStateTone,
} from "@/components/admin/scraper-state";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/scrapers/$id")({
	loader: async ({ params, context: { queryClient } }) => {
		try {
			return await queryClient.ensureQueryData(
				orpc.scraper.get.queryOptions({ input: { id: params.id } }),
			);
		} catch {
			return null;
		}
	},
	component: ScraperDetailPage,
});

type Scraper = Awaited<ReturnType<typeof client.scraper.get>>;

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
		<section className={`rounded-xl border border-border/60 bg-card p-5 ${className}`}>
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

const fmt = (n: number) => n.toLocaleString();

function humanCron(expr: string): string {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return expr;
	const [min, hour, dom, month, dow] = parts;

	const every = (field: string) => field === "*" || field === "*/1";
	const everyN = (field: string) => field.startsWith("*/") ? Number(field.slice(2)) : null;

	// Every N minutes
	if (every(hour) && every(dom) && every(month) && every(dow)) {
		const n = everyN(min);
		if (n !== null) return `Every ${n} minutes`;
		if (every(min)) return "Every minute";
		return `At minute ${min} of every hour`;
	}

	// Hourly
	if (every(dom) && every(month) && every(dow)) {
		const n = everyN(hour);
		if (n !== null) {
			const suffix = min === "0" || every(min) ? "" : ` at minute ${min}`;
			return `Every ${n} hours${suffix}`;
		}
		const minuteStr = every(min) ? "0" : min;
		if (!hour.includes(",") && !hour.includes("-")) {
			return `Daily at ${hour.padStart(2, "0")}:${minuteStr.padStart(2, "0")}`;
		}
	}

	// Daily at specific time
	if (!hour.includes("*") && !min.includes("*") && every(dom) && every(month) && every(dow)) {
		const minuteStr = min.padStart(2, "0");
		return `Daily at ${hour.padStart(2, "0")}:${minuteStr}`;
	}

	// Weekly on specific days
	const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	if (!hour.includes("*") && !min.includes("*") && every(dom) && every(month) && !every(dow)) {
		const days = dow.split(",").map((d) => dayNames[Number(d)] ?? d).join(", ");
		return `Weekly on ${days} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
	}

	// Monthly
	if (!hour.includes("*") && !min.includes("*") && !dom.includes("*") && every(month) && every(dow)) {
		return `Monthly on day ${dom} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
	}

	return expr;
}

function ScraperDetailPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const scraperQ = useQuery({
		...orpc.scraper.get.queryOptions({ input: { id } }),
		refetchInterval: 3_000,
	});
	const statsQ = useQuery({
		...orpc.scraper.stats.queryOptions({ input: { id, hours: 48 } }),
		refetchInterval: 10_000,
	});

	const sc = scraperQ.data;

	if (scraperQ.isLoading) {
		return (
			<div>
				<div className="mb-6 h-4 w-24 animate-pulse rounded bg-muted/40" />
				<div className="mb-8 h-10 w-64 animate-pulse rounded-lg bg-muted/30" />
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />
					))}
				</div>
			</div>
		);
	}

	if (!sc) {
		return (
			<div>
				<Link
					to="/dashboard/scrapers"
					className="mb-8 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" /> Scrapers
				</Link>
				<EmptyState
					icon={ScrollText}
					title="Scraper not found"
					description="This scraper may have been removed."
					action={
						<Button asChild variant="outline">
							<Link to="/dashboard/scrapers">Back to scrapers</Link>
						</Button>
					}
				/>
			</div>
		);
	}

	return <ScraperDetail scraper={sc} statsQ={statsQ} onChanged={() => scraperQ.refetch()} onRemoved={() => navigate({ to: "/dashboard/scrapers" })} />;
}

function ScraperDetail({
	scraper: sc,
	statsQ,
	onChanged,
	onRemoved,
}: {
	scraper: Scraper;
	statsQ: ReturnType<typeof useQuery<Awaited<ReturnType<typeof client.scraper.stats>>>>;
	onChanged: () => void;
	onRemoved: () => void;
}) {
	const [busy, setBusy] = useState<string | null>(null);
	const [infoOpen, setInfoOpen] = useState(false);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [removeOpen, setRemoveOpen] = useState(false);

	const isSidecar = sc.kind === "sidecar";
	const isRunning = isSidecar ? sc.live : sc.state === "running";
	const removable = sc.source.kind !== "first_party";
	const effectiveSchedule = sc.schedule ?? sc.recommendedSchedule;

	const total = sc.status?.progressTotal ?? 0;
	const current = sc.status?.progressCurrent ?? 0;
	const pct = total > 0 ? Math.round((current / total) * 100) : null;

	const y = statsQ.data?.yield;
	const activity = statsQ.data?.activity ?? [];

	async function run(key: string, fn: () => Promise<unknown>, ok: string) {
		setBusy(key);
		try {
			await fn();
			toast.success(ok);
			onChanged();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action failed");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div>
			<Link
				to="/dashboard/scrapers"
				className="mb-8 inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
			>
				<ArrowLeft className="size-3.5" /> Scrapers
			</Link>

			{/* Header with ambient glow when running */}
			<div
				className="transition-all duration-700"
				style={
					isRunning
						? {
								background:
									"radial-gradient(ellipse 800px 180px at 50% -20px, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
							}
						: undefined
				}
			>
				<PageHeader
					eyebrow="dashboard // scraper"
					title={sc.manifest.title ?? sc.name}
					description={`${sc.id} · v${sc.installedVersion}`}
					actions={
						<div className="flex items-center gap-3">
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setInfoOpen(true)}
								className="gap-1.5 text-muted-foreground"
							>
								<Info className="size-4" /> About
							</Button>
							{!isSidecar && (
								<>
									<span className="text-muted-foreground text-xs">
										{sc.enabled ? "Enabled" : "Disabled"}
									</span>
									<Switch
										checked={sc.enabled}
										disabled={busy !== null}
										onCheckedChange={(enabled) =>
											run(
												"enable",
												() => client.scraper.setEnabled({ id: sc.id, enabled }),
												enabled ? "Scraper enabled" : "Scraper disabled",
											)
										}
									/>
								</>
							)}
						</div>
					}
				/>

				{/* Metadata row */}
				<div className="mb-6 -mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-xs">
					{isSidecar ? (
						<StatusPill tone={sc.live ? "success" : "neutral"} dot pulse={sc.live}>
							{sc.live ? "Live" : "Offline"}
						</StatusPill>
					) : (
						<StatusPill
							tone={scraperStateTone(sc.state)}
							dot
							pulse={isRunning}
						>
							{scraperStateLabel(sc.state)}
						</StatusPill>
					)}
					<span aria-hidden>·</span>
					<span className="capitalize">{sc.source.kind.replace("_", " ")}</span>
					{effectiveSchedule && (
						<>
							<span aria-hidden>·</span>
							<span title={effectiveSchedule}>{humanCron(effectiveSchedule)}</span>
						</>
					)}
					{sc.lastSeenAt && (
						<>
							<span aria-hidden>·</span>
							<span>
								Last seen{" "}
								{new Date(sc.lastSeenAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</>
					)}
				</div>
			</div>

			{/* Yield stat cards */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard
					label="Total yield"
					value={y ? fmt(y.total) : "—"}
					sublabel="All time"
					accent
				/>
				<StatCard
					label="Last 24h"
					value={y ? fmt(y.last24h) : "—"}
					sublabel="Torrents added"
					accent
				/>
				<StatCard
					label="Last 48h"
					value={y ? fmt(y.last48h) : "—"}
					sublabel="Torrents added"
					accent
				/>
				<StatCard
					label="Last 7 days"
					value={y ? fmt(y.last7d) : "—"}
					sublabel="Torrents added"
					accent
				/>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				{/* Activity chart */}
				<Panel
					title="Ingest activity"
					description="Torrents added per hour, last 48 hours"
					className="lg:col-span-2"
				>
					<div className="h-48 w-full">
						{activity.length > 0 && (
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart
									data={activity}
									margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
								>
									<defs>
										<linearGradient id="scraperActivityFill" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
											<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="var(--border)"
										vertical={false}
									/>
									<XAxis
										dataKey="date"
										tickFormatter={(v: string) => v.slice(11, 16)}
										tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
										tickLine={false}
										axisLine={false}
										minTickGap={32}
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
										fill="url(#scraperActivityFill)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						)}
						{statsQ.isLoading && (
							<div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />
						)}
						{!statsQ.isLoading && activity.length === 0 && (
							<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
								No activity data
							</div>
						)}
					</div>
				</Panel>

				{/* By-type breakdown */}
				<Panel title="By type" description="All-time yield by content kind">
					{statsQ.isLoading && (
						<div className="space-y-2">
							{[0, 1, 2].map((i) => (
								<div key={i} className="h-7 animate-pulse rounded-md bg-muted/40" />
							))}
						</div>
					)}
					{!statsQ.isLoading && (!y?.byType || y.byType.length === 0) && (
						<p className="text-muted-foreground text-sm">No data yet.</p>
					)}
					{y?.byType && y.byType.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{(y.byType as { type: string; count: number }[]).map((item, i) => (
								<span
									key={item.type}
									className={[
										"rounded-md border px-2.5 py-1 text-xs font-medium",
										i === 0
											? "border-primary/30 bg-primary/10 text-primary"
											: "border-border bg-muted/40 text-foreground",
									].join(" ")}
								>
									{item.type} <span className="tabular-nums">{fmt(item.count)}</span>
								</span>
							))}
						</div>
					)}
				</Panel>
			</div>

			{/* Controls */}
			<Panel title="Controls" className="mt-4">
				<div className="flex flex-wrap items-center gap-2">
					{(isSidecar ? sc.live : sc.state === "running") && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy !== null}
							onClick={() =>
								run(
									"pause",
									() => client.scraper.issueCommand({ id: sc.id, command: "pause" }),
									"Pause requested",
								)
							}
							className="gap-1.5"
						>
							<Pause className="size-3.5" /> Pause
						</Button>
					)}
					{(isSidecar ? sc.live : sc.state === "paused") && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy !== null}
							onClick={() =>
								run(
									"resume",
									() => client.scraper.issueCommand({ id: sc.id, command: "resume" }),
									"Resume requested",
								)
							}
							className="gap-1.5"
						>
							<Play className="size-3.5" /> Resume
						</Button>
					)}
					{(isSidecar
						? sc.live
						: sc.state === "running" || sc.state === "paused") && (
						<Button
							size="sm"
							variant="outline"
							disabled={busy !== null}
							onClick={() =>
								run(
									"stop",
									() => client.scraper.issueCommand({ id: sc.id, command: "stop" }),
									"Stop requested",
								)
							}
							className="gap-1.5"
						>
							<Square className="size-3.5" /> Stop
						</Button>
					)}
					{!isSidecar &&
						(sc.state === "ready" ||
							sc.state === "scheduled" ||
							sc.state === "stopped" ||
							sc.state === "error") &&
						sc.enabled && (
							<Button
								size="sm"
								variant="outline"
								disabled={busy !== null}
								onClick={() =>
									run(
										"run",
										() => client.scraper.runNow({ id: sc.id }),
										"Scraper triggered",
									)
								}
								className="gap-1.5"
							>
								{busy === "run" ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Play className="size-3.5" />
								)}
								Run Now
							</Button>
						)}

					{!isSidecar && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setScheduleOpen(true)}
							className="gap-1.5 text-muted-foreground"
						>
							<CalendarClock className="size-3.5" /> Schedule
						</Button>
					)}
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setConfigOpen(true)}
						className="gap-1.5 text-muted-foreground"
					>
						<Settings2 className="size-3.5" /> Config
					</Button>

					{removable && (
						<>
							<div className="flex-1" />
							{!isSidecar && (
								<Button
									size="sm"
									variant="ghost"
									disabled={busy !== null}
									onClick={() =>
										run(
											"update",
											() => client.scraper.update({ id: sc.id }),
											"Update pulled",
										)
									}
									className="gap-1.5 text-muted-foreground"
								>
									{busy === "update" ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<CloudDownload className="size-3.5" />
									)}
									Update
								</Button>
							)}
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setRemoveOpen(true)}
								className="gap-1.5 text-red-600 hover:text-red-600 dark:text-red-400"
							>
								<Trash2 className="size-3.5" /> Remove
							</Button>
						</>
					)}
				</div>

				{pct !== null && (
					<div className="mt-4">
						<div className="mb-1 flex justify-between text-muted-foreground text-xs">
							<span>{sc.status?.message ?? "Working"}</span>
							<span className="tabular-nums">
								{current.toLocaleString()} / {total.toLocaleString()} ({pct}%)
							</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${pct}%` }}
							/>
						</div>
					</div>
				)}

				{sc.lastError && (
					<p className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-600 text-xs dark:text-red-400">
						{sc.lastError}
					</p>
				)}
			</Panel>

			{/* Logs placeholder */}
			<Panel title="Logs" description="Per-scraper log stream" className="mt-4">
				<EmptyState
					icon={ScrollText}
					title="No logs yet"
					description="Per-scraper log collection is not implemented yet."
				/>
			</Panel>

			<ScraperInfoDialog open={infoOpen} onOpenChange={setInfoOpen} scraper={sc} />
			<ScraperScheduleDialog
				open={scheduleOpen}
				onOpenChange={setScheduleOpen}
				scraper={sc}
				onSaved={onChanged}
			/>
			<ScraperConfigDialog
				open={configOpen}
				onOpenChange={setConfigOpen}
				scraper={sc}
				onSaved={onChanged}
			/>
			<ConfirmDialog
				open={removeOpen}
				onOpenChange={setRemoveOpen}
				title={`Remove ${sc.name}?`}
				description={
					isSidecar
						? "This revokes the sidecar's API key and removes it from the dashboard. The container itself keeps running until you stop it."
						: "This stops the scraper, deletes its source code, and revokes its API key. This cannot be undone."
				}
				confirmLabel="Remove"
				destructive
				loading={busy === "remove"}
				onConfirm={() =>
					run(
						"remove",
						() => client.scraper.remove({ id: sc.id }),
						"Scraper removed",
					).then(() => onRemoved())
				}
			/>
		</div>
	);
}

function InfoRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-[7rem_1fr] items-start gap-2">
			<span className="pt-0.5 text-muted-foreground text-xs">{label}</span>
			<span className="min-w-0 break-all text-sm">{children}</span>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="space-y-2">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
				{title}
			</p>
			<div className="space-y-2">{children}</div>
		</div>
	);
}

function ScraperInfoDialog({
	open,
	onOpenChange,
	scraper: sc,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	scraper: Scraper;
}) {
	const m = sc.manifest;
	const effectiveType = sc.lifecycle ?? m.scraperType;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{m.title ?? sc.name}</DialogTitle>
					<DialogDescription className="font-mono">{sc.id}</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
					<Section title="Identity">
						{m.title && m.title !== sc.name && (
							<InfoRow label="Package name">{sc.name}</InfoRow>
						)}
						<InfoRow label="Version">
							<span className="font-mono">v{m.version}</span>
						</InfoRow>
						{m.author && <InfoRow label="Author">{m.author}</InfoRow>}
					</Section>

					<Section title="Runtime">
						{effectiveType && (
							<InfoRow label="Type">
								<span className="capitalize">{effectiveType}</span>
							</InfoRow>
						)}
						{m.capabilities.length > 0 && (
							<InfoRow label="Capabilities">
								<div className="flex flex-wrap gap-1">
									{m.capabilities.map((cap) => (
										<span
											key={cap}
											className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
										>
											{cap}
										</span>
									))}
								</div>
							</InfoRow>
						)}
					</Section>

					<Section title="Source">
						<InfoRow label="Kind">
							<span className="capitalize">{sc.source.kind.replace("_", " ")}</span>
						</InfoRow>
						{sc.source.kind === "git" && (
							<>
								<InfoRow label="Repository">
									<span className="font-mono text-xs">{sc.source.url}</span>
								</InfoRow>
								{sc.source.ref && (
									<InfoRow label="Ref">
										<span className="font-mono text-xs">{sc.source.ref}</span>
									</InfoRow>
								)}
							</>
						)}
						{sc.source.kind === "registry" && (
							<InfoRow label="Slug">
								<span className="font-mono text-xs">{sc.source.slug}</span>
							</InfoRow>
						)}
					</Section>

					{(sc.recommendedSchedule ?? sc.schedule) && (
						<Section title="Schedule">
							{sc.recommendedSchedule && (
								<InfoRow label="Recommended">
									<span>{humanCron(sc.recommendedSchedule)}</span>
									<span className="mt-0.5 block font-mono text-muted-foreground text-xs">{sc.recommendedSchedule}</span>
								</InfoRow>
							)}
							{sc.schedule && (
								<InfoRow label="Override">
									<span>{humanCron(sc.schedule)}</span>
									<span className="mt-0.5 block font-mono text-muted-foreground text-xs">{sc.schedule}</span>
								</InfoRow>
							)}
						</Section>
					)}

					{m.defaultConfig && Object.keys(m.defaultConfig).length > 0 && (
						<Section title="Default config">
							{Object.entries(m.defaultConfig).map(([key, val]) => (
								<InfoRow key={key} label={key}>
									<span className="font-mono text-xs">{JSON.stringify(val)}</span>
								</InfoRow>
							))}
						</Section>
					)}

					<Section title="Installation">
						<InfoRow label="Installed">
							{new Date(sc.installedAt).toLocaleString()}
						</InfoRow>
						<InfoRow label="Last updated">
							{new Date(sc.updatedAt).toLocaleString()}
						</InfoRow>
						{sc.lastSeenAt && (
							<InfoRow label="Last seen">
								{new Date(sc.lastSeenAt).toLocaleString()}
							</InfoRow>
						)}
					</Section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
