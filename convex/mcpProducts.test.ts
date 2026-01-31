import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

function setupUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "mcp-clerk-id",
      email: "mcp@example.com",
      name: "MCP User",
      createdAt: Date.now(),
    });
  });
}

describe("mcpProducts", () => {
  it("can create a product via MCP", async () => {
    const t = convexTest(schema);
    const userId = await setupUser(t);

    const result = await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Acme",
      url: "https://acme.io",
    });

    expect(result.name).toBe("Acme");
    expect(result.url).toBe("https://acme.io");
    expect(result.productId).toBeDefined();
  });

  it("rejects creation for non-existent user", async () => {
    const t = convexTest(schema);
    // Create a user, get a valid-format ID, then delete it
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        clerkId: "temp",
        createdAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.mutation(api.mcpProducts.create, {
        userId,
        name: "Acme",
        url: "https://acme.io",
      })
    ).rejects.toThrow("User not found");
  });

  it("can list products for a user", async () => {
    const t = convexTest(schema);
    const userId = await setupUser(t);

    await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Acme",
      url: "https://acme.io",
    });
    await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Beta",
      url: "https://beta.io",
    });

    const products = await t.query(api.mcpProducts.list, { userId });
    expect(products).toHaveLength(2);
  });

  it("can scan a product", async () => {
    const t = convexTest(schema);
    const userId = await setupUser(t);

    const { productId } = await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Acme",
      url: "https://acme.io",
    });

    const result = await t.mutation(api.mcpProducts.scanProduct, {
      userId,
      productId,
    });

    expect(result.message).toContain("Scan scheduled");
  });

  it("rejects scan for wrong user", async () => {
    const t = convexTest(schema);
    const userId = await setupUser(t);

    const { productId } = await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Acme",
      url: "https://acme.io",
    });

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-clerk-id",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.mcpProducts.scanProduct, {
        userId: otherUserId,
        productId,
      })
    ).rejects.toThrow("Product not found");
  });

  it("returns null scan status for unscanned product", async () => {
    const t = convexTest(schema);
    const userId = await setupUser(t);

    const { productId } = await t.mutation(api.mcpProducts.create, {
      userId,
      name: "Acme",
      url: "https://acme.io",
    });

    const status = await t.query(api.mcpProducts.getScanStatus, {
      userId,
      productId,
    });

    expect(status).toBeNull();
  });
});
