# Storage Interface Definition and SQLite Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `packages/storage/` with a `StorageAdapter` interface and a working `SQLiteStorage` adapter using `better-sqlite3`. The SQLite adapter is zero-config (creates `~/.basesignal/data.db` automatically) and stores full `ProductProfile` documents as JSON blobs with indexed metadata columns.

**Architecture:** Single package (`@basesignal/storage`) with three source files: `types.ts` (interface + summary type), `sqlite.ts` (SQLite adapter implementation), and `index.ts` (re-exports). The interface uses `Promise` return types for compatibility with async adapters, while the SQLite implementation wraps synchronous `better-sqlite3` calls. One database table (`profiles`) stores the full profile as a JSON blob in the `data` column with denormalized `name`, `url`, and `completeness` columns for indexed search and listing.

**Tech Stack:** TypeScript, better-sqlite3, Vitest, tsup

**Dependency Note:** This story depends on M008-E001-S001 (monorepo workspace setup) and M008-E001-S002 (ProductProfile type extraction into `@basesignal/core`). If `packages/core/` does not yet exist, this plan uses a local `ProductProfile` placeholder type in `types.ts` and marks it with a `TODO` for replacement once `@basesignal/core` is available.

---

## Task 1: Scaffold the packages/storage directory and package.json

**Files:**
- Create: `packages/storage/package.json`
- Modify: root `package.json` (add workspaces if not already present)

**Step 1: Add workspaces to root package.json (if missing)**

Check if root `package.json` already has a `"workspaces"` field. If not, add it:

```json
{
  "workspaces": ["packages/*"]
}
```

This must be added at the top level of root `package.json`, alongside `"name"`, `"private"`, etc.

**Step 2: Create packages/storage/package.json**

```json
{
  "name": "@basesignal/storage",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "tsup": "^8.0.0",
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  }
}
```

**Step 3: Run npm install from root to wire up workspaces**

Run: `npm install`

Expected: Workspace `@basesignal/storage` is recognized. `better-sqlite3` is installed.

**Step 4: Commit**

```bash
git add package.json packages/storage/package.json package-lock.json
git commit -m "chore: scaffold packages/storage with package.json and workspace config"
```

---

## Task 2: Add TypeScript and build configuration for packages/storage

**Files:**
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/tsup.config.ts`

**Step 1: Create packages/storage/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "dist", "node_modules"]
}
```

**Step 2: Create packages/storage/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

**Step 3: Verify TypeScript config is valid**

Run: `cd packages/storage && npx tsc --noEmit --pretty` (will fail because no source files yet, but config should parse)

**Step 4: Commit**

```bash
git add packages/storage/tsconfig.json packages/storage/tsup.config.ts
git commit -m "chore: add TypeScript and tsup build config for @basesignal/storage"
```

---

## Task 3: Create Vitest configuration for packages/storage

**Files:**
- Create: `packages/storage/vitest.config.ts`

**Step 1: Create packages/storage/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

This is intentionally minimal. Tests run in Node (not jsdom) because the storage layer is backend-only. The `:memory:` SQLite database is configured per-test, not globally.

**Step 2: Commit**

```bash
git add packages/storage/vitest.config.ts
git commit -m "chore: add Vitest config for @basesignal/storage"
```

---

## Task 4: Define the StorageAdapter interface and types

**Files:**
- Create: `packages/storage/src/types.ts`

**Step 1: Create packages/storage/src/types.ts**

