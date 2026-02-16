/**
 * Determine whether a CLI argument refers to a file path or a storage ID.
 *
 * File heuristic: contains path separators (/ or \) or ends with .json.
 * Everything else is treated as a storage ID.
 */
export function resolveInput(
  idOrFile: string,
): { type: "storage"; id: string } | { type: "file"; path: string } {
  if (
    idOrFile.includes("/") ||
    idOrFile.includes("\\") ||
    idOrFile.endsWith(".json")
  ) {
    return { type: "file", path: idOrFile };
  }
  return { type: "storage", id: idOrFile };
}
