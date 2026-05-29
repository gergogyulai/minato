import type { ReactNode } from "react";

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-1.5">
				<h1 className="font-semibold text-2xl text-foreground tracking-tight">
					{title}
				</h1>
				{description && (
					<p className="max-w-prose text-muted-foreground text-sm">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