```typescript
/**
 * Minimal metadata returned by list() and search().
 * Avoids loading full profile documents for listing views.
 */
export interface ProfileSummary {
  id: string;
  name: string;
  url: string;
  completeness: number;
  updatedAt: number;
}

/**
 * Placeholder for the ProductProfile type from @basesignal/core.
 *
 * This is a minimal stand-in until M008-E001-S002 extracts the full
 * ProductProfile type system into packages/core. The storage layer
 * treats profiles as opaque JSON documents -- it only reads `id`,
 * `identity.productName`, `metadata.url`, and `completeness` for
 * indexing. The rest is serialized as-is.
 *
 * TODO: Replace with `import type { ProductProfile } from "@basesignal/core"`
 * once packages/core exists.
 */
export interface ProductProfile {
  /** UUID assigned by storage on first save. */
  id?: string;

  /** Core product identity. */
  identity?: {
    productName: string;
    description: string;
    targetCustomer: string;
    businessModel: string;
    industry?: string;
    companyStage?: string;
    confidence: number;
    evidence: Array<{ url: string; excerpt: string }>;
  };

  /** Product URL and scan metadata. */
  metadata?: {
    url: string;
    docsUrl?: string;
    scannedAt?: number;
  };

  /** Revenue architecture. */
  revenue?: Record<string, unknown>;

  /** Entity model. */
  entities?: Record<string, unknown>;

  /** Journey stages. */
  journey?: Record<string, unknown>;

  /** Definitions (activation, firstValue, active, atRisk, churn). */
  definitions?: Record<string, unknown>;

  /** Outcomes. */
  outcomes?: Record<string, unknown>;

  /** Metrics. */
  metrics?: Record<string, unknown>;

  /** Generated outputs (ICP profiles, activation map, measurement spec). */
  outputs?: Record<string, unknown>;

  /** Completeness score (0-1). */
  completeness?: number;

  /** Overall confidence score (0-1). */
  overallConfidence?: number;

  /** Allow additional fields for forward compatibility. */
  [key: string]: unknown;
}

/**
 * Storage adapter interface. All implementations must satisfy this contract.
 *
 * Methods return Promise to support both synchronous adapters (SQLite) and
 * asynchronous adapters (Postgres, HTTP-backed, etc.). The SQLite adapter
 * wraps synchronous calls in Promise.resolve().
 */
export interface StorageAdapter {
  /** Persist a profile. Creates on first call, upserts on subsequent calls. Returns the profile ID. */
  save(profile: ProductProfile): Promise<string>;

  /** Load a profile by ID. Returns null if not found. */
  load(id: string): Promise<ProductProfile | null>;

  /** List all profiles with summary metadata, ordered by most recently updated. */
  list(): Promise<ProfileSummary[]>;

  /** Delete a profile by ID. Returns true if it existed, false if not found. */
  delete(id: string): Promise<boolean>;

  /** Search profiles by name or URL substring. Case-insensitive. */
  search(query: string): Promise<ProfileSummary[]>;

  /** Clean up resources (close database connections, etc.). */
  close(): void;
}
```

**Step 2: Verify types compile**

Run: `cd packages/storage && npx tsc --noEmit`

Expected: Zero errors.

**Step 3: Commit**

```bash
git add packages/storage/src/types.ts
git commit -m "feat: define StorageAdapter interface and ProfileSummary types"
```

---

## Task 5: Write failing tests for the SQLite adapter

**Files:**
- Create: `packages/storage/src/sqlite.test.ts`

**Step 1: Create the test file**

Write tests against the `SQLiteStorage` class (which does not exist yet). All tests use `:memory:` database for zero file I/O. The test file imports from `./sqlite` and `./types`.

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { SQLiteStorage } from "./sqlite";
import type { ProductProfile } from "./types";

function createTestProfile(overrides: Partial<ProductProfile> = {}): ProductProfile {
  return {
    identity: {
      productName: "Test Product",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "SaaS",
      confidence: 0.8,
      evidence: [{ url: "https://example.com", excerpt: "test" }],
    },
    metadata: {
      url: "https://example.com",
    },
    completeness: 0.5,
    ...overrides,
  };
}

