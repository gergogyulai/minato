import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Hash, Magnet } from "lucide-react";
import type { ReactNode } from "react";

import { SectionRule } from "@/components/landing-kit";
import { MediaChips } from "@/components/media-chips";
import { cn, formatBytesString, formatDate } from "@/lib/utils";
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

const backdrop = (
	<>
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 -z-10 [background-image:radial-gradient(circle,var(--minato-grid-color)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black_25%,transparent_82%)]"
		/>
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(42rem_30rem_at_50%_-6%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]"
		/>
	</>
);

const topBar = (
	<div className="mb-10 flex items-center justify-between">
		<Link
			to="/"
			className="font-display font-bold text-base text-foreground tracking-tight transition-colors hover:text-primary"
		>
			Minato
		</Link>
		<Link
			to="/torrents"
			className="inline-flex items-center gap-1.5 font-mono text-muted-foreground/50 text-xs transition-colors hover:text-primary"
		>
			<ArrowLeft className="size-3" />
			back to browse
		</Link>
	</div>
);

const sectionLabel = (text: string) => (
	<p className="mb-3 font-mono text-[10px] text-muted-foreground/45 uppercase tracking-[0.2em]">
		// {text}
	</p>
);

function Panel({
	children,
	className = "",
	accent = false,
}: {
	children: ReactNode;
	className?: string;
	accent?: boolean;
}) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-xl border border-border/50 bg-card",
				className,
			)}
		>
			{accent && (
				<div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50 [background:linear-gradient(to_right,transparent,var(--primary),transparent)]" />
			)}
			{children}
		</div>
	);
}

/** A single mono value/label pair on the hero stat hairline. */
function Stat({
	value,
	label,
	className,
}: {
	value: ReactNode;
	label: string;
	className?: string;
}) {
	return (
		<div className="flex items-baseline gap-2">
			<span
				className={cn(
					"font-mono font-medium text-sm tabular-nums",
					className ?? "text-foreground",
				)}
			>
				{value}
			</span>
			<span className="font-mono text-[11px] text-muted-foreground/45 tracking-wider">
				{label}
			</span>
		</div>
	);
}

/** Label/value cell in the About meta grid. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div>
			<dt className="font-mono text-[10px] text-muted-foreground/45 uppercase tracking-[0.18em]">
				{label}
			</dt>
			<dd className="mt-1 font-mono text-foreground/85 text-sm tabular-nums">
				{value}
			</dd>
		</div>
	);
}

/** Right-aligned key/value row in the sidebar. */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<dt className="font-mono text-[11px] text-muted-foreground/45 uppercase tracking-wider">
				{label}
			</dt>
			<dd className="text-right font-mono text-foreground/80 text-xs tabular-nums">
				{children}
			</dd>
		</div>
	);
}

const chipClass =
	"inline-flex items-center rounded-sm border border-border/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground/65";

