# Implementation Plan: File-Based JSON Storage Adapter

**Task:** basesignal-89l (M008-E004-S002)
**Design:** docs/plans/2026-02-15-file-storage-adapter-design.md
**Depends on:** M008-E004-S001 (Storage interface + SQLite adapter)

## Context

Implement a `FileStorage` class that satisfies the `StorageAdapter` interface by storing each `ProductProfile` as a pretty-printed JSON file in a flat directory. This is the second adapter validating that the `StorageAdapter` interface is genuinely swappable. The file adapter targets debugging, git-friendly workflows, and simple single-user deployments where human-readable storage is more valuable than the performance of SQLite.

The `packages/storage/` package does not yet exist -- S001 creates it with the `StorageAdapter` interface and `SQLiteStorage`. This story adds `FileStorage` to that same package, so it must be implemented after S001 is complete.

## Approach

Add `file.ts` and `file.test.ts` to the existing `packages/storage/src/` directory. Update `index.ts` to re-export `FileStorage`. Zero new dependencies -- only Node.js built-in modules. The implementation is under 100 lines.

## Prerequisites

Before starting this story, verify that S001 has been implemented:
- `packages/storage/src/types.ts` exists with `StorageAdapter` and `ProfileSummary` interfaces
- `packages/storage/src/sqlite.ts` exists with `SQLiteStorage`
- `packages/storage/src/index.ts` re-exports the above
- `packages/storage/package.json` exists as `@basesignal/storage`
- `npm test` passes for the storage package

If S001 is not yet implemented, stop and implement it first.

## Implementation Steps

### Step 1: Create `packages/storage/src/file.ts`

Create the `FileStorage` class implementing `StorageAdapter`. Uses only Node.js built-in modules.

```typescript
// packages/storage/src/file.ts

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
import type { StorageAdapter, ProfileSummary, ProductProfile } from "./types.js";

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
          updatedAt: profile.updatedAt ?? 0,
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
```

Key details:
- `ProductProfile` type is imported from `./types.js` (defined in S001 or re-exported from `@basesignal/core`)
- Atomic writes use a dotfile temp name (`.tmp-{id}-{timestamp}`) so `jsonFiles()` ignores orphaned temp files
- `list()` reads every file sequentially -- acceptable at expected scale (< 50 profiles)
- `load()` catches both `ENOENT` (file not found) and `SyntaxError` (corrupted JSON), returning `null` for both
- `close()` is a no-op but satisfies the interface contract

**Note on `ProductProfile` type:** The exact type comes from S001's `types.ts`. If the type uses different field paths than `profile.identity?.productName` or `profile.metadata?.url`, adjust accordingly to match whatever S001 defined. The design doc shows these paths, so they should be correct.

### Step 2: Update `packages/storage/src/index.ts` to re-export FileStorage

Add the `FileStorage` export to the existing barrel file:

```typescript
// Add to existing index.ts (which already exports types and SQLiteStorage from S001)
export { FileStorage } from "./file.js";
export type { FileStorageOptions } from "./file.js";
```

### Step 3: Create `packages/storage/src/file.test.ts`

All tests use a temporary directory created with `mkdtempSync` and cleaned up after each test.

