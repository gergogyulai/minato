import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Calendar, Users, HardDrive } from "lucide-react";

export const Route = createFileRoute("/torrents/$torrent")({
  component: TorrentDetailComponent,
});

function TorrentDetailComponent() {
  const { torrent: infoHash } = Route.useParams();

  const torrent = useQuery(
    orpc.torrents.get.queryOptions({
      input: {
        infoHash,
      },
    }),
  );

  if (torrent.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading torrent details...</p>
        </div>
      </div>
    );
  }

  if (torrent.isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link to="/torrents/browse">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 size-4" />
            Back to Browse
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Error loading torrent details</p>
          <p className="text-muted-foreground text-sm">
            {torrent.error?.message || "Unknown error occurred"}
          </p>
        </div>
      </div>
    );
  }

  const data = torrent.data;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/torrents/browse">
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 size-4" />
          Back to Browse
        </Button>
      </Link>

      <div className="space-y-6">
        {/* Main Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">
                  {data?.enrichment?.title || data?.trackerTitle || "Untitled Torrent"}
                </CardTitle>
                {data?.trackerCategory && (
                  <Badge variant="secondary" className="mb-4">
                    {data.trackerCategory}
                  </Badge>
                )}
              </div>
              <Button className="gap-2">
                <Download className="size-4" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data?.size && (
                <div className="flex items-center gap-3">
                  <HardDrive className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Size</p>
                    <p className="font-medium">{formatBytes(data.size)}</p>
                  </div>
                </div>
              )}
              
              {data?.seeders !== undefined && (
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Seeders</p>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      {data.seeders}
                    </p>
                  </div>
                </div>
              )}
              
              {data?.leechers !== undefined && (
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Leechers</p>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {data.leechers}
                    </p>
                  </div>
                </div>
              )}
              
              {data?.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Added</p>
                    <p className="font-medium">{formatDate(data.createdAt)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Info Hash */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">Info Hash</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {data?.infoHash}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Enrichment Data */}
        {data?.enrichment && (
          <Card>
            <CardHeader>
              <CardTitle>Media Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.enrichment.overview && (
                <div>
                  <p className="text-sm font-medium mb-2">Overview</p>
                  <p className="text-sm text-muted-foreground">
                    {data.enrichment.overview}
                  </p>
                </div>
              )}

              {data.enrichment.releaseDate && (
                <div>
                  <p className="text-sm font-medium mb-2">Release Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(data.enrichment.releaseDate)}
                  </p>
                </div>
              )}

              {data.enrichment.genres && data.enrichment.genres.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Genres</p>
                  <div className="flex flex-wrap gap-2">
                    {data.enrichment.genres.map((genre) => (
                      <Badge key={genre} variant="outline">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {data.enrichment.year && (
                <div>
                  <p className="text-sm font-medium mb-2">Year</p>
                  <p className="text-sm text-muted-foreground">
                    {data.enrichment.year}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sources Info */}
        {data?.sources && data.sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.sources.map((source, idx) => (
                  <div key={idx} className="space-y-2">
                    {source.name && (
                      <div>
                        <p className="text-sm font-medium mb-1">Source Name</p>
                        <p className="text-sm text-muted-foreground">
                          {source.name}
                        </p>
                      </div>
                    )}
                    {source.scraper && (
                      <div>
                        <p className="text-sm font-medium mb-1">Scraper</p>
                        <p className="text-sm text-muted-foreground">
                          {source.scraper}
                        </p>
                      </div>
                    )}
                    {source.url && (
                      <div>
                        <p className="text-sm font-medium mb-1">URL</p>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {source.url}
                        </a>
                      </div>
                    )}
                    {idx < data.sources.length - 1 && <div className="border-t" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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

function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
