import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Boxes,
	CloudDownload,
	Loader2,
	Pause,
	Play,
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
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/scrapers/")({
	component: ScrapersPage,
});

type Scraper = Awaited<
	ReturnType<typeof client.scraper.list>
>["scrapers"][number];

function ScrapersPage() {
	const scrapers = useQuery({ ...orpc.scraper.list.queryOptions(), refetchInterval: 2_000 });
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
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-52 animate-pulse rounded-xl border border-border bg-muted/30"
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

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
		<div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
			{/* Clickable body */}
			<Link
				to="/dashboard/scrapers/$id"
				params={{ id: sc.id }}
				className="flex flex-1 flex-col gap-4 p-6 transition-colors hover:bg-muted/40"
			>
				{/* Header */}
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex flex-wrap items-center gap-2">
							<h3 className="truncate font-semibold text-base text-foreground transition-colors group-hover:text-primary">
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
						<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground text-xs">
							<span className="font-mono">{sc.id}</span>
							<span aria-hidden className="opacity-40">·</span>
							<span>v{sc.installedVersion}</span>
							<span aria-hidden className="opacity-40">·</span>
							<span className="capitalize">{sc.source.kind.replace("_", " ")}</span>
						</p>
					</div>

					{/* Stop propagation so the switch doesn't navigate */}
					<div onClick={(e) => e.preventDefault()}>
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

				{/* Progress */}
				{pct !== null && (
					<div className="space-y-1.5">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span className="truncate pr-2">{sc.status?.message ?? "Working"}</span>
							<span className="shrink-0 font-mono tabular-nums">{pct}%</span>
						</div>
						<div className="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all duration-300"
								style={{ width: `${pct}%` }}
							/>
						</div>
						<p className="text-right text-muted-foreground/70 text-xs tabular-nums">
							{current.toLocaleString()} / {total.toLocaleString()}
						</p>
					</div>
				)}

				{/* Error */}
				{sc.lastError && (
					<p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-600 text-xs dark:text-red-400">
						{sc.lastError}
					</p>
				)}

				{/* Spacer to anchor footer */}
				<div className="flex-1" />
			</Link>

			{/* Footer actions */}
			<div className="flex flex-wrap items-center gap-1.5 border-border border-t bg-muted/20 px-4 py-3">
				{sc.state === "running" && (
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
						className="h-7 gap-1.5 text-xs"
					>
						<Pause className="size-3" /> Pause
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
								() => client.scraper.issueCommand({ id: sc.id, command: "resume" }),
								"Resume requested",
							)
						}
						className="h-7 gap-1.5 text-xs"
					>
						<Play className="size-3" /> Resume
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
								() => client.scraper.issueCommand({ id: sc.id, command: "stop" }),
								"Stop requested",
							)
						}
						className="h-7 gap-1.5 text-xs"
					>
						<Square className="size-3" /> Stop
					</Button>
				)}
				{(sc.state === "ready" ||
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
							className="h-7 gap-1.5 text-xs"
						>
							{busy === "run" ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<Play className="size-3" />
							)}
							Run Now
						</Button>
					)}

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
							className="h-7 gap-1.5 text-muted-foreground text-xs"
						>
							{busy === "update" ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<CloudDownload className="size-3" />
							)}
							Update
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setRemoveOpen(true)}
							className="h-7 gap-1.5 text-red-600 text-xs hover:text-red-600 dark:text-red-400"
						>
							<Trash2 className="size-3" /> Remove
						</Button>
					</>
				)}

			</div>

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
