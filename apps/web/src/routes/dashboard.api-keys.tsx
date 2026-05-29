import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/api-keys")({
	component: ApiKeysPage,
});

type ApiKey = Awaited<
	ReturnType<typeof client.apiKeys.list>
>["apiKeys"][number];

const DAY_MS = 86_400_000;
const EXPIRY_OPTIONS = [
	{ label: "Never", value: "never" },
	{ label: "30 days", value: String(30 * DAY_MS) },
	{ label: "90 days", value: String(90 * DAY_MS) },
	{ label: "1 year", value: String(365 * DAY_MS) },
];

function keyType(k: ApiKey): string {
	const meta = k.metadata as { type?: string; scraperId?: string } | null;
	if (meta?.scraperId) return "scraper";
	return meta?.type ?? "custom";
}

function ApiKeysPage() {
	const keys = useQuery(orpc.apiKeys.list.queryOptions());
	const [createOpen, setCreateOpen] = useState(false);
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [revoke, setRevoke] = useState<ApiKey | null>(null);
	const [revoking, setRevoking] = useState(false);

	async function doRevoke() {
		if (!revoke) return;
		setRevoking(true);
		try {
			await client.apiKeys.delete({ keyId: revoke.id });
			toast.success("API key revoked");
			setRevoke(null);
			keys.refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to revoke key");
		} finally {
			setRevoking(false);
		}
	}

	return (
		<div>
			<PageHeader
				title="API Keys"
				description="Machine-to-machine keys for Torznab clients (Sonarr/Radarr) and custom integrations."
				actions={
					<Button onClick={() => setCreateOpen(true)} className="gap-2">
						<Plus className="size-4" />
						New key
					</Button>
				}
			/>

			{keys.isLoading && (
				<div className="h-48 animate-pulse rounded-xl border border-border bg-muted/30" />
			)}

			{keys.data?.apiKeys.length === 0 && (
				<EmptyState
					icon={KeyRound}
					title="No API keys yet"
					description="Create a key to connect a Torznab client or external integration."
					action={
						<Button onClick={() => setCreateOpen(true)} className="gap-2">
							<Plus className="size-4" />
							New key
						</Button>
					}
				/>
			)}

			{keys.data && keys.data.apiKeys.length > 0 && (
				<div className="overflow-hidden rounded-xl border border-border bg-card">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead>Name</TableHead>
								<TableHead>Key</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Created</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{keys.data.apiKeys.map((k) => (
								<TableRow key={k.id}>
									<TableCell className="font-medium">
										{k.name ?? "Unnamed"}
									</TableCell>
									<TableCell className="font-mono text-muted-foreground text-xs">
										{k.start ? `${k.start}…` : "—"}
									</TableCell>
									<TableCell className="capitalize">{keyType(k)}</TableCell>
									<TableCell>
										{k.enabled ? (
											<StatusPill tone="success" dot>
												Active
											</StatusPill>
										) : (
											<StatusPill tone="neutral" dot>
												Disabled
											</StatusPill>
										)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(k.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{k.expiresAt
											? new Date(k.expiresAt).toLocaleDateString()
											: "Never"}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setRevoke(k)}
											className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
										>
											<Trash2 className="size-4" />
											<span className="sr-only">Revoke</span>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<CreateDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={(key) => {
					setCreatedKey(key);
					keys.refetch();
				}}
			/>

			<RevealDialog apiKey={createdKey} onClose={() => setCreatedKey(null)} />

			<ConfirmDialog
				open={revoke !== null}
				onOpenChange={(o) => !o && setRevoke(null)}
				title={`Revoke "${revoke?.name ?? "key"}"?`}
				description="Any client using this key will immediately lose access. This cannot be undone."
				confirmLabel="Revoke"
				destructive
				loading={revoking}
				onConfirm={doRevoke}
			/>
		</div>
	);
}

function CreateDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	onCreated: (key: string) => void;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState<"torznab" | "custom">("torznab");
	const [expiry, setExpiry] = useState("never");
	const [saving, setSaving] = useState(false);

	async function create() {
		setSaving(true);
		try {
			const result = await client.apiKeys.create({
				name: name.trim(),
				type,
				expiresIn: expiry === "never" ? undefined : Number(expiry),
			});
			onCreated(result.key);
			onOpenChange(false);
			setName("");
			setType("torznab");
			setExpiry("never");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to create key");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create API key</DialogTitle>
					<DialogDescription>
						The full key is shown once after creation — store it somewhere safe.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="key-name">Name</Label>
						<Input
							id="key-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Sonarr"
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>Type</Label>
							<Select
								value={type}
								onValueChange={(v) => setType(v as "torznab" | "custom")}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="torznab">Torznab</SelectItem>
									<SelectItem value="custom">Custom</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label>Expiry</Label>
							<Select value={expiry} onValueChange={setExpiry}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EXPIRY_OPTIONS.map((o) => (
										<SelectItem key={o.value} value={o.value}>
											{o.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				<DialogFooter className="gap-2 sm:gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={create}
						disabled={saving || name.trim() === ""}
						className="min-w-24"
					>
						{saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RevealDialog({
	apiKey,
	onClose,
}: {
	apiKey: string | null;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);

	function copy() {
		if (!apiKey) return;
		navigator.clipboard.writeText(apiKey);
		setCopied(true);
		toast.success("Copied to clipboard");
		setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Dialog open={apiKey !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Your new API key</DialogTitle>
					<DialogDescription>
						This is the only time the full key will be shown. Copy it now.
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
					<code className="flex-1 break-all font-mono text-foreground text-xs">
						{apiKey}
					</code>
					<Button
						size="icon"
						variant="ghost"
						onClick={copy}
						className="shrink-0"
					>
						{copied ? (
							<Check className="size-4 text-emerald-500" />
						) : (
							<Copy className="size-4" />
						)}
					</Button>
				</div>
				<DialogFooter>
					<Button onClick={onClose}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
