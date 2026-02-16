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
