import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

function setupUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId,
      email: "test@example.com",
      name: "Test User",
      createdAt: Date.now(),
    });
  });
}

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

describe("products", () => {
  it("can create a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, {
      name: "Acme SaaS",
      url: "https://acme.io",
    });

    expect(productId).toBeDefined();

    const product = await t.run(async (ctx) => ctx.db.get(productId));
    expect(product).toMatchObject({
      name: "Acme SaaS",
      url: "https://acme.io",
    });
    expect(product?.createdAt).toBeDefined();
    expect(product?.updatedAt).toBeDefined();
  });

  it("can list products for authenticated user", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    await asUser.mutation(api.products.create, { name: "Product A", url: "https://a.io" });
    await asUser.mutation(api.products.create, { name: "Product B", url: "https://b.io" });

    const products = await asUser.query(api.products.list, {});
    expect(products).toHaveLength(2);
  });

  it("cannot see another user's products", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);
    await asUser.mutation(api.products.create, { name: "Secret", url: "https://secret.io" });

    await setupUser(t, "other-clerk-id");
    const asOther = authenticatedUser(t, "other-clerk-id");

    const products = await asOther.query(api.products.list, {});
    expect(products).toHaveLength(0);
  });

  it("can get a product by id with ownership check", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Mine", url: "https://mine.io" });
    const product = await asUser.query(api.products.get, { id: productId });
    expect(product?.name).toBe("Mine");
  });

  it("returns null when getting another user's product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);
    const productId = await asUser.mutation(api.products.create, { name: "Secret", url: "https://s.io" });

    await setupUser(t, "other-clerk-id");
    const asOther = authenticatedUser(t, "other-clerk-id");

    const product = await asOther.query(api.products.get, { id: productId });
    expect(product).toBeNull();
  });

  it("can delete a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Delete Me", url: "https://del.io" });
    await asUser.mutation(api.products.remove, { id: productId });

    const product = await asUser.query(api.products.get, { id: productId });
    expect(product).toBeNull();
  });

  it("can update a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Old Name", url: "https://old.io" });
    await asUser.mutation(api.products.update, { id: productId, name: "New Name", url: "https://new.io" });

    const product = await asUser.query(api.products.get, { id: productId });
    expect(product?.name).toBe("New Name");
    expect(product?.url).toBe("https://new.io");
  });

  it("returns empty list for unauthenticated user", async () => {
    const t = convexTest(schema);
    const products = await t.query(api.products.list, {});
    expect(products).toEqual([]);
  });
});
