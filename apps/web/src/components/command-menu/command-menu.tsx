import { useCommandState } from "cmdk"
import type { LucideIcon } from "lucide-react"
import {
	animate,
	AnimatePresence,
	motion,
	MotionConfig,
	useAnimate,
	useReducedMotion,
} from "motion/react"
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	Command,
	CommandDialog,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CommandMenuPage {
	id: string
	/** Segment shown in the breadcrumb trail while this page is on the stack. */
	title: string
	placeholder: string
	/** Let cmdk filter items against the query. Disable for pages that fetch their own results. */
	filterable: boolean
	Component: React.ComponentType
}

export interface CommandMenuController {
	/** Current query, scoped to the active page (resets on push/pop). */
	search: string
	pageId: string
	isRoot: boolean
	push: (page: CommandMenuPage) => void
	pop: () => void
	close: () => void
}

const CommandMenuContext = createContext<CommandMenuController | null>(null)

export function useCommandMenu(): CommandMenuController {
	const controller = useContext(CommandMenuContext)
	if (!controller) {
		throw new Error("useCommandMenu must be used inside <CommandMenuShell>")
	}
	return controller
}

const OPEN_EVENT = "minato:open-command-menu"

/** Opens the command menu from anywhere, e.g. a toolbar search button. */
export function openCommandMenu() {
	window.dispatchEvent(new Event(OPEN_EVENT))
}

// ─── Shared primitives ────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
			// {children}
		</span>
	)
}

export function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border border-border/50 bg-muted/40 px-1 font-mono text-[9px] leading-none text-muted-foreground/50">
			{children}
		</kbd>
	)
}

export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
	return (
		<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/20 transition-colors duration-150 group-data-selected/command-item:border-border group-data-selected/command-item:bg-muted/60">
			<Icon className="size-3.5 text-muted-foreground/50 transition-colors duration-150 group-data-selected/command-item:text-foreground/70" />
		</div>
	)
}

/**
 * Command item styled for the menu. The static cmdk selection background is
 * disabled in favor of the shared animated highlight rendered by the shell.
 */
export function CommandMenuItem({
	value,
	className,
	...props
}: React.ComponentProps<typeof CommandItem> & { value: string }) {
	return (
		<CommandItem
			value={value}
			className={cn("data-selected:bg-transparent", className)}
			{...props}
		/>
	)
}

function offsetWithin(element: HTMLElement, container: HTMLElement) {
	let top = 0
	let left = 0
	let node: HTMLElement | null = element
	while (node && node !== container) {
		top += node.offsetTop
		left += node.offsetLeft
		node = node.offsetParent as HTMLElement | null
	}
	return { top, left }
}

type HighlightMove = "instant" | "glide" | "breakthrough"

/**
 * Single persistent highlight that springs to the selected item. Measuring
 * layout offsets (instead of per-item mount/unmount with layout animations)
 * avoids flicker frames. Moves within a group glide; moves across a group
 * boundary "break through" it — the highlight stretches along the travel
 * direction, overshoots, and squashes as it lands on the target item. Page
 * changes and initial placement are instant.
 */
function SelectionHighlight({
	containerRef,
}: {
	containerRef: React.RefObject<HTMLDivElement | null>
}) {
	const { search, pageId } = useCommandMenu()
	const reducedMotion = useReducedMotion()
	const selectedValue = useCommandState((state) => state.value)
	const [box, setBox] = useState<{
		top: number
		left: number
		width: number
		height: number
	} | null>(null)
	const [move, setMove] = useState<HighlightMove>("instant")
	const [breakthroughKey, setBreakthroughKey] = useState(0)
	const lastGroupRef = useRef<Element | null>(null)
	const lastPageRef = useRef<string | null>(null)

	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return

		const measure = () => {
			const item = container.querySelector<HTMLElement>(
				'[cmdk-item][aria-selected="true"]',
			)
			if (!item) {
				setBox(null)
				lastGroupRef.current = null
				return
			}
			const group = item.closest("[cmdk-group]")
			if (lastPageRef.current !== pageId || lastGroupRef.current === null) {
				setMove("instant")
			} else if (group !== lastGroupRef.current) {
				setMove("breakthrough")
				setBreakthroughKey((key) => key + 1)
			} else {
				setMove("glide")
			}
			lastPageRef.current = pageId
			lastGroupRef.current = group
			const { top, left } = offsetWithin(item, container)
			setBox({ top, left, width: item.offsetWidth, height: item.offsetHeight })
		}

		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		return () => observer.disconnect()
	}, [containerRef, selectedValue, search, pageId])

	if (!box) return null

	const isBreakthrough = move === "breakthrough" && !reducedMotion

	return (
		<motion.div
			aria-hidden
			className="pointer-events-none absolute top-0 left-0 -z-10"
			initial={false}
			animate={{ x: box.left, y: box.top, width: box.width, height: box.height }}
			transition={
				reducedMotion || move === "instant"
					? { duration: 0 }
					: isBreakthrough
						? { type: "spring", stiffness: 580, damping: 26 }
						: { type: "spring", stiffness: 550, damping: 45 }
			}
		>
			{/* Re-keyed per crossing so the squash-and-stretch replays reliably. */}
			<motion.div
				key={breakthroughKey}
				className="size-full rounded-3xl bg-muted"
				animate={
					isBreakthrough
						? {
								scaleX: [1, 0.92, 1.06, 1],
								scaleY: [1, 1.25, 0.85, 1],
							}
						: undefined
				}
				transition={{ duration: 0.34, times: [0, 0.35, 0.72, 1], ease: "easeOut" }}
			/>
		</motion.div>
	)
}

