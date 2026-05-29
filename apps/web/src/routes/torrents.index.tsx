import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatBytesString } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ── URL Search Schema (mirrors every API param) ───────────────────────────────
const torrentsSearchSchema = z.object({
	q: z.string().optional().default(""),
	type: z.string().optional(),
	resolution: z.string().optional(),
	group: z.string().optional(),
	genres: z.string().optional(),
	yearMin: z.coerce.number().optional(),
	yearMax: z.coerce.number().optional(),
	sizeMin: z.coerce.number().optional(), // bytes
	sizeMax: z.coerce.number().optional(), // bytes
	seeders: z.coerce.number().optional(),
	sort: z
		.enum([
			"trackerTitle:asc",
			"trackerTitle:desc",
			"seeders:asc",
			"seeders:desc",
			"publishedAt:asc",
			"publishedAt:desc",
			"size:asc",
			"size:desc",
		])
		.optional()
		.default("seeders:desc"),
	page: z.coerce.number().optional().default(0),
	limit: z.coerce.number().optional().default(50),
});

type TorrentsSearch = z.infer<typeof torrentsSearchSchema>;
type SortValue = NonNullable<TorrentsSearch["sort"]>;
type SortField = "trackerTitle" | "seeders" | "publishedAt" | "size";
type SortDir = "asc" | "desc";

const LIMIT = 50;

// Fallback values shown before facets arrive
const FALLBACK_TYPES = [
	"movie",
	"tv",
	"anime",
	"music",
	"book",
	"game",
	"software",
];
const FALLBACK_RESOLUTIONS = [
	"360p",
	"480p",
	"720p",
	"1080p",
	"2160p",
	"4320p",
];
const FALLBACK_GENRES = [
	"Action",
	"Adventure",
	"Animation",
	"Comedy",
	"Crime",
	"Documentary",
	"Drama",
	"Fantasy",
	"Horror",
	"Music",
	"Mystery",
	"Romance",
	"Sci-Fi",
	"Thriller",
	"War",
	"Western",
];

type FacetEntry = { value: string; count?: number };

/** Merge API facet distribution with pinned (selected) values, sort by count. */
function buildFacetList(
	facetObj: Record<string, number> | undefined,
	selected: string[],
	fallback: string[],
): FacetEntry[] {
	if (!facetObj) {
		// Pre-load: show fallback + any already-selected items without counts
		const allValues = new Set([...fallback, ...selected]);
		return Array.from(allValues).map((value) => ({ value }));
	}
	// Merge facet keys + selected items not in facets (count = 0)
	const allValues = new Set([...Object.keys(facetObj), ...selected]);
	return Array.from(allValues)
		.map((value) => ({ value, count: facetObj[value] }))
		.sort((a, b) => {
			const aOn = selected.includes(a.value);
			const bOn = selected.includes(b.value);
			// Selected items stay pinned at top
			if (aOn !== bOn) return aOn ? -1 : 1;
			return (b.count ?? 0) - (a.count ?? 0);
		});
}

export const Route = createFileRoute("/torrents/")({
	component: TorrentBrowseComponent,
	validateSearch: torrentsSearchSchema,
});

