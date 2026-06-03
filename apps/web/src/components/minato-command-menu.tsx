import React, { useState, useEffect } from "react"
import { useDebounce } from "use-debounce"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, Database, Film, LayoutDashboard, List, Search } from "lucide-react"
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command"
import { orpc } from "@/utils/orpc"
import { formatBytesString } from "@/lib/utils"

// ─── Page system types ────────────────────────────────────────────────────────

interface PageDef {
	id: string
	label: string
	placeholder: string
	shouldFilter: boolean
	component: React.ComponentType<PageProps>
}

interface PageProps {
	search: string
	pushPage: (page: PageDef) => void
	popPage: () => void
	closeMenu: () => void
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
			// {children}
		</span>
	)
}

function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px] leading-none text-muted-foreground/50">
			{children}
		</kbd>
	)
}

function Footer({ isRoot }: { isRoot: boolean }) {
	return (
		<div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
			<div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/40">
				{!isRoot && (
					<span className="flex items-center gap-1.5">
						<Kbd>esc</Kbd>
						back
					</span>
				)}
				<span className="flex items-center gap-1.5">
					<Kbd>⌘K</Kbd>
					toggle
				</span>
			</div>
			<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/40">
				<Kbd>↵</Kbd>
				select
			</span>
		</div>
	)
}

// ─── Root page ────────────────────────────────────────────────────────────────

function RootPage({ pushPage, closeMenu }: PageProps) {
	const navigate = useNavigate()

	const goTo = (to: string) => {
		navigate({ to } as Parameters<typeof navigate>[0])
		closeMenu()
	}

	return (
		<>
			<CommandEmpty>
				<span className="font-mono text-xs text-muted-foreground/40">
					no commands found
				</span>
			</CommandEmpty>

			<CommandGroup heading={<SectionLabel>search</SectionLabel>}>
				<CommandItem
					value="search torrents"
					onSelect={() => pushPage(torrentSearchPageDef)}
				>
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/20">
						<Search className="size-3.5 text-muted-foreground/50" />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="font-mono text-sm text-foreground/80">
							Search torrents
						</span>
						<span className="font-mono text-[10px] text-muted-foreground/40">
							full-text search across the torrent database
						</span>
					</div>
					<ArrowRight className="size-3.5 shrink-0 text-muted-foreground/30" />
				</CommandItem>
			</CommandGroup>

			<CommandGroup heading={<SectionLabel>navigate</SectionLabel>}>
				<CommandItem value="browse torrents" onSelect={() => goTo("/torrents")}>
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/20">
						<List className="size-3.5 text-muted-foreground/50" />
					</div>
					<span className="font-mono text-sm text-foreground/80">Browse</span>
				</CommandItem>
				<CommandItem value="dashboard" onSelect={() => goTo("/dashboard")}>
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/20">
						<LayoutDashboard className="size-3.5 text-muted-foreground/50" />
					</div>
					<span className="font-mono text-sm text-foreground/80">Dashboard</span>
				</CommandItem>
			</CommandGroup>
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

function TorrentSearchPage({ search, closeMenu }: PageProps) {
	const navigate = useNavigate()
	const [debouncedSearch] = useDebounce(search, 350)

	const { data: rawData, isLoading } = useQuery(
		orpc.search.searchTorrents.queryOptions({
			input: { q: debouncedSearch, limit: 8 },
		}),
	)
	const data = rawData as { hits: TorrentHit[]; totalHits: number } | undefined

	const hits = data?.hits ?? []

	if (!search) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 py-10">
				<Database className="size-6 text-muted-foreground/20" />
				<p className="font-mono text-xs text-muted-foreground/40">
					type to search the torrent database
				</p>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-10">
				<span className="animate-pulse font-mono text-xs text-muted-foreground/40">
					searching…
				</span>
			</div>
		)
	}

	if (hits.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-10">
				<p className="font-mono text-xs text-muted-foreground/40">
					no results
				</p>
				{debouncedSearch && (
					<p className="font-mono text-[10px] text-muted-foreground/25">
						"{debouncedSearch}"
					</p>
				)}
			</div>
		)
	}

	return (
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
			{hits.map((hit) => {
				const title = hit.enrichment?.title || hit.trackerTitle
				const year = hit.enrichment?.year
				const resolution = hit.releaseData?.resolution
				const posterUrl = hit.enrichment?.posterUrl
					? "/assets" + hit.enrichment.posterUrl
					: null

				return (
					<CommandItem
						key={hit.infoHash}
						value={hit.infoHash}
						onSelect={() => {
							navigate({
								to: "/torrents/$torrent",
								params: { torrent: hit.infoHash },
							})
							closeMenu()
						}}
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
							<span className="line-clamp-1 font-mono text-xs text-foreground/80">
								{title}
							</span>
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
									{formatBytesString(String(hit.size))}
								</span>
							)}
							{hit.seeders != null && (
								<span className="font-mono text-[10px] tabular-nums text-emerald-400">
									{hit.seeders}↑
								</span>
							)}
						</div>
					</CommandItem>
				)
			})}
		</CommandGroup>
	)
}

// ─── Page definitions ─────────────────────────────────────────────────────────

const torrentSearchPageDef: PageDef = {
	id: "torrent-search",
	label: "search torrents",
	placeholder: "search the database...",
	shouldFilter: false,
	component: TorrentSearchPage,
}

const rootPageDef: PageDef = {
	id: "root",
	label: "root",
	placeholder: "type a command or search...",
	shouldFilter: true,
	component: RootPage,
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RaycastMenu() {
	const [open, setOpen] = useState(false)
	const [pageStack, setPageStack] = useState<PageDef[]>([rootPageDef])
	const [search, setSearch] = useState("")

	const currentPage = pageStack[pageStack.length - 1]
	const isRoot = pageStack.length === 1

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen((o) => !o)
			}
		}
		document.addEventListener("keydown", down)
		return () => document.removeEventListener("keydown", down)
	}, [])

	useEffect(() => {
		if (!open) {
			setSearch("")
			setPageStack([rootPageDef])
		}
	}, [open])

	const pushPage = (page: PageDef) => {
		setSearch("")
		setPageStack((prev) => [...prev, page])
	}

	const popPage = () => {
		if (pageStack.length > 1) {
			setSearch("")
			setPageStack((prev) => prev.slice(0, -1))
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
		if (e.key === "Backspace" && search === "") {
			e.preventDefault()
			popPage()
		}
	}

	const handleEscapeKeyDown = (e: KeyboardEvent) => {
		if (!isRoot) {
			e.preventDefault()
			popPage()
		}
	}

	const PageComponent = currentPage.component

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			onEscapeKeyDown={handleEscapeKeyDown}
			className="sm:max-w-[640px]"
		>
			<Command
				shouldFilter={currentPage.shouldFilter}
				className="w-full"
				onKeyDown={handleKeyDown}
			>
				<CommandInput
					value={search}
					onValueChange={setSearch}
					placeholder={currentPage.placeholder}
				/>
				<CommandList className="max-h-[400px] overflow-y-auto p-2">
					<PageComponent
						search={search}
						pushPage={pushPage}
						popPage={popPage}
						closeMenu={() => setOpen(false)}
					/>
				</CommandList>
			</Command>

			{/* <Footer isRoot={isRoot} /> */}
		</CommandDialog>
	)
}
