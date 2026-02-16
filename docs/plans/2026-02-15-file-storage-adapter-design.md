# File-Based JSON Storage Adapter Design

## Overview

Implement a `FileStorage` adapter that satisfies the `StorageAdapter` interface from S001 by storing each `ProductProfile` as an individual JSON file in a configurable directory. This adapter complements the SQLite default by providing human-readable, git-friendly, and easily inspectable profile storage for debugging, version-controlled workflows, and simple single-user deployments.

## Problem Statement

The SQLite adapter (S001) is the zero-config default, but it stores profiles in a binary database file. For certain workflows -- debugging analysis output, committing profiles to git, scripting with `jq`, or simply inspecting what Basesignal produced -- a directory of pretty-printed JSON files is superior. The file adapter is the second adapter validating that the `StorageAdapter` interface is genuinely swappable.

## Expert Perspectives

### Technical Architect

The file adapter answers a different question than SQLite: "Can I read and diff my profiles with standard tools?" That is its entire justification. The implementation should be trivially simple -- `readFileSync`/`writeFileSync` with `JSON.stringify(profile, null, 2)` -- because the `StorageAdapter` interface already defines the contract. The only subtle decision is atomic writes: write to a temp file in the same directory, then `renameSync`. This prevents partial writes from corrupting profiles if the process crashes mid-save. Beyond that, this adapter should be under 100 lines of code. If it is more, something is wrong.

### Simplification Reviewer

**Verdict: APPROVED** -- with strict scope.

What to keep:
- One file per profile. `{id}.json`. Nothing else.
- Pretty-printed JSON. The whole point of this adapter is human readability.
- Atomic write via temp-file-then-rename. Non-negotiable for data safety. Costs two lines of code.
- `search()` as sequential file reads with string matching. It will be slow with hundreds of profiles. That is fine -- if you have hundreds, use SQLite.

What to cut:
- **No file locking.** This is a single-user CLI tool. If you need concurrent access, use SQLite (it has WAL mode). File locking adds complexity for a scenario this adapter is not designed for.
- **No index file.** An `index.json` that caches metadata would speed up `list()` but adds a consistency problem (index vs. files diverging). Just read the files. It is fast enough for the expected scale (< 50 profiles).
- **No nested directories.** Flat directory. No `profiles/a/acme.json` sharding. Not needed until thousands of files, which is not this adapter's use case.
- **No SQLite migration utility.** Exporting from SQLite to files (or vice versa) is a CLI command concern, not a storage adapter concern. A future CLI export/import command can load from one adapter and save to another -- the interface already supports this.

What to watch:
- Error messages. When a file is corrupted (invalid JSON), `load()` should return `null` and log a warning, not throw and crash the CLI.

## Proposed Solution

### Directory Structure

```
~/.basesignal/profiles/           # Default directory
  a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
  b2c3d4e5-f6a7-8901-bcde-f12345678901.json
```

That is the entire structure. One flat directory. Each file is named `{id}.json` where `id` is a UUID (matching the ID format from the SQLite adapter). No subdirectories, no index files, no metadata sidecar files.

The directory path is configurable, defaulting to `~/.basesignal/profiles/`. The directory is auto-created on first `save()` if it does not exist.

### File Format

Each file contains a pretty-printed `ProductProfile` document:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "identity": {
    "productName": "Acme Analytics",
    "description": "...",
    ...
  },
  "revenue": { ... },
  "entities": { ... },
  "completeness": 0.6,
  "updatedAt": 1739577600000,
  "createdAt": 1739577600000
}
```

Design rationale:
- `JSON.stringify(profile, null, 2)` -- two-space indentation for readability.
- The profile object is the single source of truth. No metadata lives outside the JSON.
- `id`, `completeness`, `createdAt`, and `updatedAt` are fields on the profile itself (same as what gets stored in the SQLite `data` column).
- Files end with a trailing newline for POSIX compliance and clean git diffs.

### Implementation

```typescript
// packages/storage/src/file.ts

import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, renameSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
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

    // Atomic write: write to temp file in same directory, then rename.
    // rename() is atomic on POSIX when source and target are on the same filesystem.
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
      // File not found or corrupted JSON -- return null
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

    // Sort by updatedAt descending (most recent first), matching SQLite adapter behavior.
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
      (s) => s.name.toLowerCase().includes(lower) || s.url.toLowerCase().includes(lower)
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

### Key Design Decisions

**1. Atomic writes via temp-file-then-rename.**

