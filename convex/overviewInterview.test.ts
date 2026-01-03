import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create a test journey with authenticated user
async function setupJourney(t: ReturnType<typeof convexTest>) {
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

  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "overview",
    name: "Test Journey",
  });

  return { userId, asUser, journeyId };
}

describe("overviewInterview", () => {
  describe("addActivity", () => {
    it("validates format and rejects non-past-tense action", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // "Create" is not past tense - should fail
      const result = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Create",
        slot: "account_creation",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("error:");
      expect(result.message).toContain("past tense");
    });

    it("rejects vague terms in entity", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // "Onboarding" is a vague term - should fail
      const result = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Onboarding",
        action: "Completed",
        slot: "activation",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("error:");
      expect(result.message).toContain("vague");
    });

    it("detects duplicate activities", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // Add first activity
      const first = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      expect(first.success).toBe(true);

      // Try to add the same activity again
      const duplicate = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      expect(duplicate.success).toBe(false);
      expect(duplicate.message).toContain("matches existing");
    });

    it("creates stage with correct fields", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      const result = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Profile",
        action: "Completed",
        slot: "activation",
        description: "User completes their profile",
      });

      expect(result.success).toBe(true);
      expect(result.stageId).toBeDefined();

      // Verify the stage was created with correct fields
      const activities = await asUser.query(api.overviewInterview.getActivitiesBySlot, {
        journeyId,
      });

      expect(activities.activation).toHaveLength(1);
      const stage = activities.activation[0];
      expect(stage.entity).toBe("Profile");
      expect(stage.action).toBe("Completed");
      expect(stage.lifecycleSlot).toBe("activation");
      expect(stage.description).toBe("User completes their profile");
      expect(stage.position).toBeDefined();
      expect(stage.position.x).toBeGreaterThan(0);
      expect(stage.position.y).toBeGreaterThan(0);
    });

    it("accepts irregular past tense verbs", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // "Sent" is irregular past tense - should succeed
      const result = await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Email",
        action: "Sent",
        slot: "core_usage",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("checkCompletionStatus", () => {
    it("returns canComplete false for empty journey", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      const status = await asUser.query(api.overviewInterview.checkCompletionStatus, {
        journeyId,
      });

      expect(status.canComplete).toBe(false);
      expect(status.missingRequired).toEqual([
        "account_creation",
        "activation",
        "core_usage",
      ]);
      expect(status.filledSlots).toEqual([]);
    });

    it("returns canComplete true when all required slots are filled", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // Add activities to all required slots
      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Profile",
        action: "Completed",
        slot: "activation",
      });

      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Report",
        action: "Generated",
        slot: "core_usage",
      });

      const status = await asUser.query(api.overviewInterview.checkCompletionStatus, {
        journeyId,
      });

      expect(status.canComplete).toBe(true);
      expect(status.missingRequired).toEqual([]);
      expect(status.filledSlots).toContain("account_creation");
      expect(status.filledSlots).toContain("activation");
      expect(status.filledSlots).toContain("core_usage");
    });

    it("tracks partial completion correctly", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // Add activity to one required slot
      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      const status = await asUser.query(api.overviewInterview.checkCompletionStatus, {
        journeyId,
      });

      expect(status.canComplete).toBe(false);
      expect(status.filledSlots).toContain("account_creation");
      expect(status.missingRequired).toEqual(["activation", "core_usage"]);
    });
  });

  describe("getActivitiesBySlot", () => {
    it("groups activities correctly by slot", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // Add activities to different slots
      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Email",
        action: "Verified",
        slot: "account_creation",
      });

      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Profile",
        action: "Completed",
        slot: "activation",
      });

      const bySlot = await asUser.query(api.overviewInterview.getActivitiesBySlot, {
        journeyId,
      });

      expect(bySlot.account_creation).toHaveLength(2);
      expect(bySlot.activation).toHaveLength(1);
      expect(bySlot.core_usage).toHaveLength(0);
      expect(bySlot.revenue).toHaveLength(0);
      expect(bySlot.churn).toHaveLength(0);
    });
  });

  describe("removeActivity", () => {
    it("removes an existing activity", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      // Add an activity
      await asUser.mutation(api.overviewInterview.addActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
        slot: "account_creation",
      });

      // Verify it exists
      let activities = await asUser.query(api.overviewInterview.getActivitiesBySlot, {
        journeyId,
      });
      expect(activities.account_creation).toHaveLength(1);

      // Remove it
      const result = await asUser.mutation(api.overviewInterview.removeActivity, {
        journeyId,
        entity: "Account",
        action: "Created",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Removed");

      // Verify it's gone
      activities = await asUser.query(api.overviewInterview.getActivitiesBySlot, {
        journeyId,
      });
      expect(activities.account_creation).toHaveLength(0);
    });

    it("returns failure for non-existent activity", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupJourney(t);

      const result = await asUser.mutation(api.overviewInterview.removeActivity, {
        journeyId,
        entity: "NonExistent",
        action: "Created",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });
});
