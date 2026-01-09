import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user with entity
async function setupUserWithEntity(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  // Create an entity to attach properties to
  const entityId = await t.run(async (ctx) => {
    return await ctx.db.insert("measurementEntities", {
      userId,
      name: "Account",
      createdAt: Date.now(),
    });
  });

  return { userId, asUser, entityId };
}

describe("measurementProperties", () => {
  describe("listByEntity", () => {
    it("returns empty array for entity with no properties", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toEqual([]);
    });

    it("returns properties for specified entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId, userId } = await setupUserWithEntity(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("measurementProperties", {
          userId,
          entityId,
          name: "created_at",
          dataType: "timestamp",
          isRequired: true,
          createdAt: Date.now(),
        });
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe("created_at");
    });
  });

  describe("create", () => {
    it("creates property for entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "plan_type",
        dataType: "string",
        description: "Current plan",
        isRequired: false,
      });

      expect(propertyId).toBeDefined();

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe("plan_type");
      expect(properties[0].dataType).toBe("string");
      expect(properties[0].isRequired).toBe(false);
      expect(properties[0].suggestedFrom).toBe("manual");
    });

    it("rejects duplicate property names within same entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      await expect(
        asUser.mutation(api.measurementProperties.create, {
          entityId,
          name: "created_at",
          dataType: "string",
          isRequired: false,
        })
      ).rejects.toThrow("already exists");
    });

    it("allows same property name on different entities", async () => {
      const t = convexTest(schema);
      const { asUser, entityId, userId } = await setupUserWithEntity(t);

      // Create a second entity
      const entityId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "User",
          createdAt: Date.now(),
        });
      });

      await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      // Should not throw - different entity
      const propertyId2 = await asUser.mutation(api.measurementProperties.create, {
        entityId: entityId2,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      expect(propertyId2).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates property fields", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "plan",
        dataType: "string",
        isRequired: false,
      });

      await asUser.mutation(api.measurementProperties.update, {
        id: propertyId,
        name: "plan_type",
        description: "Updated description",
        isRequired: true,
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties[0].name).toBe("plan_type");
      expect(properties[0].description).toBe("Updated description");
      expect(properties[0].isRequired).toBe(true);
    });
  });

  describe("remove", () => {
    it("removes property", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "test_prop",
        dataType: "string",
        isRequired: false,
      });

      await asUser.mutation(api.measurementProperties.remove, {
        id: propertyId,
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(0);
    });
  });

  describe("createFromTemplate", () => {
    it("creates property with template suggestedFrom", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        description: "When created",
        isRequired: true,
        suggestedFrom: "template",
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties[0].suggestedFrom).toBe("template");
    });
  });
});
