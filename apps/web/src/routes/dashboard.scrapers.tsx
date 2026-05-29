import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Boxes,
	CalendarClock,
	CloudDownload,
	Loader2,
	Pause,
	Play,
	Settings2,
	Square,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import {
	scraperStateLabel,
	scraperStateTone,
} from "@/components/admin/scraper-state";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/scrapers")({
	component: ScrapersPage,
});

type Scraper = Awaited<
	ReturnType<typeof client.scraper.list>
>["scrapers"][number];

function ScrapersPage() {
	const scrapers = useQuery(orpc.scraper.list.queryOptions());
	const [installOpen, setInstallOpen] = useState(false);

	return (
		<div>
			<PageHeader
				title="Scrapers"
				description="Control the indexers feeding your library — schedules, runtime state, and configuration."
				actions={
					<Button onClick={() => setInstallOpen(true)} className="gap-2">
						<CloudDownload className="size-4" />
						Install
					</Button>
				}
			/>

			{scrapers.isLoading && (
				<div className="space-y-4">
					{[0, 1].map((i) => (
						<div
							key={i}
							className="h-32 animate-pulse rounded-xl border border-border bg-muted/30"
						/>
					))}
				</div>
			)}

			{scrapers.data?.scrapers.length === 0 && (
				<EmptyState
					icon={Boxes}
					title="No scrapers installed"
					description="Install a community scraper from a Git URL to start indexing."
					action={
						<Button onClick={() => setInstallOpen(true)} className="gap-2">
							<CloudDownload className="size-4" />
							Install scraper
						</Button>
					}
				/>
			)}

			<div className="space-y-4">
				{scrapers.data?.scrapers.map((sc) => (
					<ScraperCard
						key={sc.id}
						scraper={sc}
						onChange={() => scrapers.refetch()}
					/>
				))}
			</div>

			<InstallDialog
				open={installOpen}
				onOpenChange={setInstallOpen}
				onInstalled={() => scrapers.refetch()}
			/>
		</div>
	);
}

