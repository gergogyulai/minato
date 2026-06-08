import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	BadgeCheck,
	Bookmark,
	ChevronDown,
	ChevronUp,
	Film,
	Loader2,
	Minus,
	Plus,
	Repeat2,
	Search,
	Sparkles,
	Trash2,
	Tv,
	X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/wanted")({
	component: WantedPage,
});

type WantedItem = Awaited<ReturnType<typeof client.wanted.list>>["items"][number];
type MediaType = "movie" | "tv" | "anime" | null;
type Resolution = "2160p" | "1080p" | "720p" | "480p" | null;

const KNOWN_FLAGS = [
	"Dolby Vision",
	"HDR10+",
	"HDR10",
	"HDR",
	"HLG",
	"DDP",
	"DTS-HD MA",
	"DTS-X",
	"TrueHD",
	"Atmos",
	"REMUX",
	"IMAX",
	"Proper",
	"Repack",
] as const;

const MEDIA_TYPE_CONFIG = {
	movie: { label: "Movie", Icon: Film, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
	tv: { label: "TV", Icon: Tv, color: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20" },
	anime: { label: "Anime", Icon: Sparkles, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
} as const;

const RESOLUTION_OPTIONS: Array<{ value: Resolution; label: string }> = [
	{ value: null, label: "Any" },
	{ value: "2160p", label: "4K (2160p)" },
	{ value: "1080p", label: "1080p" },
	{ value: "720p", label: "720p" },
	{ value: "480p", label: "480p" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function WantedPage() {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery(orpc.wanted.list.queryOptions());
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<WantedItem | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<WantedItem | null>(null);

	const deleteMutation = useMutation({
		mutationFn: (id: string) => client.wanted.delete({ id }),
		onSuccess: () => {
			toast.success("Entry deleted");
			setDeleteTarget(null);
			qc.invalidateQueries(orpc.wanted.list.queryOptions());
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
	});

	const toggleEnabled = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			client.wanted.update({ id, enabled }),
		onSuccess: () => qc.invalidateQueries(orpc.wanted.list.queryOptions()),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update"),
	});

	const items = data?.items ?? [];

	return (
		<div>
			<PageHeader
				title="Watchlist"
				description="Monitor for new torrents matching specific content and quality criteria. Notifications are sent via your configured channels."
				actions={
					<Button onClick={() => setCreateOpen(true)} className="gap-2">
						<Plus className="size-4" />
						Add entry
					</Button>
				}
			/>

			{isLoading && (
				<div className="space-y-3">
					{[0, 1, 2].map((i) => (
						<div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
					))}
				</div>
			)}

			{!isLoading && items.length === 0 && (
				<EmptyState
					icon={Bookmark}
					title="No watchlist entries"
					description="Add an entry to get notified when a matching torrent is indexed and enriched."
					action={
						<Button onClick={() => setCreateOpen(true)} className="gap-2">
							<Plus className="size-4" />
							Add entry
						</Button>
					}
				/>
			)}

			{items.length > 0 && (
				<div className="space-y-3">
					{items.map((item) => (
						<WantedCard
							key={item.id}
							item={item}
							toggling={toggleEnabled.isPending}
							onEdit={() => setEditTarget(item)}
							onDelete={() => setDeleteTarget(item)}
							onToggle={(enabled) => toggleEnabled.mutate({ id: item.id, enabled })}
						/>
					))}
				</div>
			)}

			<WantedDialog
				open={createOpen || editTarget !== null}
				onOpenChange={(o) => {
					if (!o) { setCreateOpen(false); setEditTarget(null); }
				}}
				initialData={editTarget}
				onSaved={() => {
					setCreateOpen(false);
					setEditTarget(null);
					qc.invalidateQueries(orpc.wanted.list.queryOptions());
				}}
			/>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(o) => !o && setDeleteTarget(null)}
				title={`Delete "${deleteTarget?.name ?? "entry"}"?`}
				description="This watchlist entry and all its match history will be permanently removed."
				confirmLabel="Delete"
				destructive
				loading={deleteMutation.isPending}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function criteriaLabel(item: WantedItem): string {
	const parts: string[] = [];
	if (item.mediaType) parts.push(MEDIA_TYPE_CONFIG[item.mediaType]?.label ?? item.mediaType);
	if (item.tmdbId) parts.push(`TMDB:${item.tmdbId}`);
	else if (item.title) parts.push(item.title);
	if (item.year) parts.push(String(item.year));
	if (item.season != null) {
		parts.push(item.episode != null ? `S${item.season}E${item.episode}` : `Season ${item.season}`);
	}
	if (item.seasonPack === true) parts.push("Pack");
	else if (item.seasonPack === false) parts.push("Episodes");
	if (item.resolution) parts.push(item.resolution);
	if (item.group) parts.push(item.group);
	return parts.join(" · ") || "Any";
}

function WantedCard({
	item,
	toggling,
	onEdit,
	onDelete,
	onToggle,
}: {
	item: WantedItem;
	toggling: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onToggle: (enabled: boolean) => void;
}) {
	const [showFlags, setShowFlags] = useState(false);
	const isFound = item.oneShot && item.lastMatchAt != null;
	const mediaConfig = item.mediaType ? MEDIA_TYPE_CONFIG[item.mediaType] : null;

	return (
		<div
			className={cn(
				"rounded-xl border bg-card transition-shadow hover:shadow-sm",
				!item.enabled && "opacity-60",
				isFound && "border-emerald-500/30 bg-emerald-500/5",
			)}
		>
			<div className="flex items-start gap-4 p-4">
				{/* Icon */}
				{mediaConfig && (
					<div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", mediaConfig.bg, mediaConfig.border)}>
						<mediaConfig.Icon className={cn("size-4", mediaConfig.color)} />
					</div>
				)}
				{!mediaConfig && (
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
						<Bookmark className="size-4 text-muted-foreground" />
					</div>
				)}

				{/* Main content */}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={onEdit}
							className="font-semibold text-foreground text-sm hover:text-primary"
						>
							{item.name}
						</button>
						{item.oneShot && !isFound && (
							<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 text-[11px] dark:text-amber-400">
								<X className="size-2.5" />
								One-time
							</span>
						)}
						{item.oneShot && isFound && (
							<span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 text-[11px] dark:text-emerald-400">
								<BadgeCheck className="size-2.5" />
								Found
							</span>
						)}
						{!item.oneShot && (
							<span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-muted-foreground text-[11px]">
								<Repeat2 className="size-2.5" />
								Ongoing
							</span>
						)}
						{item.matchCount > 0 && (
							<span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-[11px] text-primary">
								{item.matchCount} match{item.matchCount !== 1 ? "es" : ""}
							</span>
						)}
					</div>
					<p className="mt-0.5 truncate text-muted-foreground text-xs">{criteriaLabel(item)}</p>

					{/* Flags row */}
					{((item.requiredFlags?.length ?? 0) > 0 || (item.excludedFlags?.length ?? 0) > 0) && (
						<div className="mt-2">
							<button
								type="button"
								onClick={() => setShowFlags((p) => !p)}
								className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
							>
								{showFlags ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
								{showFlags ? "Hide flags" : "Show flags"}
							</button>
							{showFlags && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{(item.requiredFlags ?? []).map((f) => (
										<span key={f} className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 text-[10px] dark:text-emerald-400">
											+{f}
										</span>
									))}
									{(item.excludedFlags ?? []).map((f) => (
										<span key={f} className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-700 text-[10px] dark:text-red-400">
											−{f}
										</span>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Controls */}
				<div className="flex shrink-0 items-center gap-2">
					{!isFound && (
						<Switch
							checked={item.enabled}
							disabled={toggling}
							onCheckedChange={onToggle}
						/>
					)}
					<Button
						size="sm"
						variant="ghost"
						onClick={onDelete}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Wizard dialog
// ---------------------------------------------------------------------------

type FlagMode = "require" | "exclude";

type TmdbResult = {
	tmdbId: number;
	title: string;
	year: number | null;
	posterUrl: string | null;
	mediaType: "movie" | "tv";
};

type FormState = {
	name: string;
	oneShot: boolean;
	mediaType: MediaType;
	contentMode: "title" | "tmdb";
	tmdbResult: TmdbResult | null;
	title: string;
	year: string;
	season: string;
	episode: string;
	seasonPack: boolean | null;
	resolution: Resolution;
	group: string;
	flags: Partial<Record<string, FlagMode>>;
};

const EMPTY_FORM: FormState = {
	name: "",
	oneShot: false,
	mediaType: null,
	contentMode: "tmdb",
	tmdbResult: null,
	title: "",
	year: "",
	season: "",
	episode: "",
	seasonPack: null,
	resolution: null,
	group: "",
	flags: {},
};

function itemToForm(item: WantedItem): FormState {
	const flags: Partial<Record<string, FlagMode>> = {};
	for (const f of item.requiredFlags ?? []) flags[f] = "require";
	for (const f of item.excludedFlags ?? []) flags[f] = "exclude";
	return {
		name: item.name,
		oneShot: item.oneShot,
		mediaType: item.mediaType as MediaType,
		contentMode: item.tmdbId != null ? "tmdb" : "title",
		tmdbResult: item.tmdbId != null
			? { tmdbId: item.tmdbId, title: item.title ?? "", year: item.year ?? null, posterUrl: null, mediaType: (item.mediaType ?? "movie") as "movie" | "tv" }
			: null,
		title: item.title ?? "",
		year: item.year != null ? String(item.year) : "",
		season: item.season != null ? String(item.season) : "",
		episode: item.episode != null ? String(item.episode) : "",
		seasonPack: item.seasonPack ?? null,
		resolution: (item.resolution as Resolution) ?? null,
		group: item.group ?? "",
		flags,
	};
}

const STEPS = ["Content", "Quality", "Details"] as const;
type StepIndex = 0 | 1 | 2;

function WantedDialog({
	open,
	onOpenChange,
	initialData,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	initialData: WantedItem | null;
	onSaved: () => void;
}) {
	const isEdit = initialData !== null;
	const [step, setStep] = useState<StepIndex>(0);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [saving, setSaving] = useState(false);

	function handleOpenChange(o: boolean) {
		if (o) {
			setStep(0);
			setForm(initialData ? itemToForm(initialData) : EMPTY_FORM);
		}
		onOpenChange(o);
	}

	function set<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	function cycleFlag(flag: string) {
		setForm((prev) => {
			const current = prev.flags[flag];
			const next: FlagMode | undefined =
				current === undefined ? "require" : current === "require" ? "exclude" : undefined;
			const updated = { ...prev.flags };
			if (next === undefined) delete updated[flag];
			else updated[flag] = next;
			return { ...prev, flags: updated };
		});
	}

	function canAdvance() {
		if (step === 0) {
			return form.contentMode === "tmdb" ? !!form.tmdbResult : !!form.title.trim();
		}
		if (step === 2) return !!form.name.trim();
		return true;
	}

	function autoName(): string {
		if (form.contentMode === "tmdb" && form.tmdbResult) {
			const parts = [form.tmdbResult.title];
			if (form.tmdbResult.year) parts.push(`(${form.tmdbResult.year})`);
			if (form.resolution) parts.push(form.resolution);
			if (form.flags["REMUX"] === "require") parts.push("REMUX");
			return parts.join(" ");
		}
		const parts: string[] = [];
		if (form.title.trim()) parts.push(form.title.trim());
		if (form.year) parts.push(`(${form.year})`);
		if (form.resolution) parts.push(form.resolution);
		if (form.flags["REMUX"] === "require") parts.push("REMUX");
		return parts.join(" ");
	}

	function handleNext() {
		if (step === 1 && !form.name) {
			const suggested = autoName();
			if (suggested) setForm((p) => ({ ...p, name: suggested }));
		}
		setStep((s) => (Math.min(s + 1, 2) as StepIndex));
	}

	async function save() {
		setSaving(true);
		try {
			const payload = {
				name: form.name.trim(),
				oneShot: form.oneShot,
				mediaType: form.mediaType,
				tmdbId: form.contentMode === "tmdb" ? (form.tmdbResult?.tmdbId ?? null) : null,
				title: form.contentMode === "title" ? (form.title.trim() || null) : null,
				year: form.year ? parseInt(form.year, 10) : null,
				season: form.season ? parseInt(form.season, 10) : null,
				episode: form.episode ? parseInt(form.episode, 10) : null,
				seasonPack: form.seasonPack,
				resolution: form.resolution,
				group: form.group.trim() || null,
				requiredFlags: Object.entries(form.flags).filter(([, v]) => v === "require").map(([k]) => k),
				excludedFlags: Object.entries(form.flags).filter(([, v]) => v === "exclude").map(([k]) => k),
			};
			if (isEdit && initialData) {
				await client.wanted.update({ id: initialData.id, ...payload });
				toast.success("Entry updated");
			} else {
				await client.wanted.create(payload);
				toast.success("Watchlist entry created");
			}
			onSaved();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="gap-0 p-0 sm:max-w-md">
				{/* Step header — pr-10 keeps text clear of the dialog's close button */}
				<div className="border-b border-border px-5 pb-4 pt-5 pr-10">
					<p className="font-semibold text-sm text-foreground">
						{isEdit ? "Edit entry" : "Add to watchlist"}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<div className="flex items-center gap-1">
							{STEPS.map((_, i) => (
								<div
									key={i}
									className={cn(
										"rounded-full transition-all duration-200",
										i === step
											? "h-1.5 w-4 bg-primary"
											: i < step
												? "h-1.5 w-1.5 bg-primary/50"
												: "h-1.5 w-1.5 bg-muted-foreground/25",
									)}
								/>
							))}
						</div>
						<span className="text-[11px] text-muted-foreground">{STEPS[step]}</span>
					</div>
				</div>

				{/* Step body */}
				<div className="px-5 py-5">
					{step === 0 && <StepContent form={form} set={set} />}
					{step === 1 && <StepQuality form={form} set={set} cycleFlag={cycleFlag} />}
					{step === 2 && <StepDetails form={form} set={set} />}
				</div>

				{/* Footer nav */}
				<div className="flex items-center gap-2 border-t border-border px-5 py-4">
					{step > 0 ? (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setStep((s) => (s - 1) as StepIndex)}
							className="gap-1.5"
						>
							<ArrowLeft className="size-3.5" />
							Back
						</Button>
					) : (
						<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
					)}
					<div className="flex-1" />
					{step < 2 ? (
						<Button size="sm" onClick={handleNext} disabled={!canAdvance()} className="gap-1.5">
							Next
							<ArrowRight className="size-3.5" />
						</Button>
					) : (
						<Button size="sm" onClick={save} disabled={saving || !canAdvance()} className="min-w-20">
							{saving ? <Loader2 className="size-3.5 animate-spin" /> : isEdit ? "Save" : "Add"}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Step 1 — Content
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
	{ value: null as MediaType, label: "Any" },
	{ value: "movie" as MediaType, label: "Movie" },
	{ value: "tv" as MediaType, label: "TV" },
	{ value: "anime" as MediaType, label: "Anime" },
];

function StepContent({
	form,
	set,
}: {
	form: FormState;
	set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
	// Anime doesn't use TMDB IDs — switch to title mode automatically
	function handleTypeChange(value: MediaType) {
		set("mediaType", value);
		if (value === "anime") {
			set("contentMode", "title");
		} else if (form.contentMode === "title") {
			set("contentMode", "tmdb");
		}
	}

	const useTmdb = form.contentMode === "tmdb";

	return (
		<div className="space-y-5">
			{/* Media type — simple horizontal pills, all equal width */}
			<div className="flex rounded-lg border border-border bg-muted/20 p-1 gap-1">
				{TYPE_OPTIONS.map(({ value, label }) => (
					<button
						key={String(value)}
						type="button"
						onClick={() => handleTypeChange(value)}
						className={cn(
							"flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
							form.mediaType === value
								? "bg-background text-foreground shadow-sm border border-border"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{label}
					</button>
				))}
			</div>

			{/* Content identifier */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="text-xs text-muted-foreground">
						{useTmdb ? "Search TMDB" : "Title"}
					</Label>
					{form.mediaType !== "anime" && (
						<button
							type="button"
							onClick={() => {
								set("contentMode", useTmdb ? "title" : "tmdb");
								set("tmdbResult", null);
							}}
							className="text-[11px] text-primary hover:underline"
						>
							Use {useTmdb ? "title" : "TMDB search"} instead
						</button>
					)}
				</div>

				{useTmdb ? (
					<TmdbSearchCombobox
						mediaType={form.mediaType}
						value={form.tmdbResult}
						onSelect={(r) => set("tmdbResult", r)}
					/>
				) : (
					<Input
						autoFocus
						value={form.title}
						onChange={(e) => set("title", e.target.value)}
						placeholder="e.g. Dune Part Two"
					/>
				)}
			</div>

			{/* Year — only shown in title mode (tmdb mode gets year from result) */}
			{!useTmdb && (
				<div className="space-y-2">
					<Label className="text-xs text-muted-foreground">
						Year <span className="opacity-50">(optional)</span>
					</Label>
					<Input
						value={form.year}
						onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))}
						placeholder="e.g. 2025"
						maxLength={4}
						className="font-mono w-28"
					/>
				</div>
			)}

			{/* TV-specific */}
			{form.mediaType === "tv" && (
				<div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-3.5">
					<p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Episode</p>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Season</Label>
							<Input
								value={form.season}
								onChange={(e) => set("season", e.target.value.replace(/\D/g, ""))}
								placeholder="any"
								className="font-mono"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Episode</Label>
							<Input
								value={form.episode}
								onChange={(e) => set("episode", e.target.value.replace(/\D/g, ""))}
								placeholder="any"
								className="font-mono"
							/>
						</div>
					</div>
					<div className="flex gap-1.5">
						{([
							{ value: null, label: "Any" },
							{ value: true, label: "Pack only" },
							{ value: false, label: "Episodes only" },
						] as const).map(({ value, label }) => (
							<button
								key={String(value)}
								type="button"
								onClick={() => set("seasonPack", value)}
								className={cn(
									"rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
									form.seasonPack === value
										? "border-primary/50 bg-primary/8 text-foreground"
										: "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
								)}
							>
								{label}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// TMDB async search combobox
// ---------------------------------------------------------------------------

function TmdbSearchCombobox({
	mediaType,
	value,
	onSelect,
}: {
	mediaType: MediaType;
	value: TmdbResult | null;
	onSelect: (r: TmdbResult | null) => void;
}) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [debouncedQuery] = useDebounce(query, 350);
	const containerRef = useRef<HTMLDivElement>(null);

	const tmdbType = mediaType === "movie" || mediaType === "tv" ? mediaType : undefined;

	const { data, isFetching } = useQuery({
		queryKey: ["tmdb-search", debouncedQuery, tmdbType],
		queryFn: () => client.wanted.tmdbSearch({ q: debouncedQuery, type: tmdbType }),
		enabled: debouncedQuery.length >= 2,
		staleTime: 60_000,
	});

	// Close dropdown on outside click
	useEffect(() => {
		function handler(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	if (value) {
		return (
			<div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
				{value.posterUrl && (
					<img
						src={value.posterUrl}
						alt=""
						className="h-10 w-7 shrink-0 rounded object-cover"
					/>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium text-foreground">{value.title}</p>
					<p className="text-[11px] text-muted-foreground">
						{value.year ?? "—"} · TMDB {value.tmdbId}
					</p>
				</div>
				<button
					type="button"
					onClick={() => { onSelect(null); setQuery(""); }}
					className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<X className="size-3.5" />
				</button>
			</div>
		);
	}

	const results = data?.results ?? [];
	const showDropdown = open && debouncedQuery.length >= 2;

	return (
		<div ref={containerRef} className="relative">
			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					autoFocus
					value={query}
					onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
					onFocus={() => setOpen(true)}
					placeholder={`Search for ${mediaType ?? "a movie or show"}…`}
					className="pl-8"
				/>
			</div>

			{showDropdown && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
					{isFetching && (
						<div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
							<Loader2 className="size-3 animate-spin" />
							Searching…
						</div>
					)}
					{!isFetching && results.length === 0 && (
						<p className="px-3 py-2.5 text-xs text-muted-foreground">No results for "{debouncedQuery}"</p>
					)}
					{results.map((r) => (
						<button
							key={r.tmdbId}
							type="button"
							onMouseDown={(e) => e.preventDefault()} // keep focus in input
							onClick={() => { onSelect(r); setOpen(false); setQuery(""); }}
							className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
						>
							{r.posterUrl ? (
								<img src={r.posterUrl} alt="" className="h-9 w-6 shrink-0 rounded object-cover" />
							) : (
								<div className="flex h-9 w-6 shrink-0 items-center justify-center rounded bg-muted">
									{r.mediaType === "movie" ? <Film className="size-3 text-muted-foreground" /> : <Tv className="size-3 text-muted-foreground" />}
								</div>
							)}
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{r.title}</p>
								<p className="text-[11px] text-muted-foreground">
									{r.year ?? "—"} · {r.mediaType === "movie" ? "Movie" : "TV"}
								</p>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 2 — Quality
// ---------------------------------------------------------------------------

function StepQuality({
	form,
	set,
	cycleFlag,
}: {
	form: FormState;
	set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
	cycleFlag: (flag: string) => void;
}) {
	return (
		<div className="space-y-5">
			{/* Resolution */}
			<div className="space-y-2.5">
				<Label className="text-xs text-muted-foreground">Resolution</Label>
				<div className="flex flex-wrap gap-1.5">
					{RESOLUTION_OPTIONS.map(({ value, label }) => (
						<button
							key={String(value)}
							type="button"
							onClick={() => set("resolution", value)}
							className={cn(
								"rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
								form.resolution === value
									? "border-primary/50 bg-primary/8 text-foreground"
									: "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
							)}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{/* Release group */}
			<div className="space-y-2">
				<Label className="text-xs text-muted-foreground">
					Release group <span className="opacity-50">(optional)</span>
				</Label>
				<Input
					value={form.group}
					onChange={(e) => set("group", e.target.value)}
					placeholder="e.g. FRaMeSToR"
					className="font-mono"
				/>
			</div>

			{/* Tri-state flag toggles */}
			<div className="space-y-2.5">
				<div className="flex items-baseline gap-2">
					<Label className="text-xs text-muted-foreground">Flags</Label>
					<span className="text-[10px] text-muted-foreground/60">
						click once to require, again to exclude
					</span>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{KNOWN_FLAGS.map((flag) => {
						const mode = form.flags[flag];
						return (
							<button
								key={flag}
								type="button"
								onClick={() => cycleFlag(flag)}
								className={cn(
									"inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
									mode === undefined &&
										"border-border bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
									mode === "require" &&
										"border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
									mode === "exclude" &&
										"border-red-500/40 bg-red-500/12 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
								)}
							>
								{mode === "require" && <Plus className="size-2.5" />}
								{mode === "exclude" && <Minus className="size-2.5" />}
								{flag}
							</button>
						);
					})}
				</div>
				{(Object.keys(form.flags).length > 0) && (
					<div className="flex gap-3 text-[10px] text-muted-foreground">
						<span className="flex items-center gap-1">
							<span className="size-2 rounded-full bg-emerald-500/60" />
							required
						</span>
						<span className="flex items-center gap-1">
							<span className="size-2 rounded-full bg-red-500/60" />
							excluded
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 3 — Details
// ---------------------------------------------------------------------------

function StepDetails({
	form,
	set,
}: {
	form: FormState;
	set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
	return (
		<div className="space-y-5">
			{/* Name */}
			<div className="space-y-2">
				<Label className="text-xs text-muted-foreground">Name</Label>
				<Input
					autoFocus
					value={form.name}
					onChange={(e) => set("name", e.target.value)}
					placeholder="e.g. Dune Part 3 4K REMUX"
				/>
			</div>

			{/* Behaviour */}
			<div className="space-y-2.5">
				<Label className="text-xs text-muted-foreground">Behaviour</Label>
				<div className="grid grid-cols-2 gap-2">
					{([
						{ value: false, label: "Ongoing", desc: "Every match notifies", Icon: Repeat2 },
						{ value: true, label: "One-time", desc: "Stop after first match", Icon: X },
					] as const).map(({ value, label, desc, Icon }) => (
						<button
							key={String(value)}
							type="button"
							onClick={() => set("oneShot", value)}
							className={cn(
								"flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
								form.oneShot === value
									? "border-primary/50 bg-primary/8 text-foreground"
									: "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
							)}
						>
							<Icon className="mt-0.5 size-3.5 shrink-0" />
							<div>
								<p className="text-xs font-medium">{label}</p>
								<p className="text-[11px] text-muted-foreground">{desc}</p>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