function StateLayout({ children }: { children: ReactNode }) {
	return (
		<div className="relative min-h-screen">
			{backdrop}
			<div className="relative mx-auto max-w-5xl px-5 py-12 sm:px-8">
				{topBar}
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
				<Panel className="p-5">
					<p className="font-mono text-muted-foreground/40 text-xs">loading…</p>
				</Panel>
			</StateLayout>
		);
	}

	if (torrent.isError) {
		return (
			<StateLayout>
				<Panel className="p-5">
					<p className="mb-1 font-mono text-destructive text-xs">
						error: failed to load torrent
					</p>
					{torrent.error?.message && (
						<p className="font-mono text-muted-foreground/40 text-xs">
							{torrent.error.message}
						</p>
					)}
				</Panel>
			</StateLayout>
		);
	}

	const data = torrent.data;

	if (!data) {
		return (
			<StateLayout>
				<Panel className="flex flex-col items-center gap-3 p-10 text-center">
					<Magnet className="size-8 text-muted-foreground/25" />
					<p className="font-mono text-muted-foreground/60 text-sm">
						torrent not found
					</p>
					<p className="font-mono text-muted-foreground/40 text-xs">
						This torrent doesn't exist or has been removed.
					</p>
				</Panel>
			</StateLayout>
		);
	}

	const enrichment = data.enrichment;
	const series = enrichment?.seriesDetails;
	const title = enrichment?.title || data.trackerTitle;
	const trackerSubtitle =
		enrichment?.title && data.trackerTitle ? data.trackerTitle : null;

	const episodeTag =
		series && (series.seasonNumber != null || series.episodeNumber != null)
			? series.seasonNumber != null && series.episodeNumber != null
				? `S${String(series.seasonNumber).padStart(2, "0")}E${String(series.episodeNumber).padStart(2, "0")}`
				: series.seasonNumber != null
					? `Season ${series.seasonNumber}`
					: `Episode ${series.episodeNumber}`
			: null;

	const eyebrow = [enrichment?.mediaType ?? "torrent", data.trackerCategory]
		.filter(Boolean)
		.join(" · ");

	const hasMeta =
		enrichment?.releaseDate ||
		enrichment?.runtime ||
		enrichment?.status ||
		enrichment?.contentRating ||
		series?.totalSeasons != null ||
		series?.totalEpisodes != null ||
		series?.isSeasonPack;
	const hasAbout = !!(enrichment?.overview || enrichment?.tagline || hasMeta);
	const sources = data.sources ?? [];
	const files = data.files ?? [];
	const hasMain = hasAbout || sources.length > 0 || files.length > 0;

	const stats: { value: ReactNode; label: string; className?: string }[] = [];
	if (data.size != null)
		stats.push({
			value: formatBytesString(data.size.toString()),
			label: "size",
		});
	if (data.seeders != null)
		stats.push({
			value: data.seeders.toLocaleString(),
			label: "seeders",
			className: "text-emerald-600 dark:text-emerald-400",
		});
	if (data.leechers != null)
		stats.push({
			value: data.leechers.toLocaleString(),
			label: "leechers",
			className: "text-rose-600 dark:text-rose-400",
		});
	if (files.length)
		stats.push({ value: files.length.toString(), label: "files" });
	if (data.createdAt)
		stats.push({ value: formatDate(data.createdAt), label: "added" });

	const externalLinks: { name: string; url: string }[] = [];
	if (enrichment?.tmdbId) {
		const tmdbType = enrichment.mediaType === "movie" ? "movie" : "tv";
		externalLinks.push({
			name: "TMDB",
			url: `https://www.themoviedb.org/${tmdbType}/${enrichment.tmdbId}`,
		});
	}
	if (enrichment?.imdbId)
		externalLinks.push({
			name: "IMDb",
			url: `https://www.imdb.com/title/${enrichment.imdbId}/`,
		});
	if (enrichment?.tvdbId)
		externalLinks.push({
			name: "TVDB",
			url: `https://www.thetvdb.com/?id=${enrichment.tvdbId}&tab=series`,
		});
	if (enrichment?.anilistId)
		externalLinks.push({
			name: "AniList",
			url: `https://anilist.co/anime/${enrichment.anilistId}`,
		});
	if (enrichment?.malId)
		externalLinks.push({
			name: "MyAnimeList",
			url: `https://myanimelist.net/anime/${enrichment.malId}`,
		});

	return (
		<div className="relative min-h-screen">
			{backdrop}

			<div className="relative mx-auto max-w-5xl px-5 py-12 sm:px-8">
				{topBar}

				{/* ── Hero ── */}
				<header className="mb-16">
					<div className="flex flex-col gap-7 sm:flex-row sm:items-end">
						{enrichment?.posterUrl && (
							<img
								src={`/assets${enrichment.posterUrl}`}
								alt={title ?? "Poster"}
								className="aspect-2/3 w-28 shrink-0 rounded-xl border border-border/50 object-cover shadow-lg shadow-black/20 sm:w-36"
							/>
						)}

						<div className="min-w-0 flex-1 space-y-4">
							<p className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-[0.2em]">
								{eyebrow}
							</p>

							<h1
								className="font-display font-bold text-foreground leading-[0.95] tracking-tight"
								style={{ fontSize: "clamp(2rem,5vw,3.25rem)" }}
							>
								{title ?? "Untitled Torrent"}
							</h1>

							{episodeTag && (
								<p className="font-mono font-semibold text-foreground/70 text-sm">
									{episodeTag}
									{series?.episodeTitle && (
										<span className="font-normal text-muted-foreground/50">
											{" · "}
											{series.episodeTitle}
										</span>
									)}
								</p>
							)}

							{trackerSubtitle && (
								<p className="line-clamp-1 font-mono text-muted-foreground/40 text-xs">
									{trackerSubtitle}
								</p>
							)}

							<div className="flex flex-wrap items-center gap-1.5 pt-1">
								{enrichment?.year && (
									<span className={chipClass}>{enrichment.year}</span>
								)}
								{enrichment?.contentRating && (
									<span className={chipClass}>{enrichment.contentRating}</span>
								)}
								{enrichment?.genres?.slice(0, 4).map((g) => (
									<span key={g} className={chipClass}>
										{g}
									</span>
								))}
							</div>

							{data.magnet && (
								<div className="pt-2">
									<a
										href={data.magnet}
										className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 font-mono text-primary-foreground text-sm transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.97]"
									>
										<Magnet className="size-4" />
										magnet
									</a>
								</div>
							)}
						</div>
					</div>

					{data.releaseData && (
						<div className="mt-8">
							<MediaChips releaseData={data.releaseData} />
						</div>
					)}

					{stats.length > 0 && (
						<div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-4 border-border/60 border-t pt-6">
							{stats.map((s) => (
								<Stat
									key={s.label}
									value={s.value}
									label={s.label}
									className={s.className}
								/>
							))}
						</div>
					)}
				</header>

				{/* ── Body ── */}
				<div
					className={
						hasMain ? "grid gap-x-12 gap-y-14 lg:grid-cols-3" : "max-w-md"
					}
				>
					{hasMain && (
						<div className="space-y-16 lg:col-span-2">
							{hasAbout && (
								<section>
									<SectionRule label="overview" className="mb-7" />

									{enrichment?.tagline && (
										<p className="mb-4 font-mono text-muted-foreground/45 text-xs italic">
											&ldquo;{enrichment.tagline}&rdquo;
										</p>
									)}

									{enrichment?.overview && (
										<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
											{enrichment.overview}
										</p>
									)}

									{hasMeta && (
										<dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
											{enrichment?.releaseDate && (
												<Fact
													label="released"
													value={formatDate(enrichment.releaseDate)}
												/>
											)}
											{enrichment?.runtime != null &&
												enrichment.runtime > 0 && (
													<Fact
														label="runtime"
														value={`${enrichment.runtime} min`}
													/>
												)}
											{enrichment?.status && (
												<Fact label="status" value={enrichment.status} />
											)}
											{series?.totalSeasons != null && (
												<Fact label="seasons" value={series.totalSeasons} />
											)}
											{series?.totalEpisodes != null && (
												<Fact label="episodes" value={series.totalEpisodes} />
											)}
											{series?.isSeasonPack && (
												<Fact label="format" value="season pack" />
											)}
										</dl>
									)}
								</section>
							)}

							{sources.length > 0 && (
								<section>
									<SectionRule
										label={`sources · ${sources.length}`}
										className="mb-6"
									/>
									<Panel className="divide-y divide-border/30">
										{sources.map((source, idx) => (
											<div
												key={idx}
												className="flex items-center justify-between gap-4 px-4 py-3"
											>
												<div className="min-w-0">
													{source.name && (
														<p className="truncate font-mono text-foreground/80 text-sm">
															{source.name}
														</p>
													)}
													{source.scraper && (
														<p className="font-mono text-muted-foreground/40 text-xs">
															<span className="text-muted-foreground/25">
																via{" "}
															</span>
															{source.scraper}
														</p>
													)}
												</div>
												{source.url && (
													<a
														href={source.url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex shrink-0 items-center gap-1 font-mono text-primary/55 text-xs transition-colors hover:text-primary"
													>
														<ExternalLink className="size-3.5" />
														visit
													</a>
												)}
											</div>
										))}
									</Panel>
								</section>
							)}

							{files.length > 0 && (
								<section>
									<SectionRule
										label={`files · ${files.length}`}
										className="mb-6"
									/>
									<Panel className="divide-y divide-border/30">
										{files.map((file, idx) => (
											<div
												key={idx}
												className="flex items-center justify-between gap-4 px-4 py-2.5"
											>
												<p className="min-w-0 truncate font-mono text-muted-foreground/65 text-xs">
													{file.filename ?? `file ${idx + 1}`}
												</p>
												{file.size != null && (
													<span className="shrink-0 font-mono text-muted-foreground/35 text-xs tabular-nums">
														{formatBytesString(file.size.toString())}
													</span>
												)}
											</div>
										))}
									</Panel>
								</section>
							)}
						</div>
					)}

					{/* ── Sidebar ── */}
					<aside className={hasMain ? "lg:col-span-1" : ""}>
						<div className="space-y-4 lg:sticky lg:top-8">
							<Panel accent className="p-5">
								{sectionLabel("release")}
								<dl className="space-y-2.5">
									<MetaRow label="sources">{sources.length}</MetaRow>
									{data.createdAt && (
										<MetaRow label="added">
											{formatDate(data.createdAt)}
										</MetaRow>
									)}
									{data.lastSeenAt && (
										<MetaRow label="last seen">
											{formatDate(data.lastSeenAt, true)}
										</MetaRow>
									)}
								</dl>

								<div className="my-4 border-border/30 border-t" />

								<p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/45 uppercase tracking-[0.2em]">
									<Hash className="size-3" />
									info hash
								</p>
								<p className="select-all break-all font-mono text-[11px] text-muted-foreground/55 leading-relaxed">
									{infoHash}
								</p>
							</Panel>

							{externalLinks.length > 0 && (
								<Panel className="p-5">
									{sectionLabel("view on")}
									<div className="flex flex-wrap gap-2">
										{externalLinks.map((link) => (
											<a
												key={link.name}
												href={link.url}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2.5 py-1.5 font-mono text-muted-foreground/65 text-xs transition-colors hover:border-primary/40 hover:text-primary"
											>
												<ExternalLink className="size-3" />
												{link.name}
											</a>
										))}
									</div>
								</Panel>
							)}
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
