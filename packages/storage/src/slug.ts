/**
 * Convert a product URL to a filesystem-safe slug.
 * Uses the hostname only, strips "www.", replaces dots with hyphens.
 *
 * Examples:
 *   https://linear.app/features  → "linear-app"
 *   https://www.notion.so        → "notion-so"
 *   https://app.example.com      → "app-example-com"
 */
export function urlToSlug(url: string): string {
  const normalized = url.match(/^https?:\/\//i) ? url : `https://${url}`;
  const parsed = new URL(normalized);
  let hostname = parsed.hostname.toLowerCase();

  // Strip www. prefix
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }

  // Replace dots with hyphens for filesystem safety
  return hostname.replace(/\./g, "-");
}
