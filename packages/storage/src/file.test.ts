import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStorage } from "./file";
import type { ProductProfile } from "./types";

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