/**
 * Intercepts cmdk's instant scrollIntoView calls and replaces them with spring
 * animations. Uses MutationObserver rather than useLayoutEffect because
 * MutationObserver callbacks fire as microtasks — after all useLayoutEffect
 * calls (including cmdk's) have run but before the browser paints — which
 * gives us a clean window to reset and animate the jumped scrollTop.
 */
function SmoothScroller({
	containerRef,
}: {
	containerRef: React.RefObject<HTMLDivElement | null>
}) {
	const reducedMotion = useReducedMotion()
	const positionRef = useRef(0)
	const isAnimatingRef = useRef(false)
	const animationRef = useRef<{ stop: () => void } | null>(null)

	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const scrollEl = el.closest<HTMLElement>('[data-slot="command-list"]')
		if (!scrollEl) return

		const handleScroll = () => {
			if (!isAnimatingRef.current) {
				positionRef.current = scrollEl.scrollTop
			}
		}
		scrollEl.addEventListener("scroll", handleScroll, { passive: true })

		if (reducedMotion) {
			return () => scrollEl.removeEventListener("scroll", handleScroll)
		}

		const observer = new MutationObserver((mutations) => {
			const hasNewSelection = mutations.some(
				(m) => (m.target as Element).getAttribute("aria-selected") === "true",
			)
			if (!hasNewSelection) return

			const target = scrollEl.scrollTop
			const from = positionRef.current

			if (Math.abs(target - from) < 1) return

			animationRef.current?.stop()
			isAnimatingRef.current = false
			scrollEl.scrollTop = from

			isAnimatingRef.current = true
			animationRef.current = animate(from, target, {
				type: "spring",
				stiffness: 700,
				damping: 50,
				mass: 0.5,
				onUpdate: (v) => {
					scrollEl.scrollTop = v
					positionRef.current = v
				},
				onComplete: () => {
					scrollEl.scrollTop = target
					positionRef.current = target
					animationRef.current = null
					isAnimatingRef.current = false
				},
			})
		})

		observer.observe(el, {
			subtree: true,
			attributes: true,
			attributeFilter: ["aria-selected"],
		})

		return () => {
			observer.disconnect()
			scrollEl.removeEventListener("scroll", handleScroll)
			animationRef.current?.stop()
		}
	}, [containerRef, reducedMotion])

	return null
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

