import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	Calendar,
	Clock,
	ExternalLink,
	FileText,
	HardDrive,
	Hash,
	Layers,
	Magnet,
} from "lucide-react";
import { MediaChips } from "@/components/media-chips";
import { formatBytesString, formatDate } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/torrents/$torrent")({
	loader: async ({ params, context: { queryClient } }) => {
		const { torrent: infoHash } = params;
		try {
			return await queryClient.ensureQueryData(
				orpc.torrents.get.queryOptions({ input: { infoHash } }),
			);
		} catch {
			return null;
		}
	},
	component: TorrentDetailComponent,
});

const dotGrid = (
	<div
		className="pointer-events-none fixed inset-0"
		style={{
			backgroundImage:
				"radial-gradient(circle, oklch(0.5 0 0 / 0.12) 1px, transparent 1px)",
			backgroundSize: "28px 28px",
		}}
	/>
);

const sectionLabel = (text: string) => (
	<p className="mb-3 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
		// {text}
	</p>
);

function Card({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`rounded-xl border border-border/50 bg-card p-5 ${className}`}
		>
			{children}
		</div>
	);
}

function StateLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative min-h-screen">
			{dotGrid}
			<div className="relative mx-auto max-w-2xl px-5 py-12 sm:px-8">
				<Link
					to="/torrents"
					className="mb-8 inline-flex items-center gap-1.5 font-mono text-muted-foreground/40 text-xs transition-colors hover:text-primary"
				>
					<ArrowLeft className="size-3" />
					back
				</Link>
				{children}
			</div>
		</div>
	);
}

