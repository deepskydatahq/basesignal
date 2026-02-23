// Slugify utilities for human-readable identifiers.

/**
 * Convert a human-readable string into a URL-safe slug.
 * "Drag tasks between columns on the board" → "drag-tasks-between-columns-on-the-board"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a unique moment ID from a name.
 * Prefixes with "moment-" and appends a numeric suffix if the slug
 * already exists in the provided set.
 */
export function momentIdFromName(name: string, existingIds?: Set<string>): string {
  const base = `moment-${slugify(name)}`;

  if (!existingIds || !existingIds.has(base)) {
    return base;
  }

  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
