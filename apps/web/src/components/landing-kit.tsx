import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: "-10% 0px" } as const;

/** Big display text painted with the theme-aware blue heading gradient. */
export function GradientText({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"bg-clip-text text-transparent [background-image:var(--web-heading-gradient)]",
				className,
			)}
		>
			{children}
		</span>
	);
}

/** Fade-up reveal when scrolled into view. */
export function Reveal({
	children,
	className,
	delay = 0,
	y = 24,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	y?: number;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={VIEWPORT}
			transition={{ duration: 0.7, ease: EASE, delay }}
		>
			{children}
		</motion.div>
	);
}

const staggerContainer: Variants = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const staggerChild: Variants = {
	hidden: { opacity: 0, y: 18 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/** Parent that reveals its StaggerItem children one by one on scroll. */
export function Stagger({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<motion.div
			className={className}
			initial="hidden"
			whileInView="visible"
			viewport={VIEWPORT}
			variants={staggerContainer}
		>
			{children}
		</motion.div>
	);
}

export function StaggerItem({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<motion.div className={className} variants={staggerChild}>
			{children}
		</motion.div>
	);
}

/** Numbered section header: mono label, then a hairline that draws itself across. */
export function SectionRule({
	label,
	className,
}: {
	label: string;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-4", className)}>
			<motion.span
				className="select-none font-mono text-[11px] text-muted-foreground/45 uppercase tracking-[0.2em]"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={VIEWPORT}
				transition={{ duration: 0.5, ease: EASE }}
			>
				{label}
			</motion.span>
			<motion.div
				className="h-px flex-1 origin-left bg-border"
				initial={{ scaleX: 0 }}
				whileInView={{ scaleX: 1 }}
				viewport={VIEWPORT}
				transition={{ duration: 1, ease: EASE, delay: 0.15 }}
			/>
		</div>
	);
}
