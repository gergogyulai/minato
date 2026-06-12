import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
	ArrowRight,
	Database,
	Film,
	LayoutDashboard,
	List,
	type LucideIcon,
	Search,
} from "lucide-react"
import { motion } from "motion/react"
import { useDebounce } from "use-debounce"
import { CommandEmpty, CommandGroup } from "@/components/ui/command"
import { cn, formatBytesString } from "@/lib/utils"
import { orpc } from "@/utils/orpc"
import {
	type CommandMenuController,
	CommandMenuItem,
	type CommandMenuPage,
	IconTile,
	SectionLabel,
	useCommandMenu,
} from "./command-menu"

// ─── Root page ────────────────────────────────────────────────────────────────

interface RootCommand {
	id: string
	label: string
	description?: string
	keywords?: string[]
	icon: LucideIcon
	/** Renders a chevron hinting that the command opens a sub-page. */
	opensPage?: boolean
	run: (ctx: {
		menu: CommandMenuController
		navigate: ReturnType<typeof useNavigate>
	}) => void
}

const rootCommandGroups: { heading: string; commands: RootCommand[] }[] = [
	{
		heading: "search",
		commands: [
			{
				id: "search-torrents",
				label: "Search torrents",
				description: "full-text search across the torrent database",
				keywords: ["find", "query", "lookup"],
				icon: Search,
				opensPage: true,
				run: ({ menu }) => menu.push(torrentSearchPage),
			},
		],
	},
	{
		heading: "navigate",
		commands: [
			{
				id: "browse-torrents",
				label: "Browse",
				description: "explore the torrent library",
				keywords: ["torrents", "library", "list"],
				icon: List,
				run: ({ menu, navigate }) => {
					navigate({ to: "/torrents" })
					menu.close()
				},
			},
			{
				id: "dashboard",
				label: "Dashboard",
				description: "scrapers, queues and system health",
				keywords: ["admin", "stats", "home"],
				icon: LayoutDashboard,
				run: ({ menu, navigate }) => {
					navigate({ to: "/dashboard" })
					menu.close()
				},
			},
		],
	},
]

function RootPage() {
	const menu = useCommandMenu()
	const navigate = useNavigate()
	let revealIndex = 0

	return (
		<>
			<CommandEmpty>
				<span className="font-mono text-xs text-muted-foreground/40">
					no matching commands
				</span>
			</CommandEmpty>

			{rootCommandGroups.map((group) => (
				<CommandGroup
					key={group.heading}
					heading={<SectionLabel>{group.heading}</SectionLabel>}
				>
					{group.commands.map((command) => (
						<CommandMenuItem
							key={command.id}
							value={command.label}
							keywords={command.keywords}
							onSelect={() => command.run({ menu, navigate })}
						>
							<motion.div
								className="flex w-full min-w-0 items-center gap-2"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									duration: 0.18,
									delay: Math.min(revealIndex++ * 0.03, 0.15),
									ease: "easeOut",
								}}
							>
								<IconTile icon={command.icon} />
								<div className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="font-mono text-sm text-foreground/80 transition-colors duration-150 group-data-selected/command-item:text-foreground">
										{command.label}
									</span>
									{command.description && (
										<span className="font-mono text-[10px] text-muted-foreground/40">
											{command.description}
										</span>
									)}
								</div>
								{command.opensPage && (
									<ArrowRight className="size-3.5 shrink-0 text-muted-foreground/30 transition-all duration-150 group-data-selected/command-item:translate-x-0.5 group-data-selected/command-item:text-muted-foreground/60" />
								)}
							</motion.div>
						</CommandMenuItem>
					))}
				</CommandGroup>
			))}
		</>
	)
}

// ─── Torrent search page ──────────────────────────────────────────────────────

type TorrentHit = {
	infoHash: string
	trackerTitle: string
	size: string | null
	seeders: number | null
	releaseData?: { resolution?: string } | null
	enrichment?: {
		title?: string | null
		year?: number | null
		posterUrl?: string | null
	} | null
}

