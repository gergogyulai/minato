import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	CornerDownLeft,
	FileText,
	HardDrive,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useState } from "react";
import { useDebounce } from "use-debounce";
import TorrentHeader from "@/components/torrent-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { formatBytesString } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
	component: HomePage,
	loader: async ({ context: { orpc, queryClient } }) => {
		await queryClient.ensureQueryData(orpc.torrents.getCount.queryOptions({}));
	},
});

const TYPES = [
	{ value: "movie", label: "Movie" },
	{ value: "tv", label: "TV" },
	{ value: "anime", label: "Anime" },
	{ value: "music", label: "Music" },
	{ value: "book", label: "Book" },
];

const RESOLUTIONS = [
	{ value: "720p", label: "720p" },
	{ value: "1080p", label: "1080p" },
	{ value: "2160p", label: "4K" },
];

const GENRES = [
	"Action",
	"Comedy",
	"Drama",
	"Horror",
	"Sci-Fi",
	"Thriller",
	"Romance",
	"Documentary",
	"Animation",
	"Fantasy",
];

const GROUPS = [
	"YIFY",
	"YTS",
	"RARBG",
	"FGT",
	"EVO",
	"SPARKS",
	"GECKOS",
	"DIMENSION",
	"LOL",
	"KILLERS",
];

const SOURCE_NAMES = [
	"YTS",
	"RARBG",
	"1337x",
	"EZTV",
	"The Pirate Bay",
	"Nyaa",
	"LimeTorrents",
	"Zooqle",
];