`writeFileSync` can leave a partial file if the process is killed mid-write. The pattern is: write to `.tmp-{id}-{timestamp}` in the same directory, then `renameSync` to the final path. `rename()` is atomic on POSIX filesystems when source and destination are on the same filesystem. Since the temp file is in the same directory, this guarantee holds. On Windows, `renameSync` is also atomic for same-volume renames. The temp file prefix (`.`) means `jsonFiles()` ignores orphaned temp files.

**2. No file locking.**

This adapter is designed for single-user, single-process use (CLI tool, local MCP server). Concurrent write protection is SQLite's job (WAL mode). Adding `flock` or `lockfile` would add complexity for a use case this adapter explicitly does not target. The story acceptance criteria do not require it, and the epic description positions this adapter for "debugging, git-friendly storage, and simple deployments."

**3. No index file.**

An `index.json` that caches `ProfileSummary` entries would avoid reading every file on `list()`. But it creates a consistency problem: if a user manually edits or deletes a JSON file, the index is stale. Since this adapter's value proposition is "files you can inspect and edit with standard tools," an index that can silently diverge from reality undermines trust. Sequential reads of all files is O(n) where n is the number of profiles. At the expected scale (< 50 profiles, each < 50KB), this completes in under 10ms.

**4. No nested directories.**

Flat directory. UUID filenames do not benefit from sharding (unlike slugs, they distribute evenly). The expected profile count for this adapter is single digits to low dozens. A user with hundreds of profiles should use the SQLite adapter.

**5. Graceful handling of corrupted files.**

`load()` catches `SyntaxError` from `JSON.parse` and returns `null` with a console warning. This means `list()` silently skips corrupted files rather than crashing. A corrupted file is a file the user probably hand-edited incorrectly -- they should be warned, not punished.

**6. Case-insensitive search.**

`search()` converts both query and field values to lowercase before matching. This matches user expectations ("acme" should find "Acme Analytics") and is consistent with the SQLite adapter's `LIKE` behavior (which is case-insensitive for ASCII by default).

**7. No migration utility in the adapter.**

Converting between SQLite and file storage is a concern for the CLI layer, not the adapter. The CLI can instantiate both adapters and pipe `list()` from one into `save()` on the other. The `StorageAdapter` interface already provides everything needed:

```typescript
// Future CLI command: basesignal export --format files --dir ./profiles
const source = new SQLiteStorage();
const target = new FileStorage({ dir: "./profiles" });
for (const summary of await source.list()) {
  const profile = await source.load(summary.id);
  if (profile) await target.save(profile);
}
```

This is 5 lines of code in the CLI, not a feature of the storage adapter.

### Package Structure Addition

The file adapter extends the existing `packages/storage/` structure from S001:

```
packages/storage/
  src/
    index.ts            # Re-exports types + SQLiteStorage + FileStorage
    types.ts            # StorageAdapter, ProfileSummary (unchanged from S001)
    sqlite.ts           # SQLiteStorage class (from S001)
    sqlite.test.ts      # SQLite tests (from S001)
    file.ts             # FileStorage class (this story)
    file.test.ts        # File adapter tests (this story)
```

No new package. No new dependencies. `FileStorage` uses only Node.js built-in modules (`node:fs`, `node:path`, `node:os`, `node:crypto`). This means the file adapter adds zero bytes to the dependency tree.

### Test Strategy

All tests use a temporary directory created with `mkdtempSync` and cleaned up after each test:

```typescript
// packages/storage/src/file.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStorage } from "./file.js";

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

  it("implements StorageAdapter interface", () => {
    // TypeScript compilation proves this; runtime check for save/load/list/delete/search/close
    expect(typeof storage.save).toBe("function");
    expect(typeof storage.load).toBe("function");
    expect(typeof storage.list).toBe("function");
    expect(typeof storage.delete).toBe("function");
    expect(typeof storage.search).toBe("function");
    expect(typeof storage.close).toBe("function");
  });

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
    await storage.save({ ...profile, id, identity: { ...profile.identity!, productName: "v2" } });
    const loaded = await storage.load(id);
    expect(loaded!.identity!.productName).toBe("v2");
  });

  it("load returns null for non-existent id", async () => {
    expect(await storage.load("does-not-exist")).toBeNull();
  });

  it("load returns null for corrupted JSON file", async () => {
    // Write garbage to a file
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(dir, "bad.json"), "not valid json{{{", "utf-8");
    expect(await storage.load("bad")).toBeNull();
  });

  it("list returns summaries sorted by updatedAt descending", async () => {
    await storage.save(makeTestProfile({ identity: { productName: "First" } }));
    // Small delay to ensure different timestamps
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

  it("delete removes the JSON file", async () => {
    const id = await storage.save(makeTestProfile());
    expect(await storage.delete(id)).toBe(true);
    expect(await storage.load(id)).toBeNull();
  });

  it("delete returns false for non-existent id", async () => {
    expect(await storage.delete("does-not-exist")).toBe(false);
  });

  it("search finds by name substring (case-insensitive)", async () => {
    await storage.save(makeTestProfile({ identity: { productName: "Acme Analytics" } }));
    await storage.save(makeTestProfile({ identity: { productName: "Beta Corp" } }));
    const results = await storage.search("acme");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Acme Analytics");
  });

  it("search finds by url substring", async () => {
    await storage.save(makeTestProfile({ metadata: { url: "https://acme.com" } }));
    await storage.save(makeTestProfile({ metadata: { url: "https://beta.io" } }));
    const results = await storage.search("acme.com");
    expect(results).toHaveLength(1);
  });

  it("uses temporary directory (cleaned up after tests)", () => {
    expect(dir).toContain("basesignal-test-");
  });
});

function makeTestProfile(overrides = {}): ProductProfile {
  return {
    identity: { productName: "Test Product", description: "", targetCustomer: "", businessModel: "", confidence: 0, evidence: [] },
    completeness: 0,
    ...overrides,
  } as ProductProfile;
}
```

### Mapping to Acceptance Criteria

| Acceptance Criterion | How It Is Met |
|---|---|
| FileStorage implements the StorageAdapter interface | TypeScript class declaration + `implements StorageAdapter` |
| save() writes profile to `{dir}/{id}.json` with pretty-printed JSON | `JSON.stringify(profile, null, 2) + "\n"` written via atomic temp-rename |
| load() reads and parses JSON from `{dir}/{id}.json` | `readFileSync` + `JSON.parse` with error handling |
| list() scans directory for .json files and returns metadata | `readdirSync` + filter `.json` + parse each for summary fields |
| delete() removes the JSON file | `unlinkSync` with boolean return |
| search() searches file contents for matching name/url | Case-insensitive substring match on `list()` results |
| Tests use a temporary directory (cleaned up after tests) | `mkdtempSync` in `beforeEach`, `rmSync` in `afterEach` |

## What This Does NOT Do

- **No file locking.** Single-user adapter. Use SQLite for concurrent access.
- **No index file.** Reads all files on `list()`. Fast enough at expected scale.
- **No nested directories.** Flat structure. No sharding.
- **No migration utility.** Export/import is a CLI concern, not a storage concern.
- **No file watching.** No `fs.watch` to detect external edits. `load()` always reads from disk.
- **No compression.** Files are plain JSON. Profiles are typically 5-30KB. Not worth gzip complexity.
- **No encryption.** Profiles contain publicly available product information scraped from websites. Not sensitive data.
- **No new dependencies.** Uses only Node.js built-in modules.

## Verification Steps

1. **TypeScript compiles:** `FileStorage implements StorageAdapter` type-checks with no errors
2. **save/load roundtrip:** Save a profile, load by ID, assert deep equality of data fields
3. **Atomic write:** Verify temp file is created and renamed (no partial writes on crash)
4. **Pretty-printed output:** Read raw file contents, verify 2-space indented JSON with trailing newline
5. **list returns correct metadata:** Save 3 profiles, list returns 3 summaries sorted by updatedAt
6. **search by name:** Save profiles "Acme" and "Beta", search "acme" returns only "Acme"
7. **search by url:** Same pattern but matching on URL field
8. **delete removes file:** Save, delete, verify file gone from disk, load returns null
9. **delete nonexistent returns false:** Delete with unknown ID returns false
10. **corrupted file handling:** Write invalid JSON to a file, load returns null without throwing
11. **auto-creates directory:** Construct with non-existent directory, verify it is created
12. **temp directory cleanup:** After test teardown, temp directory does not exist

## Success Criteria

- `FileStorage` implements the `StorageAdapter` interface (same 6 methods as `SQLiteStorage`)
- `save()` writes `{dir}/{id}.json` with pretty-printed JSON via atomic temp-file-then-rename
- `load()` reads and parses JSON, returns `null` for missing or corrupted files
- `list()` scans directory for `.json` files and returns `ProfileSummary[]` sorted by `updatedAt`
- `delete()` removes the JSON file, returns boolean
- `search()` does case-insensitive substring match on name and url
- Zero new dependencies (all Node.js built-ins)
- All tests use `mkdtempSync` temporary directories cleaned up in `afterEach`
