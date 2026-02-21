import { useState } from "react";
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
import { Button } from "@/components/ui/button";
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
import TorrentHeader from "@/components/torrent-header";

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

  return (
    <>
      {/* <TorrentHeader /> */}

      {/* Dot-grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0.5 0 0 / 0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative min-h-screen pt-16">
        {/* Main content — fixed top anchor so results expanding downward never shift the wordmark */}
        <div className="flex flex-col items-center px-5 sm:px-8 pt-[18vh] pb-24">
          <div className="w-full max-w-2xl space-y-8">

            {/* Wordmark + tagline */}
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="font-mono text-xs tracking-[0.25em] text-muted-foreground/60 uppercase select-none">
                  torrent search
                </p>
                <h1
                  className="text-[clamp(3.5rem,12vw,6.5rem)] font-black leading-none tracking-tighter text-foreground"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  Minato
                </h1>
              </div>

              {/* Stat strip */}
              <div className="flex items-center gap-0 font-mono text-xs text-muted-foreground/70 border border-border/40 divide-x divide-border/40 w-fit rounded-sm overflow-hidden">
                <div className="px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-primary font-semibold tabular-nums">
                    {totalTorrents.data?.count?.toLocaleString() ?? "—"}
                  </span>
                  <span>indexed</span>
                </div>
                <div className="px-3 py-1.5">2.4 TB</div>
                <div className="px-3 py-1.5">8.2K movies</div>
                <div className="hidden sm:block px-3 py-1.5">3.1K shows</div>
              </div>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative group">
                {/* Prompt glyph */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-base text-primary/60 pointer-events-none select-none z-10 transition-colors group-focus-within:text-primary">
                  /
                </div>

                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search anything..."
                  className="h-14 pl-8 pr-3 sm:pr-36 text-base font-mono bg-background border-border/50 hover:border-border focus-visible:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none transition-colors placeholder:text-muted-foreground/30 placeholder:font-mono"
                />

                <div className="hidden sm:flex absolute right-0 top-0 bottom-0 items-center gap-0 border-l border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters((v) => !v)}
                    className="gap-1.5 h-full px-4 rounded-none font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border-r border-border/50"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>

                  <Button
                    type="submit"
                    size="sm"
                    className="gap-1.5 h-full px-4 rounded-none font-mono text-xs"
                  >
                    <CornerDownLeft className="size-3.5" />
                    search
                  </Button>
                </div>
              </div>

              {/* Mobile buttons */}
              <div className="flex sm:hidden gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFilters((v) => !v)}
                  className="relative flex-1 gap-2 h-11 font-mono text-xs rounded-none"
                >
                  <SlidersHorizontal className="size-3.5" />
                  filters
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 font-mono text-xs rounded-none gap-1.5"
                >
                  <CornerDownLeft className="size-3.5" />
                  search
                </Button>
              </div>

              {/* Inline filter panel */}
              {showFilters && (
                <div key={filtersKey} className="animate-in fade-in-0 slide-in-from-top-1 duration-150 border border-border/50 bg-background">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground/60 uppercase">
                      filters
                    </span>
                    <div className="flex items-center gap-3">
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="font-mono text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors flex items-center gap-1"
                        >
                          <X className="size-3" />
                          clear {activeFilterCount}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowFilters(false)}
                        className="font-mono text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
                      >
                        done
                      </button>
                    </div>
                  </div>

                  {/* Row 1 — Selection lists: Type | Resolution | Genre */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/30">
                    {/* Type */}
                    <div className="py-1">
                      <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase px-4 py-2">
                        type
                      </p>
                      <ul>
                        {TYPES.map((t) => {
                          const selected = types.includes(t.value);
                          return (
                            <li key={t.value}>
                              <Label
                                htmlFor={`type-${t.value}`}
                                className="flex items-center gap-3 px-4 py-1.5 font-mono text-xs hover:bg-muted/40 transition-colors cursor-pointer w-full"
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
                                  className="rounded-none shrink-0"
                                />
                                <span className={selected ? "text-foreground" : "text-muted-foreground"}>
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
                      <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase px-4 py-2">
                        resolution
                      </p>
                      <ul>
                        {RESOLUTIONS.map((r) => {
                          const selected = resolutions.includes(r.value);
                          return (
                            <li key={r.value}>
                              <Label
                                htmlFor={`res-${r.value}`}
                                className="flex items-center gap-3 px-4 py-1.5 font-mono text-xs hover:bg-muted/40 transition-colors cursor-pointer w-full"
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
                                  className="rounded-none shrink-0"
                                />
                                <span className={selected ? "text-foreground" : "text-muted-foreground"}>
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
                      <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase px-4 py-2">
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
                                  className="flex items-center gap-3 px-4 py-1.5 font-mono text-xs hover:bg-muted/40 transition-colors cursor-pointer w-full"
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
                                    className="rounded-none shrink-0"
                                  />
                                  <span className={selected ? "text-foreground" : "text-muted-foreground"}>
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-y-0 sm:divide-x divide-border/30 border-t border-border/40">
                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                          year
                        </p>
                        <span className="font-mono text-[11px] tabular-nums text-foreground/60">
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

                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                          size
                        </p>
                        <span className="font-mono text-[11px] tabular-nums text-foreground/60">
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

                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                          seeders
                        </p>
                        <span className="font-mono text-[11px] tabular-nums text-foreground/60">
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

                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                          leechers
                        </p>
                        <span className="font-mono text-[11px] tabular-nums text-foreground/60">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/30 border-t border-border/40">
                    {/* Series */}
                    <div className="px-4 py-3 space-y-3">
                      <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                        series
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="season-number" className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                            season
                          </Label>
                          <Input
                            id="season-number"
                            type="number"
                            min={1}
                            placeholder="—"
                            value={seasonNumber}
                            onChange={(e) => setSeasonNumber(e.target.value)}
                            className="h-8 font-mono text-xs rounded-none bg-transparent"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="episode-number" className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                            episode
                          </Label>
                          <Input
                            id="episode-number"
                            type="number"
                            min={1}
                            placeholder="—"
                            value={episodeNumber}
                            onChange={(e) => setEpisodeNumber(e.target.value)}
                            className="h-8 font-mono text-xs rounded-none bg-transparent"
                          />
                        </div>
                      </div>
                      <Label
                        htmlFor="season-pack"
                        className="flex items-center gap-3 font-mono text-xs cursor-pointer"
                      >
                        <Checkbox
                          id="season-pack"
                          checked={isSeasonPack === true}
                          onCheckedChange={(checked) =>
                            setIsSeasonPack(checked ? true : null)
                          }
                          className="rounded-none shrink-0"
                        />
                        <span className={isSeasonPack ? "text-foreground" : "text-muted-foreground"}>
                          season packs only
                        </span>
                      </Label>
                    </div>

                    {/* Source */}
                    <div className="px-4 py-3 space-y-3">
                      <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase">
                        source
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="group-filter" className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                          group
                        </Label>
                        <Combobox
                          onValueChange={(v) => setGroup((v as string | null) ?? "")}
                        >
                          <ComboboxInput
                            id="group-filter"
                            placeholder="e.g. YIFY"
                            className="h-8 font-mono text-xs rounded-none [&_input]:rounded-none [&_input]:text-xs [&_input]:font-mono"
                            onChange={(e) => setGroup((e.target as HTMLInputElement).value)}
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
                        <Label htmlFor="source-names" className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                          source
                        </Label>
                        <Combobox
                          onValueChange={(v) => setSourceNameFilter((v as string | null) ?? "")}
                        >
                          <ComboboxInput
                            id="source-names"
                            placeholder="e.g. YTS"
                            className="h-8 font-mono text-xs rounded-none [&_input]:rounded-none [&_input]:text-xs [&_input]:font-mono"
                            onChange={(e) => setSourceNameFilter((e.target as HTMLInputElement).value)}
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
                <div className="animate-in fade-in-0 slide-in-from-top-2 duration-150">
                  {/* Results header */}
                  <div className="flex items-center justify-between px-0 py-2 border-b border-border/40">
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground/60 uppercase">
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
                    <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3">
                      <p className="font-mono text-xs text-destructive">
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
                          <div className="group flex items-center gap-4 px-0 py-3 border-b border-border/30 hover:bg-primary/3 transition-colors">
                            {/* Index */}
                            <span className="font-mono text-[11px] text-muted-foreground/30 w-4 shrink-0 select-none tabular-nums text-right">
                              {i + 1}
                            </span>

                            {/* Title + meta */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                                {result.trackerTitle}
                              </p>
                              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground/60">
                                <span className="flex items-center gap-1">
                                  <HardDrive className="size-3 shrink-0" />
                                  {formatBytesString(result.size)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ArrowUp className="size-3 text-emerald-500 shrink-0" />
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {result.seeders}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <ArrowDown className="size-3 text-rose-500 shrink-0" />
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
                            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                              {result.type && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 border border-border/50 text-muted-foreground/60">
                                  {result.type}
                                </span>
                              )}
                              {result.resolution && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 border border-primary/30 text-primary/70">
                                  {result.resolution}
                                </span>
                              )}
                            </div>

                            <ArrowRight className="size-3.5 text-muted-foreground/20 group-hover:text-primary/50 shrink-0 transition-colors" />
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
                        className="w-full flex items-center justify-between px-0 py-2.5 font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors group"
                      >
                        <span>
                          view all {instantResults.data.totalHits.toLocaleString()} results →
                        </span>
                        <span className="text-[10px] tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                          enter
                        </span>
                      </button>
                    </>
                  )}

                  {hasNoResults && (
                    <div className="py-8 font-mono text-xs text-muted-foreground/50">
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
