import { useEffect, useRef, useState } from "react";
import {
  SlidersHorizontal,
  HardDrive,
  ArrowUp,
  ArrowDown,
  FileText,
  ArrowRight,
  CornerDownLeft,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { useDebounce } from "use-debounce";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { formatBytesString } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);
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

  // `/` focuses search from anywhere; Escape clears it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;

      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && el === inputRef.current) {
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    if (isSeasonPack !== null) searchParams.isSeasonPack = isSeasonPack.toString();

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
  const hasResults =
    instantResults.data && instantResults.data.hits.length > 0;
  const hasNoResults =
    instantResults.data &&
    instantResults.data.hits.length === 0 &&
    !instantResults.isLoading;

  const STATS = [
    {
      value: totalTorrents.data?.count?.toLocaleString() ?? "—",
      label: "indexed",
      accent: true,
    },
    { value: "2.4 TB", label: "stored" },
    { value: "8.2K", label: "movies" },
    { value: "3.1K", label: "shows", hideOnMobile: true },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Backdrop — dot grid fading from the top, soft primary glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background-image:radial-gradient(circle,var(--minato-grid-color)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black_25%,transparent_82%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(42rem_30rem_at_50%_-6%,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_70%)]"
      />

      <div className="flex flex-col items-center px-5 pt-[16vh] pb-28 sm:px-8">
        <div className="w-full max-w-2xl space-y-9 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          {/* Wordmark + tagline */}
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="select-none font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground/45">
                <span className="text-primary/70">/</span> torrent search
              </p>
              <h1
                className="bg-clip-text font-display font-bold text-[clamp(3.5rem,12vw,6.5rem)] text-transparent leading-[0.9] tracking-tight [background-image:var(--web-heading-gradient)]"
                style={{ letterSpacing: "-0.03em" }}
              >
                Minato
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                One search across every tracker you index — infohashes,
                metadata, and sources, kept locally forever.
              </p>
            </div>

            {/* Stat hairline */}
            <div className="flex w-fit items-stretch divide-x divide-border/50 overflow-hidden rounded-lg border border-border/50 bg-card/40 font-mono text-xs backdrop-blur-sm">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className={`flex items-baseline gap-1.5 px-3.5 py-2 ${s.hideOnMobile ? "hidden sm:flex" : ""}`}
                >
                  <span
                    className={`font-semibold tabular-nums ${s.accent ? "text-primary" : "text-foreground/80"}`}
                  >
                    {s.value}
                  </span>
                  <span className="text-muted-foreground/55 tracking-wide">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Command bar */}
            <div className="group flex items-stretch overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
              <div className="flex select-none items-center pl-4 pr-1 font-mono text-base text-primary/55 transition-colors group-focus-within:text-primary">
                /
              </div>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search anything…"
                aria-label="Search torrents"
                className="h-14 min-w-0 flex-1 bg-transparent pr-2 font-mono text-base text-foreground outline-none placeholder:font-mono placeholder:text-muted-foreground/45"
              />

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
                className="flex items-center gap-1.5 border-l border-border/60 px-3.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:px-4"
              >
                <SlidersHorizontal className="size-3.5" />
                <span className="hidden sm:inline">filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 bg-primary px-4 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90 sm:px-5"
              >
                <CornerDownLeft className="size-3.5" />
                <span className="hidden sm:inline">search</span>
              </button>
            </div>

            {/* Keyboard hints */}
            {!isSearching && !showFilters && (
              <div className="flex items-center gap-4 px-1 font-mono text-[11px] text-muted-foreground/35">
                <Hint keys="/" label="focus" />
                <Hint keys="↵" label="search" />
                <Hint keys="esc" label="clear" />
              </div>
            )}

            {/* Inline filter panel */}
            {showFilters && (
              <div
                key={filtersKey}
                className="relative animate-in fade-in-0 slide-in-from-top-1 overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm duration-200"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50 [background:linear-gradient(to_right,transparent,var(--primary),transparent)]" />

                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/55">
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

                {/* Row 1 — Selection lists */}
                <div className="grid grid-cols-1 divide-y divide-border/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <FilterColumn label="type">
                    {TYPES.map((t) => (
                      <CheckRow
                        key={t.value}
                        id={`type-${t.value}`}
                        label={t.label}
                        checked={types.includes(t.value)}
                        onChange={(checked) =>
                          setTypes((prev) =>
                            checked
                              ? [...prev, t.value]
                              : prev.filter((v) => v !== t.value),
                          )
                        }
                      />
                    ))}
                  </FilterColumn>

                  <FilterColumn label="resolution">
                    {RESOLUTIONS.map((r) => (
                      <CheckRow
                        key={r.value}
                        id={`res-${r.value}`}
                        label={r.label}
                        checked={resolutions.includes(r.value)}
                        onChange={(checked) =>
                          setResolutions((prev) =>
                            checked
                              ? [...prev, r.value]
                              : prev.filter((v) => v !== r.value),
                          )
                        }
                      />
                    ))}
                  </FilterColumn>

                  <FilterColumn label="genre">
                    <ScrollArea className="h-40">
                      {GENRES.map((g) => (
                        <CheckRow
                          key={g}
                          id={`genre-${g}`}
                          label={g}
                          checked={genres.includes(g)}
                          onChange={(checked) =>
                            setGenres((prev) =>
                              checked ? [...prev, g] : prev.filter((v) => v !== g),
                            )
                          }
                        />
                      ))}
                    </ScrollArea>
                  </FilterColumn>
                </div>

                {/* Row 2 — Ranges */}
                <div className="grid grid-cols-2 divide-border/40 border-t border-border/50 sm:grid-cols-4 sm:divide-x">
                  <RangeCell label="year" value={`${yearRange[0]}–${yearRange[1]}`}>
                    <Slider
                      min={1900}
                      max={2030}
                      step={1}
                      value={yearRange}
                      onValueChange={setYearRange}
                    />
                  </RangeCell>
                  <RangeCell label="size" value={`${sizeRange[0]}–${sizeRange[1]} GB`}>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={sizeRange}
                      onValueChange={setSizeRange}
                    />
                  </RangeCell>
                  <RangeCell label="seeders" value={`≥${seedersMin[0]}`}>
                    <Slider
                      min={0}
                      max={1000}
                      step={10}
                      value={seedersMin}
                      onValueChange={setSeedersMin}
                    />
                  </RangeCell>
                  <RangeCell label="leechers" value={`≥${leechersMin[0]}`}>
                    <Slider
                      min={0}
                      max={1000}
                      step={10}
                      value={leechersMin}
                      onValueChange={setLeechersMin}
                    />
                  </RangeCell>
                </div>

                {/* Row 3 — Series + Source */}
                <div className="grid grid-cols-1 divide-y divide-border/40 border-t border-border/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="space-y-3 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                      series
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="season-number"
                          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50"
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
                          className="h-8 bg-transparent font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="episode-number"
                          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50"
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
                          className="h-8 bg-transparent font-mono text-xs"
                        />
                      </div>
                    </div>
                    <Label
                      htmlFor="season-pack"
                      className="flex cursor-pointer items-center gap-2.5 font-mono text-xs"
                    >
                      <Checkbox
                        id="season-pack"
                        checked={isSeasonPack === true}
                        onCheckedChange={(checked) =>
                          setIsSeasonPack(checked ? true : null)
                        }
                        className="size-3.5 shrink-0 rounded-sm"
                      />
                      <span
                        className={isSeasonPack ? "text-foreground" : "text-muted-foreground"}
                      >
                        season packs only
                      </span>
                    </Label>
                  </div>

                  <div className="space-y-3 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                      source
                    </p>
                    <div className="space-y-1">
                      <Label
                        htmlFor="group-filter"
                        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50"
                      >
                        group
                      </Label>
                      <Combobox
                        onValueChange={(v) => setGroup((v as string | null) ?? "")}
                      >
                        <ComboboxInput
                          id="group-filter"
                          placeholder="e.g. YIFY"
                          className="h-8 font-mono text-xs [&_input]:font-mono [&_input]:text-xs"
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
                        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50"
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
                          className="h-8 font-mono text-xs [&_input]:font-mono [&_input]:text-xs"
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

            {/* Instant results */}
            {isSearching && (
              <div className="relative animate-in fade-in-0 slide-in-from-top-2 overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm duration-200">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50 [background:linear-gradient(to_right,transparent,var(--primary),transparent)]" />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/55">
                    results
                  </span>
                  {instantResults.data && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
                      {instantResults.data.processingTimeMs}ms
                      {instantResults.data.totalHits > 0 &&
                        ` · ${instantResults.data.totalHits.toLocaleString()} total`}
                    </span>
                  )}
                </div>

                {instantResults.isLoading && (
                  <div className="divide-y divide-border/30">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="h-2.5 w-4 shrink-0 animate-pulse rounded-sm bg-muted/40" />
                        <div className="flex-1 space-y-1.5">
                          <div
                            className="h-2.5 animate-pulse rounded-sm bg-muted/40"
                            style={{ width: `${60 + i * 12}%` }}
                          />
                          <div className="h-2 w-1/3 animate-pulse rounded-sm bg-muted/25" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {instantResults.isError && (
                  <div className="bg-destructive/5 px-4 py-3">
                    <p className="font-mono text-xs text-destructive">
                      error: failed to fetch results
                    </p>
                  </div>
                )}

                {hasResults && !instantResults.isLoading && (
                  <>
                    <div className="divide-y divide-border/30">
                      {instantResults.data.hits.map((result, i) => (
                        <Link
                          to="/torrents/$torrent"
                          params={{ torrent: result.infoHash }}
                          key={result.infoHash}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/5"
                        >
                          <span className="w-4 shrink-0 select-none text-right font-mono text-[11px] tabular-nums text-muted-foreground/40">
                            {i + 1}
                          </span>

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="line-clamp-1 text-sm font-medium leading-tight transition-colors group-hover:text-primary">
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

                          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                            {result.type && (
                              <span className="rounded-sm border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
                                {result.type}
                              </span>
                            )}
                            {result.resolution && (
                              <span className="rounded-sm border border-primary/30 px-1.5 py-0.5 font-mono text-[10px] text-primary/80">
                                {result.resolution}
                              </span>
                            )}
                          </div>

                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary/70" />
                        </Link>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate({ to: "/torrents", search: { q: searchQuery } })
                      }
                      className="group flex w-full items-center justify-between border-t border-border/50 px-4 py-2.5 font-mono text-xs text-muted-foreground/50 transition-colors hover:bg-primary/5 hover:text-primary"
                    >
                      <span>
                        view all {instantResults.data.totalHits.toLocaleString()}{" "}
                        results
                      </span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </>
                )}

                {hasNoResults && (
                  <div className="px-4 py-10 text-center font-mono text-xs text-muted-foreground/50">
                    <span className="text-primary/50">0</span> results for{" "}
                    <span className="text-foreground/70">"{searchQuery}"</span> —
                    try different keywords
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/50 bg-muted/30 px-1 text-[10px] text-muted-foreground/60">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function FilterColumn({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <p className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label
      htmlFor={id}
      className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-1.5 font-mono text-xs transition-colors hover:bg-muted/40"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onChange(!!c)}
        className="size-3.5 shrink-0 rounded-sm"
      />
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </Label>
  );
}

function RangeCell({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          {label}
        </p>
        <span className="font-mono text-[11px] tabular-nums text-foreground/60">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
