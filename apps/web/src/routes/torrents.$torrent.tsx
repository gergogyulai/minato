import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  HardDrive,
  Calendar,
  Magnet,
  ExternalLink,
  Hash,
  FileText,
} from "lucide-react";
import { formatBytesString, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/torrents/$torrent")({
  loader: async ({ params, context: { queryClient } }) => {
    const { torrent: infoHash } = params;

    try {
      return await queryClient.ensureQueryData(
        orpc.torrents.get.queryOptions({
          input: {
            infoHash,
          },
        }),
      );
    } catch (error) {
      return null;
    }
  },
  component: TorrentDetailComponent,
});

const dotGrid = (
  <div
    className="fixed inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "radial-gradient(circle, oklch(0.5 0 0 / 0.12) 1px, transparent 1px)",
      backgroundSize: "28px 28px",
    }}
  />
);

function TorrentDetailComponent() {
  const { torrent: infoHash } = Route.useParams();

  const torrent = useQuery(
    orpc.torrents.get.queryOptions({
      input: { infoHash },
    }),
  );

  if (torrent.isLoading) {
    return (
      <div className="relative min-h-screen">
        {dotGrid}
        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-12">
          <Link
            to="/torrents"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors mb-10"
          >
            <ArrowLeft className="size-3" />
            back
          </Link>
          <p className="font-mono text-xs text-muted-foreground/50">loading…</p>
        </div>
      </div>
    );
  }

  if (torrent.isError) {
    return (
      <div className="relative min-h-screen">
        {dotGrid}
        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-12">
          <Link
            to="/torrents"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors mb-10"
          >
            <ArrowLeft className="size-3" />
            back
          </Link>
          <p className="font-mono text-xs text-destructive mb-1">
            error: failed to load torrent
          </p>
          {torrent.error?.message && (
            <p className="font-mono text-xs text-muted-foreground/50">
              {torrent.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const data = torrent.data;

  if (!data) {
    return (
      <div className="relative min-h-screen">
        {dotGrid}
        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-12">
          <Link
            to="/torrents"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors mb-10"
          >
            <ArrowLeft className="size-3" />
            back
          </Link>
          <div className="border border-border/40 px-6 py-10 flex flex-col items-center text-center gap-3">
            <Magnet className="size-8 text-muted-foreground/30" />
            <p className="font-mono text-sm text-muted-foreground/60">
              torrent not found
            </p>
            <p className="font-mono text-xs text-muted-foreground/40">
              This torrent doesn't exist or has been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title = data.enrichment?.title || data.trackerTitle;
  const trackerSubtitle =
    data.enrichment?.title && data.trackerTitle ? data.trackerTitle : null;

  return (
    <div className="relative min-h-screen">
      {dotGrid}

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-12">
        {/* Back link */}
        <Link
          to="/torrents"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/50 hover:text-primary transition-colors mb-10"
        >
          <ArrowLeft className="size-3" />
          back
        </Link>

        {/* Header — poster (if present) + title block */}
        <div className="flex gap-6 mb-0">
          {data.enrichment?.posterUrl && (
            <img
              src={"http://localhost:3000/assets" + data.enrichment.posterUrl}
              alt={title ?? "Poster"}
              className="w-20 shrink-0 aspect-2/3 object-cover border border-border/40"
            />
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-end">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground/50 uppercase mb-2">
              torrent
            </p>
            <h1 className="text-2xl font-black tracking-tight leading-tight">
              {title ?? "Untitled Torrent"}
            </h1>
            {trackerSubtitle && (
              <p className="font-mono text-sm text-muted-foreground/50 mt-1 line-clamp-1">
                {trackerSubtitle}
              </p>
            )}
            {data.trackerCategory && (
              <span className="mt-2 w-fit font-mono text-xs px-1.5 py-0.5 border border-border/50 text-muted-foreground/60">
                {data.trackerCategory}
              </span>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-b border-border/40 py-3 mt-6 font-mono text-sm text-muted-foreground/70">
          {data.size != null && (
            <span className="flex items-center gap-1.5">
              <HardDrive className="size-3.5 shrink-0" />
              {formatBytesString(data.size.toString())}
            </span>
          )}
          {data.seeders != null && (
            <span className="flex items-center gap-1.5">
              <ArrowUp className="size-3.5 text-emerald-500 shrink-0" />
              <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                {data.seeders}
              </span>
              <span className="text-muted-foreground/40">seeders</span>
            </span>
          )}
          {data.leechers != null && (
            <span className="flex items-center gap-1.5">
              <ArrowDown className="size-3.5 text-rose-500 shrink-0" />
              <span className="text-rose-600 dark:text-rose-400 tabular-nums">
                {data.leechers}
              </span>
              <span className="text-muted-foreground/40">leechers</span>
            </span>
          )}
          {data.createdAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0" />
              added {formatDate(data.createdAt)}
            </span>
          )}
          {data.lastSeenAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 shrink-0 text-muted-foreground/40" />
              last seen {formatDate(data.lastSeenAt, true)}
            </span>
          )}
        </div>

        {/* Info hash + magnet */}
        <div className="py-4 border-b border-border/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground/50 uppercase flex items-center gap-1.5">
              <Hash className="size-3.5" />
              info hash
            </span>
            {data.magnet && (
              <a
                href={data.magnet}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-primary/70 hover:text-primary transition-colors"
              >
                <Magnet className="size-3.5" />
                open magnet
              </a>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground/60 break-all select-all">
            {infoHash}
          </p>
        </div>

        {/* Overview */}
        {data.enrichment?.overview && (
          <div className="py-4 border-b border-border/40">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground/50 uppercase mb-2">
              overview
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.enrichment.overview}
            </p>
          </div>
        )}

        {/* Media metadata */}
        {(data.enrichment?.releaseDate ||
          data.enrichment?.year ||
          (data.enrichment?.genres && data.enrichment.genres.length > 0)) && (
          <div className="py-4 border-b border-border/40 space-y-3">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground/50 uppercase">
              media info
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground/70">
              {data.enrichment?.year && (
                <span>
                  <span className="text-muted-foreground/40">year </span>
                  <span className="text-foreground/70">{data.enrichment.year}</span>
                </span>
              )}
              {data.enrichment?.releaseDate && (
                <span>
                  <span className="text-muted-foreground/40">released </span>
                  <span className="text-foreground/70">
                    {formatDate(data.enrichment.releaseDate)}
                  </span>
                </span>
              )}
            </div>
            {data.enrichment?.genres && data.enrichment.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.enrichment.genres.map((genre) => (
                  <span
                    key={genre}
                    className="font-mono text-xs px-1.5 py-0.5 border border-border/50 text-muted-foreground/60"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {data.sources && data.sources.length > 0 && (
          <div className="py-4 border-b border-border/40">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground/50 uppercase mb-3">
              sources{" "}
              <span className="text-muted-foreground/30">
                · {data.sources.length}
              </span>
            </p>
            <div className="divide-y divide-border/30">
              {data.sources.map((source, idx) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      {source.name && (
                        <p className="font-mono text-sm text-foreground/80 leading-snug">
                          {source.name}
                        </p>
                      )}
                      {source.scraper && (
                        <p className="font-mono text-xs text-muted-foreground/50">
                          <span className="text-muted-foreground/30">via </span>
                          {source.scraper}
                        </p>
                      )}
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 font-mono text-xs text-primary/60 hover:text-primary transition-colors"
                      >
                        <ExternalLink className="size-3.5" />
                        visit
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {data.files && data.files.length > 0 && (
          <div className="py-4">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground/50 uppercase mb-3 flex items-center gap-1.5">
              <FileText className="size-3.5" />
              files{" "}
              <span className="text-muted-foreground/30">
                · {data.files.length}
              </span>
            </p>
            <div className="divide-y divide-border/30">
              {data.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                >
                  <p className="font-mono text-xs text-muted-foreground/70 min-w-0 truncate">
                    {file.filename ?? `file ${idx + 1}`}
                  </p>
                  {file.size != null && (
                    <span className="font-mono text-xs text-muted-foreground/40 shrink-0 tabular-nums">
                      {formatBytesString(file.size.toString())}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}