// ── Main Component ────────────────────────────────────────────────────────────
function TorrentBrowseComponent() {
	const navigate = useNavigate();
	const sp = Route.useSearch();

	// Local (debounced) state for text-based inputs
	const [localQ, setLocalQ] = useState(sp.q ?? "");
	const [localYearMin, setLocalYearMin] = useState(
		sp.yearMin?.toString() ?? "",
	);
	const [localYearMax, setLocalYearMax] = useState(
		sp.yearMax?.toString() ?? "",
	);
	const [localSizeMinGb, setLocalSizeMinGb] = useState(
		sp.sizeMin ? (sp.sizeMin / 1_073_741_824).toFixed(1) : "",
	);
	const [localSizeMaxGb, setLocalSizeMaxGb] = useState(
		sp.sizeMax ? (sp.sizeMax / 1_073_741_824).toFixed(1) : "",
	);
	const [localSeeders, setLocalSeeders] = useState(
		sp.seeders?.toString() ?? "",
	);

	const [debouncedQ] = useDebounce(localQ, 350);
	const [debouncedYearMin] = useDebounce(localYearMin, 500);
	const [debouncedYearMax] = useDebounce(localYearMax, 500);
	const [debouncedSizeMinGb] = useDebounce(localSizeMinGb, 500);
	const [debouncedSizeMaxGb] = useDebounce(localSizeMaxGb, 500);
	const [debouncedSeeders] = useDebounce(localSeeders, 500);

	// Checkbox filter state — all read directly from URL params
	const selectedTypes = useMemo(
		() => (sp.type ? sp.type.split(",") : []),
		[sp.type],
	);
	const selectedResolutions = useMemo(
		() => (sp.resolution ? sp.resolution.split(",") : []),
		[sp.resolution],
	);
	const selectedGenres = useMemo(
		() => (sp.genres ? sp.genres.split(",") : []),
		[sp.genres],
	);
	const selectedGroups = useMemo(
		() => (sp.group ? sp.group.split(",") : []),
		[sp.group],
	);

	// Sync debounced text inputs → URL
	useEffect(() => {
		navigate({
			to: "/torrents",
			search: { ...sp, q: debouncedQ || undefined, page: 0 },
			replace: true,
		});
	}, [debouncedQ]);

	useEffect(() => {
		const yearMin = debouncedYearMin ? Number(debouncedYearMin) : undefined;
		const yearMax = debouncedYearMax ? Number(debouncedYearMax) : undefined;
		navigate({
			to: "/torrents",
			search: { ...sp, yearMin, yearMax, page: 0 },
			replace: true,
		});
	}, [debouncedYearMin, debouncedYearMax]);

	useEffect(() => {
		const sizeMin = debouncedSizeMinGb
			? Math.round(Number(debouncedSizeMinGb) * 1_073_741_824)
			: undefined;
		const sizeMax = debouncedSizeMaxGb
			? Math.round(Number(debouncedSizeMaxGb) * 1_073_741_824)
			: undefined;
		navigate({
			to: "/torrents",
			search: { ...sp, sizeMin, sizeMax, page: 0 },
			replace: true,
		});
	}, [debouncedSizeMinGb, debouncedSizeMaxGb]);

	useEffect(() => {
		const seeders = debouncedSeeders ? Number(debouncedSeeders) : undefined;
		navigate({
			to: "/torrents",
			search: { ...sp, seeders, page: 0 },
			replace: true,
		});
	}, [debouncedSeeders]);

	// Checkbox toggle helpers (write directly to URL)
	const toggleType = (t: string) => {
		const next = selectedTypes.includes(t)
			? selectedTypes.filter((x) => x !== t)
			: [...selectedTypes, t];
		navigate({
			to: "/torrents",
			search: {
				...sp,
				type: next.length ? next.join(",") : undefined,
				page: 0,
			},
			replace: true,
		});
	};

	const toggleResolution = (r: string) => {
		const next = selectedResolutions.includes(r)
			? selectedResolutions.filter((x) => x !== r)
			: [...selectedResolutions, r];
		navigate({
			to: "/torrents",
			search: {
				...sp,
				resolution: next.length ? next.join(",") : undefined,
				page: 0,
			},
			replace: true,
		});
	};

	const toggleGenre = (g: string) => {
		const next = selectedGenres.includes(g)
			? selectedGenres.filter((x) => x !== g)
			: [...selectedGenres, g];
		navigate({
			to: "/torrents",
			search: {
				...sp,
				genres: next.length ? next.join(",") : undefined,
				page: 0,
			},
			replace: true,
		});
	};

	const toggleGroup = (g: string) => {
		const next = selectedGroups.includes(g)
			? selectedGroups.filter((x) => x !== g)
			: [...selectedGroups, g];
		navigate({
			to: "/torrents",
			search: {
				...sp,
				group: next.length ? next.join(",") : undefined,
				page: 0,
			},
			replace: true,
		});
	};

	const clearAllFilters = () => {
		setLocalQ("");
		setLocalYearMin("");
		setLocalYearMax("");
		setLocalSizeMinGb("");
		setLocalSizeMaxGb("");
		setLocalSeeders("");
		navigate({
			to: "/torrents",
			search: { sort: sp.sort, page: 0, limit: LIMIT },
			replace: true,
		});
	};

	const activeFilterCount =
		selectedTypes.length +
		selectedResolutions.length +
		selectedGenres.length +
		selectedGroups.length +
		(sp.yearMin !== undefined || sp.yearMax !== undefined ? 1 : 0) +
		(sp.sizeMin !== undefined || sp.sizeMax !== undefined ? 1 : 0) +
		(sp.seeders !== undefined ? 1 : 0) +
		(sp.q ? 1 : 0);

	// Build API input from URL params
	const apiInput = useMemo(() => {
		const input: Record<string, unknown> = {
			q: sp.q ?? "",
			sort: sp.sort,
			limit: sp.limit ?? LIMIT,
			offset: (sp.page ?? 0) * (sp.limit ?? LIMIT),
		};
		if (sp.type) input.type = sp.type.split(",");
		if (sp.resolution) input.resolution = sp.resolution.split(",");
		if (sp.group) input.group = sp.group.split(",");
		if (sp.genres) input.genres = sp.genres.split(",");
		if (sp.yearMin !== undefined || sp.yearMax !== undefined) {
			input.year = { min: sp.yearMin, max: sp.yearMax };
		}
		if (sp.sizeMin !== undefined || sp.sizeMax !== undefined) {
			input.size = { min: sp.sizeMin, max: sp.sizeMax };
		}
		if (sp.seeders !== undefined) input.seeders = sp.seeders;
		return input;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sp]);

	const results = useQuery(
		// biome-ignore lint/suspicious/noExplicitAny: dynamic API input construction
		orpc.search.searchTorrents.queryOptions({ input: apiInput as any }),
	);

	// ── Facet data ────────────────────────────────────────────────────────────
	const facetDist = results.data?.facetDistribution as
		| Record<string, Record<string, number>>
		| undefined;

	const typeFacets = useMemo(
		() => buildFacetList(facetDist?.type, selectedTypes, FALLBACK_TYPES),
		[facetDist?.type, selectedTypes],
	);
	const resFacets = useMemo(
		() =>
			buildFacetList(
				facetDist?.resolution,
				selectedResolutions,
				FALLBACK_RESOLUTIONS,
			),
		[facetDist?.resolution, selectedResolutions],
	);
	const genreFacets = useMemo(
		() =>
			buildFacetList(
				facetDist?.["enrichment.genres"],
				selectedGenres,
				FALLBACK_GENRES,
			),
		[facetDist?.["enrichment.genres"], selectedGenres],
	);
	const groupFacets = useMemo(
		() => buildFacetList(facetDist?.group, selectedGroups, []).slice(0, 25),
		[facetDist?.group, selectedGroups],
	);
	const sourceFacets = useMemo(
		() =>
			facetDist?.sourceNames
				? Object.entries(facetDist.sourceNames)
						.sort((a, b) => b[1] - a[1])
						.slice(0, 12)
				: [],
		[facetDist?.sourceNames],
	);

	// Sorting
	const currentSort = sp.sort ?? "seeders:desc";
	const [sortField, sortDir] = currentSort.split(":") as [SortField, SortDir];

	const handleSort = (field: SortField) => {
		const newDir: SortDir =
			sortField === field && sortDir === "desc" ? "asc" : "desc";
		navigate({
			to: "/torrents",
			search: { ...sp, sort: `${field}:${newDir}` as SortValue, page: 0 },
			replace: true,
		});
	};

	// Pagination
	const totalHits = results.data?.totalHits ?? 0;
	const pageSize = sp.limit ?? LIMIT;
	const currentPage = sp.page ?? 0;
	const totalPages = Math.ceil(totalHits / pageSize);

	const handlePage = (newPage: number) =>
		navigate({
			to: "/torrents",
			search: { ...sp, page: newPage },
			replace: true,
		});

	const SortHeader = ({
		field,
		label,
		right = false,
	}: {
		field: SortField;
		label: string;
		right?: boolean;
	}) => (
		<button
			type="button"
			onClick={() => handleSort(field)}
			className={`group flex items-center gap-1 font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest transition-colors hover:text-foreground ${right ? "ml-auto" : ""}`}
		>
			{label}
			{sortField === field ? (
				sortDir === "asc" ? (
					<ArrowUp className="size-3 text-primary" />
				) : (
					<ArrowDown className="size-3 text-primary" />
				)
			) : (
				<ChevronsUpDown className="size-3 opacity-25 transition-opacity group-hover:opacity-60" />
			)}
		</button>
	);

	return (
		<div className="relative flex min-h-screen">
			{/* Dot-grid background */}
			<div
				className="pointer-events-none fixed inset-0"
				style={{
					backgroundImage:
						"radial-gradient(circle, oklch(0.5 0 0 / 0.12) 1px, transparent 1px)",
					backgroundSize: "28px 28px",
				}}
			/>

			{/* ── Sidebar ──────────────────────────────────────────────────────── */}
			<aside className="sticky top-0 z-10 hidden max-h-screen min-h-screen w-64 shrink-0 flex-col overflow-y-auto border-border/40 border-r bg-background/90 backdrop-blur-sm md:flex">
				{/* Wordmark / nav */}
				<div className="flex items-center justify-between border-border/40 border-b px-5 py-4">
					<Link
						to="/"
						className="font-black font-mono text-base text-foreground tracking-tighter transition-colors hover:text-primary"
					>
						Minato
					</Link>
					<span className="font-mono text-[10px] text-muted-foreground/35 uppercase tracking-[0.2em]">
						browse
					</span>
				</div>

				{/* Search input */}
				<div className="border-border/40 border-b px-4 py-3">
					<div className="relative">
						<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 select-none font-mono text-primary/40 text-sm">
							/
						</span>
						<Input
							type="text"
							value={localQ}
							onChange={(e) => setLocalQ(e.target.value)}
							placeholder="search anything..."
							className="h-9 rounded-none border-border/40 bg-transparent pl-7 font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
						/>
						{localQ && (
							<button
								type="button"
								onClick={() => setLocalQ("")}
								className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground/35 transition-colors hover:text-foreground"
							>
								<X className="size-3" />
							</button>
						)}
					</div>
				</div>

				{/* Filters header */}
				<div className="flex items-center justify-between border-border/35 border-b px-4 py-2">
					<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/45 uppercase tracking-[0.2em]">
						<SlidersHorizontal className="size-3" />
						filters
						{activeFilterCount > 0 && (
							<span className="inline-flex size-4 items-center justify-center rounded-full bg-primary font-bold text-[9px] text-primary-foreground tabular-nums">
								{activeFilterCount}
							</span>
						)}
					</span>
					{activeFilterCount > 0 && (
						<button
							type="button"
							onClick={clearAllFilters}
							className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/35 transition-colors hover:text-destructive"
						>
							<X className="size-2.5" />
							clear
						</button>
					)}
				</div>

				{/* Type */}
				<FilterSection label="type" count={typeFacets.length}>
					<div className="space-y-0.5">
						{typeFacets.map(({ value, count }) => (
							<FilterCheckbox
								key={value}
								label={value}
								count={count}
								checked={selectedTypes.includes(value)}
								onCheckedChange={() => toggleType(value)}
							/>
						))}
					</div>
				</FilterSection>

				{/* Resolution */}
				<FilterSection label="resolution" count={resFacets.length}>
					<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
						{resFacets.map(({ value, count }) => (
							<FilterCheckbox
								key={value}
								label={value}
								count={count}
								checked={selectedResolutions.includes(value)}
								onCheckedChange={() => toggleResolution(value)}
							/>
						))}
					</div>
				</FilterSection>

				{/* Genre */}
				<FilterSection label="genre" count={genreFacets.length}>
					<ScrollArea className="h-44">
						<div className="space-y-0.5 pr-2">
							{genreFacets.map(({ value, count }) => (
								<FilterCheckbox
									key={value}
									label={value}
									count={count}
									checked={selectedGenres.includes(value)}
									onCheckedChange={() => toggleGenre(value)}
								/>
							))}
						</div>
					</ScrollArea>
				</FilterSection>

				{/* Release group — facet-driven */}
				{groupFacets.length > 0 && (
					<FilterSection label="group" count={groupFacets.length}>
						<ScrollArea className="h-36">
							<div className="space-y-0.5 pr-2">
								{groupFacets.map(({ value, count }) => (
									<FilterCheckbox
										key={value}
										label={value}
										count={count}
										checked={selectedGroups.includes(value)}
										onCheckedChange={() => toggleGroup(value)}
									/>
								))}
							</div>
						</ScrollArea>
					</FilterSection>
				)}

				{/* Source names — informational */}
				{sourceFacets.length > 0 && (
					<FilterSection label="source">
						<div className="space-y-0.5">
							{sourceFacets.map(([value, count]) => (
								<div
									key={value}
									className="flex items-center justify-between py-0.5"
								>
									<span className="font-mono text-[11px] text-muted-foreground/50">
										{value}
									</span>
									<span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums">
										{count.toLocaleString()}
									</span>
								</div>
							))}
						</div>
					</FilterSection>
				)}

				{/* Year range */}
				<FilterSection label="year">
					<div className="flex items-center gap-2">
						<Input
							type="number"
							value={localYearMin}
							onChange={(e) => setLocalYearMin(e.target.value)}
							placeholder="1900"
							className="h-7 rounded-none border-border/40 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
						/>
						<span className="shrink-0 font-mono text-muted-foreground/30 text-xs">
							—
						</span>
						<Input
							type="number"
							value={localYearMax}
							onChange={(e) => setLocalYearMax(e.target.value)}
							placeholder="2026"
							className="h-7 rounded-none border-border/40 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
						/>
					</div>
				</FilterSection>

				{/* Size range (GB) */}
				<FilterSection label="size (gb)">
					<div className="flex items-center gap-2">
						<Input
							type="number"
							value={localSizeMinGb}
							onChange={(e) => setLocalSizeMinGb(e.target.value)}
							placeholder="0"
							className="h-7 rounded-none border-border/40 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
						/>
						<span className="shrink-0 font-mono text-muted-foreground/30 text-xs">
							—
						</span>
						<Input
							type="number"
							value={localSizeMaxGb}
							onChange={(e) => setLocalSizeMaxGb(e.target.value)}
							placeholder="∞"
							className="h-7 rounded-none border-border/40 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
						/>
					</div>
				</FilterSection>

				{/* Min seeders */}
				<FilterSection label="min seeders">
					<Input
						type="number"
						min={0}
						value={localSeeders}
						onChange={(e) => setLocalSeeders(e.target.value)}
						placeholder="0"
						className="h-7 max-w-28 rounded-none border-border/40 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/25 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
					/>
				</FilterSection>
			</aside>

			{/* ── Main content ─────────────────────────────────────────────────── */}
			<main className="relative z-10 flex min-h-screen flex-1 flex-col overflow-hidden">
				{/* Toolbar */}
				<div className="sticky top-0 z-20 flex min-h-11 items-center justify-between gap-4 border-border/40 border-b bg-background/85 px-5 py-2.5 backdrop-blur-sm">
					<div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground/50 tabular-nums">
						{results.isLoading ? (
							<span className="animate-pulse">searching…</span>
						) : results.isSuccess ? (
							<>
								<span className="font-medium text-foreground/75">
									{results.data.totalHits.toLocaleString()}
								</span>
								<span>results</span>
								{results.data.processingTimeMs !== undefined && (
									<span className="hidden text-muted-foreground/30 sm:inline">
										· {results.data.processingTimeMs}ms
									</span>
								)}
							</>
						) : null}
					</div>

					{/* Sort selector */}
					<div className="flex shrink-0 items-center gap-2">
						<span className="hidden font-mono text-[10px] text-muted-foreground/35 uppercase tracking-[0.2em] sm:block">
							sort
						</span>
						<select
							value={sp.sort ?? "seeders:desc"}
							onChange={(e) =>
								navigate({
									to: "/torrents",
									search: { ...sp, sort: e.target.value as SortValue, page: 0 },
									replace: true,
								})
							}
							className="cursor-pointer border border-border/40 bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground/65 transition-colors hover:border-border/60 focus:border-primary/50 focus:outline-none"
						>
							<option value="seeders:desc">seeds ↓</option>
							<option value="seeders:asc">seeds ↑</option>
							<option value="size:desc">size ↓</option>
							<option value="size:asc">size ↑</option>
							<option value="publishedAt:desc">newest first</option>
							<option value="publishedAt:asc">oldest first</option>
							<option value="trackerTitle:asc">title A→Z</option>
							<option value="trackerTitle:desc">title Z→A</option>
						</select>
					</div>
				</div>

				{/* Results table */}
				<div className="flex-1 overflow-x-auto">
					<table className="w-full min-w-140 border-collapse">
						<thead>
							<tr className="border-border/25 border-b">
								<th className="px-5 py-2.5 text-left">
									<SortHeader field="trackerTitle" label="title" />
								</th>
								<th className="w-20 px-4 py-2.5 text-left">
									<span className="font-mono text-[11px] text-muted-foreground/35 uppercase tracking-widest">
										type
									</span>
								</th>
								<th className="w-16 px-4 py-2.5 text-left">
									<span className="font-mono text-[11px] text-muted-foreground/35 uppercase tracking-widest">
										res
									</span>
								</th>
								<th className="w-24 px-4 py-2.5 text-right">
									<div className="flex justify-end">
										<SortHeader field="size" label="size" right />
									</div>
								</th>
								<th className="w-20 px-4 py-2.5 text-right">
									<div className="flex justify-end">
										<SortHeader field="seeders" label="seeds" right />
									</div>
								</th>
								<th className="hidden w-16 px-4 py-2.5 text-right lg:table-cell">
									<span className="font-mono text-[11px] text-muted-foreground/35 uppercase tracking-widest">
										leech
									</span>
								</th>
								<th className="hidden w-28 px-4 py-2.5 text-right xl:table-cell">
									<div className="flex justify-end">
										<SortHeader field="publishedAt" label="date" right />
									</div>
								</th>
							</tr>
						</thead>

						<tbody>
							{/* Loading skeleton */}
							{results.isLoading &&
								Array.from({ length: 20 }).map((_, i) => (
									<tr
										// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
										key={i}
										className="border-border/15 border-b"
										style={{ opacity: 1 - i * 0.04 }}
									>
										<td className="px-5 py-3">
											<div
												className="h-2.5 animate-pulse bg-muted/35"
												style={{ width: `${55 + ((i * 17) % 35)}%` }}
											/>
										</td>
										<td className="px-4 py-3">
											<div className="h-2.5 w-12 animate-pulse bg-muted/25" />
										</td>
										<td className="px-4 py-3">
											<div className="h-2.5 w-10 animate-pulse bg-muted/25" />
										</td>
										<td className="px-4 py-3">
											<div className="ml-auto h-2.5 w-14 animate-pulse bg-muted/25" />
										</td>
										<td className="px-4 py-3">
											<div className="ml-auto h-2.5 w-8 animate-pulse bg-muted/25" />
										</td>
										<td className="hidden px-4 py-3 lg:table-cell">
											<div className="ml-auto h-2.5 w-8 animate-pulse bg-muted/20" />
										</td>
										<td className="hidden px-4 py-3 xl:table-cell">
											<div className="ml-auto h-2.5 w-20 animate-pulse bg-muted/20" />
										</td>
									</tr>
								))}

							{/* Error */}
							{results.isError && (
								<tr>
									<td colSpan={7} className="px-5 py-16 text-center">
										<p className="font-mono text-destructive/70 text-xs">
											error: failed to fetch results
										</p>
									</td>
								</tr>
							)}

							{/* Empty state */}
							{results.isSuccess && results.data.hits.length === 0 && (
								<tr>
									<td colSpan={7} className="px-5 py-20 text-center">
										<p className="font-mono text-muted-foreground/35 text-sm">
											<span className="text-primary/40">0</span> results
											{sp.q ? (
												<>
													{" "}
													for{" "}
													<span className="text-foreground/40">"{sp.q}"</span>
												</>
											) : (
												""
											)}
										</p>
										<p className="mt-1.5 font-mono text-[11px] text-muted-foreground/25">
											try different keywords or loosen the filters
										</p>
									</td>
								</tr>
							)}

							{/* Data rows */}
							{results.isSuccess &&
								results.data.hits.map((hit) => (
									<tr
										key={hit.infoHash}
										onClick={() =>
											navigate({
												to: "/torrents/$torrent",
												params: { torrent: hit.infoHash },
											})
										}
										className="group cursor-pointer border-border/15 border-b transition-colors hover:bg-primary/4"
									>
										{/* Title */}
										<td className="w-full min-w-0 max-w-px px-5 py-2.5">
											<span className="line-clamp-1 block font-mono text-foreground/75 text-xs transition-colors group-hover:text-foreground">
												{hit.trackerTitle || "—"}
											</span>
											{hit.enrichment?.title &&
												hit.enrichment.title !== hit.trackerTitle && (
													<span className="mt-0.5 line-clamp-1 block font-mono text-[10px] text-muted-foreground/35">
														{hit.enrichment.title}
														{hit.enrichment.year
															? ` (${hit.enrichment.year})`
															: ""}
													</span>
												)}
										</td>

										{/* Type */}
										<td className="whitespace-nowrap px-4 py-2.5">
											{hit.type ? (
												<span className="font-mono text-[11px] text-muted-foreground/55">
													{hit.type}
												</span>
											) : (
												<span className="font-mono text-[11px] text-muted-foreground/20">
													—
												</span>
											)}
										</td>

										{/* Resolution */}
										<td className="whitespace-nowrap px-4 py-2.5">
											{hit.resolution ? (
												<span className="font-mono text-[11px] text-primary/55">
													{hit.resolution}
												</span>
											) : (
												<span className="font-mono text-[11px] text-muted-foreground/20">
													—
												</span>
											)}
										</td>

										{/* Size */}
										<td className="whitespace-nowrap px-4 py-2.5 text-right">
											<span className="font-mono text-[11px] text-muted-foreground/55 tabular-nums">
												{hit.size ? formatBytesString(String(hit.size)) : "—"}
											</span>
										</td>

										{/* Seeders */}
										<td className="whitespace-nowrap px-4 py-2.5 text-right">
											<span className="font-mono text-[11px] text-green-500/65 tabular-nums">
												{hit.seeders ?? "—"}
											</span>
										</td>

										{/* Leechers */}
										<td className="hidden whitespace-nowrap px-4 py-2.5 text-right lg:table-cell">
											<span className="font-mono text-[11px] text-red-500/55 tabular-nums">
												{hit.leechers ?? "—"}
											</span>
										</td>

										{/* Date */}
										<td className="hidden whitespace-nowrap px-4 py-2.5 text-right xl:table-cell">
											{hit.publishedAt ? (
												<span className="font-mono text-[11px] text-muted-foreground/45 tabular-nums">
													{new Date(hit.publishedAt).toISOString().slice(0, 10)}
												</span>
											) : (
												<span className="font-mono text-[11px] text-muted-foreground/20">
													—
												</span>
											)}
										</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				{results.isSuccess && totalPages > 1 && (
					<div className="sticky bottom-0 z-10 flex items-center justify-between border-border/40 border-t bg-background/85 px-5 py-2.5 backdrop-blur-sm">
						<span className="font-mono text-[11px] text-muted-foreground/45 tabular-nums">
							{(currentPage * pageSize + 1).toLocaleString()}–
							{Math.min(
								(currentPage + 1) * pageSize,
								totalHits,
							).toLocaleString()}{" "}
							of {totalHits.toLocaleString()}
						</span>
						<div className="flex items-center gap-1">
							<PageButton
								onClick={() => handlePage(currentPage - 1)}
								disabled={currentPage === 0}
								icon={<ChevronLeft className="size-3" />}
								label="prev"
							/>
							<span className="px-3 font-mono text-[11px] text-muted-foreground/40 tabular-nums">
								{currentPage + 1} / {totalPages}
							</span>
							<PageButton
								onClick={() => handlePage(currentPage + 1)}
								disabled={currentPage >= totalPages - 1}
								icon={<ChevronRight className="size-3" />}
								label="next"
								iconAfter
							/>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterSection({
	label,
	count,
	children,
}: {
	label: string;
	count?: number;
	children: React.ReactNode;
}) {
	return (
		<div className="border-border/25 border-b">
			<div className="flex items-center justify-between px-4 pt-3 pb-1.5">
				<p className="font-mono text-[10px] text-muted-foreground/35 uppercase tracking-[0.2em]">
					{label}
				</p>
				{count !== undefined && (
					<span className="font-mono text-[10px] text-muted-foreground/25 tabular-nums">
						{count}
					</span>
				)}
			</div>
			<div className="px-4 pb-3">{children}</div>
		</div>
	);
}

function FilterCheckbox({
	label,
	count,
	checked,
	onCheckedChange,
}: {
	label: string;
	count?: number;
	checked: boolean;
	onCheckedChange: () => void;
}) {
	const isEmpty = count === 0 && !checked;
	return (
		<label
			className={`group flex cursor-pointer select-none items-center gap-2 py-0.5 ${
				isEmpty ? "pointer-events-none opacity-30" : ""
			}`}
		>
			<Checkbox
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="size-3 shrink-0 rounded-none border-border/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			/>
			<span
				className={`min-w-0 flex-1 truncate font-mono text-[11px] transition-colors ${
					checked
						? "text-foreground/85"
						: "text-muted-foreground/50 group-hover:text-foreground/65"
				}`}
			>
				{label}
			</span>
			{count !== undefined && (
				<span className="shrink-0 font-mono text-[10px] text-muted-foreground/30 tabular-nums">
					{count.toLocaleString()}
				</span>
			)}
		</label>
	);
}

function PageButton({
	onClick,
	disabled,
	icon,
	label,
	iconAfter = false,
}: {
	onClick: () => void;
	disabled: boolean;
	icon: React.ReactNode;
	label: string;
	iconAfter?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className="flex items-center gap-1 border border-border/35 px-3 py-1.5 font-mono text-[11px] text-muted-foreground/55 transition-colors hover:border-border/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25"
		>
			{!iconAfter && icon}
			{label}
			{iconAfter && icon}
		</button>
	);
}
