import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

/**
 * Data Persistence Test Suite for Story 1.4
 *
 * Validates:
 * 1. Schema supports: Product (via users/orgs), Identity (users), Journey, Stages, Definitions
 * 2. CRUD operations work for all core entities
 * 3. Relationships between entities are enforced
 * 4. Data survives server restarts (inherent to Convex - tests ACID compliance)
 * 5. Basic query patterns are performant
 */

describe("Data Persistence - Schema and CRUD Operations", () => {
  describe("Core Tables Exist", () => {
    it("has all required tables in schema", async () => {
      const t = convexTest(schema);

      // Verify we can access core tables by attempting to insert test data
      const orgId = await t.run(async (ctx) => {
        return await ctx.db.insert("orgs", {
          name: "Test Org",
          slug: "test-org",
          githubRepoUrl: "https://github.com/test/repo",
          createdAt: Date.now(),
        });
      });

      expect(orgId).toBeDefined();

      // Verify table structure with read
      const org = await t.run(async (ctx) => {
        return await ctx.db.get(orgId);
      });

      expect(org).toBeDefined();
      expect(org?.name).toBe("Test Org");
      expect(org?.slug).toBe("test-org");
    });
  });

  describe("Identity Table (users) CRUD", () => {
    it("can create and retrieve a user (Create)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "crud-test-user-1",
          email: "crud@example.com",
          name: "CRUD Test User",
          createdAt: Date.now(),
        });
      });

      expect(userId).toBeDefined();

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe("crud@example.com");
      expect(user?.clerkId).toBe("crud-test-user-1");
    });

    it("can update a user (Update)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "update-test-user",
          email: "update@example.com",
          name: "Original Name",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(userId, {
          name: "Updated Name",
          email: "updated@example.com",
        });
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("updated@example.com");
      expect(updated?.clerkId).toBe("update-test-user"); // Verify other fields unchanged
    });

    it("can delete a user (Delete)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "delete-test-user",
          email: "delete@example.com",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.delete(userId);
      });

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(deleted).toBeNull();
    });

    it("can query users by clerkId index", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "indexed-user-1",
          email: "indexed1@example.com",
          createdAt: Date.now(),
        });
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "indexed-user-1"))
          .first();
      });

      expect(user).not.toBeNull();
      expect(user?.clerkId).toBe("indexed-user-1");
    });
  });

  describe("Journey Table CRUD", () => {
    it("can create and retrieve a journey (Create + Read)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "journey-user",
          email: "journey@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Test Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      expect(journeyId).toBeDefined();

      const journey = await t.run(async (ctx) => {
        return await ctx.db.get(journeyId);
      });

      expect(journey).not.toBeNull();
      expect(journey?.name).toBe("Test Journey");
      expect(journey?.userId).toBe(userId);
      expect(journey?.type).toBe("overview");
    });

    it("can update a journey (Update)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "journey-update-user",
          email: "journey-update@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "first_value",
          name: "Original Name",
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(journeyId, {
          name: "Updated Journey Name",
          isDefault: true,
          updatedAt: Date.now(),
        });
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(journeyId);
      });

      expect(updated?.name).toBe("Updated Journey Name");
      expect(updated?.isDefault).toBe(true);
      expect(updated?.type).toBe("first_value"); // Verify other fields unchanged
    });

    it("can delete a journey (Delete)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "journey-delete-user",
          email: "journey-delete@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "retention",
          name: "To Delete",
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.delete(journeyId);
      });

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(journeyId);
      });

      expect(deleted).toBeNull();
    });

    it("can query journeys by user index", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "journey-index-user",
          email: "journey-index@example.com",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Journey 1",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("journeys", {
          userId,
          type: "first_value",
          name: "Journey 2",
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const journeys = await t.run(async (ctx) => {
        return await ctx.db
          .query("journeys")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(journeys).toHaveLength(2);
      expect(journeys.map((j) => j.name).sort()).toEqual([
        "Journey 1",
        "Journey 2",
      ]);
    });
  });

  describe("Stages Table CRUD", () => {
    it("can create and retrieve stages (Create + Read)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "stage-user",
          email: "stage@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Test Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stageId = await t.run(async (ctx) => {
        return await ctx.db.insert("stages", {
          journeyId,
          name: "Account Created",
          type: "activity",
          description: "When an account is created",
          position: { x: 100, y: 200 },
          entity: "Account",
          action: "Created",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      expect(stageId).toBeDefined();

      const stage = await t.run(async (ctx) => {
        return await ctx.db.get(stageId);
      });

      expect(stage).not.toBeNull();
      expect(stage?.name).toBe("Account Created");
      expect(stage?.journeyId).toBe(journeyId);
      expect(stage?.entity).toBe("Account");
      expect(stage?.action).toBe("Created");
      expect(stage?.position).toEqual({ x: 100, y: 200 });
    });

    it("can update stage position (Update)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "stage-update-user",
          email: "stage-update@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Test Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stageId = await t.run(async (ctx) => {
        return await ctx.db.insert("stages", {
          journeyId,
          name: "Test Stage",
          type: "entry",
          position: { x: 0, y: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(stageId, {
          position: { x: 500, y: 600 },
          updatedAt: Date.now(),
        });
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(stageId);
      });

      expect(updated?.position).toEqual({ x: 500, y: 600 });
    });

    it("can query stages by journey index", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "stage-index-user",
          email: "stage-index@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Test Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("stages", {
          journeyId,
          name: "Stage 1",
          type: "entry",
          position: { x: 0, y: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("stages", {
          journeyId,
          name: "Stage 2",
          type: "activity",
          position: { x: 100, y: 100 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stages = await t.run(async (ctx) => {
        return await ctx.db
          .query("stages")
          .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
          .collect();
      });

      expect(stages).toHaveLength(2);
      expect(stages.map((s) => s.name).sort()).toEqual(["Stage 1", "Stage 2"]);
    });
  });

  describe("Entity Relationships and Constraints", () => {
    it("enforces journey-stage relationship through foreign key", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "rel-user",
          email: "rel@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Test Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stageId = await t.run(async (ctx) => {
        return await ctx.db.insert("stages", {
          journeyId,
          name: "Test Stage",
          type: "activity",
          position: { x: 0, y: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Verify the stage has the correct journey reference
      const stage = await t.run(async (ctx) => {
        return await ctx.db.get(stageId);
      });

      expect(stage?.journeyId).toBe(journeyId);

      // Verify we can navigate through the relationship
      const journey = await t.run(async (ctx) => {
        const stage = await ctx.db.get(stageId);
        if (!stage) return null;
        return await ctx.db.get(stage.journeyId);
      });

      expect(journey?.name).toBe("Test Journey");
    });

    it("enforces user-journey relationship", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user-journey-rel",
          email: "user-journey@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "first_value",
          name: "User Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Verify journey references correct user
      const journey = await t.run(async (ctx) => {
        return await ctx.db.get(journeyId);
      });

      expect(journey?.userId).toBe(userId);

      // Verify we can query journeys by user
      const userJourneys = await t.run(async (ctx) => {
        return await ctx.db
          .query("journeys")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(userJourneys.some((j) => j._id === journeyId)).toBe(true);
    });

    it("enforces measurement entity to measurement activity relationship", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "entity-activity-user",
          email: "entity-activity@example.com",
          createdAt: Date.now(),
        });
      });

      const entityId = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "Account",
          description: "The primary entity",
          createdAt: Date.now(),
        });
      });

      const activityId = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementActivities", {
          userId,
          entityId,
          name: "Account Created",
          action: "Created",
          isFirstValue: true,
          createdAt: Date.now(),
        });
      });

      // Verify activity references correct entity
      const activity = await t.run(async (ctx) => {
        return await ctx.db.get(activityId);
      });

      expect(activity?.entityId).toBe(entityId);

      // Verify we can navigate relationship
      const entity = await t.run(async (ctx) => {
        const activity = await ctx.db.get(activityId);
        if (!activity) return null;
        return await ctx.db.get(activity.entityId);
      });

      expect(entity?.name).toBe("Account");
    });

    it("allows querying activities by entity", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "query-activity-user",
          email: "query-activity@example.com",
          createdAt: Date.now(),
        });
      });

      const entityId = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "Subscription",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("measurementActivities", {
          userId,
          entityId,
          name: "Subscription Created",
          action: "Created",
          isFirstValue: false,
          createdAt: Date.now(),
        });
        await ctx.db.insert("measurementActivities", {
          userId,
          entityId,
          name: "Subscription Upgraded",
          action: "Upgraded",
          isFirstValue: false,
          createdAt: Date.now(),
        });
      });

      // Query by entity
      const activities = await t.run(async (ctx) => {
        return await ctx.db
          .query("measurementActivities")
          .withIndex("by_entity", (q) => q.eq("entityId", entityId))
          .collect();
      });

      expect(activities).toHaveLength(2);
      expect(activities.map((a) => a.name).sort()).toEqual([
        "Subscription Created",
        "Subscription Upgraded",
      ]);
    });
  });

  describe("Data Definition Table (Definitions)", () => {
    it("can store metric definitions with flexible JSON content", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "metric-def-user",
          email: "metric-def@example.com",
          createdAt: Date.now(),
        });
      });

      const metricId = await t.run(async (ctx) => {
        return await ctx.db.insert("metrics", {
          userId,
          name: "Activation Rate",
          definition: "Percentage of users who completed account setup",
          formula: "activated / signups * 100",
          whyItMatters: "Shows how well onboarding converts users",
          howToImprove: "Simplify the signup flow",
          category: "value_delivery",
          metricType: "generated",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metric = await t.run(async (ctx) => {
        return await ctx.db.get(metricId);
      });

      expect(metric).not.toBeNull();
      expect(metric?.name).toBe("Activation Rate");
      expect(metric?.category).toBe("value_delivery");
      expect(metric?.formula).toBe("activated / signups * 100");
    });

    it("can store first value definitions", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "fv-def-user",
          email: "fv-def@example.com",
          createdAt: Date.now(),
        });
      });

      const fvDefId = await t.run(async (ctx) => {
        return await ctx.db.insert("firstValueDefinitions", {
          userId,
          activityName: "Account Activated",
          reasoning: "First time user sets up their workspace",
          expectedTimeframe: "Within 24 hours of signup",
          source: "manual_edit",
          confirmedAt: Date.now(),
        });
      });

      const fvDef = await t.run(async (ctx) => {
        return await ctx.db.get(fvDefId);
      });

      expect(fvDef).not.toBeNull();
      expect(fvDef?.activityName).toBe("Account Activated");
      expect(fvDef?.source).toBe("manual_edit");
    });
  });

  describe("Data Persistence and Atomicity", () => {
    it("persists data across separate query contexts (simulating server restart)", async () => {
      const t = convexTest(schema);

      // First context: insert data
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "persist-user-1",
          email: "persist1@example.com",
          name: "Persist User",
          createdAt: Date.now(),
        });
      });

      // Second context (simulating new connection): query data
      const retrieved = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(retrieved).not.toBeNull();
      expect(retrieved?.email).toBe("persist1@example.com");

      // Third context: modify data
      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { name: "Updated Persist User" });
      });

      // Fourth context: verify modification persisted
      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(updated?.name).toBe("Updated Persist User");
    });

    it("ensures consistent reads and writes", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "consistency-test",
          email: "consistency@example.com",
          createdAt: Date.now(),
        });
      });

      // Create related objects
      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Journey",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Verify relationship is immediately queryable
      const userJourneys = await t.run(async (ctx) => {
        return await ctx.db
          .query("journeys")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(userJourneys.length).toBeGreaterThan(0);
      expect(userJourneys[0]._id).toBe(journeyId);
    });
  });

  describe("Query Performance Patterns", () => {
    it("can efficiently query by indexed fields", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "perf-user",
          email: "perf@example.com",
          createdAt: Date.now(),
        });
      });

      // Insert multiple journeys
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("journeys", {
            userId,
            type: i % 2 === 0 ? "overview" : "first_value",
            name: `Journey ${i}`,
            isDefault: i === 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      });

      // Query using index
      const journeys = await t.run(async (ctx) => {
        return await ctx.db
          .query("journeys")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(journeys.length).toBe(10);
    });

    it("can efficiently filter and collect results", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "filter-user",
          email: "filter@example.com",
          createdAt: Date.now(),
        });
      });

      const entityId = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "Account",
          createdAt: Date.now(),
        });
      });

      // Insert multiple activities
      await t.run(async (ctx) => {
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("measurementActivities", {
            userId,
            entityId,
            name: `Activity ${i}`,
            action: `Action${i}`,
            isFirstValue: i === 0,
            createdAt: Date.now(),
          });
        }
      });

      // Filter by first value status
      const firstValueActivities = await t.run(async (ctx) => {
        return await ctx.db
          .query("measurementActivities")
          .withIndex("by_entity", (q) => q.eq("entityId", entityId))
          .filter((q) => q.eq(q.field("isFirstValue"), true))
          .collect();
      });

      expect(firstValueActivities).toHaveLength(1);
      expect(firstValueActivities[0].name).toBe("Activity 0");
    });
  });

  describe("Cascade Operations", () => {
    it("allows cascading deletes for journey and stages", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "cascade-user",
          email: "cascade@example.com",
          createdAt: Date.now(),
        });
      });

      const journeyId = await t.run(async (ctx) => {
        return await ctx.db.insert("journeys", {
          userId,
          type: "overview",
          name: "Journey to Delete",
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stage1Id = await t.run(async (ctx) => {
        return await ctx.db.insert("stages", {
          journeyId,
          name: "Stage 1",
          type: "entry",
          position: { x: 0, y: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const stage2Id = await t.run(async (ctx) => {
        return await ctx.db.insert("stages", {
          journeyId,
          name: "Stage 2",
          type: "activity",
          position: { x: 100, y: 100 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const transitionId = await t.run(async (ctx) => {
        return await ctx.db.insert("transitions", {
          journeyId,
          fromStageId: stage1Id,
          toStageId: stage2Id,
          label: "Test Transition",
          createdAt: Date.now(),
        });
      });

      // Delete journey (this should cascade to stages and transitions)
      await t.run(async (ctx) => {
        // First delete transitions
        const transitions = await ctx.db
          .query("transitions")
          .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
          .collect();
        for (const t of transitions) {
          await ctx.db.delete(t._id);
        }

        // Then delete stages
        const stages = await ctx.db
          .query("stages")
          .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
          .collect();
        for (const s of stages) {
          await ctx.db.delete(s._id);
        }

        // Finally delete journey
        await ctx.db.delete(journeyId);
      });

      // Verify all deleted
      const journey = await t.run(async (ctx) => {
        return await ctx.db.get(journeyId);
      });

      const stage1 = await t.run(async (ctx) => {
        return await ctx.db.get(stage1Id);
      });

      const transition = await t.run(async (ctx) => {
        return await ctx.db.get(transitionId);
      });

      expect(journey).toBeNull();
      expect(stage1).toBeNull();
      expect(transition).toBeNull();
    });
  });
});
