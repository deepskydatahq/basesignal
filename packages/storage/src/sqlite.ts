import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { StorageAdapter, ProductProfile, ProfileSummary } from "./types";

/** Default database path: ~/.basesignal/data.db */
const DEFAULT_DB_PATH = join(homedir(), ".basesignal", "data.db");

/**
 * Options for configuring the SQLite storage adapter.
 */
export interface SQLiteStorageOptions {
  /** Path to the SQLite database file. Use ':memory:' for in-memory (tests). Defaults to ~/.basesignal/data.db. */
  path?: string;
}

/**
 * SQLite storage adapter using better-sqlite3.
 *
 * Stores ProductProfile documents as JSON blobs with indexed metadata columns
 * for search and listing. Zero-config: auto-creates the database directory
 * and file on first use.
 */
export class SQLiteStorage implements StorageAdapter {
  private db: Database.Database;

  constructor(options: SQLiteStorageOptions = {}) {
    const dbPath = options.path ?? DEFAULT_DB_PATH;

    // Auto-create directory for file-based databases
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  /**
   * Create the profiles table and indexes if they don't exist.
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        completeness REAL NOT NULL DEFAULT 0,
        data        TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
      CREATE INDEX IF NOT EXISTS idx_profiles_url ON profiles(url);
    `);
  }

  async save(profile: ProductProfile): Promise<string> {
    const now = Date.now();
    const id = profile.id ?? randomUUID();
    const name = profile.identity?.productName ?? "";
    const url = profile.metadata?.url ?? "";
    const completeness = profile.completeness ?? 0;

    const profileWithId = { ...profile, id };
    const data = JSON.stringify(profileWithId);

    const stmt = this.db.prepare(`
      INSERT INTO profiles (id, name, url, completeness, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        url = excluded.url,
        completeness = excluded.completeness,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, name, url, completeness, data, now, now);
    return id;
  }

  async load(id: string): Promise<ProductProfile | null> {
    const row = this.db
      .prepare("SELECT data FROM profiles WHERE id = ?")
      .get(id) as { data: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.data) as ProductProfile;
  }

  async list(): Promise<ProfileSummary[]> {
    const rows = this.db
      .prepare(
        "SELECT id, name, url, completeness, updated_at FROM profiles ORDER BY updated_at DESC"
      )
      .all() as Array<{
      id: string;
      name: string;
      url: string;
      completeness: number;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      completeness: r.completeness,
      updatedAt: r.updated_at,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db
      .prepare("DELETE FROM profiles WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  async search(query: string): Promise<ProfileSummary[]> {
    const pattern = `%${query}%`;
    const rows = this.db
      .prepare(
        "SELECT id, name, url, completeness, updated_at FROM profiles WHERE name LIKE ? OR url LIKE ? ORDER BY updated_at DESC"
      )
      .all(pattern, pattern) as Array<{
      id: string;
      name: string;
      url: string;
      completeness: number;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      completeness: r.completeness,
      updatedAt: r.updated_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
