import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("measurementPlan.extractFromJourney", () => {
  it("extracts entities and activities from journey stages", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Add stages with entity/action
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Verified",
        type: "activity",
        entity: "Account",
        action: "Verified",
        lifecycleSlot: "activation",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "core_usage",
        position: { x: 200, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const result = await asUser.query(api.measurementPlan.extractFromJourney, {
      journeyId,
    });

    expect(result.entities).toHaveLength(2);

    const account = result.entities.find((e) => e.name === "Account");
    expect(account).toBeDefined();
    expect(account?.activities).toHaveLength(2);
    expect(account?.activities.map((a) => a.action)).toContain("Created");
    expect(account?.activities.map((a) => a.action)).toContain("Verified");

    const project = result.entities.find((e) => e.name === "Project");
    expect(project).toBeDefined();
    expect(project?.activities).toHaveLength(1);
    expect(project?.activities[0].lifecycleSlot).toBe("core_usage");
  });

  it("returns empty when stages have no entity/action", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Add stage without entity/action
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Entry Point",
        type: "entry",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const result = await asUser.query(api.measurementPlan.extractFromJourney, {
      journeyId,
    });

    expect(result.entities).toHaveLength(0);
  });
});

describe("measurementPlan.importFromJourney", () => {
  it("creates measurement entities and activities from selected items", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Add stages
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "core_usage",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourney,
      {
        journeyId,
        selectedEntities: ["Account"],
        selectedActivities: ["Account Created"],
      }
    );

    expect(result.entitiesCreated).toBe(1);
    expect(result.activitiesCreated).toBe(1);

    // Verify the entity was created
    const entities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementEntities").collect();
    });

    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("Account");
    expect(entities[0].suggestedFrom).toBe("overview_interview");

    // Verify the activity was created
    const activities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementActivities").collect();
    });

    expect(activities).toHaveLength(1);
    expect(activities[0].name).toBe("Account Created");
    expect(activities[0].action).toBe("Created");
    expect(activities[0].lifecycleSlot).toBe("account_creation");
    expect(activities[0].suggestedFrom).toBe("overview_interview");
  });

  it("does not create duplicate entities on re-import", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Pre-create the entity
    await t.run(async (ctx) => {
      await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourney,
      {
        journeyId,
        selectedEntities: ["Account"],
        selectedActivities: ["Account Created"],
      }
    );

    // Should not create a new entity (already exists)
    expect(result.entitiesCreated).toBe(0);
    // Should still create the activity
    expect(result.activitiesCreated).toBe(1);

    // Verify only 1 entity exists
    const entities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementEntities").collect();
    });
    expect(entities).toHaveLength(1);
  });

  it("does not create duplicate activities on re-import", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "My Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Pre-create the entity and activity
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Created",
        action: "Created",
        lifecycleSlot: "account_creation",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourney,
      {
        journeyId,
        selectedEntities: ["Account"],
        selectedActivities: ["Account Created"],
      }
    );

    // Should not create duplicates
    expect(result.entitiesCreated).toBe(0);
    expect(result.activitiesCreated).toBe(0);

    // Verify only 1 activity exists
    const activities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementActivities").collect();
    });
    expect(activities).toHaveLength(1);
  });
});

// Helper to set up authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-crud",
      email: "crud-test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user-crud",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user-crud",
  });

  return { userId, asUser };
}

describe("measurementEntities CRUD", () => {
  it("can create and retrieve an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
      description: "User accounts",
      suggestedFrom: "manual",
    });

    expect(entityId).toBeDefined();

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });

    expect(entity).not.toBeNull();
    expect(entity?.name).toBe("Account");
    expect(entity?.description).toBe("User accounts");
  });

  it("can list all entities for a user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });
    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "User",
    });

    const entities = await asUser.query(api.measurementPlan.listEntities, {});

    expect(entities).toHaveLength(2);
    expect(entities.map((e) => e.name).sort()).toEqual(["Account", "User"]);
  });

  it("can update an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.updateEntity, {
      id: entityId,
      name: "Organization",
      description: "Updated description",
    });

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });

    expect(entity?.name).toBe("Organization");
    expect(entity?.description).toBe("Updated description");
  });

  it("can delete an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.deleteEntity, { id: entityId });

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });
    expect(entity).toBeNull();
  });

  it("returns empty list for unauthenticated users", async () => {
    const t = convexTest(schema);
    const entities = await t.query(api.measurementPlan.listEntities, {});
    expect(entities).toEqual([]);
  });

  it("prevents duplicate entity names for same user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await expect(
      asUser.mutation(api.measurementPlan.createEntity, {
        name: "Account",
      })
    ).rejects.toThrow(/already exists/i);
  });
});

