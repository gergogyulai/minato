import { humanId } from "human-id";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	AlertCircle,
	Bell,
	CalendarDays,
	CheckCircle2,
	FlaskConical,
	Loader2,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
} from "lucide-react";
import { type ElementType, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import {
	DiscordIcon,
	NtfyIcon,
	TelegramIcon,
} from "@/components/admin/channel-icons";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/notifications")({
	component: NotificationsPage,
});

type Channel = Awaited<
	ReturnType<typeof client.notifications.list>
>["channels"][number];

type ChannelType = "telegram" | "ntfy" | "discord";

// ---------------------------------------------------------------------------
// Channel + event metadata
// ---------------------------------------------------------------------------

const CHANNEL_CONFIG = {
	telegram: {
		label: "Telegram",
		icon: TelegramIcon,
		color: "text-sky-500",
		bg: "bg-sky-500/10",
		border: "border-sky-500/20",
		ring: "ring-sky-500/30",
	},
	ntfy: {
		label: "ntfy",
		icon: NtfyIcon,
		color: "text-green-500",
		bg: "bg-green-500/10",
		border: "border-green-500/20",
		ring: "ring-green-500/30",
	},
	discord: {
		label: "Discord",
		icon: DiscordIcon,
		color: "text-violet-500",
		bg: "bg-violet-500/10",
		border: "border-violet-500/20",
		ring: "ring-violet-500/30",
	},
} as const satisfies Record<
	ChannelType,
	{
		label: string;
		icon: ElementType;
		color: string;
		bg: string;
		border: string;
		ring: string;
	}
>;

const EVENT_CONFIG = {
	scraper_completed: {
		label: "Scraper completed",
		icon: CheckCircle2,
		color: "text-emerald-500",
	},
	scraper_failed: {
		label: "Scraper failed",
		icon: AlertCircle,
		color: "text-red-500",
	},
	scraper_state_changed: {
		label: "State changed",
		icon: Activity,
		color: "text-sky-500",
	},
	torrent_digest: {
		label: "Daily digest",
		icon: CalendarDays,
		color: "text-amber-500",
	},
	wanted_torrent_found: {
		label: "Wanted found",
		icon: Sparkles,
		color: "text-violet-500",
	},
} as const;

const ALL_EVENTS = Object.keys(EVENT_CONFIG) as (keyof typeof EVENT_CONFIG)[];

