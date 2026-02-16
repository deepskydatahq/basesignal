import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { StorageAdapter, ProfileSummary, ProductProfile } from "./types";

const DEFAULT_DIR = join(homedir(), ".basesignal", "profiles");

export interface FileStorageOptions {
  /** Directory to store profile JSON files. Auto-created if missing. */
  dir?: string;
}

export class FileStorage implements StorageAdapter {
  private readonly dir: string;

  constructor(options: FileStorageOptions = {}) {
    this.dir = options.dir ?? DEFAULT_DIR;
    mkdirSync(this.dir, { recursive: true });
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  async save(profile: ProductProfile): Promise<string> {
    const now = Date.now();
    const id = profile.id ?? randomUUID();
    const profileWithId = {
      ...profile,
      id,
      updatedAt: now,
      createdAt: profile.createdAt ?? now,
    };
    const data = JSON.stringify(profileWithId, null, 2) + "\n";

    // Atomic write: temp file in same directory, then rename.
    // rename() is atomic on POSIX when source and target share a filesystem.
    const tmpFile = join(this.dir, `.tmp-${id}-${Date.now()}`);
    writeFileSync(tmpFile, data, "utf-8");
    renameSync(tmpFile, this.filePath(id));

    return id;
  }

  async load(id: string): Promise<ProductProfile | null> {
    try {
      const raw = readFileSync(this.filePath(id), "utf-8");
      return JSON.parse(raw);
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        console.warn(`FileStorage: corrupted JSON in ${id}.json, skipping`);
      }
      return null;
    }
  }

  async list(): Promise<ProfileSummary[]> {
    const files = this.jsonFiles();
    const summaries: ProfileSummary[] = [];

    for (const filename of files) {
      const id = basename(filename, ".json");
      const profile = await this.load(id);
      if (profile) {
        summaries.push({
          id,
          name: profile.identity?.productName ?? "",
          url: profile.metadata?.url ?? "",
          completeness: profile.completeness ?? 0,
          updatedAt: (profile.updatedAt as number) ?? 0,
        });
      }
    }

    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    return summaries;
  }

  async delete(id: string): Promise<boolean> {
    try {
      unlinkSync(this.filePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string): Promise<ProfileSummary[]> {
    const all = await this.list();
    const lower = query.toLowerCase();
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.url.toLowerCase().includes(lower)
    );
  }

  close(): void {
    // No resources to clean up for file-based storage.
  }

  /** List .json filenames in the directory, ignoring dotfiles and non-json. */
  private jsonFiles(): string[] {
    try {
      return readdirSync(this.dir).filter(
        (f) => f.endsWith(".json") && !f.startsWith(".")
      );
    } catch {
      return [];
    }
  }
}
