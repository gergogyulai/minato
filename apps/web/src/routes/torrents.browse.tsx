import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/torrents/browse")({
  component: TorrentBrowseComponent,
});

function TorrentBrowseComponent() {
  const [searchQuery, setSearchQuery] = useState("breaking bad");

  const torrents = useQuery(
    orpc.search.searchTorrents.queryOptions({
      input: {
        q: searchQuery,
      },
    }),
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Query will automatically refetch when searchQuery changes
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
                key={hit.id}
                to="/torrents/$torrent"
                params={{ torrent: hit.infoHash }}
                className="block"
              >
                <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">{hit.title || "Untitled"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                      {hit.size && (
                        <Badge variant="outline">
                          {formatBytes(hit.size)}
                        </Badge>
                      )}
                      {hit.seeders !== undefined && (
                        <Badge variant="outline" className="text-green-600 dark:text-green-400">
                          ↑ {hit.seeders} seeders
                        </Badge>
                      )}
                      {hit.leechers !== undefined && (
                        <Badge variant="outline" className="text-red-600 dark:text-red-400">
                          ↓ {hit.leechers} leechers
                        </Badge>
                      )}
                      {hit.category && (
                        <Badge variant="secondary">
                          {hit.category}
                        </Badge>
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
