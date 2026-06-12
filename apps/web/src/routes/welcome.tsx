import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/welcome")({
	component: WelcomePage,
	beforeLoad: async ({ context }) => {
		const setupStatus = await context.queryClient.fetchQuery(
			context.orpc.setup.getStatus.queryOptions(),
		);

		if (setupStatus.setupCompleted) {
			throw redirect({ to: "/" });
		}
	},
});

const BOOT_LINES = [
	{ label: "index core", status: "ok", tone: "ok" },
	{ label: "scraper engine", status: "ok", tone: "ok" },
	{ label: "torznab interface", status: "ready", tone: "ok" },
	{ label: "admin account", status: "missing", tone: "warn" },
] as const;

const BOOT_LINE_STAGGER = 0.55;
const BOOT_DURATION_MS = 2500;

const easeOut = [0.22, 1, 0.36, 1] as const;

function WelcomePage() {
	const reducedMotion = useReducedMotion();
	const [phase, setPhase] = useState<"boot" | "ready">(
		reducedMotion ? "ready" : "boot",
	);

	useEffect(() => {
		if (phase !== "boot") return;
		const timer = setTimeout(() => setPhase("ready"), BOOT_DURATION_MS);
		return () => clearTimeout(timer);
	}, [phase]);

	return (
		<div className="relative min-h-screen bg-background overflow-hidden">
			{/* Soft glow behind the wordmark once ready */}
			<AnimatePresence>
				{phase === "ready" && (
					<motion.div
						className="pointer-events-none fixed inset-0 flex items-center justify-center"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 1.2, ease: "easeOut" }}
					>
						<div className="h-[40vh] w-[70vw] max-w-3xl rounded-full bg-[radial-gradient(ellipse,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)] blur-3xl" />
					</motion.div>
				)}
			</AnimatePresence>

			<div className="relative flex min-h-screen items-center justify-center px-5 sm:px-8">
				<AnimatePresence mode="wait">
					{phase === "boot" ? (
						<BootSequence key="boot" />
					) : (
						<ReadyScreen key="ready" reducedMotion={!!reducedMotion} />
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function BootSequence() {
	return (
		<motion.div
			className="w-full max-w-xs font-mono text-xs"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, filter: "blur(6px)", y: -12 }}
			transition={{ duration: 0.3, ease: easeOut }}
		>
			<motion.p
				className="mb-4 tracking-[0.25em] text-muted-foreground/60 uppercase select-none"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
			>
				minato // system boot
			</motion.p>

			<div className="space-y-2">
				{BOOT_LINES.map((line, i) => (
					<motion.div
						key={line.label}
						className="flex items-baseline gap-2"
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{
							delay: 0.15 + i * BOOT_LINE_STAGGER,
							duration: 0.18,
							ease: easeOut,
						}}
					>
						<span className="text-muted-foreground/70">{line.label}</span>
						<span className="flex-1 overflow-hidden text-muted-foreground/25 whitespace-nowrap select-none">
							{"·".repeat(40)}
						</span>
						<span
							className={
								line.tone === "ok"
									? "text-primary"
									: "text-amber-600 dark:text-amber-400"
							}
						>
							{line.status}
						</span>
					</motion.div>
				))}
			</div>

			{/* Blinking caret */}
			<motion.span
				className="mt-4 inline-block h-3.5 w-2 bg-primary/80"
				animate={{ opacity: [1, 1, 0, 0] }}
				transition={{
					duration: 0.9,
					repeat: Number.POSITIVE_INFINITY,
					times: [0, 0.5, 0.5, 1],
				}}
			/>
		</motion.div>
	);
}

function ReadyScreen({ reducedMotion }: { reducedMotion: boolean }) {
	const letters = "Minato".split("");
	const d = (delay: number) => (reducedMotion ? 0 : delay);

	return (
		<motion.div
			className="flex w-full max-w-2xl flex-col items-center text-center"
			initial={{ opacity: reducedMotion ? 1 : 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2 }}
		>
			{/* Eyebrow */}
			<motion.p
				className="font-mono text-xs tracking-[0.25em] text-muted-foreground/60 uppercase select-none"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: d(0.1), duration: 0.4, ease: easeOut }}
			>
				first run detected
			</motion.p>

			{/* Wordmark — letters cascade in */}
			<h1
				className="mt-2 font-display font-bold text-[clamp(3.5rem,12vw,6.5rem)] text-foreground leading-none tracking-tight"
				aria-label="Minato"
			>
				{letters.map((letter, i) => (
					<motion.span
						key={`${letter}-${i}`}
						className="inline-block"
						initial={{ opacity: 0, y: "0.45em", filter: "blur(10px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{
							delay: d(0.15 + i * 0.05),
							duration: 0.55,
							ease: easeOut,
						}}
					>
						{letter}
					</motion.span>
				))}
			</h1>

			{/* Scanline rule */}
			<motion.div
				className="mt-6 h-px w-48 origin-center bg-gradient-to-r from-transparent via-primary/60 to-transparent"
				initial={{ scaleX: 0, opacity: 0 }}
				animate={{ scaleX: 1, opacity: 1 }}
				transition={{ delay: d(0.55), duration: 0.5, ease: easeOut }}
			/>

			{/* Tagline */}
			<motion.p
				className="mt-6 max-w-sm text-sm text-muted-foreground leading-relaxed"
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: d(0.7), duration: 0.45, ease: easeOut }}
			>
				Your torrent indexing &amp; scraping control panel is almost ready. A
				few quick steps and you're in.
			</motion.p>

			{/* CTA */}
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: d(0.9), duration: 0.45, ease: easeOut }}
				whileHover={reducedMotion ? undefined : { scale: 1.02 }}
				whileTap={reducedMotion ? undefined : { scale: 0.97 }}
				className="mt-10"
			>
				<Button
					asChild
					size="lg"
					className="group h-12 gap-2.5 rounded-md px-7 font-mono text-sm"
				>
					<Link to="/setup">
						Setup your Minato
						<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
					</Link>
				</Button>
			</motion.div>

			{/* Footer hint */}
			<motion.p
				className="mt-8 font-mono text-[11px] text-muted-foreground/40 select-none"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: d(1.3), duration: 0.6 }}
			>
				takes about a minute
			</motion.p>
		</motion.div>
	);
}
