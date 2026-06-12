import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
	label,
	value,
	sublabel,
	icon: Icon,
	accent = false,
	className,
}: {
	label: string;
	value: string | number;
	sublabel?: string;
	icon?: LucideIcon;
	accent?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-border",
				className,
			)}
		>
			{accent && (
				<div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 [background:linear-gradient(to_right,transparent,var(--primary),transparent)]" />
			)}
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground/55 uppercase tracking-[0.18em]">
					{label}
				</span>
				{Icon && (
					<Icon className="size-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
				)}
			</div>
			<div className="mt-3 font-display font-bold text-3xl text-foreground tabular-nums tracking-tight">
				{value}
			</div>
			{sublabel && (
				<div className="mt-1 font-mono text-[11px] text-muted-foreground/55">
					{sublabel}
				</div>
			)}
		</div>
	);
}
