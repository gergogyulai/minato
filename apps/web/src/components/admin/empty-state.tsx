import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed px-6 py-16 text-center">
			<div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted/40">
				<Icon className="size-5 text-muted-foreground" />
			</div>
			<p className="mt-4 font-medium text-foreground text-sm">{title}</p>
			{description && (
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					{description}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
