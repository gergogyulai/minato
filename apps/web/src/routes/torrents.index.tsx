import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { formatBytesString } from "@/lib/utils";
import { z } from "zod";

const torrentsSearchSchema = z.object({
  q: z.string().optional().default(""),
  type: z.string().optional(),
  resolution: z.string().optional(),
  genres: z.string().optional(),
  yearMin: z.string().optional(),
  yearMax: z.string().optional(),
  sizeMin: z.string().optional(),
  sizeMax: z.string().optional(),
  seeders: z.string().optional(),
});

export const Route = createFileRoute("/torrents/")({
  component: TorrentBrowseComponent,
  validateSearch: torrentsSearchSchema,
});

function TorrentBrowseComponent() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState(searchParams.q || "");

  // Update local search query when URL params change
  useEffect(() => {
    setSearchQuery(searchParams.q || "");
  }, [searchParams.q]);

  // Build API query input from URL search params
  const buildQueryInput = () => {
    const input: any = {
      q: searchParams.q || "",
    };

    if (searchParams.type) {
      input.type = searchParams.type.split(",");
    }
    if (searchParams.resolution) {
      input.resolution = searchParams.resolution.split(",");
    }
    if (searchParams.genres) {
      input.genres = searchParams.genres.split(",");
    }
    if (searchParams.yearMin || searchParams.yearMax) {
      input.year = {
        min: searchParams.yearMin ? parseInt(searchParams.yearMin) : undefined,
        max: searchParams.yearMax ? parseInt(searchParams.yearMax) : undefined,
      };
    }
    if (searchParams.sizeMin || searchParams.sizeMax) {
      input.size = {
        min: searchParams.sizeMin ? parseInt(searchParams.sizeMin) : undefined,
        max: searchParams.sizeMax ? parseInt(searchParams.sizeMax) : undefined,
      };
    }
    if (searchParams.seeders) {
      input.seeders = parseInt(searchParams.seeders);
    }

    return input;
  };

  const torrents = useQuery(
    orpc.search.searchTorrents.queryOptions({
      input: buildQueryInput(),
    }),
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL search params with new query
    navigate({
      to: "/torrents",
      search: { q: searchQuery },
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Browse Torrents</h1>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search torrents..."
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {torrents.isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading torrents...</p>
        </div>
      )}

      {torrents.isError && (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading torrents</p>
        </div>
      )}

      {torrents.isSuccess && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              {torrents.data?.hits.length ?? 0} torrents found
            </p>
          </div>

          <div className="grid gap-4">
            {torrents.data?.hits.map((hit) => (
              <Link
                key={hit.infoHash}
                to="/torrents/$torrent"
                params={{ torrent: hit.infoHash }}
                className="block"
              >
                <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {hit.trackerTitle || "Untitled"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                      {hit.size && (
                        <Badge variant="outline">{formatBytesString(hit.size)}</Badge>
                      )}
                      {hit.seeders !== undefined && (
                        <Badge
                          variant="outline"
                          className="text-green-600 dark:text-green-400"
                        >
                          ↑ {hit.seeders} seeders
                        </Badge>
                      )}
                      {hit.leechers !== undefined && (
                        <Badge
                          variant="outline"
                          className="text-red-600 dark:text-red-400"
                        >
                          ↓ {hit.leechers} leechers
                        </Badge>
                      )}
                      {hit.trackerCategory && (
                        <Badge variant="secondary">{hit.trackerCategory}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}