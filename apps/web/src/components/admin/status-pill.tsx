import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<Tone, string> = {
	success:
		"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
	warning:
		"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
	danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
	info: "bg-primary/10 text-primary border-primary/25",
	neutral: "bg-muted text-muted-foreground border-border",
};

const dotStyles: Record<Tone, string> = {
	success: "bg-emerald-500",
	warning: "bg-amber-500",
	danger: "bg-red-500",
	info: "bg-primary",
	neutral: "bg-muted-foreground/60",
};

export function StatusPill({
	tone = "neutral",
	dot = false,
	pulse = false,
	children,
	className,
}: {
	tone?: Tone;
	dot?: boolean;
	pulse?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs",
				toneStyles[tone],
				className,
			)}
		>
			{dot && (
				<span className="relative flex size-1.5">
					{pulse && (
						<span
							className={cn(
								"absolute inline-flex size-full animate-ping rounded-full opacity-75",
								dotStyles[tone],
							)}
						/>
					)}
					<span
						className={cn(
							"relative inline-flex size-1.5 rounded-full",
							dotStyles[tone],
						)}
					/>
				</span>
			)}
			{children}
		</span>
	);
}