function TorrentDetailComponent() {
	const { torrent: infoHash } = Route.useParams();

	const torrent = useQuery(
		orpc.torrents.get.queryOptions({ input: { infoHash } }),
	);

	if (torrent.isLoading) {
		return (
			<StateLayout>
				<Card>
					<p className="font-mono text-muted-foreground/40 text-xs">
						loading…
					</p>
				</Card>
			</StateLayout>
		);
	}

	if (torrent.isError) {
		return (
			<StateLayout>
				<Card>
					<p className="mb-1 font-mono text-destructive text-xs">
						error: failed to load torrent
					</p>
					{torrent.error?.message && (
						<p className="font-mono text-muted-foreground/40 text-xs">
							{torrent.error.message}
						</p>
					)}
				</Card>
			</StateLayout>
		);
	}

	const data = torrent.data;

	if (!data) {
		return (
			<StateLayout>
				<Card className="flex flex-col items-center gap-3 py-10 text-center">
					<Magnet className="size-8 text-muted-foreground/25" />
					<p className="font-mono text-muted-foreground/60 text-sm">
						torrent not found
					</p>
					<p className="font-mono text-muted-foreground/40 text-xs">
						This torrent doesn't exist or has been removed.
					</p>
				</Card>
			</StateLayout>
		);
	}

	const title = data.enrichment?.title || data.trackerTitle;
	const trackerSubtitle =
		data.enrichment?.title && data.trackerTitle ? data.trackerTitle : null;

	const hasAbout =
		data.enrichment?.overview ||
		data.enrichment?.releaseDate ||
		data.enrichment?.year ||
		data.enrichment?.runtime ||
		data.enrichment?.status ||
		data.enrichment?.contentRating ||
		(data.enrichment?.genres && data.enrichment.genres.length > 0) ||
		(data.enrichment?.seriesDetails &&
			(data.enrichment.seriesDetails.totalSeasons != null ||
				data.enrichment.seriesDetails.totalEpisodes != null ||
				data.enrichment.seriesDetails.isSeasonPack));

	const externalLinks: { name: string; url: string }[] = [];
	if (data.enrichment?.tmdbId) {
		const tmdbType =
			data.enrichment.mediaType === "movie" ? "movie" : "tv";
		externalLinks.push({
			name: "TMDB",
			url: `https://www.themoviedb.org/${tmdbType}/${data.enrichment.tmdbId}`,
		});
	}
	if (data.enrichment?.imdbId) {
		externalLinks.push({
			name: "IMDb",
			url: `https://www.imdb.com/title/${data.enrichment.imdbId}/`,
		});
	}
	if (data.enrichment?.tvdbId) {
		externalLinks.push({
			name: "TVDB",
			url: `https://www.thetvdb.com/?id=${data.enrichment.tvdbId}&tab=series`,
		});
	}
	if (data.enrichment?.anilistId) {
		externalLinks.push({
			name: "AniList",
			url: `https://anilist.co/anime/${data.enrichment.anilistId}`,
		});
	}
	if (data.enrichment?.malId) {
		externalLinks.push({
			name: "MyAnimeList",
			url: `https://myanimelist.net/anime/${data.enrichment.malId}`,
		});
	}

	return (
		<div className="relative min-h-screen">
			{dotGrid}

			<div className="relative mx-auto flex max-w-2xl flex-col gap-4 px-5 py-12 sm:px-8">
				{/* Back link */}
				<Link
					to="/torrents"
					className="mb-2 inline-flex items-center gap-1.5 font-mono text-muted-foreground/40 text-xs transition-colors hover:text-primary"
				>
					<ArrowLeft className="size-3" />
					back
				</Link>

				{/* ── Hero card ── */}
				<Card>
					<div className="flex gap-5">
						{data.enrichment?.posterUrl && (
							<img
								src={"/assets" + data.enrichment.posterUrl}
								alt={title ?? "Poster"}
								className="aspect-2/3 w-[4.5rem] shrink-0 rounded-md border border-border/40 object-cover"
							/>
						)}

						<div className="flex min-w-0 flex-1 flex-col justify-end">
							{sectionLabel("torrent")}
							<h1 className="font-black text-2xl leading-tight tracking-tight">
								{title ?? "Untitled Torrent"}
							</h1>

							{data.enrichment?.seriesDetails &&
								(data.enrichment.seriesDetails.seasonNumber != null ||
									data.enrichment.seriesDetails.episodeNumber != null) && (
									<p className="mt-1 font-bold font-mono text-foreground/70 text-sm">
										{data.enrichment.seriesDetails.seasonNumber != null &&
										data.enrichment.seriesDetails.episodeNumber != null
											? `S${String(data.enrichment.seriesDetails.seasonNumber).padStart(2, "0")}E${String(data.enrichment.seriesDetails.episodeNumber).padStart(2, "0")}`
											: data.enrichment.seriesDetails.seasonNumber != null
												? `Season ${data.enrichment.seriesDetails.seasonNumber}`
												: `Episode ${data.enrichment.seriesDetails.episodeNumber}`}
										{data.enrichment.seriesDetails.episodeTitle && (
											<span className="font-normal text-muted-foreground/50">
												{" · "}
												{data.enrichment.seriesDetails.episodeTitle}
											</span>
										)}
									</p>
								)}

							{trackerSubtitle && (
								<p className="mt-1 line-clamp-1 font-mono text-muted-foreground/40 text-xs">
									{trackerSubtitle}
								</p>
							)}

							{data.trackerCategory && (
								<span className="mt-2 w-fit rounded border border-border/50 px-1.5 py-0.5 font-mono text-muted-foreground/50 text-xs">
									{data.trackerCategory}
								</span>
							)}
						</div>
					</div>

					{data.releaseData && (
						<>
							<div className="my-4 border-border/30 border-t" />
							<MediaChips releaseData={data.releaseData} />
						</>
					)}
				</Card>

				{/* ── Stats + hash card ── */}
				<Card>
					{sectionLabel("stats")}
					<div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-muted-foreground/60 text-sm">
						{data.size != null && (
							<span className="flex items-center gap-1.5">
								<HardDrive className="size-3.5 shrink-0" />
								{formatBytesString(data.size.toString())}
							</span>
						)}
						{data.seeders != null && (
							<span className="flex items-center gap-1.5">
								<ArrowUp className="size-3.5 shrink-0 text-emerald-500" />
								<span className="text-emerald-600 tabular-nums dark:text-emerald-400">
									{data.seeders}
								</span>
								<span className="text-muted-foreground/30">seeders</span>
							</span>
						)}
						{data.leechers != null && (
							<span className="flex items-center gap-1.5">
								<ArrowDown className="size-3.5 shrink-0 text-rose-500" />
								<span className="text-rose-600 tabular-nums dark:text-rose-400">
									{data.leechers}
								</span>
								<span className="text-muted-foreground/30">leechers</span>
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
								<Calendar className="size-3.5 shrink-0 opacity-40" />
								last seen {formatDate(data.lastSeenAt, true)}
							</span>
						)}
					</div>

					<div className="my-4 border-border/30 border-t" />

					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 flex-1">
							<p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
								<Hash className="size-3" />
								info hash
							</p>
							<p className="select-all break-all font-mono text-muted-foreground/50 text-xs">
								{infoHash}
							</p>
						</div>
						{data.magnet && (
							<a
								href={data.magnet}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex shrink-0 items-center gap-1.5 font-mono text-primary/60 text-xs transition-colors hover:text-primary"
							>
								<Magnet className="size-3.5" />
								magnet
							</a>
						)}
					</div>
				</Card>

				{/* ── About card ── */}
				{hasAbout && (
					<Card>
						{sectionLabel("about")}

						{data.enrichment?.tagline && (
							<p className="mb-3 font-mono text-muted-foreground/40 text-xs italic">
								&ldquo;{data.enrichment.tagline}&rdquo;
							</p>
						)}

						{data.enrichment?.overview && (
							<p className="mb-4 text-muted-foreground text-sm leading-relaxed">
								{data.enrichment.overview}
							</p>
						)}

						<div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-muted-foreground/60 text-sm">
							{data.enrichment?.year && (
								<span>
									<span className="text-muted-foreground/30">year </span>
									<span className="text-foreground/70">
										{data.enrichment.year}
									</span>
								</span>
							)}
							{data.enrichment?.releaseDate && (
								<span>
									<span className="text-muted-foreground/30">released </span>
									<span className="text-foreground/70">
										{formatDate(data.enrichment.releaseDate)}
									</span>
								</span>
							)}
							{data.enrichment?.runtime != null &&
								data.enrichment.runtime > 0 && (
									<span className="flex items-center gap-1.5">
										<Clock className="size-3.5 shrink-0" />
										<span className="text-foreground/70">
											{data.enrichment.runtime} min
										</span>
									</span>
								)}
							{data.enrichment?.status && (
								<span>
									<span className="text-muted-foreground/30">status </span>
									<span className="text-foreground/70">
										{data.enrichment.status}
									</span>
								</span>
							)}
							{data.enrichment?.contentRating && (
								<span className="self-center rounded border border-border/50 px-1.5 py-0.5 font-mono text-muted-foreground/50 text-xs">
									{data.enrichment.contentRating}
								</span>
							)}
						</div>

						{data.enrichment?.seriesDetails &&
							(data.enrichment.seriesDetails.totalSeasons != null ||
								data.enrichment.seriesDetails.totalEpisodes != null ||
								data.enrichment.seriesDetails.isSeasonPack) && (
								<div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-muted-foreground/60 text-sm">
									{data.enrichment.seriesDetails.totalSeasons != null && (
										<span>
											<span className="text-muted-foreground/30">seasons </span>
											<span className="text-foreground/70">
												{data.enrichment.seriesDetails.totalSeasons}
											</span>
										</span>
									)}
									{data.enrichment.seriesDetails.totalEpisodes != null && (
										<span>
											<span className="text-muted-foreground/30">
												episodes{" "}
											</span>
											<span className="text-foreground/70">
												{data.enrichment.seriesDetails.totalEpisodes}
											</span>
										</span>
									)}
									{data.enrichment.seriesDetails.isSeasonPack && (
										<span className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-muted-foreground/50 text-xs">
											season pack
										</span>
									)}
								</div>
							)}

						{data.enrichment?.genres && data.enrichment.genres.length > 0 && (
							<div className="mt-3 flex flex-wrap gap-1.5">
								{data.enrichment.genres.map((genre) => (
									<span
										key={genre}
										className="rounded border border-border/50 px-1.5 py-0.5 font-mono text-muted-foreground/50 text-xs"
									>
										{genre}
									</span>
								))}
							</div>
						)}
					</Card>
				)}

				{/* ── Sources card ── */}
				{data.sources && data.sources.length > 0 && (
					<Card>
						{sectionLabel(`sources · ${data.sources.length}`)}
						<div className="divide-y divide-border/30">
							{data.sources.map((source, idx) => (
								<div key={idx} className="py-3 first:pt-0 last:pb-0">
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0 space-y-0.5">
											{source.name && (
												<p className="font-mono text-foreground/70 text-sm leading-snug">
													{source.name}
												</p>
											)}
											{source.scraper && (
												<p className="font-mono text-muted-foreground/40 text-xs">
													<span className="text-muted-foreground/25">via </span>
													{source.scraper}
												</p>
											)}
										</div>
										{source.url && (
											<a
												href={source.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex shrink-0 items-center gap-1 font-mono text-primary/50 text-xs transition-colors hover:text-primary"
											>
												<ExternalLink className="size-3.5" />
												visit
											</a>
										)}
									</div>
								</div>
							))}
						</div>
					</Card>
				)}

				{/* ── Files card ── */}
				{data.files && data.files.length > 0 && (
					<Card>
						<div className="mb-3 flex items-center gap-1.5">
							<FileText className="size-3 text-muted-foreground/40" />
							<p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
								// files{" "}
								<span className="text-muted-foreground/25">
									· {data.files.length}
								</span>
							</p>
						</div>
						<div className="divide-y divide-border/30">
							{data.files.map((file, idx) => (
								<div
									key={idx}
									className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
								>
									<p className="min-w-0 truncate font-mono text-muted-foreground/60 text-xs">
										{file.filename ?? `file ${idx + 1}`}
									</p>
									{file.size != null && (
										<span className="shrink-0 font-mono text-muted-foreground/30 text-xs tabular-nums">
											{formatBytesString(file.size.toString())}
										</span>
									)}
								</div>
							))}
						</div>
					</Card>
				)}

				{/* ── External links card ── */}
				{externalLinks.length > 0 && (
					<Card>
						<div className="mb-3 flex items-center gap-1.5">
							<Layers className="size-3 text-muted-foreground/40" />
							<p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
								// view on
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							{externalLinks.map((link) => (
								<a
									key={link.name}
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 rounded border border-border/50 px-2.5 py-1.5 font-mono text-muted-foreground/60 text-xs transition-colors hover:border-primary/40 hover:text-primary"
								>
									<ExternalLink className="size-3" />
									{link.name}
								</a>
							))}
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}