describe("measurementActivities CRUD", () => {
  it("can create and retrieve an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        lifecycleSlot: "account_creation",
        isFirstValue: false,
      }
    );

    expect(activityId).toBeDefined();

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.name).toBe("Account Created");
    expect(activity?.action).toBe("Created");
    expect(activity?.lifecycleSlot).toBe("account_creation");
  });

  it("can list activities by entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });
    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: true,
    });

    const activities = await asUser.query(
      api.measurementPlan.listActivitiesByEntity,
      { entityId }
    );

    expect(activities).toHaveLength(2);
  });

  it("can update an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: false,
      }
    );

    await asUser.mutation(api.measurementPlan.updateActivity, {
      id: activityId,
      isFirstValue: true,
      lifecycleSlot: "activation",
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.isFirstValue).toBe(true);
    expect(activity?.lifecycleSlot).toBe("activation");
  });

  it("can delete an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: false,
      }
    );

    await asUser.mutation(api.measurementPlan.deleteActivity, {
      id: activityId,
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });
    expect(activity).toBeNull();
  });

  it("deletes activities when entity is deleted", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    // Delete the entity
    await asUser.mutation(api.measurementPlan.deleteEntity, { id: entityId });

    // Activities should be empty
    const activities = await asUser.query(
      api.measurementPlan.listActivities,
      {}
    );
    expect(activities).toHaveLength(0);
  });
});

describe("setFirstValue", () => {
  it("marks an activity as First Value", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "set-fv-user",
        email: "set-fv@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "set-fv-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|set-fv-user",
    });

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: false,
    });

    await asUser.mutation(api.measurementPlan.setFirstValue, {
      activityId,
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.isFirstValue).toBe(true);
  });

  it("clears previous First Value when setting new one", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "clear-fv-user",
        email: "clear-fv@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "clear-fv-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|clear-fv-user",
    });

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activity1Id = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: true,
    });

    const activity2Id = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: false,
    });

    // Set activity2 as First Value
    await asUser.mutation(api.measurementPlan.setFirstValue, {
      activityId: activity2Id,
    });

    const activity1 = await asUser.query(api.measurementPlan.getActivity, {
      id: activity1Id,
    });
    const activity2 = await asUser.query(api.measurementPlan.getActivity, {
      id: activity2Id,
    });

    expect(activity1?.isFirstValue).toBe(false);
    expect(activity2?.isFirstValue).toBe(true);
  });

  it("throws error for unauthenticated user", async () => {
    const t = convexTest(schema);

    // Create a valid activity ID first
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "unauth-test-user",
        email: "unauth@example.com",
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

    const activityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: false,
        createdAt: Date.now(),
      });
    });

    // Try to call mutation without authentication
    await expect(
      t.mutation(api.measurementPlan.setFirstValue, {
        activityId,
      })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("measurementProperties CRUD", () => {
  it("can create and retrieve a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        description: "Subscription plan type",
        isRequired: true,
      }
    );

    expect(propertyId).toBeDefined();

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });

    expect(property?.name).toBe("plan_type");
    expect(property?.dataType).toBe("string");
    expect(property?.isRequired).toBe(true);
  });

  it("can list properties by entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });
    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "created_at",
      dataType: "timestamp",
      isRequired: true,
    });

    const properties = await asUser.query(
      api.measurementPlan.listPropertiesByEntity,
      { entityId }
    );

    expect(properties).toHaveLength(2);
  });

  it("can update a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: false,
      }
    );

    await asUser.mutation(api.measurementPlan.updateProperty, {
      id: propertyId,
      isRequired: true,
      description: "Updated description",
    });

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });

    expect(property?.isRequired).toBe(true);
    expect(property?.description).toBe("Updated description");
  });

  it("can delete a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: true,
      }
    );

    await asUser.mutation(api.measurementPlan.deleteProperty, {
      id: propertyId,
    });

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });
    expect(property).toBeNull();
  });

  it("prevents duplicate property names within same entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });

    await expect(
      asUser.mutation(api.measurementPlan.createProperty, {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: false,
      })
    ).rejects.toThrow(/already exists/i);
  });
});

describe("getFullPlan", () => {
  it("returns hierarchical plan with entities, activities, and properties", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    // Create entity with activities and properties
    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });

    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});

    expect(plan).toHaveLength(1);
    expect(plan[0].entity.name).toBe("Account");
    expect(plan[0].activities).toHaveLength(1);
    expect(plan[0].activities[0].name).toBe("Account Created");
    expect(plan[0].properties).toHaveLength(1);
    expect(plan[0].properties[0].name).toBe("plan_type");
  });

  it("returns empty array for users with no plan", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});
    expect(plan).toEqual([]);
  });
});