function TorrentSearchPage() {
	const { search, close } = useCommandMenu()
	const navigate = useNavigate()
	const [debouncedSearch] = useDebounce(search.trim(), 250)

	const { data: rawData, isPending, isPlaceholderData } = useQuery({
		...orpc.search.searchTorrents.queryOptions({
			input: { q: debouncedSearch, limit: 8 },
		}),
		enabled: debouncedSearch.length > 0,
		placeholderData: keepPreviousData,
	})
	const data = rawData as { hits: TorrentHit[]; totalHits: number } | undefined

	if (!search) {
		return (
			<StateMessage icon={Database} message="type to search the torrent database" />
		)
	}

	if (isPending) {
		return (
			<div
				role="status"
				className="flex items-center justify-center gap-1 py-10"
			>
				<span className="sr-only">searching</span>
				<span className="size-1 animate-pulse rounded-full bg-muted-foreground/40" />
				<span className="size-1 animate-pulse rounded-full bg-muted-foreground/40 [animation-delay:160ms]" />
				<span className="size-1 animate-pulse rounded-full bg-muted-foreground/40 [animation-delay:320ms]" />
			</div>
		)
	}

	const hits = data?.hits ?? []

	if (hits.length === 0) {
		return <StateMessage message="no results" detail={`"${debouncedSearch}"`} />
	}

	return (
		<div
			className={cn(
				"transition-opacity duration-150",
				isPlaceholderData && "opacity-60",
			)}
		>
			<CommandGroup
				heading={
					<SectionLabel>
						results
						{data?.totalHits != null
							? ` · ${data.totalHits.toLocaleString()}`
							: ""}
					</SectionLabel>
				}
			>
				{hits.map((hit, index) => (
					<TorrentResultItem
						key={hit.infoHash}
						hit={hit}
						revealDelay={Math.min(index * 0.025, 0.15)}
						onSelect={() => {
							navigate({
								to: "/torrents/$torrent",
								params: { torrent: hit.infoHash },
							})
							close()
						}}
					/>
				))}

				{data != null && data.totalHits > hits.length && (
					<CommandMenuItem
						value="view-all-results"
						onSelect={() => {
							navigate({ to: "/torrents", search: { q: debouncedSearch } })
							close()
						}}
					>
						<motion.div
							className="flex w-full min-w-0 items-center gap-2"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{
								duration: 0.18,
								delay: Math.min(hits.length * 0.025, 0.15),
								ease: "easeOut",
							}}
						>
							<div className="flex h-9 w-6 shrink-0 items-center justify-center rounded border border-border/30 bg-muted/20">
								<ArrowRight className="size-3 text-muted-foreground/40 transition-transform duration-150 group-data-selected/command-item:translate-x-0.5" />
							</div>
							<span className="font-mono text-xs text-muted-foreground/60 transition-colors duration-150 group-data-selected/command-item:text-foreground">
								view all results
							</span>
							<span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/40">
								{data.totalHits.toLocaleString()}
							</span>
						</motion.div>
					</CommandMenuItem>
				)}
			</CommandGroup>
		</div>
	)
}

function TorrentResultItem({
	hit,
	revealDelay,
	onSelect,
}: {
	hit: TorrentHit
	revealDelay: number
	onSelect: () => void
}) {
	const title = hit.enrichment?.title || hit.trackerTitle
	const year = hit.enrichment?.year
	const resolution = hit.releaseData?.resolution
	const posterUrl = hit.enrichment?.posterUrl
		? "/assets" + hit.enrichment.posterUrl
		: null

	return (
		<CommandMenuItem value={hit.infoHash} onSelect={onSelect}>
			<motion.div
				className="flex w-full min-w-0 items-center gap-2 overflow-hidden"
				initial={{ opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.18, delay: revealDelay, ease: "easeOut" }}
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt=""
						className="aspect-[2/3] h-9 w-6 shrink-0 rounded border border-border/40 object-cover"
					/>
				) : (
					<div className="flex h-9 w-6 shrink-0 items-center justify-center rounded border border-border/30 bg-muted/20">
						<Film className="size-3 text-muted-foreground/30" />
					</div>
				)}

				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<p className="truncate font-mono text-xs text-foreground/80 transition-colors duration-150 group-data-selected/command-item:text-foreground">
						{title}
					</p>
					<div className="flex items-center gap-1.5">
						{year && (
							<span className="font-mono text-[10px] text-muted-foreground/50">
								{year}
							</span>
						)}
						{resolution && (
							<span className="rounded border border-border/50 px-1 font-mono text-[10px] text-muted-foreground/60">
								{resolution}
							</span>
						)}
					</div>
				</div>

				<div className="flex shrink-0 flex-col items-end gap-0.5">
					{hit.size != null && (
						<span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
							{formatBytesString(hit.size)}
						</span>
					)}
					{hit.seeders != null && (
						<span className="font-mono text-[10px] tabular-nums text-emerald-400">
							{hit.seeders}↑
						</span>
					)}
				</div>
			</motion.div>
		</CommandMenuItem>
	)
}

function StateMessage({
	icon: Icon,
	message,
	detail,
}: {
	icon?: LucideIcon
	message: string
	detail?: string
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
			className="flex flex-col items-center justify-center gap-3 py-10"
		>
			{Icon && <Icon className="size-6 text-muted-foreground/20" />}
			<p className="font-mono text-xs text-muted-foreground/40">{message}</p>
			{detail && (
				<p className="font-mono text-[10px] text-muted-foreground/25">
					{detail}
				</p>
			)}
		</motion.div>
	)
}

// ─── Page definitions ─────────────────────────────────────────────────────────

export const torrentSearchPage: CommandMenuPage = {
	id: "torrent-search",
	title: "search torrents",
	placeholder: "search the database...",
	filterable: false,
	Component: TorrentSearchPage,
}

export const rootPage: CommandMenuPage = {
	id: "root",
	title: "home",
	placeholder: "type a command or search...",
	filterable: true,
	Component: RootPage,
}