export default function HomePage() {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [filtersKey, setFiltersKey] = useState(0);

	const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

	const [types, setTypes] = useState<string[]>([]);
	const [resolutions, setResolutions] = useState<string[]>([]);
	const [genres, setGenres] = useState<string[]>([]);

	const [yearRange, setYearRange] = useState<number[]>([1900, 2030]);
	const [sizeRange, setSizeRange] = useState<number[]>([0, 100]);
	const [seedersMin, setSeedersMin] = useState<number[]>([0]);
	const [leechersMin, setLeechersMin] = useState<number[]>([0]);

	const [group, setGroup] = useState("");
	const [sourceNameFilter, setSourceNameFilter] = useState("");
	const [seasonNumber, setSeasonNumber] = useState("");
	const [episodeNumber, setEpisodeNumber] = useState("");
	const [isSeasonPack, setIsSeasonPack] = useState<boolean | null>(null);

	const totalTorrents = useQuery(orpc.torrents.getCount.queryOptions({}));

	const instantResults = useQuery(
		orpc.search.searchTorrents.queryOptions({
			input: {
				q: debouncedSearchQuery,
				limit: 5,
			},
			enabled: debouncedSearchQuery.length > 2,
		}),
	);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();

		const searchParams: Record<string, string> = { q: searchQuery };

		if (types.length > 0) searchParams.type = types.join(",");
		if (resolutions.length > 0) searchParams.resolution = resolutions.join(",");
		if (genres.length > 0) searchParams.genres = genres.join(",");
		if (yearRange[0] !== 1900 || yearRange[1] !== 2030) {
			searchParams.yearMin = yearRange[0].toString();
			searchParams.yearMax = yearRange[1].toString();
		}
		if (sizeRange[0] !== 0 || sizeRange[1] !== 100) {
			searchParams.sizeMin = (sizeRange[0] * 1073741824).toString();
			searchParams.sizeMax = (sizeRange[1] * 1073741824).toString();
		}
		if (seedersMin[0] > 0) searchParams.seeders = seedersMin[0].toString();
		if (leechersMin[0] > 0) searchParams.leechers = leechersMin[0].toString();
		if (group) searchParams.group = group;
		if (sourceNameFilter) searchParams.sourceNames = sourceNameFilter;
		if (seasonNumber) searchParams.seasonNumber = seasonNumber;
		if (episodeNumber) searchParams.episodeNumber = episodeNumber;
		if (isSeasonPack !== null)
			searchParams.isSeasonPack = isSeasonPack.toString();

		navigate({ to: "/torrents", search: searchParams });
	};

	const activeFilterCount =
		types.length +
		resolutions.length +
		genres.length +
		(yearRange[0] !== 1900 || yearRange[1] !== 2030 ? 1 : 0) +
		(sizeRange[0] !== 0 || sizeRange[1] !== 100 ? 1 : 0) +
		(seedersMin[0] > 0 ? 1 : 0) +
		(leechersMin[0] > 0 ? 1 : 0) +
		(group ? 1 : 0) +
		(sourceNameFilter ? 1 : 0) +
		(seasonNumber ? 1 : 0) +
		(episodeNumber ? 1 : 0) +
		(isSeasonPack !== null ? 1 : 0);

	const clearFilters = () => {
		setTypes([]);
		setResolutions([]);
		setGenres([]);
		setYearRange([1900, 2030]);
		setSizeRange([0, 100]);
		setSeedersMin([0]);
		setLeechersMin([0]);
		setGroup("");
		setSourceNameFilter("");
		setSeasonNumber("");
		setEpisodeNumber("");
		setIsSeasonPack(null);
		setFiltersKey((k) => k + 1);
	};

	const isSearching = searchQuery.length > 2;
	const hasResults = instantResults.data && instantResults.data.hits.length > 0;
	const hasNoResults =
		instantResults.data &&
		instantResults.data.hits.length === 0 &&
		!instantResults.isLoading;

	return (
		<>
			{/* <TorrentHeader /> */}

			{/* Dot-grid background */}
			<div
				className="pointer-events-none fixed inset-0"
				style={{
					backgroundImage:
						"radial-gradient(circle, oklch(0.5 0 0 / 0.12) 1px, transparent 1px)",
					backgroundSize: "28px 28px",
				}}
			/>

			<div className="relative min-h-screen pt-16">
				{/* Main content — fixed top anchor so results expanding downward never shift the wordmark */}
				<div className="flex flex-col items-center px-5 pt-[18vh] pb-24 sm:px-8">
					<div className="w-full max-w-2xl space-y-8">
						{/* Wordmark + tagline */}
						<div className="space-y-5">
							<div className="space-y-1">
								<p className="select-none font-mono text-muted-foreground/60 text-xs uppercase tracking-[0.25em]">
									torrent search
								</p>
								<h1
									className="font-black text-[clamp(3.5rem,12vw,6.5rem)] text-foreground leading-none tracking-tighter"
									style={{ letterSpacing: "-0.04em" }}
								>
									Minato
								</h1>
							</div>

							{/* Stat strip */}
							<div className="flex w-fit items-center gap-0 divide-x divide-border/40 overflow-hidden rounded-sm border border-border/40 font-mono text-muted-foreground/70 text-xs">
								<div className="flex items-center gap-1.5 px-3 py-1.5">
									<span className="font-semibold text-primary tabular-nums">
										{totalTorrents.data?.count?.toLocaleString() ?? "—"}
									</span>
									<span>indexed</span>
								</div>
								<div className="px-3 py-1.5">2.4 TB</div>
								<div className="px-3 py-1.5">8.2K movies</div>
								<div className="hidden px-3 py-1.5 sm:block">3.1K shows</div>
							</div>
						</div>

						{/* Search */}
						<form onSubmit={handleSearch} className="space-y-3">
							<div className="group relative">
								{/* Prompt glyph */}
								<div className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 select-none font-mono text-base text-primary/60 transition-colors group-focus-within:text-primary">
									/
								</div>

								<Input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="search anything..."
									className="h-14 rounded-none border-border/50 bg-background pr-3 pl-8 font-mono text-base transition-colors placeholder:font-mono placeholder:text-muted-foreground/30 hover:border-border focus-visible:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 sm:pr-36"
								/>

								<div className="absolute top-0 right-0 bottom-0 hidden items-center gap-0 border-border/50 border-l sm:flex">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowFilters((v) => !v)}
										className="h-full gap-1.5 rounded-none border-border/50 border-r px-4 font-mono text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
									>
										<SlidersHorizontal className="size-3.5" />
										filters
										{activeFilterCount > 0 && (
											<span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground tabular-nums">
												{activeFilterCount}
											</span>
										)}
									</Button>

									<Button
										type="submit"
										size="sm"
										className="h-full gap-1.5 rounded-none px-4 font-mono text-xs"
									>
										<CornerDownLeft className="size-3.5" />
										search
									</Button>
								</div>
							</div>

							{/* Mobile buttons */}
							<div className="flex gap-2 sm:hidden">
								<Button
									type="button"
									variant="outline"
									onClick={() => setShowFilters((v) => !v)}
									className="relative h-11 flex-1 gap-2 rounded-none font-mono text-xs"
								>
									<SlidersHorizontal className="size-3.5" />
									filters
									{activeFilterCount > 0 && (
										<span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground tabular-nums">
											{activeFilterCount}
										</span>
									)}
								</Button>
								<Button
									type="submit"
									className="h-11 flex-1 gap-1.5 rounded-none font-mono text-xs"
								>
									<CornerDownLeft className="size-3.5" />
									search
								</Button>
							</div>

							{/* Inline filter panel */}
							{showFilters && (
								<div
									key={filtersKey}
									className="fade-in-0 slide-in-from-top-1 animate-in border border-border/50 bg-background duration-150"
								>
									{/* Panel header */}
									<div className="flex items-center justify-between border-border/40 border-b px-4 py-2.5">
										<span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
											filters
										</span>
										<div className="flex items-center gap-3">
											{activeFilterCount > 0 && (
												<button
													type="button"
													onClick={clearFilters}
													className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/50 transition-colors hover:text-destructive"
												>
													<X className="size-3" />
													clear {activeFilterCount}
												</button>
											)}
											<button
												type="button"
												onClick={() => setShowFilters(false)}
												className="font-mono text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
											>
												done
											</button>
										</div>
									</div>

									{/* Row 1 — Selection lists: Type | Resolution | Genre */}
									<div className="grid grid-cols-1 divide-y divide-border/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
										{/* Type */}
										<div className="py-1">
											<p className="px-4 py-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												type
											</p>
											<ul>
												{TYPES.map((t) => {
													const selected = types.includes(t.value);
													return (
														<li key={t.value}>
															<Label
																htmlFor={`type-${t.value}`}
																className="flex w-full cursor-pointer items-center gap-3 px-4 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40"
															>
																<Checkbox
																	id={`type-${t.value}`}
																	checked={selected}
																	onCheckedChange={(checked) =>
																		setTypes((prev) =>
																			checked
																				? [...prev, t.value]
																				: prev.filter((v) => v !== t.value),
																		)
																	}
																	className="shrink-0 rounded-none"
																/>
																<span
																	className={
																		selected
																			? "text-foreground"
																			: "text-muted-foreground"
																	}
																>
																	{t.label}
																</span>
															</Label>
														</li>
													);
												})}
											</ul>
										</div>

										{/* Resolution */}
										<div className="py-1">
											<p className="px-4 py-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												resolution
											</p>
											<ul>
												{RESOLUTIONS.map((r) => {
													const selected = resolutions.includes(r.value);
													return (
														<li key={r.value}>
															<Label
																htmlFor={`res-${r.value}`}
																className="flex w-full cursor-pointer items-center gap-3 px-4 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40"
															>
																<Checkbox
																	id={`res-${r.value}`}
																	checked={selected}
																	onCheckedChange={(checked) =>
																		setResolutions((prev) =>
																			checked
																				? [...prev, r.value]
																				: prev.filter((v) => v !== r.value),
																		)
																	}
																	className="shrink-0 rounded-none"
																/>
																<span
																	className={
																		selected
																			? "text-foreground"
																			: "text-muted-foreground"
																	}
																>
																	{r.label}
																</span>
															</Label>
														</li>
													);
												})}
											</ul>
										</div>

										{/* Genre — scrollable */}
										<div className="py-1">
											<p className="px-4 py-2 font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												genre
											</p>
											<ScrollArea className="h-40">
												<ul>
													{GENRES.map((g) => {
														const selected = genres.includes(g);
														return (
															<li key={g}>
																<Label
																	htmlFor={`genre-${g}`}
																	className="flex w-full cursor-pointer items-center gap-3 px-4 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40"
																>
																	<Checkbox
																		id={`genre-${g}`}
																		checked={selected}
																		onCheckedChange={(checked) =>
																			setGenres((prev) =>
																				checked
																					? [...prev, g]
																					: prev.filter((v) => v !== g),
																			)
																		}
																		className="shrink-0 rounded-none"
																	/>
																	<span
																		className={
																			selected
																				? "text-foreground"
																				: "text-muted-foreground"
																		}
																	>
																		{g}
																	</span>
																</Label>
															</li>
														);
													})}
												</ul>
											</ScrollArea>
										</div>
									</div>

									{/* Row 2 — Numeric ranges */}
									<div className="grid grid-cols-2 divide-y-0 divide-border/30 border-border/40 border-t sm:grid-cols-4 sm:divide-x">
										<div className="space-y-3 px-4 py-3">
											<div className="flex items-center justify-between">
												<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
													year
												</p>
												<span className="font-mono text-[11px] text-foreground/60 tabular-nums">
													{yearRange[0]}–{yearRange[1]}
												</span>
											</div>
											<Slider
												min={1900}
												max={2030}
												step={1}
												value={yearRange}
												onValueChange={setYearRange}
												className="w-full"
											/>
										</div>

										<div className="space-y-3 px-4 py-3">
											<div className="flex items-center justify-between">
												<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
													size
												</p>
												<span className="font-mono text-[11px] text-foreground/60 tabular-nums">
													{sizeRange[0]}–{sizeRange[1]} GB
												</span>
											</div>
											<Slider
												min={0}
												max={100}
												step={1}
												value={sizeRange}
												onValueChange={setSizeRange}
												className="w-full"
											/>
										</div>

										<div className="space-y-3 px-4 py-3">
											<div className="flex items-center justify-between">
												<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
													seeders
												</p>
												<span className="font-mono text-[11px] text-foreground/60 tabular-nums">
													≥{seedersMin[0]}
												</span>
											</div>
											<Slider
												min={0}
												max={1000}
												step={10}
												value={seedersMin}
												onValueChange={setSeedersMin}
												className="w-full"
											/>
										</div>

										<div className="space-y-3 px-4 py-3">
											<div className="flex items-center justify-between">
												<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
													leechers
												</p>
												<span className="font-mono text-[11px] text-foreground/60 tabular-nums">
													≥{leechersMin[0]}
												</span>
											</div>
											<Slider
												min={0}
												max={1000}
												step={10}
												value={leechersMin}
												onValueChange={setLeechersMin}
												className="w-full"
											/>
										</div>
									</div>

									{/* Row 3 — Series details + Source */}
									<div className="grid grid-cols-1 divide-y divide-border/30 border-border/40 border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0">
										{/* Series */}
										<div className="space-y-3 px-4 py-3">
											<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												series
											</p>
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-1">
													<Label
														htmlFor="season-number"
														className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest"
													>
														season
													</Label>
													<Input
														id="season-number"
														type="number"
														min={1}
														placeholder="—"
														value={seasonNumber}
														onChange={(e) => setSeasonNumber(e.target.value)}
														className="h-8 rounded-none bg-transparent font-mono text-xs"
													/>
												</div>
												<div className="space-y-1">
													<Label
														htmlFor="episode-number"
														className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest"
													>
														episode
													</Label>
													<Input
														id="episode-number"
														type="number"
														min={1}
														placeholder="—"
														value={episodeNumber}
														onChange={(e) => setEpisodeNumber(e.target.value)}
														className="h-8 rounded-none bg-transparent font-mono text-xs"
													/>
												</div>
											</div>
											<Label
												htmlFor="season-pack"
												className="flex cursor-pointer items-center gap-3 font-mono text-xs"
											>
												<Checkbox
													id="season-pack"
													checked={isSeasonPack === true}
													onCheckedChange={(checked) =>
														setIsSeasonPack(checked ? true : null)
													}
													className="shrink-0 rounded-none"
												/>
												<span
													className={
														isSeasonPack
															? "text-foreground"
															: "text-muted-foreground"
													}
												>
													season packs only
												</span>
											</Label>
										</div>

										{/* Source */}
										<div className="space-y-3 px-4 py-3">
											<p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
												source
											</p>
											<div className="space-y-1">
												<Label
													htmlFor="group-filter"
													className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest"
												>
													group
												</Label>
												<Combobox
													onValueChange={(v) =>
														setGroup((v as string | null) ?? "")
													}
												>
													<ComboboxInput
														id="group-filter"
														placeholder="e.g. YIFY"
														className="h-8 rounded-none font-mono text-xs [&_input]:rounded-none [&_input]:font-mono [&_input]:text-xs"
														onChange={(e) =>
															setGroup((e.target as HTMLInputElement).value)
														}
														showClear
													/>
													<ComboboxContent>
														<ComboboxList>
															<ComboboxEmpty>No matches</ComboboxEmpty>
															{GROUPS.filter((g) =>
																g.toLowerCase().includes(group.toLowerCase()),
															).map((g) => (
																<ComboboxItem key={g} value={g}>
																	{g}
																</ComboboxItem>
															))}
														</ComboboxList>
													</ComboboxContent>
												</Combobox>
											</div>
											<div className="space-y-1">
												<Label
													htmlFor="source-names"
													className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest"
												>
													source
												</Label>
												<Combobox
													onValueChange={(v) =>
														setSourceNameFilter((v as string | null) ?? "")
													}
												>
													<ComboboxInput
														id="source-names"
														placeholder="e.g. YTS"
														className="h-8 rounded-none font-mono text-xs [&_input]:rounded-none [&_input]:font-mono [&_input]:text-xs"
														onChange={(e) =>
															setSourceNameFilter(
																(e.target as HTMLInputElement).value,
															)
														}
														showClear
													/>
													<ComboboxContent>
														<ComboboxList>
															<ComboboxEmpty>No matches</ComboboxEmpty>
															{SOURCE_NAMES.filter((s) =>
																s
																	.toLowerCase()
																	.includes(sourceNameFilter.toLowerCase()),
															).map((s) => (
																<ComboboxItem key={s} value={s}>
																	{s}
																</ComboboxItem>
															))}
														</ComboboxList>
													</ComboboxContent>
												</Combobox>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Quick results */}
							{isSearching && (
								<div className="fade-in-0 slide-in-from-top-2 animate-in duration-150">
									{/* Results header */}
									<div className="flex items-center justify-between border-border/40 border-b px-0 py-2">
										<span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
											results
										</span>
										{instantResults.data && (
											<span className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
												{instantResults.data.processingTimeMs}ms
												{instantResults.data.totalHits > 0 &&
													` · ${instantResults.data.totalHits.toLocaleString()} total`}
											</span>
										)}
									</div>

									{instantResults.isError && (
										<div className="border-destructive/20 border-b bg-destructive/5 px-4 py-3">
											<p className="font-mono text-destructive text-xs">
												error: failed to fetch results
											</p>
										</div>
									)}

									{hasResults && !instantResults.isLoading && (
										<>
											{instantResults.data.hits.map((result, i) => (
												<Link
													to="/torrents/$torrent"
													params={{ torrent: result.infoHash }}
													key={result.infoHash}
													className="block"
												>
													<div className="group flex items-center gap-4 border-border/30 border-b px-0 py-3 transition-colors hover:bg-primary/3">
														{/* Index */}
														<span className="w-4 shrink-0 select-none text-right font-mono text-[11px] text-muted-foreground/30 tabular-nums">
															{i + 1}
														</span>

														{/* Title + meta */}
														<div className="min-w-0 flex-1 space-y-1">
															<p className="line-clamp-1 font-medium text-sm leading-tight transition-colors group-hover:text-primary">
																{result.trackerTitle}
															</p>
															<div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground/60">
																<span className="flex items-center gap-1">
																	<HardDrive className="size-3 shrink-0" />
																	{formatBytesString(result.size)}
																</span>
																<span className="flex items-center gap-1">
																	<ArrowUp className="size-3 shrink-0 text-emerald-500" />
																	<span className="text-emerald-600 dark:text-emerald-400">
																		{result.seeders}
																	</span>
																</span>
																<span className="flex items-center gap-1">
																	<ArrowDown className="size-3 shrink-0 text-rose-500" />
																	<span className="text-rose-600 dark:text-rose-400">
																		{result.leechers ?? 0}
																	</span>
																</span>
																{result.files && result.files.length > 0 && (
																	<span className="flex items-center gap-1">
																		<FileText className="size-3 shrink-0" />
																		{result.files.length}f
																	</span>
																)}
															</div>
														</div>

														{/* Type + resolution badges */}
														<div className="hidden shrink-0 items-center gap-1.5 sm:flex">
															{result.type && (
																<span className="border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
																	{result.type}
																</span>
															)}
															{result.resolution && (
																<span className="border border-primary/30 px-1.5 py-0.5 font-mono text-[10px] text-primary/70">
																	{result.resolution}
																</span>
															)}
														</div>

														<ArrowRight className="size-3.5 shrink-0 text-muted-foreground/20 transition-colors group-hover:text-primary/50" />
													</div>
												</Link>
											))}

											{/* View all row */}
											<button
												type="button"
												onClick={() =>
													navigate({
														to: "/torrents",
														search: { q: searchQuery },
													})
												}
												className="group flex w-full items-center justify-between px-0 py-2.5 font-mono text-muted-foreground/50 text-xs transition-colors hover:text-primary"
											>
												<span>
													view all{" "}
													{instantResults.data.totalHits.toLocaleString()}{" "}
													results →
												</span>
												<span className="text-[10px] uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100">
													enter
												</span>
											</button>
										</>
									)}

									{hasNoResults && (
										<div className="py-8 font-mono text-muted-foreground/50 text-xs">
											<span className="text-primary/50">0 </span>results for "
											{searchQuery}" — try different keywords
										</div>
									)}
								</div>
							)}
						</form>
					</div>
				</div>
			</div>
		</>
	);
}