describe("computeJourneyDiff", () => {
  it("identifies new entities and activities from journey", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create a journey with stages
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

    // Add stages to the journey
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "core_usage",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const diff = await asUser.query(api.measurementPlan.computeJourneyDiff, {
      journeyId,
    });

    expect(diff).not.toBeNull();
    expect(diff?.newEntities).toHaveLength(2);
    expect(diff?.newEntities.map((e) => e.name).sort()).toEqual([
      "Account",
      "Project",
    ]);
    expect(diff?.newActivities).toHaveLength(2);
    expect(diff?.existingEntities).toHaveLength(0);
    expect(diff?.existingActivities).toHaveLength(0);
  });

  it("correctly identifies existing entities and activities", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create existing entity and activity in measurement plan
    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });
    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    // Create a journey with stages (some overlap)
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
      // This one already exists
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // This one is new
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Activated",
        type: "activity",
        entity: "Account",
        action: "Activated",
        lifecycleSlot: "activation",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const diff = await asUser.query(api.measurementPlan.computeJourneyDiff, {
      journeyId,
    });

    expect(diff).not.toBeNull();
    expect(diff?.newEntities).toHaveLength(0); // Account already exists
    expect(diff?.existingEntities).toHaveLength(1);
    expect(diff?.existingEntities[0].name).toBe("Account");
    expect(diff?.newActivities).toHaveLength(1);
    expect(diff?.newActivities[0].name).toBe("Account Activated");
    expect(diff?.existingActivities).toHaveLength(1);
    expect(diff?.existingActivities[0].name).toBe("Account Created");
  });

  it("returns null for journeys belonging to other users", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    // Create another user's journey
    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-user",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });

    const otherJourneyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId: otherUserId,
        type: "overview",
        name: "Other Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const diff = await asUser.query(api.measurementPlan.computeJourneyDiff, {
      journeyId: otherJourneyId,
    });

    expect(diff).toBeNull();
  });
});

describe("importFromJourneyIncremental", () => {
  it("creates selected entities and activities from journey", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create a journey with stages
    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "core_usage",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourneyIncremental,
      {
        journeyId,
        selectedEntities: ["Account", "Project"],
        selectedActivities: ["Account Created", "Project Created"],
        selectedProperties: [
          {
            entityName: "Account",
            propertyName: "plan_type",
            dataType: "string",
            isRequired: true,
          },
        ],
      }
    );

    expect(result.entitiesCreated).toBe(2);
    expect(result.activitiesCreated).toBe(2);
    expect(result.propertiesCreated).toBe(1);

    // Verify plan was created
    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});
    expect(plan).toHaveLength(2);

    const accountEntity = plan.find((p) => p.entity.name === "Account");
    expect(accountEntity).toBeDefined();
    expect(accountEntity?.activities).toHaveLength(1);
    expect(accountEntity?.activities[0].name).toBe("Account Created");
    expect(accountEntity?.properties).toHaveLength(1);
    expect(accountEntity?.properties[0].name).toBe("plan_type");
    expect(accountEntity?.entity.suggestedFrom).toBe("first_value");
  });

  it("does not create duplicate entities or activities", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create existing entity and activity
    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });
    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    // Create journey with overlapping content
    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourneyIncremental,
      {
        journeyId,
        selectedEntities: ["Account"],
        selectedActivities: ["Account Created"],
        selectedProperties: [],
      }
    );

    // Nothing should be created as they already exist
    expect(result.entitiesCreated).toBe(0);
    expect(result.activitiesCreated).toBe(0);

    // Verify no duplicates
    const entities = await asUser.query(api.measurementPlan.listEntities, {});
    expect(entities).toHaveLength(1);

    const activities = await asUser.query(
      api.measurementPlan.listActivities,
      {}
    );
    expect(activities).toHaveLength(1);
  });

  it("adds activities to existing entities", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create existing entity (no activities yet)
    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    // Create journey with new activity for existing entity
    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Activated",
        type: "activity",
        entity: "Account",
        action: "Activated",
        lifecycleSlot: "activation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await asUser.mutation(
      api.measurementPlan.importFromJourneyIncremental,
      {
        journeyId,
        selectedEntities: [], // Not selecting entity since it exists
        selectedActivities: ["Account Activated"],
        selectedProperties: [],
      }
    );

    expect(result.entitiesCreated).toBe(0);
    expect(result.activitiesCreated).toBe(1);

    // Verify activity was added to existing entity
    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});
    expect(plan).toHaveLength(1);
    expect(plan[0].entity.name).toBe("Account");
    expect(plan[0].activities).toHaveLength(1);
    expect(plan[0].activities[0].name).toBe("Account Activated");
  });
});

