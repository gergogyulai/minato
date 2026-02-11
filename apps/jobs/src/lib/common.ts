import natural from "natural";

export function calculateTitleSimilarity(title1: string, title2: string): number {
  const distance = natural.JaroWinklerDistance(title1.toLowerCase(), title2.toLowerCase());
  return distance;
}

export const TITLE_SIMILARITY_THRESHOLD = 0.8;