function generateNtfyTopic(): string {
	const num = 1000 + Math.floor(Math.random() * 9000);
	return `${humanId({ separator: "-", capitalize: false })}-${num}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function NotificationsPage() {
	const qc = useQueryClient();
	const channels = useQuery(orpc.notifications.list.queryOptions());
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
	const [testing, setTesting] = useState<string | null>(null);

	const deleteMutation = useMutation({
		mutationFn: (id: string) => client.notifications.delete({ id }),
		onSuccess: () => {
			toast.success("Channel deleted");
			setDeleteTarget(null);
			qc.invalidateQueries(orpc.notifications.list.queryOptions());
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed to delete"),
	});

	const toggleEnabled = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			client.notifications.update({ id, enabled }),
		onSuccess: () => qc.invalidateQueries(orpc.notifications.list.queryOptions()),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed to update"),
	});

	async function handleTest(id: string) {
		setTesting(id);
		try {
			await client.notifications.test({ id });
			toast.success("Test notification sent");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Test failed");
		} finally {
			setTesting(null);
		}
	}

	return (
		<div>
			<PageHeader
				eyebrow="dashboard // notifications"
				title="Notifications"
				description="Configure Telegram, ntfy, or Discord channels to receive alerts for scraper events."
				actions={
					<Button onClick={() => setCreateOpen(true)} className="gap-2">
						<Plus className="size-4" />
						Add channel
					</Button>
				}
			/>

			{/* Loading skeleton */}
			{channels.isLoading && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{[0, 1].map((i) => (
						<div
							key={i}
							className="h-48 animate-pulse rounded-xl border border-border bg-muted/30"
						/>
					))}
				</div>
			)}

			{/* Empty state */}
			{channels.data?.channels.length === 0 && (
				<EmptyState
					icon={Bell}
					title="No notification channels"
					description="Add a Telegram bot, ntfy topic, or Discord webhook to start receiving alerts."
					action={
						<Button onClick={() => setCreateOpen(true)} className="gap-2">
							<Plus className="size-4" />
							Add channel
						</Button>
					}
				/>
			)}

			{/* Card grid */}
			{channels.data && channels.data.channels.length > 0 && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{channels.data.channels.map((ch) => (
						<ChannelCard
							key={ch.id}
							channel={ch}
							testing={testing === ch.id}
							toggling={toggleEnabled.isPending}
							onTest={() => handleTest(ch.id)}
							onDelete={() => setDeleteTarget(ch)}
							onToggle={(enabled) =>
								toggleEnabled.mutate({ id: ch.id, enabled })
							}
						/>
					))}
				</div>
			)}

			<CreateChannelDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={() => {
					setCreateOpen(false);
					qc.invalidateQueries(orpc.notifications.list.queryOptions());
				}}
			/>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(o) => !o && setDeleteTarget(null)}
				title={`Delete "${deleteTarget?.name ?? "channel"}"?`}
				description="This channel will stop receiving notifications immediately."
				confirmLabel="Delete"
				destructive
				loading={deleteMutation.isPending}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Channel card
// ---------------------------------------------------------------------------

function ChannelCard({
	channel,
	testing,
	toggling,
	onTest,
	onDelete,
	onToggle,
}: {
	channel: Channel;
	testing: boolean;
	toggling: boolean;
	onTest: () => void;
	onDelete: () => void;
	onToggle: (enabled: boolean) => void;
}) {
	const cfg = CHANNEL_CONFIG[channel.type as ChannelType];
	const Icon = cfg?.icon ?? Bell;

	return (
		<div
			className={cn(
				"flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
				channel.enabled ? "border-border" : "border-border opacity-60",
			)}
		>
			{/* Header */}
			<div className="flex items-start justify-between gap-3 p-5">
				<div className="flex min-w-0 items-center gap-3">
					<div
						className={cn(
							"flex size-9 shrink-0 items-center justify-center rounded-lg border",
							cfg?.bg ?? "bg-muted",
							cfg?.border ?? "border-border",
						)}
					>
						<Icon className="size-5" />
					</div>
					<div className="min-w-0">
						<p className="truncate font-semibold text-foreground text-sm">
							{channel.name}
						</p>
						<p className={cn("text-xs font-medium", cfg?.color ?? "text-muted-foreground")}>
							{cfg?.label ?? channel.type}
						</p>
					</div>
				</div>
				<Switch
					checked={channel.enabled}
					disabled={toggling}
					onCheckedChange={onToggle}
				/>
			</div>

			{/* Events */}
			<div className="flex-1 px-5 pb-5">
				<p className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-widest">
					Events
				</p>
				<div className="flex flex-wrap gap-1.5">
					{(channel.events as string[]).map((event) => {
						const ev = EVENT_CONFIG[event as keyof typeof EVENT_CONFIG];
						if (!ev) return null;
						const EvIcon = ev.icon;
						return (
							<span
								key={event}
								className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-muted-foreground text-xs"
							>
								<EvIcon className={cn("size-3 shrink-0", ev.color)} />
								{ev.label}
							</span>
						);
					})}
				</div>
			</div>

			{/* Footer */}
			<div className="flex items-center gap-2 border-border border-t bg-muted/20 px-4 py-3">
				<Button
					size="sm"
					variant="outline"
					disabled={testing}
					onClick={onTest}
					className="h-7 gap-1.5 text-xs"
				>
					{testing ? (
						<Loader2 className="size-3 animate-spin" />
					) : (
						<FlaskConical className="size-3" />
					)}
					Send test
				</Button>
				<div className="flex-1" />
				<Button
					size="sm"
					variant="ghost"
					onClick={onDelete}
					className="h-7 gap-1.5 text-red-600 text-xs hover:text-red-600 dark:text-red-400"
				>
					<Trash2 className="size-3" />
					Delete
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

function CreateChannelDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	onCreated: () => void;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState<ChannelType>("telegram");
	const [events, setEvents] = useState<string[]>(["scraper_failed"]);
	const [saving, setSaving] = useState(false);

	// Telegram
	const [tgBotToken, setTgBotToken] = useState("");
	const [tgChatId, setTgChatId] = useState("");

	// ntfy
	const [ntfyUrl, setNtfyUrl] = useState("https://ntfy.sh");
	const [ntfyTopic, setNtfyTopic] = useState(generateNtfyTopic);
	const [ntfyToken, setNtfyToken] = useState("");

	// Discord
	const [discordWebhook, setDiscordWebhook] = useState("");

	function toggleEvent(event: string) {
		setEvents((prev) =>
			prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
		);
	}

	function buildConfig() {
		switch (type) {
			case "telegram":
				return { botToken: tgBotToken, chatId: tgChatId };
			case "ntfy":
				return {
					url: ntfyUrl,
					topic: ntfyTopic,
					...(ntfyToken ? { token: ntfyToken } : {}),
				};
			case "discord":
				return { webhookUrl: discordWebhook };
		}
	}

	function isValid() {
		if (!name.trim() || events.length === 0) return false;
		switch (type) {
			case "telegram":
				return tgBotToken.trim() !== "" && tgChatId.trim() !== "";
			case "ntfy":
				return ntfyUrl.trim() !== "" && ntfyTopic.trim() !== "";
			case "discord":
				return discordWebhook.trim() !== "";
		}
	}

	async function create() {
		setSaving(true);
		try {
			await client.notifications.create({
				name: name.trim(),
				type,
				config: buildConfig() as Parameters<
					typeof client.notifications.create
				>[0]["config"],
				events: events as Parameters<
					typeof client.notifications.create
				>[0]["events"],
			});
			toast.success("Notification channel created");
			onCreated();
			setName("");
			setType("telegram");
			setEvents(["scraper_failed"]);
			setTgBotToken("");
			setTgChatId("");
			setNtfyUrl("https://ntfy.sh");
			setNtfyTopic(generateNtfyTopic());
			setNtfyToken("");
			setDiscordWebhook("");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to create channel",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add notification channel</DialogTitle>
					<DialogDescription>
						Receive alerts via Telegram, ntfy, or Discord.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					{/* Name */}
					<div className="space-y-1.5">
						<Label htmlFor="ch-name">Name</Label>
						<Input
							id="ch-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My alerts"
						/>
					</div>

					{/* Type picker */}
					<div className="space-y-1.5">
						<Label>Channel type</Label>
						<div className="grid grid-cols-3 gap-2">
							{(
								Object.entries(CHANNEL_CONFIG) as [
									ChannelType,
									(typeof CHANNEL_CONFIG)[ChannelType],
								][]
							).map(([key, cfg]) => {
								const Ic = cfg.icon;
								const selected = type === key;
								return (
									<button
										key={key}
										type="button"
										onClick={() => setType(key)}
										className={cn(
											"flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors",
											selected
												? cn(
														"border-primary/40 bg-primary/5 text-foreground",
													)
												: "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
										)}
									>
										<div
											className={cn(
												"flex size-8 items-center justify-center rounded-lg border transition-colors",
												selected
													? cn(cfg.bg, cfg.border)
													: "border-border bg-muted",
											)}
										>
											<Ic className="size-4" />
										</div>
										{cfg.label}
									</button>
								);
							})}
						</div>
					</div>

					{/* Telegram fields */}
					{type === "telegram" && (
						<div className="space-y-3">
							<div className="space-y-1.5">
								<Label htmlFor="tg-token">Bot token</Label>
								<Input
									id="tg-token"
									value={tgBotToken}
									onChange={(e) => setTgBotToken(e.target.value)}
									placeholder="123456:ABC-DEF..."
									className="font-mono text-sm"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="tg-chat">Chat ID</Label>
								<Input
									id="tg-chat"
									value={tgChatId}
									onChange={(e) => setTgChatId(e.target.value)}
									placeholder="-100123456789"
									className="font-mono text-sm"
								/>
							</div>
						</div>
					)}

					{/* ntfy fields */}
					{type === "ntfy" && (
						<div className="space-y-3">
							<div className="space-y-1.5">
								<Label htmlFor="ntfy-url">Server URL</Label>
								<Input
									id="ntfy-url"
									value={ntfyUrl}
									onChange={(e) => setNtfyUrl(e.target.value)}
									placeholder="https://ntfy.sh"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="ntfy-topic">Topic</Label>
								<div className="flex gap-2">
									<Input
										id="ntfy-topic"
										value={ntfyTopic}
										onChange={(e) => setNtfyTopic(e.target.value)}
										placeholder="my-minato-alerts"
										className="font-mono text-sm"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => setNtfyTopic(generateNtfyTopic())}
										title="Generate a random topic"
										className="shrink-0"
									>
										<RefreshCw className="size-4" />
										<span className="sr-only">Generate topic</span>
									</Button>
								</div>
								<p className="text-muted-foreground text-xs">
									Auto-generated — hard to guess, easy to remember.
								</p>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="ntfy-token">
									Access token{" "}
									<span className="text-muted-foreground">(optional)</span>
								</Label>
								<Input
									id="ntfy-token"
									value={ntfyToken}
									onChange={(e) => setNtfyToken(e.target.value)}
									placeholder="tk_..."
									className="font-mono text-sm"
								/>
							</div>
						</div>
					)}

					{/* Discord fields */}
					{type === "discord" && (
						<div className="space-y-1.5">
							<Label htmlFor="discord-webhook">Webhook URL</Label>
							<Input
								id="discord-webhook"
								value={discordWebhook}
								onChange={(e) => setDiscordWebhook(e.target.value)}
								placeholder="https://discord.com/api/webhooks/..."
								className="font-mono text-sm"
							/>
						</div>
					)}

					{/* Events */}
					<div className="space-y-2">
						<Label>Events</Label>
						<div className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
							{ALL_EVENTS.map((event) => {
								const ev = EVENT_CONFIG[event];
								const EvIcon = ev.icon;
								return (
									<label
										key={event}
										className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
									>
										<Checkbox
											checked={events.includes(event)}
											onCheckedChange={() => toggleEvent(event)}
										/>
										<EvIcon className={cn("size-3.5 shrink-0", ev.color)} />
										<span className="text-sm">{ev.label}</span>
									</label>
								);
							})}
						</div>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={create}
						disabled={saving || !isValid()}
						className="min-w-24"
					>
						{saving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							"Create"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