describe("generateFromJourneyInternal", () => {
  it("creates entities and activities from journey stages", async () => {
    const t = convexTest(schema);

    // Create user directly in db (not through auth)
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-internal",
        email: "internal-test@example.com",
        createdAt: Date.now(),
      });
    });

    // Create journey directly in db
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

    // Add stages with entity/action
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Profile Completed",
        type: "activity",
        entity: "Profile",
        action: "Completed",
        lifecycleSlot: "activation",
        position: { x: 200, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Call internal mutation directly (no auth needed)
    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId,
      }
    );

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(2);
    expect(result.activitiesCreated).toBe(2);

    // Verify entities were created
    const entities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementEntities").collect();
    });
    expect(entities).toHaveLength(2);
    expect(entities.map((e) => e.name).sort()).toEqual(["Account", "Profile"]);
    expect(entities[0].suggestedFrom).toBe("overview_interview");

    // Verify activities were created
    const activities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementActivities").collect();
    });
    expect(activities).toHaveLength(2);
    expect(activities.map((a) => a.name).sort()).toEqual([
      "Account Created",
      "Profile Completed",
    ]);
    expect(activities[0].suggestedFrom).toBe("overview_interview");
  });

  it("skips stages without entity/action", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-skip",
        email: "skip-test@example.com",
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

    // Add entry stage without entity/action
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Entry Point",
        type: "entry",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Add one valid stage
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId,
      }
    );

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(1);
    expect(result.activitiesCreated).toBe(1);
  });

  it("does not create duplicate entities (case-insensitive)", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-dup",
        email: "dup-test@example.com",
        createdAt: Date.now(),
      });
    });

    // Pre-create an entity
    await t.run(async (ctx) => {
      await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        suggestedFrom: "manual",
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
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId,
      }
    );

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(0); // Not created (already exists)
    expect(result.activitiesCreated).toBe(1); // Activity is new

    // Verify only 1 entity exists
    const entities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementEntities").collect();
    });
    expect(entities).toHaveLength(1);
  });

  it("does not create duplicate activities (case-insensitive)", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-act-dup",
        email: "act-dup-test@example.com",
        createdAt: Date.now(),
      });
    });

    // Pre-create an entity and activity
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        suggestedFrom: "manual",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Created",
        action: "Created",
        lifecycleSlot: "account_creation",
        isFirstValue: false,
        suggestedFrom: "manual",
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
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId,
      }
    );

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(0);
    expect(result.activitiesCreated).toBe(0); // Not created (already exists)

    // Verify only 1 activity exists
    const activities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementActivities").collect();
    });
    expect(activities).toHaveLength(1);
  });

  it("returns error for non-existent journey", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-err",
        email: "err-test@example.com",
        createdAt: Date.now(),
      });
    });

    // Create a different user's journey
    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-user",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });

    const otherJourneyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId: otherUserId,
        type: "overview",
        name: "Other Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Try to generate from other user's journey
    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId: otherJourneyId,
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Journey not found");
  });

  it("handles multiple activities for same entity", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-multi",
        email: "multi-test@example.com",
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

    // Add multiple activities for the same entity
    await t.run(async (ctx) => {
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Verified",
        type: "activity",
        entity: "Account",
        action: "Verified",
        lifecycleSlot: "activation",
        position: { x: 200, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Upgraded",
        type: "activity",
        entity: "Account",
        action: "Upgraded",
        lifecycleSlot: "revenue",
        position: { x: 300, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.measurementPlan.generateFromJourneyInternal,
      {
        userId,
        journeyId,
      }
    );

    expect(result.success).toBe(true);
    expect(result.entitiesCreated).toBe(1); // Only one entity
    expect(result.activitiesCreated).toBe(3); // Three activities

    // Verify entity was created once
    const entities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementEntities").collect();
    });
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("Account");

    // Verify all activities are linked to the same entity
    const activities = await t.run(async (ctx) => {
      return await ctx.db.query("measurementActivities").collect();
    });
    expect(activities).toHaveLength(3);
    const entityIds = new Set(activities.map((a) => a.entityId));
    expect(entityIds.size).toBe(1); // All linked to same entity
  });
});
