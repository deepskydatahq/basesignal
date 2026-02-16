import { describe, it, expect, beforeEach } from "vitest";
import { resolveProduct } from "./resolveProduct.js";
import { MockStorage, makeTestProfile } from "./__tests__/mockStorage.js";

describe("resolveProduct", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it("resolves by explicit ID", async () => {
    const profile = makeTestProfile({ id: "prod-1" });
    await storage.save(profile);

    const result = await resolveProduct(storage, "prod-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toBe("prod-1");
      expect(
        (result.profile.identity as { productName: string }).productName
      ).toBe("Test Product");
    }
  });

  it("returns error for invalid ID", async () => {
    const result = await resolveProduct(storage, "nonexistent");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No product found with ID 'nonexistent'");
      expect(result.error).toContain("list_products");
    }
  });

  it("auto-resolves single product", async () => {
    const profile = makeTestProfile({ id: "only-one" });
    await storage.save(profile);

    const result = await resolveProduct(storage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toBe("only-one");
    }
  });

  it("returns error for zero products", async () => {
    const result = await resolveProduct(storage);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No products found");
      expect(result.error).toContain("scan_product");
    }
  });

  it("returns error listing multiple products", async () => {
    await storage.save(
      makeTestProfile({
        id: "prod-1",
        identity: {
          productName: "Product A",
          description: "A",
          targetCustomer: "A",
          businessModel: "A",
          confidence: 0.8,
          evidence: [],
        },
        metadata: { url: "https://a.com" },
      })
    );
    await storage.save(
      makeTestProfile({
        id: "prod-2",
        identity: {
          productName: "Product B",
          description: "B",
          targetCustomer: "B",
          businessModel: "B",
          confidence: 0.8,
          evidence: [],
        },
        metadata: { url: "https://b.com" },
      })
    );

    const result = await resolveProduct(storage);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("You have 2 products");
      expect(result.error).toContain("Product A");
      expect(result.error).toContain("Product B");
      expect(result.error).toContain("prod-1");
      expect(result.error).toContain("prod-2");
    }
  });
});
