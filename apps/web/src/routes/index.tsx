import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  HardDrive,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
  ArrowRight,
  Film,
  Tv,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("breaking bad");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce the search query for instant results (300ms delay)
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Filter states matching API contract
  const [types, setTypes] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  // Range sliders (year: 1900-2030, size: 0-100GB, seeders: 0-1000)
  const [yearRange, setYearRange] = useState<number[]>([1900, 2030]);
  const [sizeRange, setSizeRange] = useState<number[]>([0, 100]);
  const [seedersRange, setSeedersRange] = useState<number[]>([0]);

  const totalTorrents = useQuery(orpc.torrents.getCount.queryOptions({}));

  // Fetch instant results using debounced search query
  const instantResults = useQuery(
    orpc.search.searchTorrents.queryOptions({
      input: {
        q: debouncedSearchQuery,
        limit: 3,
      },
      enabled: debouncedSearchQuery.length > 2, // Only search if query is longer than 2 characters
    }),
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // Build search params to pass to /torrents route
    const searchParams: Record<string, string> = {
      q: searchQuery,
    };

    if (types.length > 0) {
      searchParams.type = types.join(",");
    }
    if (resolutions.length > 0) {
      searchParams.resolution = resolutions.join(",");
    }
    if (genres.length > 0) {
      searchParams.genres = genres.join(",");
    }
    if (yearRange[0] !== 1900 || yearRange[1] !== 2030) {
      searchParams.yearMin = yearRange[0].toString();
      searchParams.yearMax = yearRange[1].toString();
    }
    if (sizeRange[0] !== 0 || sizeRange[1] !== 100) {
      searchParams.sizeMin = (sizeRange[0] * 1073741824).toString();
      searchParams.sizeMax = (sizeRange[1] * 1073741824).toString();
    }
    if (seedersRange[0] > 0) {
      searchParams.seeders = seedersRange[0].toString();
    }

    // Navigate to /torrents with search params
    navigate({
      to: "/torrents",
      search: searchParams,
    });
  };

  return (
    <>
      <TorrentHeader />
      <div className="flex flex-col items-center px-4 sm:px-6 overflow-x-hidden min-h-screen pt-20 sm:pt-24 pb-16">
        <div className="w-full max-w-3xl space-y-10 min-w-0">

          {/* Hero */}
          <div className="text-center space-y-3 pt-8 sm:pt-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Minato
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
              Search across{" "}
              <span className="font-semibold text-foreground">
                {totalTorrents.data?.count?.toLocaleString() ?? "—"}
              </span>{" "}
              indexed torrents instantly
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <HardDrive className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-none mb-1">
                    Size
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-none">2.4TB</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Film className="size-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-none mb-1">
                    Movies
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-none">8.2K</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Tv className="size-4 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-none mb-1">
                    TV Shows
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-none">3.1K</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-none mb-1">
                    Enriched
                  </p>
                  <p className="text-xl font-bold tabular-nums leading-none">4.5K</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none z-10">
                <Search className="size-5" />
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search torrents..."
                className="h-14 pl-12 pr-3 sm:pr-40 text-base bg-background border-border/60 hover:border-border focus-visible:border-foreground/40 focus-visible:ring-1 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 rounded-full transition-colors font-medium placeholder:text-muted-foreground/40 shadow-sm"
              />
              <div className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-1.5">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-10 px-3 hover:bg-accent rounded-full font-medium text-muted-foreground hover:text-foreground"
                    >
                      <SlidersHorizontal className="size-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="space-y-2">
                      <SheetTitle className="text-xl font-bold">
                        Advanced Filters
                      </SheetTitle>
                      <SheetDescription className="text-sm">
                        Refine your search with detailed criteria
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-8 space-y-6 pb-8">
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Media Type
                          </h3>
                          <ToggleGroup
                            type="multiple"
                            value={types}
                            onValueChange={setTypes}
                            className="flex-wrap justify-start gap-2"
                          >
                            {TYPES.map((type) => (
                              <ToggleGroupItem
                                key={type.value}
                                value={type.value}
                                variant="outline"
                                className="min-w-20 font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                              >
                                {type.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Quality
                          </h3>
                          <ToggleGroup
                            type="multiple"
                            value={resolutions}
                            onValueChange={setResolutions}
                            className="flex-wrap justify-start gap-2"
                          >
                            {RESOLUTIONS.map((res) => (
                              <ToggleGroupItem
                                key={res.value}
                                value={res.value}
                                variant="outline"
                                className="min-w-20 font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                              >
                                {res.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Genres
                        </h3>
                        <ToggleGroup
                          type="multiple"
                          value={genres}
                          onValueChange={setGenres}
                          className="flex-wrap justify-start gap-2"
                        >
                          {GENRES.map((genre) => (
                            <ToggleGroupItem
                              key={genre}
                              value={genre}
                              variant="outline"
                              className="font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                            >
                              {genre}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>

                      <div className="border-t border-border/40" />

                      <div className="space-y-5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Range Filters
                        </h3>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Year Range</Label>
                              <span className="text-sm tabular-nums text-muted-foreground font-medium">
                                {yearRange[0]} – {yearRange[1]}
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

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Size Range</Label>
                              <span className="text-sm tabular-nums text-muted-foreground font-medium">
                                {sizeRange[0]} – {sizeRange[1]} GB
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

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Min. Seeders</Label>
                              <span className="text-sm tabular-nums text-muted-foreground font-medium">
                                {seedersRange[0]}
                              </span>
                            </div>
                            <Slider
                              min={0}
                              max={1000}
                              step={10}
                              value={seedersRange}
                              onValueChange={setSeedersRange}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="w-px h-6 bg-border/60" />

                <Button
                  type="submit"
                  size="sm"
                  className="h-10 px-5 font-semibold rounded-full"
                >
                  Search
                </Button>
              </div>
            </div>

            {/* Mobile Buttons */}
            <div className="flex sm:hidden gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(true)}
                className="flex-1 gap-2 h-11 font-medium rounded-full"
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              <Button type="submit" className="flex-1 h-11 font-semibold rounded-full">
                Search
              </Button>
            </div>

            {/* Instant Results */}
            {searchQuery.length > 2 && (
              <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200 overflow-x-hidden">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Quick Results
                  </h2>
                  {instantResults.data && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {instantResults.data.totalHits.toLocaleString()} found
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 overflow-x-hidden">
                  {instantResults.isError && (
                    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4">
                      <p className="text-destructive text-sm font-medium">
                        Error loading results. Please try again.
                      </p>
                    </div>
                  )}

                  {instantResults.data &&
                    instantResults.data.hits.length > 0 &&
                    !instantResults.isLoading && (
                      <>
                        <div className="flex flex-col gap-1 min-w-0">
                          {instantResults.data.hits.map((result) => (
                            <Link
                              to="/torrents/$torrent"
                              params={{ torrent: result.infoHash }}
                              key={result.infoHash}
                              className="block min-w-0"
                            >
                              <div className="group flex items-center gap-3 rounded-xl px-4 py-3 bg-card/40 border border-border/40 hover:bg-accent/40 hover:border-border/70 transition-all duration-150 overflow-hidden min-w-0">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <h3 className="text-sm font-semibold line-clamp-1 flex-1 min-w-0">
                                      {result.trackerTitle}
                                    </h3>
                                    {result.sourceNames && result.sourceNames.length > 0 && (
                                      <span className="font-mono text-[11px] text-muted-foreground/50 shrink-0 hidden sm:block">
                                        {result.sourceNames[0]}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                    <div className="flex items-center gap-1" title="Size">
                                      <HardDrive className="size-3.5 shrink-0" />
                                      <span className="font-medium text-foreground/70">
                                        {formatBytesString(result.size)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Seeders">
                                      <ArrowUp className="size-3.5 text-green-500 shrink-0" />
                                      <span className="font-medium text-green-600 dark:text-green-400">
                                        {result.seeders}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1" title="Leechers">
                                      <ArrowDown className="size-3.5 text-rose-500 shrink-0" />
                                      <span className="font-medium text-rose-600 dark:text-rose-400">
                                        {result.leechers ?? 0}
                                      </span>
                                    </div>
                                    {result.files && result.files.length > 0 && (
                                      <div className="flex items-center gap-1" title={`${result.files.length} files`}>
                                        <FileText className="size-3.5 shrink-0" />
                                        <span>{result.files.length}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      {result.type && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] px-1.5 py-0 h-4 font-medium"
                                        >
                                          {result.type}
                                        </Badge>
                                      )}
                                      {result.resolution && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-4 font-medium border-border/50"
                                        >
                                          {result.resolution}
                                        </Badge>
                                      )}
                                      {(result.publishedAt || result.createdAt) && (
                                        <div className="hidden sm:flex items-center gap-1">
                                          <Calendar className="size-3.5 shrink-0" />
                                          <span className="whitespace-nowrap">
                                            {new Date(
                                              result.publishedAt || result.createdAt,
                                            ).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              year:
                                                new Date(
                                                  result.publishedAt || result.createdAt,
                                                ).getFullYear() !== new Date().getFullYear()
                                                  ? "numeric"
                                                  : undefined,
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
                              </div>
                            </Link>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigate({ to: "/torrents", search: { q: searchQuery } })}
                          className="w-full gap-2 h-10 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg group"
                        >
                          View all {instantResults.data.totalHits.toLocaleString()} results
                          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </>
                    )}

                  {instantResults.data &&
                    instantResults.data.hits.length === 0 &&
                    !instantResults.isLoading && (
                      <div className="rounded-xl py-10 text-center">
                        <p className="text-muted-foreground font-medium text-sm">
                          No results for "{searchQuery}"
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Try different keywords or check your spelling
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