function Breadcrumbs({
	stack,
	popTo,
}: {
	stack: CommandMenuPage[]
	popTo: (depth: number) => void
}) {
	return (
		<div className="flex items-center gap-1 px-4 pt-3 font-mono text-[10px] text-muted-foreground/40">
			<AnimatePresence initial={false} mode="popLayout">
				{stack.map((page, depth) => {
					const isCurrent = depth === stack.length - 1
					return (
						<motion.span
							key={page.id}
							layout
							initial={{ opacity: 0, x: -6 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -6 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
							className="flex items-center gap-1"
						>
							{depth > 0 && <span aria-hidden>/</span>}
							<button
								type="button"
								tabIndex={-1}
								disabled={isCurrent}
								onClick={() => popTo(depth)}
								className={cn(
									"rounded px-1 py-0.5 transition-colors",
									isCurrent
										? "text-muted-foreground/70"
										: "hover:bg-muted/40 hover:text-muted-foreground",
								)}
							>
								{depth === 0 ? "~" : page.title}
							</button>
						</motion.span>
					)
				})}
			</AnimatePresence>
		</div>
	)
}

function Footer({ isRoot }: { isRoot: boolean }) {
	return (
		<div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
			<div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/40">
				<span className="flex items-center gap-1.5">
					<Kbd>↑↓</Kbd>
					navigate
				</span>
				<span className="flex items-center gap-1.5">
					<Kbd>esc</Kbd>
					<AnimatePresence initial={false} mode="wait">
						<motion.span
							key={isRoot ? "close" : "back"}
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.12 }}
						>
							{isRoot ? "close" : "back"}
						</motion.span>
					</AnimatePresence>
				</span>
			</div>
			<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/40">
				<Kbd>↵</Kbd>
				select
			</span>
		</div>
	)
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function CommandMenuShell({ rootPage }: { rootPage: CommandMenuPage }) {
	const [open, setOpen] = useState(false)
	const [stack, setStack] = useState<CommandMenuPage[]>([rootPage])
	const [direction, setDirection] = useState<1 | -1>(1)
	const [search, setSearch] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)
	const listContentRef = useRef<HTMLDivElement>(null)
	const [panelRef, animatePanel] = useAnimate<HTMLDivElement>()
	const reducedMotion = useReducedMotion()

	const page = stack[stack.length - 1] ?? rootPage
	const isRoot = stack.length === 1

	const handleOpenChange = useCallback(
		(next: boolean) => {
			if (next) {
				setStack([rootPage])
				setDirection(1)
				setSearch("")
			}
			setOpen(next)
		},
		[rootPage],
	)

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey) && !e.repeat) {
				e.preventDefault()
				setOpen((prev) => {
					if (!prev) {
						setStack([rootPage])
						setDirection(1)
						setSearch("")
					}
					return !prev
				})
			}
		}
		const onOpenEvent = () => handleOpenChange(true)

		document.addEventListener("keydown", onKeyDown)
		window.addEventListener(OPEN_EVENT, onOpenEvent)
		return () => {
			document.removeEventListener("keydown", onKeyDown)
			window.removeEventListener(OPEN_EVENT, onOpenEvent)
		}
	}, [rootPage, handleOpenChange])

	// Keep typing flowing into the input after breadcrumb clicks or page changes.
	useEffect(() => {
		if (open) inputRef.current?.focus()
	}, [open, page.id])

	const push = useCallback((next: CommandMenuPage) => {
		setDirection(1)
		setSearch("")
		setStack((prev) => [...prev, next])
	}, [])

	const pop = useCallback(() => {
		setDirection(-1)
		setSearch("")
		setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
	}, [])

	const popTo = useCallback((depth: number) => {
		setDirection(-1)
		setSearch("")
		setStack((prev) => (prev.length > depth + 1 ? prev.slice(0, depth + 1) : prev))
	}, [])

	const close = useCallback(() => setOpen(false), [])

	const controller = useMemo<CommandMenuController>(
		() => ({ search, pageId: page.id, isRoot, push, pop, close }),
		[search, page.id, isRoot, push, pop, close],
	)

	const shake = () => {
		if (reducedMotion || !panelRef.current) return
		animatePanel(
			panelRef.current,
			{ x: [0, -6, 6, -3, 3, 0] },
			{ duration: 0.3, ease: "easeInOut" },
		)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
		if (e.key === "Backspace" && search === "") {
			e.preventDefault()
			if (isRoot) {
				shake()
			} else {
				pop()
			}
		}
	}

	return (
		<CommandMenuContext.Provider value={controller}>
			<CommandDialog
				title="Command menu"
				open={open}
				onOpenChange={handleOpenChange}
				onEscapeKeyDown={(e) => {
					if (!isRoot) {
						e.preventDefault()
						pop()
					}
				}}
				className="sm:max-w-[640px]"
			>
				<MotionConfig reducedMotion="user">
					<div ref={panelRef} className="w-full overflow-hidden">
						<Command
							shouldFilter={page.filterable}
							className="w-full"
							onKeyDown={handleKeyDown}
						>
							<Breadcrumbs stack={stack} popTo={popTo} />
							<CommandInput
								ref={inputRef}
								autoFocus
								value={search}
								onValueChange={setSearch}
								placeholder={page.placeholder}
							/>
							<CommandList className="w-full h-[min(400px,calc(var(--cmdk-list-height)+1rem))] max-h-[400px] overflow-y-auto p-2 transition-[height] duration-150 ease-out">
								<div ref={listContentRef} className="relative isolate overflow-hidden">
									<SelectionHighlight containerRef={listContentRef} />
									<SmoothScroller containerRef={listContentRef} />
									<motion.div
										key={page.id}
										initial={{ opacity: 0, x: 14 * direction }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.16, ease: "easeOut" }}
									>
										<page.Component />
									</motion.div>
								</div>
							</CommandList>
							<Footer isRoot={isRoot} />
						</Command>
					</div>
				</MotionConfig>
			</CommandDialog>
		</CommandMenuContext.Provider>
	)
}