function ScraperCard({
	scraper: sc,
	onChange,
}: {
	scraper: Scraper;
	onChange: () => void;
}) {
	const [busy, setBusy] = useState<string | null>(null);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [removeOpen, setRemoveOpen] = useState(false);

	const total = sc.status?.progressTotal ?? 0;
	const current = sc.status?.progressCurrent ?? 0;
	const pct = total > 0 ? Math.round((current / total) * 100) : null;
	const removable = sc.source.kind !== "first_party";

	async function run(key: string, fn: () => Promise<unknown>, ok: string) {
		setBusy(key);
		try {
			await fn();
			toast.success(ok);
			onChange();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Action failed");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2.5">
						<h3 className="truncate font-semibold text-base text-foreground">
							{sc.name}
						</h3>
						<StatusPill
							tone={scraperStateTone(sc.state)}
							dot
							pulse={sc.state === "running"}
						>
							{scraperStateLabel(sc.state)}
						</StatusPill>
					</div>
					<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
						<span className="font-mono">{sc.id}</span>
						<span aria-hidden>·</span>
						<span>v{sc.installedVersion}</span>
						<span aria-hidden>·</span>
						<span className="capitalize">
							{sc.source.kind.replace("_", " ")}
						</span>
						{sc.schedule && (
							<>
								<span aria-hidden>·</span>
								<span className="font-mono">{sc.schedule}</span>
							</>
						)}
					</p>
				</div>

				<div className="flex items-center gap-3">
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
				</div>
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

			<div className="mt-4 flex flex-wrap items-center gap-2 border-border border-t pt-4">
				{sc.state === "running" && (
					<Button
						size="sm"
						variant="outline"
						disabled={busy !== null}
						onClick={() =>
							run(
								"pause",
								() =>
									client.scraper.issueCommand({ id: sc.id, command: "pause" }),
								"Pause requested",
							)
						}
						className="gap-1.5"
					>
						<Pause className="size-3.5" /> Pause
					</Button>
				)}
				{sc.state === "paused" && (
					<Button
						size="sm"
						variant="outline"
						disabled={busy !== null}
						onClick={() =>
							run(
								"resume",
								() =>
									client.scraper.issueCommand({ id: sc.id, command: "resume" }),
								"Resume requested",
							)
						}
						className="gap-1.5"
					>
						<Play className="size-3.5" /> Resume
					</Button>
				)}
				{(sc.state === "running" || sc.state === "paused") && (
					<Button
						size="sm"
						variant="outline"
						disabled={busy !== null}
						onClick={() =>
							run(
								"stop",
								() =>
									client.scraper.issueCommand({ id: sc.id, command: "stop" }),
								"Stop requested",
							)
						}
						className="gap-1.5"
					>
						<Square className="size-3.5" /> Stop
					</Button>
				)}

				<Button
					size="sm"
					variant="ghost"
					onClick={() => setScheduleOpen(true)}
					className="gap-1.5 text-muted-foreground"
				>
					<CalendarClock className="size-3.5" /> Schedule
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setConfigOpen(true)}
					className="gap-1.5 text-muted-foreground"
				>
					<Settings2 className="size-3.5" /> Config
				</Button>

				<div className="flex-1" />

				{removable && (
					<>
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

			<ScheduleDialog
				open={scheduleOpen}
				onOpenChange={setScheduleOpen}
				scraper={sc}
				onSaved={onChange}
			/>
			<ConfigDialog
				open={configOpen}
				onOpenChange={setConfigOpen}
				scraper={sc}
				onSaved={onChange}
			/>
			<ConfirmDialog
				open={removeOpen}
				onOpenChange={setRemoveOpen}
				title={`Remove ${sc.name}?`}
				description="This stops the scraper, deletes its source code, and revokes its API key. This cannot be undone."
				confirmLabel="Remove"
				destructive
				loading={busy === "remove"}
				onConfirm={() =>
					run(
						"remove",
						() => client.scraper.remove({ id: sc.id }),
						"Scraper removed",
					).then(() => setRemoveOpen(false))
				}
			/>
		</div>
	);
}

function ScheduleDialog({
	open,
	onOpenChange,
	scraper,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	scraper: Scraper;
	onSaved: () => void;
}) {
	const [value, setValue] = useState(scraper.schedule ?? "");
	const [saving, setSaving] = useState(false);

	async function save() {
		setSaving(true);
		try {
			await client.scraper.updateSchedule({
				id: scraper.id,
				schedule: value.trim() === "" ? null : value.trim(),
			});
			toast.success("Schedule updated");
			onSaved();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Invalid schedule");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Schedule</DialogTitle>
					<DialogDescription>
						Five-field UTC cron expression. Leave empty to clear the schedule.
						{scraper.recommendedSchedule && (
							<>
								{" "}
								Recommended:{" "}
								<span className="font-mono text-foreground">
									{scraper.recommendedSchedule}
								</span>
							</>
						)}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-1.5">
					<Label htmlFor="cron">Cron expression</Label>
					<Input
						id="cron"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder="0 */6 * * *"
						className="font-mono"
					/>
				</div>
				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={save} disabled={saving} className="min-w-24">
						{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ConfigDialog({
	open,
	onOpenChange,
	scraper,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	scraper: Scraper;
	onSaved: () => void;
}) {
	const [value, setValue] = useState(() =>
		JSON.stringify(scraper.config ?? {}, null, 2),
	);
	const [saving, setSaving] = useState(false);

	async function save() {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(value);
		} catch {
			toast.error("Config must be valid JSON");
			return;
		}
		setSaving(true);
		try {
			await client.scraper.updateConfig({ id: scraper.id, config: parsed });
			toast.success("Configuration saved");
			onSaved();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save config");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Configuration</DialogTitle>
					<DialogDescription>
						Override the scraper's default configuration. Edited as JSON.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					rows={12}
					spellCheck={false}
					className="font-mono text-xs"
				/>
				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={save} disabled={saving} className="min-w-24">
						{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function InstallDialog({
	open,
	onOpenChange,
	onInstalled,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	onInstalled: () => void;
}) {
	const [url, setUrl] = useState("");
	const [ref, setRef] = useState("");
	const [saving, setSaving] = useState(false);

	async function install() {
		setSaving(true);
		try {
			await client.scraper.installFromUrl({
				url: url.trim(),
				ref: ref.trim() === "" ? undefined : ref.trim(),
			});
			toast.success("Scraper installed");
			onInstalled();
			onOpenChange(false);
			setUrl("");
			setRef("");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Install failed");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Install scraper</DialogTitle>
					<DialogDescription>
						Clone a community scraper from a Git repository (GitHub, GitLab,
						Codeberg, or Bitbucket).
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="repo-url">Repository URL</Label>
						<Input
							id="repo-url"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://github.com/owner/scraper"
							className="font-mono text-sm"
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="repo-ref">Branch / tag (optional)</Label>
						<Input
							id="repo-ref"
							value={ref}
							onChange={(e) => setRef(e.target.value)}
							placeholder="main"
							className="font-mono text-sm"
						/>
					</div>
				</div>
				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={install}
						disabled={saving || url.trim() === ""}
						className="min-w-24"
					>
						{saving ? <Loader2 className="size-4 animate-spin" /> : "Install"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
