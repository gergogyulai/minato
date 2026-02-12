"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DiscoveryItem {
  id: string;
  title: string;
  subtitle?: string;
  posterUrl: string;
  year?: number;
  rating?: number;
}

interface DiscoveryGridProps {
  items: DiscoveryItem[];
}

const ITEMS_PER_PAGE = 4;

export function DiscoveryGrid({ items }: DiscoveryGridProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  
  const goToNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };
  
  const goToPrevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  return (
    <div className="space-y-4">
      {/* Horizontal scrollable grid on mobile, 1x4 grid on desktop */}
      <div className="relative">
        {/* Desktop: Grid with 4 columns */}
        <div className="hidden sm:grid sm:grid-cols-4 gap-4">
          {currentItems.map((item) => (
            <DiscoveryGridItem key={item.id} item={item} />
          ))}
        </div>
        
        {/* Mobile: Horizontal scroll */}
        <div className="sm:hidden flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {currentItems.map((item) => (
            <div key={item.id} className="snap-start shrink-0 w-[calc(100vw-3rem)]">
              <DiscoveryGridItem item={item} />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevPage}
          disabled={totalPages <= 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={goToNextPage}
          disabled={totalPages <= 1}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface DiscoveryGridItemProps {
  item: DiscoveryItem;
}

function DiscoveryGridItem({ item }: DiscoveryGridItemProps) {
  return (
    <div className="group flex flex-col gap-3 bg-card p-2 rounded-lg cursor-pointer transition-all hover:bg-accent/50">
      {/* Poster Container */}
      <div className="relative overflow-hidden rounded-md aspect-2/3 shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02]">
        <img
          src={item.posterUrl}
          alt={item.title}
          className="object-cover w-full h-full rounded-md"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md" />
        
        {/* Rating badge on hover */}
        {item.rating && (
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-yellow-400">★</span>
              <span className="text-xs font-semibold text-white">
                {item.rating.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-col gap-1 px-1">
        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors duration-200">
          {item.title}
        </h3>

        {/* Year and Rating */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </div>
  );
}
