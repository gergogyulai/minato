"use client";

import { Calendar, Download, Film, HardDrive, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface InstantResultItem {
	id: string;
	title: string;
	type: string;
	resolution?: string;
	size: number;
	seeders: number;
	leechers: number;
	year?: number;
	genres?: string[];
	posterUrl?: string;
}

interface InstantSearchResultsProps {
	items: InstantResultItem[];
}

export function InstantSearchResults({ items }: InstantSearchResultsProps) {
	// Show up to 4 items to match the suggestions height
	const displayItems = items.slice(0, 4);

	return (
		<div className="space-y-3">
			{displayItems.map((item) => (
				<InstantResultCard key={item.id} item={item} />
			))}
		</div>
	);
}

interface InstantResultCardProps {
	item: InstantResultItem;
}

function InstantResultCard({ item }: InstantResultCardProps) {
	const formatSize = (bytes: number) => {
		if (bytes >= 1073741824) {
			return `${(bytes / 1073741824).toFixed(2)} GB`;
		}
		return `${(bytes / 1048576).toFixed(2)} MB`;
	};

	return (
		<div className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-primary/50 hover:bg-accent/50">
			<div className="flex h-full gap-4 p-4 sm:p-2">
				{/* Poster Thumbnail */}
				{item.posterUrl && (
					<div className="hidden w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:block sm:w-15.5">
						<img
							src={item.posterUrl}
							alt={item.title}
							className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
						/>
					</div>
				)}

				{/* Content */}
				<div className="min-w-0 flex-1 space-y-1.5 overflow-hidden sm:space-y-2">
					{/* Title */}
					<h3 className="line-clamp-1 font-semibold text-foreground text-sm leading-tight transition-colors group-hover:text-primary sm:line-clamp-2 sm:text-base">
						{item.title}
					</h3>

					{/* Badges */}
					<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
						<Badge
							variant="secondary"
							className="h-5 px-1.5 py-0 font-medium text-[10px] sm:text-xs"
						>
							{item.type}
						</Badge>
						{item.resolution && (
							<Badge
								variant="outline"
								className="h-5 px-1.5 py-0 text-[10px] sm:text-xs"
							>
								{item.resolution}
							</Badge>
						)}
						{item.year && (
							<div className="flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
								<Calendar className="h-3 w-3" />
								<span>{item.year}</span>
							</div>
						)}
					</div>

					{/* Stats Row */}
					<div className="mt-auto flex flex-wrap items-center gap-3 text-xs sm:gap-4 sm:text-sm">
						<div className="flex items-center gap-1.5">
							<HardDrive className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
							<span className="font-medium text-foreground">
								{formatSize(item.size)}
							</span>
						</div>

						<div className="flex items-center gap-1.5">
							<Upload className="h-3.5 w-3.5 text-green-600 sm:h-4 sm:w-4 dark:text-green-400" />
							<span className="font-medium text-green-600 dark:text-green-400">
								{item.seeders}
							</span>
						</div>

						<div className="flex items-center gap-1.5">
							<Download className="h-3.5 w-3.5 text-red-600 sm:h-4 sm:w-4 dark:text-red-400" />
							<span className="font-medium text-red-600 dark:text-red-400">
								{item.leechers}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Hover indicator */}
			<div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
		</div>
	);
}
