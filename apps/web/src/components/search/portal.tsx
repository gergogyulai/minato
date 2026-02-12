"use client";

import { DiscoveryGrid, type DiscoveryItem } from "./discovery-grid";
import { InstantSearchResults, type InstantResultItem } from "./instant-results";

interface SearchPortalProps {
  searchQuery: string;
}

// Mock data for suggestions (20 items for pagination)
const MOCK_SUGGESTIONS: DiscoveryItem[] = [
  {
    id: "1",
    title: "Inception",
    subtitle: "Your mind is the scene of the crime",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2010,
    rating: 8.8,
  },
  {
    id: "2",
    title: "The Dark Knight",
    subtitle: "Welcome to a world without rules",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2008,
    rating: 9.0,
  },
  {
    id: "3",
    title: "Interstellar",
    subtitle: "Mankind was born on Earth. It was never meant to die here.",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2014,
    rating: 8.7,
  },
  {
    id: "4",
    title: "Oppenheimer",
    subtitle: "The world forever changes",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2023,
    rating: 8.4,
  },
  {
    id: "5",
    title: "The Matrix",
    subtitle: "Free your mind",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1999,
    rating: 8.7,
  },
  {
    id: "6",
    title: "Pulp Fiction",
    subtitle: "You won't know the facts until you've seen the fiction",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1994,
    rating: 8.9,
  },
  {
    id: "7",
    title: "The Shawshank Redemption",
    subtitle: "Fear can hold you prisoner. Hope can set you free.",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1994,
    rating: 9.3,
  },
  {
    id: "8",
    title: "The Godfather",
    subtitle: "An offer you can't refuse",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1972,
    rating: 9.2,
  },
  {
    id: "9",
    title: "Fight Club",
    subtitle: "Mischief. Mayhem. Soap.",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1999,
    rating: 8.8,
  },
  {
    id: "10",
    title: "Forrest Gump",
    subtitle: "The world will never be the same once you've seen it through the eyes of Forrest Gump",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1994,
    rating: 8.8,
  },
  {
    id: "11",
    title: "Gladiator",
    subtitle: "A hero will rise",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2000,
    rating: 8.5,
  },
  {
    id: "12",
    title: "The Prestige",
    subtitle: "Are you watching closely?",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2006,
    rating: 8.5,
  },
  {
    id: "13",
    title: "Django Unchained",
    subtitle: "Life, liberty and the pursuit of vengeance",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2012,
    rating: 8.4,
  },
  {
    id: "14",
    title: "The Departed",
    subtitle: "Lies. Betrayal. Sacrifice. How far will you take it?",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2006,
    rating: 8.5,
  },
  {
    id: "15",
    title: "Whiplash",
    subtitle: "The road to greatness can take you to the edge",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 2014,
    rating: 8.5,
  },
  {
    id: "16",
    title: "The Silence of the Lambs",
    subtitle: "A census taker once tried to test me. I ate his liver with some fava beans and a nice Chianti.",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1991,
    rating: 8.6,
  },
  {
    id: "17",
    title: "Saving Private Ryan",
    subtitle: "The mission is a man",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1998,
    rating: 8.6,
  },
  {
    id: "18",
    title: "Goodfellas",
    subtitle: "Three decades of life in the Mafia",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1990,
    rating: 8.7,
  },
  {
    id: "19",
    title: "The Green Mile",
    subtitle: "Miracles do happen",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1999,
    rating: 8.6,
  },
  {
    id: "20",
    title: "Schindler's List",
    subtitle: "Whoever saves one life, saves the world entire",
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
    year: 1993,
    rating: 9.0,
  },
];

// Mock instant search results
const MOCK_INSTANT_RESULTS: InstantResultItem[] = [
  {
    id: "r1",
    title: "Inception (2010) 1080p BluRay x264",
    type: "Movie",
    resolution: "1080p",
    size: 2684354560, // 2.5 GB
    seeders: 245,
    leechers: 12,
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
  },
  {
    id: "r2",
    title: "Inception (2010) 2160p UHD BluRay x265 HDR",
    type: "Movie",
    resolution: "2160p",
    size: 15032385536, // 14 GB
    seeders: 128,
    leechers: 8,
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
  },
  {
    id: "r4",
    title: "Inception (2010) REMUX 1080p BluRay AVC DTS-HD MA 5.1",
    type: "Movie",
    resolution: "1080p",
    size: 32212254720, // 30 GB
    seeders: 45,
    leechers: 3,
    year: 2010,
    genres: ["Action", "Sci-Fi", "Thriller"],
    posterUrl: "http://localhost:3000/assets/tm/tmdb-872585/poster.webp",
  },
];

export function SearchPortal({ searchQuery }: SearchPortalProps) {
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {hasQuery ? "Instant Results" : "Suggestions"}
        </h2>
        {!hasQuery && (
          <span className="text-xs text-muted-foreground">
            {MOCK_SUGGESTIONS.length} items
          </span>
        )}
      </div>

      {/* Content Area - maintains consistent height */}
      <div>
        {hasQuery ? (
          <InstantSearchResults items={MOCK_INSTANT_RESULTS} />
        ) : (
          <DiscoveryGrid items={MOCK_SUGGESTIONS} />
        )}
      </div>
    </div>
  );
}
