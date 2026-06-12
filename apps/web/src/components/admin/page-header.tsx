import type { ReactNode } from "react";

export function PageHeader({
	title,
	description,
	eyebrow,
	actions,
}: {
	title: string;
	description?: string;
	eyebrow?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="pb-8">
			{eyebrow && (
				<p className="mb-3 select-none font-mono text-[11px] text-muted-foreground/45 uppercase tracking-[0.2em]">
					{eyebrow}
				</p>
			)}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-2">
					<h1 className="font-display font-bold text-3xl text-foreground tracking-tight">
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
		</div>
	);
}