```typescript
// packages/storage/src/file.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStorage } from "./file.js";
import type { ProductProfile } from "./types.js";

describe("FileStorage", () => {
  let dir: string;
  let storage: FileStorage;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "basesignal-test-"));
    storage = new FileStorage({ dir });
  });

  afterEach(() => {
    storage.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // --- Interface compliance ---

  it("implements StorageAdapter interface", () => {
    expect(typeof storage.save).toBe("function");
    expect(typeof storage.load).toBe("function");
    expect(typeof storage.list).toBe("function");
    expect(typeof storage.delete).toBe("function");
    expect(typeof storage.search).toBe("function");
    expect(typeof storage.close).toBe("function");
  });

  // --- save() ---

  it("save writes pretty-printed JSON and load reads it back", async () => {
    const profile = makeTestProfile({ identity: { productName: "Acme" } });
    const id = await storage.save(profile);
    const loaded = await storage.load(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.identity!.productName).toBe("Acme");
  });

  it("save generates UUID if profile has no id", async () => {
    const id = await storage.save(makeTestProfile());
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("save overwrites existing file on re-save", async () => {
    const profile = makeTestProfile({ identity: { productName: "v1" } });
    const id = await storage.save(profile);
    await storage.save({
      ...profile,
      id,
      identity: { ...profile.identity!, productName: "v2" },
    });
    const loaded = await storage.load(id);
    expect(loaded!.identity!.productName).toBe("v2");
  });

  it("save writes file with trailing newline", async () => {
    const id = await storage.save(makeTestProfile());
    const raw = readFileSync(join(dir, `${id}.json`), "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("save writes 2-space indented JSON", async () => {
    const id = await storage.save(
      makeTestProfile({ identity: { productName: "Acme" } })
    );
    const raw = readFileSync(join(dir, `${id}.json`), "utf-8");
    // 2-space indentation means lines start with "  " for nested fields
    expect(raw).toContain('  "identity"');
  });

  it("save sets createdAt and updatedAt timestamps", async () => {
    const before = Date.now();
    const id = await storage.save(makeTestProfile());
    const after = Date.now();
    const loaded = await storage.load(id);
    expect(loaded!.createdAt).toBeGreaterThanOrEqual(before);
    expect(loaded!.createdAt).toBeLessThanOrEqual(after);
    expect(loaded!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(loaded!.updatedAt).toBeLessThanOrEqual(after);
  });

  it("save preserves original createdAt on re-save", async () => {
    const profile = makeTestProfile();
    const id = await storage.save(profile);
    const first = await storage.load(id);
    const originalCreatedAt = first!.createdAt;

    // Re-save should keep createdAt but update updatedAt
    await storage.save({ ...first!, id });
    const second = await storage.load(id);
    expect(second!.createdAt).toBe(originalCreatedAt);
  });

  // --- load() ---

  it("load returns null for non-existent id", async () => {
    expect(await storage.load("does-not-exist")).toBeNull();
  });

  it("load returns null for corrupted JSON file", async () => {
    writeFileSync(join(dir, "bad.json"), "not valid json{{{", "utf-8");
    expect(await storage.load("bad")).toBeNull();
  });

  // --- list() ---

  it("list returns summaries sorted by updatedAt descending", async () => {
    await storage.save(makeTestProfile({ identity: { productName: "First" } }));
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));
    await storage.save(makeTestProfile({ identity: { productName: "Second" } }));
    const list = await storage.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Second");
    expect(list[1].name).toBe("First");
  });

  it("list scans directory for .json files", async () => {
    await storage.save(makeTestProfile());
    await storage.save(makeTestProfile());
    const list = await storage.list();
    expect(list).toHaveLength(2);
  });

  it("list skips corrupted files", async () => {
    await storage.save(makeTestProfile({ identity: { productName: "Good" } }));
    writeFileSync(join(dir, "corrupt.json"), "{bad json", "utf-8");
    const list = await storage.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Good");
  });

  it("list ignores dotfiles and non-json files", async () => {
    await storage.save(makeTestProfile());
    writeFileSync(join(dir, ".hidden.json"), "{}", "utf-8");
    writeFileSync(join(dir, "readme.txt"), "not a profile", "utf-8");
    const list = await storage.list();
    expect(list).toHaveLength(1);
  });

  it("list returns empty array for empty directory", async () => {
    const list = await storage.list();
    expect(list).toEqual([]);
  });

  // --- delete() ---

  it("delete removes the JSON file", async () => {
    const id = await storage.save(makeTestProfile());
    expect(await storage.delete(id)).toBe(true);
    expect(await storage.load(id)).toBeNull();
    expect(existsSync(join(dir, `${id}.json`))).toBe(false);
  });

  it("delete returns false for non-existent id", async () => {
    expect(await storage.delete("does-not-exist")).toBe(false);
  });

  // --- search() ---

  it("search finds by name substring (case-insensitive)", async () => {
    await storage.save(
      makeTestProfile({ identity: { productName: "Acme Analytics" } })
    );
    await storage.save(
      makeTestProfile({ identity: { productName: "Beta Corp" } })
    );
    const results = await storage.search("acme");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Acme Analytics");
  });

  it("search finds by url substring", async () => {
    await storage.save(
      makeTestProfile({ metadata: { url: "https://acme.com" } })
    );
    await storage.save(
      makeTestProfile({ metadata: { url: "https://beta.io" } })
    );
    const results = await storage.search("acme.com");
    expect(results).toHaveLength(1);
  });

  it("search returns empty array for no matches", async () => {
    await storage.save(makeTestProfile({ identity: { productName: "Acme" } }));
    const results = await storage.search("nonexistent");
    expect(results).toEqual([]);
  });

  // --- constructor ---

  it("auto-creates directory if it does not exist", () => {
    const nested = join(dir, "nested", "deep", "profiles");
    const s = new FileStorage({ dir: nested });
    expect(existsSync(nested)).toBe(true);
    s.close();
  });

  it("uses temporary directory (cleaned up after tests)", () => {
    expect(dir).toContain("basesignal-test-");
  });
});

function makeTestProfile(overrides: Record<string, unknown> = {}): ProductProfile {
  return {
    identity: {
      productName: "Test Product",
      description: "",
      targetCustomer: "",
      businessModel: "",
      confidence: 0,
      evidence: [],
    },
    completeness: 0,
    ...overrides,
  } as ProductProfile;
}
```

