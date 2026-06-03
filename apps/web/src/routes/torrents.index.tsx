import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowDown,
	ArrowUp,
	ChevronsUpDown,
	CircleAlert,
	Loader2,
	PanelLeft,
	SlidersHorizontal,
	X,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn, formatBytesString } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const torrentsSearchSchema = z.object({
	q: z.string().optional().default(""),
	type: z.string().optional(),
	resolution: z.string().optional(),
	group: z.string().optional(),
	genres: z.string().optional(),
	yearMin: z.coerce.number().optional(),
	yearMax: z.coerce.number().optional(),
	sizeMin: z.coerce.number().optional(),
	sizeMax: z.coerce.number().optional(),
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

type TorrentHit = {
	infoHash: string;
	trackerTitle?: string | null;
	type?: string | null;
	resolution?: string | null;
	group?: string | null;
	size?: string | number | null;
	seeders?: number | null;
	leechers?: number | null;
	publishedAt?: string | Date | null;
	enrichment?: {
		title?: string | null;
		year?: number | null;
	} | null;
};

type FacetEntry = { value: string; count?: number };

type TableMeta = {
	headClassName?: string;
	cellClassName?: string;
};

type SearchPatchOptions = {
	resetPage?: boolean;
	replace?: boolean;
};

type FilterBlockProps = {
	activeFilterCount: number;
	localQ: string;
	setLocalQ: (value: string) => void;
	localYearMin: string;
	setLocalYearMin: (value: string) => void;
	localYearMax: string;
	setLocalYearMax: (value: string) => void;
	localSizeMinGb: string;
	setLocalSizeMinGb: (value: string) => void;
	localSizeMaxGb: string;
	setLocalSizeMaxGb: (value: string) => void;
	localSeeders: string;
	setLocalSeeders: (value: string) => void;
	typeFacets: FacetEntry[];
	resFacets: FacetEntry[];
	genreFacets: FacetEntry[];
	groupFacets: FacetEntry[];
	sourceFacets: Array<[string, number]>;
	selectedTypes: string[];
	selectedResolutions: string[];
	selectedGenres: string[];
	selectedGroups: string[];
	toggleType: (value: string) => void;
	toggleResolution: (value: string) => void;
	toggleGenre: (value: string) => void;
	toggleGroup: (value: string) => void;
	clearAllFilters: () => void;
	includeWordmark?: boolean;
	compactSearch?: boolean;
};

const LIMIT = 50;
const DEFAULT_SORT: SortValue = "seeders:desc";
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
const SKELETON_KEYS = Array.from({ length: 20 }, (_, i) => `row-${i + 1}`);

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
	{ value: "seeders:desc", label: "seeds ↓" },
	{ value: "seeders:asc", label: "seeds ↑" },
	{ value: "size:desc", label: "size ↓" },
	{ value: "size:asc", label: "size ↑" },
	{ value: "publishedAt:desc", label: "newest first" },
	{ value: "publishedAt:asc", label: "oldest first" },
	{ value: "trackerTitle:asc", label: "title A→Z" },
	{ value: "trackerTitle:desc", label: "title Z→A" },
];

export const Route = createFileRoute("/torrents/")({
	component: TorrentBrowseComponent,
	validateSearch: torrentsSearchSchema,
});

function TorrentBrowseComponent() {
	const navigate = useNavigate();
	const sp = Route.useSearch();
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

	const [localQ, setLocalQ] = useState(sp.q ?? "");
	const [localYearMin, setLocalYearMin] = useState(
		sp.yearMin?.toString() ?? "",
	);
	const [localYearMax, setLocalYearMax] = useState(
		sp.yearMax?.toString() ?? "",
	);
	const [localSizeMinGb, setLocalSizeMinGb] = useState(
		sp.sizeMin ? bytesToGbString(sp.sizeMin) : "",
	);
	const [localSizeMaxGb, setLocalSizeMaxGb] = useState(
		sp.sizeMax ? bytesToGbString(sp.sizeMax) : "",
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

	useEffect(() => setLocalQ(sp.q ?? ""), [sp.q]);
	useEffect(() => setLocalYearMin(sp.yearMin?.toString() ?? ""), [sp.yearMin]);
	useEffect(() => setLocalYearMax(sp.yearMax?.toString() ?? ""), [sp.yearMax]);
	useEffect(
		() => setLocalSizeMinGb(sp.sizeMin ? bytesToGbString(sp.sizeMin) : ""),
		[sp.sizeMin],
	);
	useEffect(
		() => setLocalSizeMaxGb(sp.sizeMax ? bytesToGbString(sp.sizeMax) : ""),
		[sp.sizeMax],
	);
	useEffect(() => setLocalSeeders(sp.seeders?.toString() ?? ""), [sp.seeders]);

	const selectedTypes = useMemo(() => csvParamToArray(sp.type), [sp.type]);
	const selectedResolutions = useMemo(
		() => csvParamToArray(sp.resolution),
		[sp.resolution],
	);
	const selectedGenres = useMemo(() => csvParamToArray(sp.genres), [sp.genres]);
	const selectedGroups = useMemo(() => csvParamToArray(sp.group), [sp.group]);

	const navigateWithPatch = useCallback(
		(patch: Partial<TorrentsSearch>, options: SearchPatchOptions = {}) => {
			const next = buildNextSearch(sp, patch, options);
			if (searchesEqual(sp, next)) return;

			void navigate({
				to: "/torrents",
				search: next,
				replace: options.replace ?? true,
			});
		},
		[navigate, sp],
	);

	useEffect(() => {
		const q = debouncedQ.trim();
		if (q === (sp.q ?? "")) return;
		navigateWithPatch({ q: q || undefined }, { resetPage: true });
	}, [debouncedQ, navigateWithPatch, sp.q]);

	useEffect(() => {
		const yearMin = parseOptionalInt(debouncedYearMin);
		const yearMax = parseOptionalInt(debouncedYearMax);
		if (yearMin === sp.yearMin && yearMax === sp.yearMax) return;
		navigateWithPatch({ yearMin, yearMax }, { resetPage: true });
	}, [
		debouncedYearMax,
		debouncedYearMin,
		navigateWithPatch,
		sp.yearMax,
		sp.yearMin,
	]);

	useEffect(() => {
		const sizeMin = parseOptionalGbToBytes(debouncedSizeMinGb);
		const sizeMax = parseOptionalGbToBytes(debouncedSizeMaxGb);
		if (sizeMin === sp.sizeMin && sizeMax === sp.sizeMax) return;
		navigateWithPatch({ sizeMin, sizeMax }, { resetPage: true });
	}, [
		debouncedSizeMaxGb,
		debouncedSizeMinGb,
		navigateWithPatch,
		sp.sizeMax,
		sp.sizeMin,
	]);

	useEffect(() => {
		const seeders = parseOptionalInt(debouncedSeeders);
		if (seeders === sp.seeders) return;
		navigateWithPatch({ seeders }, { resetPage: true });
	}, [debouncedSeeders, navigateWithPatch, sp.seeders]);

	const toggleType = useCallback(
		(value: string) => {
			navigateWithPatch(
				{ type: toggleCsvSelection(sp.type, value) },
				{ resetPage: true },
			);
		},
		[navigateWithPatch, sp.type],
	);

	const toggleResolution = useCallback(
		(value: string) => {
			navigateWithPatch(
				{ resolution: toggleCsvSelection(sp.resolution, value) },
				{ resetPage: true },
			);
		},
		[navigateWithPatch, sp.resolution],
	);

	const toggleGenre = useCallback(
		(value: string) => {
			navigateWithPatch(
				{ genres: toggleCsvSelection(sp.genres, value) },
				{ resetPage: true },
			);
		},
		[navigateWithPatch, sp.genres],
	);

	const toggleGroup = useCallback(
		(value: string) => {
			navigateWithPatch(
				{ group: toggleCsvSelection(sp.group, value) },
				{ resetPage: true },
			);
		},
		[navigateWithPatch, sp.group],
	);

	const clearAllFilters = useCallback(() => {
		setLocalQ("");
		setLocalYearMin("");
		setLocalYearMax("");
		setLocalSizeMinGb("");
		setLocalSizeMaxGb("");
		setLocalSeeders("");
		navigateWithPatch(
			{
				q: undefined,
				type: undefined,
				resolution: undefined,
				group: undefined,
				genres: undefined,
				yearMin: undefined,
				yearMax: undefined,
				sizeMin: undefined,
				sizeMax: undefined,
				seeders: undefined,
			},
			{ resetPage: true },
		);
	}, [navigateWithPatch]);

	const activeFilterCount =
		selectedTypes.length +
		selectedResolutions.length +
		selectedGenres.length +
		selectedGroups.length +
		(sp.yearMin !== undefined || sp.yearMax !== undefined ? 1 : 0) +
		(sp.sizeMin !== undefined || sp.sizeMax !== undefined ? 1 : 0) +
		(sp.seeders !== undefined ? 1 : 0) +
		((sp.q ?? "").trim() ? 1 : 0);

	const apiInput = useMemo(() => {
		const input: Record<string, unknown> = {
			q: sp.q ?? "",
			sort: sp.sort,
			limit: sp.limit ?? LIMIT,
			offset: (sp.page ?? 0) * (sp.limit ?? LIMIT),
		};

		if (sp.type) input.type = csvParamToArray(sp.type);
		if (sp.resolution) input.resolution = csvParamToArray(sp.resolution);
		if (sp.group) input.group = csvParamToArray(sp.group);
		if (sp.genres) input.genres = csvParamToArray(sp.genres);
		if (sp.yearMin !== undefined || sp.yearMax !== undefined) {
			input.year = { min: sp.yearMin, max: sp.yearMax };
		}
		if (sp.sizeMin !== undefined || sp.sizeMax !== undefined) {
			input.size = { min: sp.sizeMin, max: sp.sizeMax };
		}
		if (sp.seeders !== undefined) input.seeders = sp.seeders;

		return input;
	}, [sp]);

	const results = useQuery({
		// biome-ignore lint/suspicious/noExplicitAny: dynamic API input mirrors validated URL schema
		...orpc.search.searchTorrents.queryOptions({ input: apiInput as any }),
		placeholderData: keepPreviousData,
	});

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

	const currentSort = (sp.sort ?? DEFAULT_SORT) as SortValue;
	const [sortField, sortDir] = currentSort.split(":") as [SortField, SortDir];

	const handleSort = useCallback(
		(field: SortField) => {
			const nextDir: SortDir =
				sortField === field && sortDir === "desc" ? "asc" : "desc";
			navigateWithPatch(
				{ sort: `${field}:${nextDir}` as SortValue },
				{ resetPage: true },
			);
		},
		[navigateWithPatch, sortDir, sortField],
	);

	const totalHits = results.data?.totalHits ?? 0;
	const pageSize = sp.limit ?? LIMIT;
	const currentPage = sp.page ?? 0;
	const totalPages = Math.ceil(totalHits / pageSize);
	const hasResults = results.isSuccess && (results.data?.hits.length ?? 0) > 0;
	const isInitialLoading = results.isPending && !results.data;
	const isRefreshing = results.isFetching && !!results.data;

	useEffect(() => {
		if (!results.isSuccess) return;
		if (totalPages === 0) return;
		if (currentPage <= totalPages - 1) return;

		navigateWithPatch(
			{ page: Math.max(0, totalPages - 1) },
			{ resetPage: false },
		);
	}, [currentPage, navigateWithPatch, results.isSuccess, totalPages]);

	const handlePage = (nextPage: number) => {
		if (nextPage < 0) return;
		if (totalPages > 0 && nextPage > totalPages - 1) return;
		if (nextPage === currentPage) return;

		navigateWithPatch({ page: nextPage }, { resetPage: false, replace: false });
	};

	const hits = ((results.data?.hits ?? []) as TorrentHit[]) ?? [];

	const columns = useMemo<ColumnDef<TorrentHit>[]>(() => {
		return [
			{
				id: "trackerTitle",
				accessorKey: "trackerTitle",
				header: () => (
					<SortHeader
						field="trackerTitle"
						label="title"
						onSort={handleSort}
						sortField={sortField}
						sortDir={sortDir}
					/>
				),
				meta: {
					headClassName: "px-5 py-2.5 text-left",
					cellClassName: "px-5 py-2.5 min-w-0 max-w-px w-full",
				} satisfies TableMeta,
				cell: ({ row }) => {
					const hit = row.original;
					return (
						<>
							<span className="line-clamp-1 block font-mono text-xs text-foreground/90 transition-colors group-hover:text-foreground">
								{hit.trackerTitle || "—"}
							</span>
							{hit.enrichment?.title &&
								hit.enrichment.title !== hit.trackerTitle && (
									<span className="mt-0.5 line-clamp-1 block font-mono text-[11px] text-muted-foreground/60">
										{hit.enrichment.title}
										{hit.enrichment.year ? ` (${hit.enrichment.year})` : ""}
									</span>
								)}
						</>
					);
				},
			},
			{
				id: "type",
				accessorKey: "type",
				header: () => (
					<span className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">
						type
					</span>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-left w-20",
					cellClassName: "px-4 py-2.5 whitespace-nowrap",
				} satisfies TableMeta,
				cell: ({ row }) =>
					row.original.type ? (
						<span className="font-mono text-xs text-muted-foreground/75">
							{row.original.type}
						</span>
					) : (
						<span className="font-mono text-xs text-muted-foreground/65">
							—
						</span>
					),
			},
			{
				id: "resolution",
				accessorKey: "resolution",
				header: () => (
					<span className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">
						res
					</span>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-left w-16",
					cellClassName: "px-4 py-2.5 whitespace-nowrap",
				} satisfies TableMeta,
				cell: ({ row }) =>
					row.original.resolution ? (
						<span className="font-mono text-xs text-primary/75">
							{row.original.resolution}
						</span>
					) : (
						<span className="font-mono text-xs text-muted-foreground/65">
							—
						</span>
					),
			},
			{
				id: "size",
				accessorKey: "size",
				header: () => (
					<SortHeader
						field="size"
						label="size"
						onSort={handleSort}
						sortField={sortField}
						sortDir={sortDir}
						right
					/>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-right w-24",
					cellClassName: "px-4 py-2.5 text-right whitespace-nowrap",
				} satisfies TableMeta,
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground/75 tabular-nums">
						{row.original.size
							? formatBytesString(String(row.original.size))
							: "—"}
					</span>
				),
			},
			{
				id: "seeders",
				accessorKey: "seeders",
				header: () => (
					<SortHeader
						field="seeders"
						label="seeds"
						onSort={handleSort}
						sortField={sortField}
						sortDir={sortDir}
						right
					/>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-right w-20",
					cellClassName: "px-4 py-2.5 text-right whitespace-nowrap",
				} satisfies TableMeta,
				cell: ({ row }) => (
					<span className="font-mono text-xs text-green-500/85 tabular-nums">
						{row.original.seeders ?? "—"}
					</span>
				),
			},
			{
				id: "leechers",
				accessorKey: "leechers",
				header: () => (
					<span className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">
						leech
					</span>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-right w-16 hidden lg:table-cell",
					cellClassName:
						"px-4 py-2.5 text-right whitespace-nowrap hidden lg:table-cell",
				} satisfies TableMeta,
				cell: ({ row }) => (
					<span className="font-mono text-xs text-red-500/75 tabular-nums">
						{row.original.leechers ?? "—"}
					</span>
				),
			},
			{
				id: "publishedAt",
				accessorKey: "publishedAt",
				header: () => (
					<SortHeader
						field="publishedAt"
						label="date"
						onSort={handleSort}
						sortField={sortField}
						sortDir={sortDir}
						right
					/>
				),
				meta: {
					headClassName: "px-4 py-2.5 text-right w-28 hidden xl:table-cell",
					cellClassName:
						"px-4 py-2.5 text-right whitespace-nowrap hidden xl:table-cell",
				} satisfies TableMeta,
				cell: ({ row }) => {
					const date = row.original.publishedAt
						? formatDateCell(row.original.publishedAt)
						: null;
					return date ? (
						<span className="font-mono text-xs text-muted-foreground/65 tabular-nums">
							{date}
						</span>
					) : (
						<span className="font-mono text-xs text-muted-foreground/65">
							—
						</span>
					);
				},
			},
		];
	}, [handleSort, sortDir, sortField]);

	const table = useReactTable({
		data: hits,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualSorting: true,
	});

	const activeChips = buildActiveChips({
		sp,
		selectedTypes,
		selectedResolutions,
		selectedGenres,
		selectedGroups,
		toggleType,
		toggleResolution,
		toggleGenre,
		toggleGroup,
		clearText: () => {
			setLocalQ("");
			navigateWithPatch({ q: undefined }, { resetPage: true });
		},
		clearYear: () => {
			setLocalYearMin("");
			setLocalYearMax("");
			navigateWithPatch(
				{ yearMin: undefined, yearMax: undefined },
				{ resetPage: true },
			);
		},
		clearSize: () => {
			setLocalSizeMinGb("");
			setLocalSizeMaxGb("");
			navigateWithPatch(
				{ sizeMin: undefined, sizeMax: undefined },
				{ resetPage: true },
			);
		},
		clearSeeders: () => {
			setLocalSeeders("");
			navigateWithPatch({ seeders: undefined }, { resetPage: true });
		},
	});

	const filterProps: FilterBlockProps = {
		activeFilterCount,
		localQ,
		setLocalQ,
		localYearMin,
		setLocalYearMin,
		localYearMax,
		setLocalYearMax,
		localSizeMinGb,
		setLocalSizeMinGb,
		localSizeMaxGb,
		setLocalSizeMaxGb,
		localSeeders,
		setLocalSeeders,
		typeFacets,
		resFacets,
		genreFacets,
		groupFacets,
		sourceFacets,
		selectedTypes,
		selectedResolutions,
		selectedGenres,
		selectedGroups,
		toggleType,
		toggleResolution,
		toggleGenre,
		toggleGroup,
		clearAllFilters,
	};

	const pageStart = totalHits === 0 ? 0 : currentPage * pageSize + 1;
	const pageEnd =
		totalHits === 0 ? 0 : Math.min((currentPage + 1) * pageSize, totalHits);

	return (
			<Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
				<div className="minato-console relative min-h-screen pt-[calc(var(--minato-header-height)+0.875rem)] sm:pt-[calc(var(--minato-header-height)+1rem)]">
					<div
						className="pointer-events-none fixed inset-0"
						style={{
							backgroundImage:
								"radial-gradient(circle, var(--minato-grid-color) 1px, transparent 1px)",
							backgroundSize: "28px 28px",
						}}
					/>
					<div className="minato-shell-container">
						<div className="relative z-10 flex min-h-[calc(100dvh-var(--minato-header-height)-1rem)] items-start gap-3">
							<aside className="sticky top-[calc(var(--minato-header-height)+0.875rem)] z-10 hidden h-[calc(100dvh-var(--minato-header-height)-1.125rem)] w-72 shrink-0 self-start flex-col overflow-y-auto rounded-[calc(var(--radius)+6px)] border border-border/50 bg-background/92 backdrop-blur-sm md:flex sm:top-[calc(var(--minato-header-height)+1rem)] sm:h-[calc(100dvh-var(--minato-header-height)-1.25rem)]">
								<FiltersPanel {...filterProps} includeWordmark />
							</aside>

							<main className="relative z-10 flex min-h-[calc(100dvh-var(--minato-header-height)-1rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border/50 bg-background/92 backdrop-blur-sm">
								{activeChips.length > 0 && (
									<div className="border-border/45 border-b bg-background/88 px-5 py-2 backdrop-blur-sm">
										<div className="flex flex-wrap items-center gap-1.5">
											{activeChips.map((chip) => (
												<Button
													key={chip.key}
													type="button"
													variant="ghost"
													size="xs"
													onClick={chip.onRemove}
													className="h-6 rounded-none border border-border/45 px-2 font-mono text-[11px] text-muted-foreground/75 hover:border-border/60 hover:text-foreground"
												>
													<span className="max-w-40 truncate">{chip.label}</span>
													<X className="size-2.5" />
												</Button>
											))}
											<Button
												type="button"
												variant="ghost"
												size="xs"
												onClick={clearAllFilters}
												className="h-6 rounded-none px-2 font-mono text-[11px] text-muted-foreground/65 hover:text-destructive"
											>
												clear all
											</Button>
										</div>
									</div>
								)}
								<div className="sticky top-[calc(var(--minato-header-height)+0.875rem)] z-20 border-border/50 border-b bg-background/95 backdrop-blur-sm sm:top-[calc(var(--minato-header-height)+1rem)]">
							<div className="flex min-h-11 items-center justify-between gap-4 px-5 py-2.5">
								<div className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground/70 tabular-nums">
									{isInitialLoading ? (
									<span className="animate-pulse">searching…</span>
								) : results.isSuccess ? (
									<>
										<span className="font-medium text-foreground/90">
											{results.data.totalHits.toLocaleString()}
										</span>
										<span>results</span>
										{results.data.processingTimeMs !== undefined && (
											<span className="hidden text-muted-foreground/70 sm:inline">
												· {results.data.processingTimeMs}ms
											</span>
										)}
										{isRefreshing && (
											<span className="inline-flex items-center gap-1 text-muted-foreground/60">
												<Loader2 className="size-3 animate-spin" />
												updating
											</span>
										)}
									</>
								) : null}
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<SheetTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 rounded-none border border-border/50 px-2 font-mono text-xs text-muted-foreground/60 hover:border-border/60 hover:text-foreground md:hidden"
									>
										<PanelLeft className="size-3.5" />
										filters
										{activeFilterCount > 0 && (
											<Badge className="h-4 min-w-4 rounded-full px-1 text-[9px] tabular-nums">
												{activeFilterCount}
											</Badge>
										)}
									</Button>
								</SheetTrigger>

								<span className="hidden font-mono text-[11px] text-muted-foreground/60 uppercase tracking-[0.2em] sm:block">
									sort
								</span>
								<Select
									value={sp.sort ?? DEFAULT_SORT}
									onValueChange={(value) =>
										navigateWithPatch(
											{ sort: value as SortValue },
											{ resetPage: true },
										)
									}
								>
									<SelectTrigger
										size="sm"
										className="h-7 min-w-[138px] rounded-none border border-border/50 bg-background px-2 font-mono text-xs text-muted-foreground/65 shadow-none hover:border-border/60 focus-visible:ring-0"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="rounded-none font-mono">
										{SORT_OPTIONS.map((option) => (
											<SelectItem
												key={option.value}
												value={option.value}
												className="rounded-none font-mono text-xs"
											>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="px-4 pb-3 md:hidden">
							<SearchBox
								localQ={localQ}
								setLocalQ={setLocalQ}
								compact={false}
								placeholder="search anything..."
							/>
						</div>

						</div>

								<div className="relative flex-1 overflow-x-auto overflow-y-hidden">
							{isRefreshing && (
								<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
							)}

						<Table className="w-full min-w-140 border-collapse">
							<TableHeader>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow
										key={headerGroup.id}
										className="border-border/45 border-b hover:bg-transparent"
									>
										{headerGroup.headers.map((header) => {
											const meta = header.column.columnDef.meta as
												| TableMeta
												| undefined;
											return (
												<TableHead
													key={header.id}
													className={meta?.headClassName}
												>
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</TableHead>
											);
										})}
									</TableRow>
								))}
							</TableHeader>

							<TableBody>
								{isInitialLoading &&
									SKELETON_KEYS.map((key, i) => (
										<TableRow
											key={key}
											className="border-border/45 border-b hover:bg-transparent"
											style={{ opacity: 1 - i * 0.04 }}
										>
											<TableCell className="px-5 py-3">
												<Skeleton
													className="h-2.5 rounded-none bg-muted/35"
													style={{ width: `${55 + ((i * 17) % 35)}%` }}
												/>
											</TableCell>
											<TableCell className="px-4 py-3">
												<Skeleton className="h-2.5 w-12 rounded-none bg-muted/25" />
											</TableCell>
											<TableCell className="px-4 py-3">
												<Skeleton className="h-2.5 w-10 rounded-none bg-muted/25" />
											</TableCell>
											<TableCell className="px-4 py-3">
												<Skeleton className="ml-auto h-2.5 w-14 rounded-none bg-muted/25" />
											</TableCell>
											<TableCell className="px-4 py-3">
												<Skeleton className="ml-auto h-2.5 w-8 rounded-none bg-muted/25" />
											</TableCell>
											<TableCell className="hidden px-4 py-3 lg:table-cell">
												<Skeleton className="ml-auto h-2.5 w-8 rounded-none bg-muted/20" />
											</TableCell>
											<TableCell className="hidden px-4 py-3 xl:table-cell">
												<Skeleton className="ml-auto h-2.5 w-20 rounded-none bg-muted/20" />
											</TableCell>
										</TableRow>
									))}

								{results.isError && (
									<TableRow className="hover:bg-transparent">
										<TableCell colSpan={7} className="px-5 py-12">
											<Alert
												variant="destructive"
												className="rounded-none border-destructive/25 bg-transparent px-4 py-3"
											>
												<CircleAlert className="size-4" />
												<AlertTitle className="font-mono text-xs">
													error: failed to fetch results
												</AlertTitle>
												<AlertDescription className="font-mono text-xs text-destructive/90">
													<div className="flex items-center gap-2">
														<span>try again or adjust the query.</span>
														<Button
															type="button"
															variant="ghost"
															size="xs"
															onClick={() => void results.refetch()}
															className="h-6 rounded-none border border-destructive/25 px-2 font-mono text-[11px]"
														>
															retry
														</Button>
													</div>
												</AlertDescription>
											</Alert>
										</TableCell>
									</TableRow>
								)}

								{results.isSuccess && !hasResults && (
									<TableRow className="hover:bg-transparent">
										<TableCell colSpan={7} className="px-5 py-16">
											<Empty className="gap-2 rounded-none border border-border/45 bg-transparent p-8">
												<EmptyHeader className="items-center gap-1">
													<EmptyTitle className="font-mono text-muted-foreground/75 text-sm">
														<span className="text-primary/60">0</span> results
														{sp.q ? (
															<>
																{" "}
																for{" "}
																<span className="text-foreground/80">
																	"{sp.q}"
																</span>
															</>
														) : null}
													</EmptyTitle>
													<EmptyDescription className="font-mono text-xs text-muted-foreground/60">
														try different keywords or loosen the filters
													</EmptyDescription>
												</EmptyHeader>
												<div className="mt-1 flex items-center gap-2">
													<Button
														type="button"
														variant="ghost"
														size="xs"
														onClick={clearAllFilters}
														className="h-7 rounded-none border border-border/45 px-3 font-mono text-[11px]"
													>
														clear filters
													</Button>
												</div>
											</Empty>
										</TableCell>
									</TableRow>
								)}

								{hasResults &&
									table.getRowModel().rows.map((row) => {
										const hit = row.original;
										return (
											<TableRow
												key={hit.infoHash}
												onClick={() =>
													navigate({
														to: "/torrents/$torrent",
														params: { torrent: hit.infoHash },
													})
												}
												onKeyDown={(event) => {
													if (event.key !== "Enter" && event.key !== " ")
														return;
													event.preventDefault();
													void navigate({
														to: "/torrents/$torrent",
														params: { torrent: hit.infoHash },
													});
												}}
												tabIndex={0}
												className="group cursor-pointer border-border/45 border-b transition-colors hover:bg-primary/4 focus-visible:bg-primary/5 focus-visible:outline-none"
											>
												{row.getVisibleCells().map((cell) => {
													const meta = cell.column.columnDef.meta as
														| TableMeta
														| undefined;
													return (
														<TableCell
															key={cell.id}
															className={meta?.cellClassName}
														>
															{flexRender(
																cell.column.columnDef.cell,
																cell.getContext(),
															)}
														</TableCell>
													);
												})}
											</TableRow>
										);
									})}
							</TableBody>
						</Table>
					</div>

								{results.isSuccess && totalPages > 1 && (
									<div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-border/50 border-t bg-background/95 px-5 py-2.5 backdrop-blur-sm">
								<span className="font-mono text-xs text-muted-foreground/65 tabular-nums">
									{pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of{" "}
									{totalHits.toLocaleString()}
							</span>

							<div className="flex items-center gap-1">
								<Pagination className="mx-0 w-auto justify-end">
									<PaginationContent className="gap-1">
										<PaginationItem>
											<PaginationPrevious
												href="#prev"
												text="prev"
												className={cn(
													"h-7 rounded-none border border-border/45 font-mono text-xs text-muted-foreground/75 hover:border-border/60 hover:text-foreground",
													currentPage === 0 && "pointer-events-none opacity-25",
												)}
												onClick={(event) => {
													event.preventDefault();
													handlePage(currentPage - 1);
												}}
											/>
										</PaginationItem>
									</PaginationContent>
								</Pagination>

								<span className="px-3 font-mono text-xs text-muted-foreground/60 tabular-nums">
									{currentPage + 1} / {totalPages}
								</span>

								<Pagination className="mx-0 w-auto justify-end">
									<PaginationContent className="gap-1">
										<PaginationItem>
											<PaginationNext
												href="#next"
												text="next"
												className={cn(
													"h-7 rounded-none border border-border/45 font-mono text-xs text-muted-foreground/75 hover:border-border/60 hover:text-foreground",
													currentPage >= totalPages - 1 &&
														"pointer-events-none opacity-25",
												)}
												onClick={(event) => {
													event.preventDefault();
													handlePage(currentPage + 1);
												}}
											/>
										</PaginationItem>
									</PaginationContent>
								</Pagination>
							</div>
									</div>
								)}
							</main>
						</div>
					</div>
				</div>

			<SheetContent
				side="left"
				className="w-[92vw] border-border/50 bg-background/95 p-0 sm:max-w-sm"
			>
				<SheetHeader className="border-border/50 border-b px-4 py-4">
					<SheetTitle className="font-mono text-sm tracking-tight">
						Minato
					</SheetTitle>
					<SheetDescription className="font-mono text-xs text-muted-foreground/65">
						browse filters
					</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-y-auto">
					<FiltersPanel
						{...filterProps}
						compactSearch
						includeWordmark={false}
					/>
				</div>
				<SheetFooter className="flex-row gap-2 border-border/50 border-t p-4">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={clearAllFilters}
						disabled={activeFilterCount === 0}
						className="h-8 rounded-none border border-border/45 px-3 font-mono text-xs"
					>
						clear
					</Button>
					<SheetClose asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 rounded-none border border-border/45 px-3 font-mono text-xs"
						>
							close
						</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function FiltersPanel({
	includeWordmark = false,
	compactSearch = false,
	...props
}: FilterBlockProps) {
	return (
		<>
			{includeWordmark && (
				<div className="flex items-center justify-between border-border/50 border-b px-5 py-4">
					<Link
						to="/"
						className="font-black font-mono text-base text-foreground tracking-tighter transition-colors hover:text-primary"
					>
						Minato
					</Link>
					<span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-[0.2em]">
						browse
					</span>
				</div>
			)}

			<div className="border-border/50 border-b px-4 py-3">
				<SearchBox
					localQ={props.localQ}
					setLocalQ={props.setLocalQ}
					compact={compactSearch || includeWordmark}
					placeholder="search anything..."
				/>
			</div>

			<div className="flex items-center justify-between border-border/45 border-b px-4 py-2">
				<span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/65 uppercase tracking-[0.2em]">
					<SlidersHorizontal className="size-3" />
					filters
					{props.activeFilterCount > 0 && (
						<span className="inline-flex size-4 items-center justify-center rounded-full bg-primary font-bold text-[9px] text-primary-foreground tabular-nums">
							{props.activeFilterCount}
						</span>
					)}
				</span>
				{props.activeFilterCount > 0 && (
					<button
						type="button"
						onClick={props.clearAllFilters}
						className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/60 transition-colors hover:text-destructive"
					>
						<X className="size-2.5" />
						clear
					</button>
				)}
			</div>

			<FilterSections {...props} />
		</>
	);
}

function SearchBox({
	localQ,
	setLocalQ,
	compact,
	placeholder,
}: {
	localQ: string;
	setLocalQ: (value: string) => void;
	compact: boolean;
	placeholder: string;
}) {
	return (
		<div className="relative">
			<span
				className={cn(
					"pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 select-none font-mono text-primary/60 text-sm",
					!compact && "text-primary/75",
				)}
			>
				/
			</span>
			<Input
				type="text"
				value={localQ}
				onChange={(event) => setLocalQ(event.target.value)}
				placeholder={placeholder}
				className={cn(
					"rounded-none border-border/50 bg-transparent transition-colors hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0",
					compact
						? "h-9 pl-7 font-mono text-xs placeholder:text-muted-foreground/65"
						: "h-9 pr-7 pl-7 font-mono text-xs placeholder:text-muted-foreground/70",
				)}
			/>
			{localQ && (
				<button
					type="button"
					onClick={() => setLocalQ("")}
					className={cn(
						"absolute top-1/2 right-2 -translate-y-1/2 transition-colors",
						compact
							? "text-muted-foreground/60 hover:text-foreground"
							: "text-muted-foreground/65 hover:text-foreground",
					)}
				>
					<X className="size-3" />
				</button>
			)}
		</div>
	);
}

function FilterSections({
	localYearMin,
	setLocalYearMin,
	localYearMax,
	setLocalYearMax,
	localSizeMinGb,
	setLocalSizeMinGb,
	localSizeMaxGb,
	setLocalSizeMaxGb,
	localSeeders,
	setLocalSeeders,
	typeFacets,
	resFacets,
	genreFacets,
	groupFacets,
	sourceFacets,
	selectedTypes,
	selectedResolutions,
	selectedGenres,
	selectedGroups,
	toggleType,
	toggleResolution,
	toggleGenre,
	toggleGroup,
}: FilterBlockProps) {
	return (
		<>
			<FilterSection label="type" count={typeFacets.length}>
				<div className="space-y-0.5">
					{typeFacets.map(({ value, count }) => (
						<FilterCheckbox
							key={value}
							idPrefix="type"
							label={value}
							count={count}
							checked={selectedTypes.includes(value)}
							onCheckedChange={() => toggleType(value)}
						/>
					))}
				</div>
			</FilterSection>

			<FilterSection label="resolution" count={resFacets.length}>
				<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
					{resFacets.map(({ value, count }) => (
						<FilterCheckbox
							key={value}
							idPrefix="resolution"
							label={value}
							count={count}
							checked={selectedResolutions.includes(value)}
							onCheckedChange={() => toggleResolution(value)}
						/>
					))}
				</div>
			</FilterSection>

			<FilterSection label="genre" count={genreFacets.length}>
				<ScrollArea className="h-44">
					<div className="space-y-0.5 pr-2">
						{genreFacets.map(({ value, count }) => (
							<FilterCheckbox
								key={value}
								idPrefix="genre"
								label={value}
								count={count}
								checked={selectedGenres.includes(value)}
								onCheckedChange={() => toggleGenre(value)}
							/>
						))}
					</div>
				</ScrollArea>
			</FilterSection>

			{groupFacets.length > 0 && (
				<FilterSection label="group" count={groupFacets.length}>
					<ScrollArea className="h-36">
						<div className="space-y-0.5 pr-2">
							{groupFacets.map(({ value, count }) => (
								<FilterCheckbox
									key={value}
									idPrefix="group"
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

			{sourceFacets.length > 0 && (
				<FilterSection label="source">
					<div className="space-y-0.5">
						{sourceFacets.map(([value, count]) => (
							<div
								key={value}
								className="flex items-center justify-between py-0.5"
							>
								<span className="font-mono text-xs text-muted-foreground/70">
									{value}
								</span>
								<span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
									{count.toLocaleString()}
								</span>
							</div>
						))}
					</div>
				</FilterSection>
			)}

			<FilterSection label="year">
				<div className="flex items-center gap-2">
					<Input
						type="number"
						value={localYearMin}
						onChange={(event) => setLocalYearMin(event.target.value)}
						placeholder="1900"
						className="h-7 rounded-none border-border/50 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/65 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
					/>
					<span className="shrink-0 font-mono text-muted-foreground/70 text-xs">
						—
					</span>
					<Input
						type="number"
						value={localYearMax}
						onChange={(event) => setLocalYearMax(event.target.value)}
						placeholder="2026"
						className="h-7 rounded-none border-border/50 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/65 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
					/>
				</div>
			</FilterSection>

			<FilterSection label="size (gb)">
				<div className="flex items-center gap-2">
					<Input
						type="number"
						value={localSizeMinGb}
						onChange={(event) => setLocalSizeMinGb(event.target.value)}
						placeholder="0"
						className="h-7 rounded-none border-border/50 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/65 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
					/>
					<span className="shrink-0 font-mono text-muted-foreground/70 text-xs">
						—
					</span>
					<Input
						type="number"
						value={localSizeMaxGb}
						onChange={(event) => setLocalSizeMaxGb(event.target.value)}
						placeholder="∞"
						className="h-7 rounded-none border-border/50 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/65 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
					/>
				</div>
			</FilterSection>

			<FilterSection label="min seeders">
				<Input
					type="number"
					min={0}
					value={localSeeders}
					onChange={(event) => setLocalSeeders(event.target.value)}
					placeholder="0"
					className="h-7 max-w-28 rounded-none border-border/50 bg-transparent font-mono text-xs transition-colors placeholder:text-muted-foreground/65 hover:border-border/60 focus-visible:border-primary/50 focus-visible:ring-0"
				/>
			</FilterSection>
		</>
	);
}

function SortHeader({
	field,
	label,
	onSort,
	sortField,
	sortDir,
	right = false,
}: {
	field: SortField;
	label: string;
	onSort: (field: SortField) => void;
	sortField: SortField;
	sortDir: SortDir;
	right?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={() => onSort(field)}
			className={cn(
				"group flex items-center gap-1 font-mono text-xs text-muted-foreground/70 uppercase tracking-widest transition-colors hover:text-foreground",
				right && "ml-auto",
			)}
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
}

function FilterSection({
	label,
	count,
	children,
}: {
	label: string;
	count?: number;
	children: ReactNode;
}) {
	return (
		<div className="border-border/45 border-b">
			<div className="flex items-center justify-between px-4 pt-3 pb-1.5">
				<p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-[0.2em]">
					{label}
				</p>
				{count !== undefined && (
					<span className="font-mono text-[11px] text-muted-foreground/65 tabular-nums">
						{count}
					</span>
				)}
			</div>
			<div className="px-4 pb-3">{children}</div>
		</div>
	);
}

function FilterCheckbox({
	idPrefix,
	label,
	count,
	checked,
	onCheckedChange,
}: {
	idPrefix: string;
	label: string;
	count?: number;
	checked: boolean;
	onCheckedChange: () => void;
}) {
	const isEmpty = count === 0 && !checked;
	const id = `${idPrefix}-${slugify(label)}`;

	return (
		<label
			htmlFor={id}
			className={cn(
				"group flex cursor-pointer select-none items-center gap-2 py-0.5",
				isEmpty && "pointer-events-none opacity-30",
			)}
		>
			<Checkbox
				id={id}
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="size-3 shrink-0 rounded-none border-border/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			/>
			<span
				className={cn(
					"min-w-0 flex-1 truncate font-mono text-xs transition-colors",
					checked
						? "text-foreground/85"
						: "text-muted-foreground/70 group-hover:text-foreground/65",
				)}
			>
				{label}
			</span>
			{count !== undefined && (
				<span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
					{count.toLocaleString()}
				</span>
			)}
		</label>
	);
}

function buildFacetList(
	facetObj: Record<string, number> | undefined,
	selected: string[],
	fallback: string[],
): FacetEntry[] {
	if (!facetObj) {
		const allValues = new Set([...fallback, ...selected]);
		return Array.from(allValues).map((value) => ({ value }));
	}

	const allValues = new Set([...Object.keys(facetObj), ...selected]);
	return Array.from(allValues)
		.map((value) => ({ value, count: facetObj[value] }))
		.sort((a, b) => {
			const aOn = selected.includes(a.value);
			const bOn = selected.includes(b.value);
			if (aOn !== bOn) return aOn ? -1 : 1;
			if ((b.count ?? 0) !== (a.count ?? 0))
				return (b.count ?? 0) - (a.count ?? 0);
			return a.value.localeCompare(b.value);
		});
}

function csvParamToArray(value?: string) {
	if (!value) return [];
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function toggleCsvSelection(current: string | undefined, nextValue: string) {
	const currentValues = csvParamToArray(current);
	const nextValues = currentValues.includes(nextValue)
		? currentValues.filter((value) => value !== nextValue)
		: [...currentValues, nextValue];

	return nextValues.length ? nextValues.join(",") : undefined;
}

function parseOptionalInt(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalGbToBytes(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) return undefined;
	return Math.max(0, Math.round(parsed * 1_073_741_824));
}

function bytesToGbString(bytes: number) {
	return (bytes / 1_073_741_824).toFixed(1).replace(/\.0$/, "");
}

function formatDateCell(value: string | Date) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function normalizeSearch(search: Partial<TorrentsSearch>) {
	return {
		q: search.q ?? "",
		type: search.type ?? undefined,
		resolution: search.resolution ?? undefined,
		group: search.group ?? undefined,
		genres: search.genres ?? undefined,
		yearMin: search.yearMin ?? undefined,
		yearMax: search.yearMax ?? undefined,
		sizeMin: search.sizeMin ?? undefined,
		sizeMax: search.sizeMax ?? undefined,
		seeders: search.seeders ?? undefined,
		sort: (search.sort ?? DEFAULT_SORT) as SortValue,
		page: search.page ?? 0,
		limit: search.limit ?? LIMIT,
	};
}

function compactSearch(
	search: ReturnType<typeof normalizeSearch>,
): Partial<TorrentsSearch> {
	return {
		q: search.q.trim() || undefined,
		type: search.type,
		resolution: search.resolution,
		group: search.group,
		genres: search.genres,
		yearMin: search.yearMin,
		yearMax: search.yearMax,
		sizeMin: search.sizeMin,
		sizeMax: search.sizeMax,
		seeders: search.seeders,
		sort: search.sort === DEFAULT_SORT ? undefined : search.sort,
		page: search.page === 0 ? undefined : search.page,
		limit: search.limit === LIMIT ? undefined : search.limit,
	};
}

function buildNextSearch(
	current: TorrentsSearch,
	patch: Partial<TorrentsSearch>,
	options: SearchPatchOptions,
) {
	const next = normalizeSearch({ ...current, ...patch });
	if (options.resetPage ?? true) next.page = 0;
	return compactSearch(next);
}

function searchesEqual(a: Partial<TorrentsSearch>, b: Partial<TorrentsSearch>) {
	const left = normalizeSearch(a);
	const right = normalizeSearch(b);

	return (
		left.q === right.q &&
		left.type === right.type &&
		left.resolution === right.resolution &&
		left.group === right.group &&
		left.genres === right.genres &&
		left.yearMin === right.yearMin &&
		left.yearMax === right.yearMax &&
		left.sizeMin === right.sizeMin &&
		left.sizeMax === right.sizeMax &&
		left.seeders === right.seeders &&
		left.sort === right.sort &&
		left.page === right.page &&
		left.limit === right.limit
	);
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function buildActiveChips({
	sp,
	selectedTypes,
	selectedResolutions,
	selectedGenres,
	selectedGroups,
	toggleType,
	toggleResolution,
	toggleGenre,
	toggleGroup,
	clearText,
	clearYear,
	clearSize,
	clearSeeders,
}: {
	sp: TorrentsSearch;
	selectedTypes: string[];
	selectedResolutions: string[];
	selectedGenres: string[];
	selectedGroups: string[];
	toggleType: (value: string) => void;
	toggleResolution: (value: string) => void;
	toggleGenre: (value: string) => void;
	toggleGroup: (value: string) => void;
	clearText: () => void;
	clearYear: () => void;
	clearSize: () => void;
	clearSeeders: () => void;
}) {
	const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

	if ((sp.q ?? "").trim()) {
		chips.push({ key: "q", label: `q:${sp.q}`, onRemove: clearText });
	}

	for (const value of selectedTypes) {
		chips.push({
			key: `type:${value}`,
			label: `type:${value}`,
			onRemove: () => toggleType(value),
		});
	}
	for (const value of selectedResolutions) {
		chips.push({
			key: `res:${value}`,
			label: `res:${value}`,
			onRemove: () => toggleResolution(value),
		});
	}
	for (const value of selectedGenres) {
		chips.push({
			key: `genre:${value}`,
			label: `genre:${value}`,
			onRemove: () => toggleGenre(value),
		});
	}
	for (const value of selectedGroups) {
		chips.push({
			key: `group:${value}`,
			label: `group:${value}`,
			onRemove: () => toggleGroup(value),
		});
	}

	if (sp.yearMin !== undefined || sp.yearMax !== undefined) {
		chips.push({
			key: "year",
			label: `year:${sp.yearMin ?? "*"}-${sp.yearMax ?? "*"}`,
			onRemove: clearYear,
		});
	}

	if (sp.sizeMin !== undefined || sp.sizeMax !== undefined) {
		chips.push({
			key: "size",
			label: `size:${sp.sizeMin ? bytesToGbString(sp.sizeMin) : "*"}-${sp.sizeMax ? bytesToGbString(sp.sizeMax) : "*"}gb`,
			onRemove: clearSize,
		});
	}

	if (sp.seeders !== undefined) {
		chips.push({
			key: "seeders",
			label: `seeders≥${sp.seeders}`,
			onRemove: clearSeeders,
		});
	}

	return chips;
}
