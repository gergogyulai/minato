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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="flex flex-col items-center px-4 sm:px-6 py-10 sm:py-16 overflow-x-hidden min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-4xl space-y-12 min-w-0">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Minato
            </h1>
          </div>

          {/* Bento Stats Grid */}
          <div className="grid grid-cols-6 gap-2.5">
            {/* Total Torrents - Large */}
            <Card className="col-span-3 sm:col-span-2 bg-gradient-to-br from-card to-muted/20 border-border/40">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground/80 font-medium mb-1.5 uppercase tracking-wide">
                  Torrents
                </p>
                <p className="text-3xl sm:text-4xl font-bold tabular-nums">
                  {totalTorrents.data?.count?.toLocaleString() ?? 0}
                </p>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card className="col-span-3 sm:col-span-1 bg-card border-border/40">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground/80 font-medium mb-1.5 uppercase tracking-wide">
                  Size
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  2.4TB
                </p>
              </CardContent>
            </Card>

            {/* Movies */}
            <Card className="col-span-2 sm:col-span-1 bg-card border-border/40">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground/80 font-medium mb-1.5 uppercase tracking-wide">
                  Movies
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  8.2K
                </p>
              </CardContent>
            </Card>

            {/* TV */}
            <Card className="col-span-2 sm:col-span-1 bg-card border-border/40">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground/80 font-medium mb-1.5 uppercase tracking-wide">
                  TV
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  3.1K
                </p>
              </CardContent>
            </Card>

            {/* Enriched */}
            <Card className="col-span-2 sm:col-span-1 bg-card border-border/40">
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs text-muted-foreground/80 font-medium mb-1.5 uppercase tracking-wide">
                  Enriched
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  4.5K
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Section */}
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="space-y-5">
            <div className="relative flex items-center gap-2">
              <div className="absolute left-4 sm:left-5 text-muted-foreground/40 pointer-events-none z-10">
                <Search className="size-5 sm:size-6" />
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search torrents..."
                className="h-16 sm:h-20 pl-12 sm:pl-16 pr-2 sm:pr-44 text-base sm:text-lg bg-background/50 backdrop-blur-sm shadow-sm border border-border hover:border-border/80 focus-visible:border-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/5 focus-visible:ring-offset-0 rounded-xl transition-all font-medium placeholder:text-muted-foreground/50"
              />
              <div className="hidden sm:flex absolute right-3 items-center gap-2">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="gap-2 h-14 border-2 hover:bg-accent/50 rounded-lg font-semibold"
                    >
                      <SlidersHorizontal className="size-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="space-y-3">
                      <SheetTitle className="text-2xl font-bold">
                        Advanced Filters
                      </SheetTitle>
                      <SheetDescription className="text-sm">
                        Refine your search with detailed criteria
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-8 space-y-6 pb-8">
                      {/* Type & Resolution */}
                      <div className="space-y-5">
                        {/* Type */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
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
                                className="min-w-20 border-2 font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                              >
                                {type.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        {/* Resolution */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">Quality</h3>
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
                                className="min-w-20 border-2 font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                              >
                                {res.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </div>

                      {/* Genres */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">Genres</h3>
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
                              className="min-w-24 border-2 font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                            >
                              {genre}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>

                      {/* Separator */}
                      <div className="border-t" />

                      {/* Range Filters */}
                      <div className="space-y-5">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
                          Range Filters
                        </h3>

                        <div className="space-y-6">
                          {/* Year Range */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold uppercase tracking-wide">
                                Year Range
                              </Label>
                              <span className="text-sm font-bold tabular-nums text-foreground/80">
                                {yearRange[0]} - {yearRange[1]}
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

                          {/* Size Range */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold uppercase tracking-wide">
                                Size Range
                              </Label>
                              <span className="text-sm font-bold tabular-nums text-foreground/80">
                                {sizeRange[0]} GB - {sizeRange[1]} GB
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

                          {/* Minimum Seeders */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold uppercase tracking-wide">
                                Minimum Seeders
                              </Label>
                              <span className="text-sm font-bold tabular-nums text-foreground/80">
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

                <Button
                  type="submit"
                  size="lg"
                  className="shadow-md h-14 px-8 font-bold text-base rounded-lg"
                >
                  Search
                </Button>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex sm:hidden gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(true)}
                className="flex-1 gap-2 h-12 border-2 hover:bg-accent/50 font-semibold rounded-lg"
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              <Button type="submit" className="flex-1 h-12 shadow-md font-bold rounded-lg">
                Search
              </Button>
            </div>

            {/* Instant Results */}
            {searchQuery.length > 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-300 overflow-x-hidden pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">Instant Results</h2>
                  </div>
                  {instantResults.data && (
                    <span className="text-sm text-muted-foreground font-medium">
                      {instantResults.data.totalHits.toLocaleString()} total
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 overflow-x-hidden">
                  {instantResults.isError && (
                    <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-5">
                      <p className="text-destructive text-sm font-semibold">
                        Error loading results. Please try again.
                      </p>
                    </div>
                  )}

                  {/* {instantResults.isLoading && (
                    <div className="flex flex-col gap-2">
                      {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="border border-border/50 rounded-xl p-4 bg-card/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <Skeleton className="h-5 w-full sm:w-72" />
                          <Skeleton className="h-4 w-24 sm:ml-auto" />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                          </div>
                        </div>
                        </div>
                      </div>
                      ))}
                    </div>
                  )} */}

                  {instantResults.data &&
                    instantResults.data.hits.length > 0 &&
                    !instantResults.isLoading && (
                      <>
                        <div className="flex flex-col gap-2 min-w-0">
                          {instantResults.data.hits.map((result) => (
                          <Link
                            to="/torrents/$torrent"
                            params={{ torrent: result.infoHash }}
                            key={result.infoHash}
                            className="block min-w-0"
                          >
                            <div className="group border border-border/50 rounded-xl p-4 bg-card/50 hover:bg-accent/30 hover:border-foreground/20 cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden">
                              <div className="flex items-start gap-4 min-w-0">
                                {/* Main content */}
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                                    <h3 className="text-base font-bold line-clamp-2 sm:line-clamp-1 flex-1 min-w-0 overflow-hidden wrap-break-word">
                                      {result.trackerTitle}
                                    </h3>
                                    {result.sourceNames &&
                                      result.sourceNames.length > 0 && (
                                        <span className="font-mono text-xs text-muted-foreground/60 shrink-0 truncate max-w-full sm:max-w-none font-medium">
                                          {result.sourceNames.join(", ")}
                                        </span>
                                      )}
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 min-w-0">
                                    <div className="flex items-center gap-3 text-xs flex-wrap min-w-0">
                                      <div
                                        className="flex items-center gap-1.5"
                                        title="Size"
                                      >
                                        <HardDrive className="size-4 text-muted-foreground/70" />
                                        <span className="font-semibold text-foreground/90">
                                          {formatBytesString(result.size)}
                                        </span>
                                      </div>
                                      <div
                                        className="flex items-center gap-1.5"
                                        title="Seeders"
                                      >
                                        <ArrowUp className="size-4 text-green-600 dark:text-green-400" />
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                          {result.seeders}
                                        </span>
                                      </div>
                                      <div
                                        className="flex items-center gap-1.5"
                                        title="Leechers"
                                      >
                                        <ArrowDown className="size-4 text-rose-600 dark:text-rose-400" />
                                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                                          {result.leechers ?? 0}
                                        </span>
                                      </div>
                                      {result.files &&
                                        result.files.length > 0 && (
                                          <div
                                            className="flex items-center gap-1.5"
                                            title={`${result.files.length} files`}
                                          >
                                            <FileText className="size-4 text-muted-foreground/70" />
                                            <span className="font-semibold text-foreground/90">
                                              {result.files.length}
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2.5 sm:gap-3 text-xs flex-wrap min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {result.type && (
                                          <Badge
                                            variant="secondary"
                                            className="text-[11px] leading-none px-2 py-1 h-5 font-semibold"
                                          >
                                            {result.type}
                                          </Badge>
                                        )}
                                        {result.resolution && (
                                          <Badge
                                            variant="outline"
                                            className="text-[11px] leading-none px-2 py-1 h-5 font-semibold border-border/50"
                                          >
                                            {result.resolution}
                                          </Badge>
                                        )}
                                      </div>
                                      {(result.publishedAt ||
                                        result.createdAt) && (
                                        <div
                                          className="flex items-center gap-1.5"
                                          title="Published date"
                                        >
                                          <Calendar className="size-4 text-muted-foreground/70" />
                                          <span className="whitespace-nowrap font-medium text-muted-foreground">
                                            {new Date(
                                              result.publishedAt ||
                                                result.createdAt,
                                            ).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              year:
                                                new Date(
                                                  result.publishedAt ||
                                                    result.createdAt,
                                                ).getFullYear() !==
                                                new Date().getFullYear()
                                                  ? "numeric"
                                                  : undefined,
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                          ))}
                        </div>
                        
                        {/* View All Results Button */}
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              navigate({
                                to: "/torrents",
                                search: { q: searchQuery },
                              });
                            }}
                            className="w-full gap-2 h-12 border-2 border-dashed hover:border-solid hover:bg-accent/50 font-semibold rounded-lg group"
                          >
                            View All {instantResults.data.totalHits.toLocaleString()} Results
                            <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </>
                    )}

                  {instantResults.data &&
                    instantResults.data.hits.length === 0 &&
                    !instantResults.isLoading && (
                      <div className="border-2 border-dashed border-border/50 rounded-xl p-10 text-center bg-muted/20">
                        <p className="text-muted-foreground font-semibold text-base">
                          No results found for "{searchQuery}"
                        </p>
                        <p className="text-sm text-muted-foreground/70 mt-2">
                          Try adjusting your search terms or filters
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
