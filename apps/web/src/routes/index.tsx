import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  HardDrive,
  ArrowUp,
  ArrowDown,
  FileText,
  Calendar,
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
        limit: 3, // Only show top 5 instant results
      },
      enabled: debouncedSearchQuery.length > 2, // Only search if query is longer than 2 characters
    }),
  );

  // instantResults.isLoading = true

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
    <div className="flex min-h-screen flex-col items-center px-4 pt-24 sm:pt-32">
      <div className="w-full max-w-5xl space-y-12">
        {/* Hero Section */}
        <div className="space-y-6 text-center">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Minato
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg font-medium">
              Search across your {totalTorrents.data?.count ?? 0} torrents,
              instantly
            </p>
          </div>
        </div>

        {/* Search Section */}
        <form onSubmit={handleSearch} className="space-y-8">
          <div className="space-y-6">
            <div className="relative flex items-center gap-2">
              <div className="absolute left-3 sm:left-5 text-muted-foreground pointer-events-none">
                <Search className="size-4 sm:size-5" />
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search torrents..."
                className="h-14 sm:h-16 pl-10 sm:pl-14 pr-2 sm:pr-40 text-sm sm:text-base shadow-xl border-2 focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
              />
              <div className="hidden sm:flex absolute right-2 items-center gap-2">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="gap-2 h-12 border-2 hover:bg-accent"
                    >
                      <SlidersHorizontal className="size-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="space-y-3">
                      <SheetTitle className="text-2xl">
                        Advanced Filters
                      </SheetTitle>
                      <SheetDescription className="text-base">
                        Refine your search with detailed criteria
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-8 space-y-8 pb-8">
                      {/* Type & Resolution */}
                      <div className="space-y-6">
                        {/* Type */}
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold">
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
                                className="min-w-20 border-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                {type.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        {/* Resolution */}
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold">Quality</h3>
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
                                className="min-w-20 border-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                {res.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </div>

                      {/* Genres */}
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold">Genres</h3>
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
                              className="min-w-24 border-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                            >
                              {genre}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>

                      {/* Separator */}
                      <div className="border-t" />

                      {/* Range Filters */}
                      <div className="space-y-6">
                        <h3 className="text-base font-semibold">
                          Range Filters
                        </h3>

                        <div className="space-y-8">
                          {/* Year Range */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Year Range
                              </Label>
                              <span className="text-sm font-semibold tabular-nums">
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
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Size Range
                              </Label>
                              <span className="text-sm font-semibold tabular-nums">
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
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Minimum Seeders
                              </Label>
                              <span className="text-sm font-semibold tabular-nums">
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
                  className="shadow-lg h-12 px-6 font-semibold"
                >
                  Search
                </Button>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex sm:hidden gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(true)}
                className="flex-1 gap-2 border-2 hover:bg-accent"
              >
                <SlidersHorizontal className="size-4" />
                Filters
              </Button>
              <Button type="submit" className="flex-1 shadow-lg font-semibold">
                Search
              </Button>
            </div>

            {/* Instant Results */}
            {searchQuery.length > 2 && (
              <div className="space-y-3 animate-in fade-in-50 duration-300">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">Instant Results</h2>
                    {instantResults.data && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {instantResults.data.totalHits} hits
                      </Badge>
                    )}
                  </div>
                  {instantResults.data && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {instantResults.data.processingTimeMs}ms
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {instantResults.isError && (
                    <div className="border-2 border-destructive/50 bg-destructive/5 rounded-lg p-4">
                      <p className="text-destructive text-sm font-medium">
                        Error loading results. Please try again.
                      </p>
                    </div>
                  )}

                  {instantResults.isLoading && (
                    <div className="flex flex-col gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="border-2 rounded-lg p-3 bg-card"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-full max-w-md" />
                              <Skeleton className="h-4 w-12 shrink-0" />
                              <Skeleton className="h-4 w-12 shrink-0" />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-12" />
                              </div>
                              <Skeleton className="h-4 w-24" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {instantResults.data &&
                    instantResults.data.hits.length > 0 &&
                    !instantResults.isLoading && (
                      <div className="flex flex-col gap-2">
                        {instantResults.data.hits.map((result) => (
                          <Link
                            to="/torrents/$torrent"
                            params={{ torrent: result.infoHash }}
                            key={result.infoHash}
                            className="block"
                          >
                            <div className="group border-2 rounded-lg p-3 bg-card hover:bg-accent/50 hover:border-accent-foreground/20 cursor-pointer transition-all duration-200 hover:shadow-lg sm:hover:scale-[1.01]">
                              <div className="flex items-start justify-between gap-4">
                                {/* Left side: Main content */}
                                <div className="flex-1 min-w-0 space-y-2">
                                  {/* Row 1: Title and Badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-semibold line-clamp-1 flex-1 min-w-0">
                                      {result.trackerTitle}
                                    </h3>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {result.type && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] leading-none px-1.5 py-0.5 h-4"
                                        >
                                          {result.type}
                                        </Badge>
                                      )}
                                      {result.resolution && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] leading-none px-1.5 py-0.5 h-4"
                                        >
                                          {result.resolution}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Row 2: Stats */}
                                  <div className="flex items-center gap-3 text-xs flex-wrap">
                                    <div
                                      className="flex items-center gap-1"
                                      title="Size"
                                    >
                                      <HardDrive className="size-3.5 text-muted-foreground" />
                                      <span className="font-medium">
                                        {formatBytesString(result.size)}
                                      </span>
                                    </div>
                                    <div
                                      className="flex items-center gap-1"
                                      title="Seeders"
                                    >
                                      <ArrowUp className="size-3.5 text-green-600 dark:text-green-400" />
                                      <span className="font-medium text-green-600 dark:text-green-400">
                                        {result.seeders}
                                      </span>
                                    </div>
                                    <div
                                      className="flex items-center gap-1"
                                      title="Leechers"
                                    >
                                      <ArrowDown className="size-3.5 text-amber-600 dark:text-amber-400" />
                                      <span className="font-medium text-amber-600 dark:text-amber-400">
                                        {result.leechers ?? 0}
                                      </span>
                                    </div>
                                    {result.files &&
                                      result.files.length > 0 && (
                                        <div
                                          className="flex items-center gap-1"
                                          title={`${result.files.length} files`}
                                        >
                                          <FileText className="size-3.5 text-muted-foreground" />
                                          <span className="font-medium">
                                            {result.files.length}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                </div>

                                {/* Right side: Metadata */}
                                <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground shrink-0">
                                  {result.sourceNames &&
                                    result.sourceNames.length > 0 && (
                                      <span className="font-medium">
                                        {result.sourceNames.join(", ")}
                                      </span>
                                    )}
                                  {result.publishedAt && (
                                    <div
                                      className="flex items-center gap-1"
                                      title="Published date"
                                    >
                                      <Calendar className="size-3.5" />
                                      <span>
                                        {new Date(
                                          result.publishedAt,
                                        ).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                  {instantResults.data &&
                    instantResults.data.hits.length === 0 &&
                    !instantResults.isLoading && (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <p className="text-muted-foreground font-medium">
                          No results found for "{searchQuery}"
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
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

      {/* Status Indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur-sm border-2 rounded-full shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <p className="text-sm font-medium select-none">
            All systems operational
          </p>
        </div>
      </div>
    </div>
  );
}
