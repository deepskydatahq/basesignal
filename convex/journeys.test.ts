import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("journeys", () => {
  it("can create and retrieve a journey with authenticated user", async () => {
    // Create a convexTest instance with our schema
    const t = convexTest(schema);

    // First create a user in the database
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
      });
    });

    // Simulate an authenticated user with withIdentity
    const asUser = t.withIdentity({
      subject: "test-clerk-id",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-clerk-id",
    });

    // Call the create mutation
    const journeyId = await asUser.mutation(api.journeys.create, {
      type: "overview",
      name: "Test Journey",
    });

    expect(journeyId).toBeDefined();

    // Verify with the get query
    const journey = await asUser.query(api.journeys.get, { id: journeyId });

    expect(journey).not.toBeNull();
    expect(journey?.name).toBe("Test Journey");
    expect(journey?.type).toBe("overview");
    expect(journey?.isDefault).toBe(true); // First journey of type should be default
    expect(journey?.userId).toBe(userId);
  });

  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema);

    // Try to list journeys without authentication
    const journeys = await t.query(api.journeys.listByUser, {});

    expect(journeys).toEqual([]);
  });

  it("can list all journeys for a user", async () => {
    const t = convexTest(schema);

    // Create a user
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "list-test-user",
        email: "list@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "list-test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|list-test-user",
    });

    // Create multiple journeys
    await asUser.mutation(api.journeys.create, {
      type: "overview",
      name: "Overview Journey",
    });
    await asUser.mutation(api.journeys.create, {
      type: "first_value",
      name: "First Value Journey",
    });

    // List all journeys
    const journeys = await asUser.query(api.journeys.listByUser, {});

    expect(journeys).toHaveLength(2);
    expect(journeys.map((j) => j.name).sort()).toEqual([
      "First Value Journey",
      "Overview Journey",
    ]);
  });
});
