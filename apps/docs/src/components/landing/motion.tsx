"use client";

import { MotionConfig, motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: "-10% 0px" } as const;

/** Wraps the landing page so every animation respects prefers-reduced-motion. */
export function LandingMotion({ children }: { children: ReactNode }) {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	/** Initial vertical offset in px */
	y?: number;
}

/** Fade-up reveal when scrolled into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
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
	visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Parent for StaggerItem children — reveals them one by one on scroll. */
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

/** Section header: label fades in, hairline draws itself across the page. */
export function SectionRule({ label }: { label: string }) {
	return (
		<div className="mb-12 flex items-center gap-4">
			<motion.span
				className="font-mono text-[11px] tracking-[0.2em] text-web-muted/40 uppercase"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={VIEWPORT}
				transition={{ duration: 0.5, ease: EASE }}
			>
				{label}
			</motion.span>
			<motion.div
				className="h-px flex-1 origin-left bg-web-line"
				initial={{ scaleX: 0 }}
				whileInView={{ scaleX: 1 }}
				viewport={VIEWPORT}
				transition={{ duration: 1, ease: EASE, delay: 0.15 }}
			/>
		</div>
	);
}
