import { useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from 'use-debounce';
import { useQuery } from "@tanstack/react-query"
import { orpc } from "@/utils/orpc"

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Helper function to format bytes to human-readable size
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const TYPES = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
  { value: "anime", label: "Anime" },
  { value: "music", label: "Music" },
  { value: "book", label: "Book" },
]

const RESOLUTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "2160p", label: "4K" },
]

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
]

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Debounce the search query for instant results (300ms delay)
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)

  // Filter states matching API contract
  const [types, setTypes] = useState<string[]>([])
  const [resolutions, setResolutions] = useState<string[]>([])
  const [genres, setGenres] = useState<string[]>([])

  // Range sliders (year: 1900-2030, size: 0-100GB, seeders: 0-1000)
  const [yearRange, setYearRange] = useState<number[]>([1900, 2030])
  const [sizeRange, setSizeRange] = useState<number[]>([0, 100])
  const [seedersRange, setSeedersRange] = useState<number[]>([0])

  // Fetch instant results using debounced search query
  const instantResults = useQuery(
    orpc.search.searchTorrents.queryOptions({
      input: {
        q: debouncedSearchQuery,
        limit: 5, // Only show top 5 instant results
      },
      enabled: debouncedSearchQuery.length > 2, // Only search if query is longer than 2 characters
    })
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

    // Build search payload matching API contract
    const payload = {
      q: searchQuery,
      type: types.length > 0 ? types : undefined,
      resolution: resolutions.length > 0 ? resolutions : undefined,
      genres: genres.length > 0 ? genres : undefined,
      year:
        yearRange[0] !== 1900 || yearRange[1] !== 2030
          ? {
              min: yearRange[0],
              max: yearRange[1],
            }
          : undefined,
      size:
        sizeRange[0] !== 0 || sizeRange[1] !== 100
          ? {
              min: sizeRange[0] * 1073741824, // Convert GB to bytes
              max: sizeRange[1] * 1073741824,
            }
          : undefined,
      seeders: seedersRange[0] > 0 ? seedersRange[0] : undefined,
    }

    console.log("Searching with:", payload)
    // TODO: Call API with payload
  }


  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-36">
      <div className="w-full max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Minato
          </h1>
          <p className="text-muted-foreground text-sm">
            Search torrents across the web
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-6">
          <div className="space-y-4">
            <div className="relative flex items-center gap-2">
              <div className="absolute left-4 text-muted-foreground">
                <Search className="size-5" />
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search torrents..."
                className="h-14 pl-12 pr-36 text-base shadow-lg"
              />
              <div className="absolute right-1.5 flex items-center gap-2">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      className="gap-2"
                    >
                      <SlidersHorizontal className="size-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Advanced Filters</SheetTitle>
                      <SheetDescription>
                        Refine your search with detailed criteria
                      </SheetDescription>
                    </SheetHeader>

                    <div className="mt-8 space-y-8 pb-8">
                      {/* Type & Resolution */}
                      <div className="space-y-6">
                        {/* Type */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold">Media Type</h3>
                          <ToggleGroup
                            type="multiple"
                            value={types}
                            onValueChange={setTypes}
                            className="flex-wrap justify-start"
                          >
                            {TYPES.map((type) => (
                              <ToggleGroupItem
                                key={type.value}
                                value={type.value}
                                variant="outline"
                                className="min-w-20"
                              >
                                {type.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>

                        {/* Resolution */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold">Quality</h3>
                          <ToggleGroup
                            type="multiple"
                            value={resolutions}
                            onValueChange={setResolutions}
                            className="flex-wrap justify-start"
                          >
                            {RESOLUTIONS.map((res) => (
                              <ToggleGroupItem
                                key={res.value}
                                value={res.value}
                                variant="outline"
                                className="min-w-20"
                              >
                                {res.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      </div>

                      {/* Genres */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Genres</h3>
                        <ToggleGroup
                          type="multiple"
                          value={genres}
                          onValueChange={setGenres}
                          className="flex-wrap justify-start"
                        >
                          {GENRES.map((genre) => (
                            <ToggleGroupItem
                              key={genre}
                              value={genre}
                              variant="outline"
                              className="min-w-24"
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
                        <h3 className="text-sm font-semibold">Range Filters</h3>

                        <div className="space-y-8">
                          {/* Year Range */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">
                                Year Range
                              </Label>
                              <span className="text-sm text-muted-foreground">
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
                              <Label className="text-sm text-muted-foreground">
                                Size Range
                              </Label>
                              <span className="text-sm text-muted-foreground">
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
                              <Label className="text-sm text-muted-foreground">
                                Minimum Seeders
                              </Label>
                              <span className="text-sm text-muted-foreground">
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

                <Button type="submit" size="lg" className="shadow-sm">
                  Search
                </Button>
              </div>
            </div>

            {/* Instant Results */}
            {searchQuery.length > 2 && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-xs">
                  {instantResults.isLoading ? "Searching..." : "Instant results"}
                </p>
                {instantResults.isError && (
                  <p className="text-destructive text-sm">
                    Error loading results. Please try again.
                  </p>
                )}
                {instantResults.data && instantResults.data.hits.length > 0 && (
                  <div className="space-y-2">
                    {instantResults.data.hits.map((result) => (
                      <Link to="/torrents/$torrent" params={{ torrent: result.infoHash }} key={result.infoHash} >
                        <Card
                          key={result.infoHash}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm font-medium truncate">
                                {result.trackerTitle}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{formatBytes(Number(result.size))}</span>
                              <span className="text-green-600 dark:text-green-400">
                                ↑ {result.seeders}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
                {instantResults.data && instantResults.data.hits.length === 0 && !instantResults.isLoading && (
                  <p className="text-muted-foreground text-sm">
                    No results found
                  </p>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}