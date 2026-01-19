// src/lib/productColor.ts

// 12 curated colors that work well with white text
const COLOR_PALETTE = [
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#A855F7", // Purple
  "#0EA5E9", // Sky
];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Returns the first letter of the product name, uppercase.
 * Returns "?" if no valid name is provided.
 */
export function getProductInitial(name: string | undefined): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) return "?";
  return trimmed[0].toUpperCase();
}

/**
 * Returns a deterministic color from a curated palette based on product name.
 */
export function getProductColor(name: string | undefined): string {
  const hash = hashString(name ?? "");
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}