### Step 4: Verify

1. Run `cd packages/storage && npx vitest run` -- all tests pass (both sqlite.test.ts and file.test.ts)
2. Run `cd packages/storage && npx tsc --noEmit` -- zero type errors
3. Verify `FileStorage implements StorageAdapter` compiles without error

## Files Changed

| File | Change |
|------|--------|
| `packages/storage/src/file.ts` | **New.** `FileStorage` class implementing `StorageAdapter` (~90 lines) |
| `packages/storage/src/file.test.ts` | **New.** 20 tests covering all acceptance criteria |
| `packages/storage/src/index.ts` | **Modified.** Add re-export of `FileStorage` and `FileStorageOptions` |

## Acceptance Criteria Mapping

| Acceptance Criterion | Test(s) | How Met |
|---|---|---|
| FileStorage implements the StorageAdapter interface | "implements StorageAdapter interface" | TypeScript `implements StorageAdapter` + runtime method check |
| save() writes profile to {dir}/{id}.json with pretty-printed JSON | "save writes pretty-printed JSON...", "save writes file with trailing newline", "save writes 2-space indented JSON" | `JSON.stringify(profile, null, 2) + "\n"` via atomic temp-rename |
| load() reads and parses JSON from {dir}/{id}.json | "save writes pretty-printed JSON and load reads it back", "load returns null for non-existent id", "load returns null for corrupted JSON file" | `readFileSync` + `JSON.parse` with SyntaxError/ENOENT handling |
| list() scans directory for .json files and returns metadata | "list scans directory for .json files", "list returns summaries sorted by updatedAt descending", "list skips corrupted files", "list ignores dotfiles and non-json files" | `readdirSync` filter + parse each for summary fields |
| delete() removes the JSON file | "delete removes the JSON file", "delete returns false for non-existent id" | `unlinkSync` with boolean return |
| search() searches file contents for matching name/url | "search finds by name substring (case-insensitive)", "search finds by url substring" | Case-insensitive substring match on `list()` results |
| Tests use a temporary directory (cleaned up after tests) | "uses temporary directory (cleaned up after tests)" | `mkdtempSync` in `beforeEach`, `rmSync` in `afterEach` |

## Risks

1. **S001 not yet implemented.** This story depends on S001 for the `StorageAdapter` interface, `ProfileSummary` type, `ProductProfile` type, and the package scaffold. If those do not exist, this story cannot proceed.
2. **ProductProfile field paths may differ.** The design doc assumes `profile.identity?.productName` and `profile.metadata?.url`. If S001 or E001-S002 uses different paths, the `list()` summary extraction and `save()` timestamp handling will need adjustment.
3. **Timestamp ordering in tests.** The "list returns summaries sorted by updatedAt descending" test uses a 5ms delay between saves. On very fast machines, `Date.now()` might return the same millisecond. The delay mitigates this, but if tests are flaky, increase the delay or manually set timestamps.

## Order of Implementation

1. Verify S001 exists (types.ts, sqlite.ts, index.ts, package.json)
2. Create `packages/storage/src/file.ts` with `FileStorage` class
3. Update `packages/storage/src/index.ts` to re-export `FileStorage`
4. Create `packages/storage/src/file.test.ts` with all tests
5. Run tests, fix any type mismatches with actual S001 types
6. Run full test suite to verify no regressions