describe("SQLiteStorage", () => {
  let storage: SQLiteStorage;

  afterEach(() => {
    storage?.close();
  });

  describe("constructor", () => {
    it("creates an in-memory database", () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      expect(storage).toBeDefined();
    });

    it("defaults to in-memory when no path provided and path option is :memory:", () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      expect(storage).toBeDefined();
    });
  });

  describe("save and load", () => {
    it("saves a profile and returns an ID", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const profile = createTestProfile();
      const id = await storage.save(profile);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("loads a profile by ID with full data", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const profile = createTestProfile();
      const id = await storage.save(profile);

      const loaded = await storage.load(id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(id);
      expect(loaded!.identity?.productName).toBe("Test Product");
      expect(loaded!.identity?.description).toBe("A test product");
      expect(loaded!.metadata?.url).toBe("https://example.com");
      expect(loaded!.completeness).toBe(0.5);
    });

    it("returns null for non-existent ID", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const loaded = await storage.load("non-existent-id");
      expect(loaded).toBeNull();
    });

    it("preserves the ID on subsequent saves (upsert)", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const profile = createTestProfile();
      const id = await storage.save(profile);

      const updated = createTestProfile({
        id,
        completeness: 0.9,
      });
      const upsertId = await storage.save(updated);
      expect(upsertId).toBe(id);

      const loaded = await storage.load(id);
      expect(loaded!.completeness).toBe(0.9);
    });

    it("uses existing ID from profile if provided", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const profile = createTestProfile({ id: "custom-id-123" });
      const id = await storage.save(profile);
      expect(id).toBe("custom-id-123");

      const loaded = await storage.load("custom-id-123");
      expect(loaded).not.toBeNull();
      expect(loaded!.identity?.productName).toBe("Test Product");
    });
  });

  describe("list", () => {
    it("returns empty array when no profiles exist", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const results = await storage.list();
      expect(results).toEqual([]);
    });

    it("returns summaries for all profiles ordered by updatedAt desc", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });

      await storage.save(createTestProfile({
        identity: {
          productName: "First",
          description: "First product",
          targetCustomer: "Dev",
          businessModel: "SaaS",
          confidence: 0.5,
          evidence: [],
        },
        metadata: { url: "https://first.com" },
        completeness: 0.3,
      }));

      // Small delay to ensure different updated_at timestamps
      await new Promise((r) => setTimeout(r, 10));

      await storage.save(createTestProfile({
        identity: {
          productName: "Second",
          description: "Second product",
          targetCustomer: "Dev",
          businessModel: "SaaS",
          confidence: 0.8,
          evidence: [],
        },
        metadata: { url: "https://second.com" },
        completeness: 0.7,
      }));

      const results = await storage.list();
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Second"); // Most recent first
      expect(results[1].name).toBe("First");

      // Verify summary shape
      expect(results[0]).toHaveProperty("id");
      expect(results[0]).toHaveProperty("name");
      expect(results[0]).toHaveProperty("url");
      expect(results[0]).toHaveProperty("completeness");
      expect(results[0]).toHaveProperty("updatedAt");
      expect(results[0].url).toBe("https://second.com");
      expect(results[0].completeness).toBe(0.7);
    });
  });

  describe("delete", () => {
    it("deletes an existing profile and returns true", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const id = await storage.save(createTestProfile());

      const deleted = await storage.delete(id);
      expect(deleted).toBe(true);

      const loaded = await storage.load(id);
      expect(loaded).toBeNull();
    });

    it("returns false when deleting non-existent profile", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const deleted = await storage.delete("non-existent-id");
      expect(deleted).toBe(false);
    });

    it("delete is idempotent (second delete returns false)", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      const id = await storage.save(createTestProfile());

      await storage.delete(id);
      const secondDelete = await storage.delete(id);
      expect(secondDelete).toBe(false);
    });
  });

  describe("search", () => {
    it("finds profiles by product name substring", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });

      await storage.save(createTestProfile({
        identity: {
          productName: "Acme Analytics",
          description: "Analytics tool",
          targetCustomer: "Teams",
          businessModel: "SaaS",
          confidence: 0.9,
          evidence: [],
        },
        metadata: { url: "https://acme.com" },
      }));

      await storage.save(createTestProfile({
        identity: {
          productName: "Beta Dashboard",
          description: "Dashboard tool",
          targetCustomer: "Teams",
          businessModel: "SaaS",
          confidence: 0.8,
          evidence: [],
        },
        metadata: { url: "https://beta.io" },
      }));

      const results = await storage.search("acme");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Acme Analytics");
    });

    it("finds profiles by URL substring", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });

      await storage.save(createTestProfile({
        identity: {
          productName: "My Tool",
          description: "A tool",
          targetCustomer: "Dev",
          businessModel: "SaaS",
          confidence: 0.5,
          evidence: [],
        },
        metadata: { url: "https://mytool.example.com" },
      }));

      const results = await storage.search("example.com");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("My Tool");
    });

    it("returns empty array when no matches found", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      await storage.save(createTestProfile());

      const results = await storage.search("nonexistent-query");
      expect(results).toEqual([]);
    });

    it("search is case-insensitive", async () => {
      storage = new SQLiteStorage({ path: ":memory:" });

      await storage.save(createTestProfile({
        identity: {
          productName: "Acme Analytics",
          description: "Analytics tool",
          targetCustomer: "Teams",
          businessModel: "SaaS",
          confidence: 0.9,
          evidence: [],
        },
        metadata: { url: "https://acme.com" },
      }));

      const results = await storage.search("ACME");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Acme Analytics");
    });
  });

  describe("close", () => {
    it("can be called without error", () => {
      storage = new SQLiteStorage({ path: ":memory:" });
      expect(() => storage.close()).not.toThrow();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/storage && npx vitest run`

Expected: All tests FAIL because `./sqlite` module does not exist yet.

**Step 3: Commit**

```bash
git add packages/storage/src/sqlite.test.ts
git commit -m "test: add failing tests for SQLiteStorage adapter"
```

---

## Task 6: Implement the SQLiteStorage class

**Files:**
- Create: `packages/storage/src/sqlite.ts`

**Step 1: Create the SQLite adapter**

```typescript
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
```

**Step 2: Run tests to verify they pass**

Run: `cd packages/storage && npx vitest run`

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add packages/storage/src/sqlite.ts
git commit -m "feat: implement SQLiteStorage adapter with better-sqlite3"
```

---

## Task 7: Create the index.ts barrel export

**Files:**
- Create: `packages/storage/src/index.ts`

**Step 1: Create the barrel export**

```typescript
// Types
export type { StorageAdapter, ProfileSummary, ProductProfile } from "./types";

// Implementations
export { SQLiteStorage } from "./sqlite";
export type { SQLiteStorageOptions } from "./sqlite";
```

**Step 2: Verify build succeeds**

Run: `cd packages/storage && npx tsup`

Expected: Produces `dist/index.mjs`, `dist/index.cjs`, and `dist/index.d.ts` with no errors.

**Step 3: Verify typecheck passes**

Run: `cd packages/storage && npx tsc --noEmit`

Expected: Zero errors.

**Step 4: Commit**

```bash
git add packages/storage/src/index.ts
git commit -m "feat: add barrel export for @basesignal/storage"
```

---

## Task 8: Final verification and build validation

**Files:** None (validation only)

**Step 1: Run all tests**

Run: `cd packages/storage && npx vitest run`

Expected: All tests pass. All tests use `:memory:` (no file I/O).

**Step 2: Run typecheck**

Run: `cd packages/storage && npx tsc --noEmit`

Expected: Zero errors.

**Step 3: Run build**

Run: `cd packages/storage && npx tsup`

Expected: `dist/` contains `index.mjs`, `index.cjs`, `index.d.ts`, `index.d.mts`.

**Step 4: Verify existing app tests still pass**

Run: `npm test -- --run` (from repo root)

Expected: Existing test suite passes. The new package does not interfere with the existing React/Convex app.

**Step 5: Commit (if any cleanup needed)**

Only commit if Tasks 1-7 left anything uncommitted.

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Covered By |
|---|---|
| Storage interface exports: save, load, list, delete, search | Task 4: `types.ts` defines `StorageAdapter` interface |
| packages/storage/ has its own package.json with name '@basesignal/storage' | Task 1: `package.json` created |
| SQLiteStorage creates database file at configurable path (default ~/.basesignal/data.db) | Task 6: `DEFAULT_DB_PATH` + constructor `path` option |
| save() stores a ProductProfile and returns its ID | Task 5+6: `save and load` test group |
| load() retrieves a profile by ID, returns null if not found | Task 5+6: `save and load` test group |
| list() returns all profiles with basic metadata (id, name, url, updatedAt) | Task 5+6: `list` test group |
| search() finds profiles by product name or URL (basic text search) | Task 5+6: `search` test group |
| Tests use an in-memory SQLite database (no file I/O) | Task 5: all tests use `{ path: ":memory:" }` |

## File Summary

| File | Action | Purpose |
|---|---|---|
| `package.json` (root) | Modify | Add `"workspaces": ["packages/*"]` |
| `packages/storage/package.json` | Create | Package manifest for `@basesignal/storage` |
| `packages/storage/tsconfig.json` | Create | TypeScript configuration |
| `packages/storage/tsup.config.ts` | Create | Build configuration (ESM + CJS) |
| `packages/storage/vitest.config.ts` | Create | Test runner configuration |
| `packages/storage/src/types.ts` | Create | `StorageAdapter` interface, `ProfileSummary`, `ProductProfile` placeholder |
| `packages/storage/src/sqlite.ts` | Create | `SQLiteStorage` class implementation |
| `packages/storage/src/sqlite.test.ts` | Create | Tests (14 test cases, all using `:memory:`) |
| `packages/storage/src/index.ts` | Create | Barrel re-export |
