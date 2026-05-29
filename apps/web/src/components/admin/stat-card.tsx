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
				"group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					{label}
				</span>
				{Icon && (
					<Icon className="size-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
				)}
			</div>
			<div className="mt-3 font-semibold text-3xl text-foreground tabular-nums tracking-tight">
				{value}
			</div>
			{sublabel && (
				<div className="mt-1 text-muted-foreground text-xs">{sublabel}</div>
			)}
			{accent && (
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
			)}
		</div>
	);
}
