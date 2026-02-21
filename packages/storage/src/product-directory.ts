import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const DEFAULT_ROOT = join(homedir(), ".basesignal", "products");

export interface ProductDirectoryOptions {
  /** Root directory for product directories. Defaults to ~/.basesignal/products */
  root?: string;
}

/**
 * Structured per-product directory storage.
 * Each product gets a slug-named directory with nested JSON artifact files.
 *
 * Layout:
 *   {root}/{slug}/profile.json
 *   {root}/{slug}/crawl/pages.json
 *   {root}/{slug}/lenses/capability-mapping.json
 *   {root}/{slug}/convergence/clusters.json
 *   ...
 */
export class ProductDirectory {
  private readonly root: string;

  constructor(options: ProductDirectoryOptions = {}) {
    this.root = options.root ?? DEFAULT_ROOT;
    mkdirSync(this.root, { recursive: true });
  }

  /**
   * Write a JSON artifact for a product.
   * Creates intermediate directories as needed. Uses atomic write (temp + rename).
   *
   * @param slug - Product slug (e.g. "linear-app")
   * @param artifactPath - Relative path within product dir (e.g. "crawl/pages.json")
   * @param data - Data to serialize as JSON
   */
  writeJson(slug: string, artifactPath: string, data: unknown): void {
    const fullPath = join(this.root, slug, artifactPath);
    mkdirSync(dirname(fullPath), { recursive: true });

    const json = JSON.stringify(data, null, 2) + "\n";

    // Atomic write: temp file then rename
    const tmpPath = fullPath + `.tmp-${Date.now()}`;
    writeFileSync(tmpPath, json, "utf-8");
    renameSync(tmpPath, fullPath);
  }

  /**
   * Read a JSON artifact for a product.
   * Returns null if the file doesn't exist or is invalid JSON.
   */
  readJson<T = unknown>(slug: string, artifactPath: string): T | null {
    const fullPath = join(this.root, slug, artifactPath);
    try {
      const raw = readFileSync(fullPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Check whether a product directory exists. */
  exists(slug: string): boolean {
    return existsSync(join(this.root, slug));
  }

  /** List all product slugs (directory names). */
  listProducts(): string[] {
    try {
      return readdirSync(this.root, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  }

  /** Get the full filesystem path for a product's artifact. */
  getPath(slug: string, artifactPath?: string): string {
    if (artifactPath) return join(this.root, slug, artifactPath);
    return join(this.root, slug);
  }
}
