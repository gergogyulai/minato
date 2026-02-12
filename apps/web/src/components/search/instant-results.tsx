"use client";

import { Download, Upload, HardDrive, Calendar, Film } from "lucide-react";
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
    <div className="group relative bg-card hover:bg-accent/50 rounded-lg border border-border hover:border-primary/50 transition-all duration-200 cursor-pointer overflow-hidden">
      <div className="flex gap-4 p-4 sm:p-2 h-full">
        {/* Poster Thumbnail */}
        {item.posterUrl && (
          <div className="hidden sm:block shrink-0 w-16 sm:w-15.5 rounded-md overflow-hidden bg-muted">
            <img
              src={item.posterUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2 overflow-hidden">
          {/* Title */}
          <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-1 sm:line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="text-[10px] sm:text-xs font-medium px-1.5 py-0 h-5">
              {item.type}
            </Badge>
            {item.resolution && (
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 h-5">
                {item.resolution}
              </Badge>
            )}
            {item.year && (
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{item.year}</span>
              </div>
            )}
          </div>
          
          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm mt-auto">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {formatSize(item.size)}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-600 dark:text-green-400">
                {item.seeders}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
              <span className="font-medium text-red-600 dark:text-red-400">
                {item.leechers}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hover indicator */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </div>
  );
}
