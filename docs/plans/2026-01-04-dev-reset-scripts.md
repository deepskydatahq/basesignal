# Dev Reset Scripts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create bun scripts to reset user data during development by email, with safety checks to prevent running against production.

**Architecture:** Thin bun CLI scripts call a Convex internal mutation for cascade deletion, plus Clerk API for user removal. Safety module validates environment before any destructive operation.

**Tech Stack:** Bun, Convex (internalMutation), Clerk Backend API (@clerk/backend)

---

## Task 1: Install @clerk/backend dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `npm install @clerk/backend`

**Step 2: Verify installation**

Run: `npm list @clerk/backend`
Expected: Shows @clerk/backend version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @clerk/backend for dev reset scripts"
```

---

## Task 2: Create safety check module

**Files:**
- Create: `scripts/lib/safety.ts`
- Create: `scripts/lib/safety.test.ts`

**Step 1: Write the failing test**

Create `scripts/lib/safety.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateDevEnvironment } from "./safety";

describe("validateDevEnvironment", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if CONVEX_URL looks like production", () => {
    process.env.VITE_CONVEX_URL = "https://prod-deployment.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).toThrow("production");
  });

  it("throws if CLERK_SECRET_KEY is live key", () => {
    process.env.VITE_CONVEX_URL = "https://dev-deployment.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_live_xxx";

    expect(() => validateDevEnvironment()).toThrow("production Clerk");
  });

  it("passes for dev Convex URL and test Clerk key", () => {
    process.env.VITE_CONVEX_URL = "https://<your-deployment>.convex.cloud";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).not.toThrow();
  });

  it("passes for localhost Convex URL", () => {
    process.env.VITE_CONVEX_URL = "http://localhost:3210";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";

    expect(() => validateDevEnvironment()).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- scripts/lib/safety.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `scripts/lib/safety.ts`:

```typescript
export function validateDevEnvironment(): void {
  const convexUrl = process.env.VITE_CONVEX_URL || "";
  const clerkKey = process.env.CLERK_SECRET_KEY || "";

  // Check Convex URL - block if it contains "prod" (common convention)
  if (convexUrl.includes("prod")) {
    throw new Error(
      `Refusing to run against production Convex: ${convexUrl}\n` +
      "This script only runs in development environments."
    );
  }

  // Check Clerk key - must be test key, not live
  if (clerkKey.startsWith("sk_live_")) {
    throw new Error(
      "Refusing to run with production Clerk key.\n" +
      "CLERK_SECRET_KEY must start with 'sk_test_' for dev scripts."
    );
  }

  // Require both env vars to be set
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL environment variable is required");
  }

  if (!clerkKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- scripts/lib/safety.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scripts/lib/safety.ts scripts/lib/safety.test.ts
git commit -m "feat: add safety check module for dev scripts"
```

---

## Task 3: Create Convex cascade delete mutation

**Files:**
- Create: `convex/devReset.ts`
- Create: `convex/devReset.test.ts`

**Step 1: Write the failing test**

Create `convex/devReset.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

describe("devReset.deleteUserData", () => {
  it("deletes user and all related data", async () => {
    const t = convexTest(schema);

    // Create a user with full data hierarchy
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        clerkId: "clerk_test_123",
        createdAt: Date.now(),
      });

      // Create setup progress
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });

      // Create journey
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Test Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create stage
      const stageId = await ctx.db.insert("stages", {
        journeyId,
        name: "Test Stage",
        type: "entry",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create another stage for transition
      const stage2Id = await ctx.db.insert("stages", {
        journeyId,
        name: "Test Stage 2",
        type: "activity",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create transition
      await ctx.db.insert("transitions", {
        journeyId,
        fromStageId: stageId,
        toStageId: stage2Id,
        createdAt: Date.now(),
      });

      // Create interview session
      const sessionId = await ctx.db.insert("interviewSessions", {
        journeyId,
        status: "active",
        startedAt: Date.now(),
      });

      // Create interview message
      await ctx.db.insert("interviewMessages", {
        sessionId,
        role: "user",
        content: "Test message",
        createdAt: Date.now(),
      });

      return userId;
    });

    // Run the delete mutation
    const result = await t.mutation(internal.devReset.deleteUserData, { userId });

    // Verify counts
    expect(result.deletedCounts.interviewMessages).toBe(1);
    expect(result.deletedCounts.interviewSessions).toBe(1);
    expect(result.deletedCounts.transitions).toBe(1);
    expect(result.deletedCounts.stages).toBe(2);
    expect(result.deletedCounts.journeys).toBe(1);
    expect(result.deletedCounts.setupProgress).toBe(1);
    expect(result.deletedCounts.users).toBe(1);

    // Verify user is gone
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      expect(user).toBeNull();
    });
  });

  it("returns zero counts when user has no data", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "empty@example.com",
        clerkId: "clerk_empty",
        createdAt: Date.now(),
      });
    });

    const result = await t.mutation(internal.devReset.deleteUserData, { userId });

    expect(result.deletedCounts.users).toBe(1);
    expect(result.deletedCounts.journeys).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/devReset.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `convex/devReset.ts`:

```typescript
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteUserData = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const deletedCounts = {
      interviewMessages: 0,
      interviewSessions: 0,
      transitions: 0,
      stages: 0,
      journeys: 0,
      setupProgress: 0,
      users: 0,
    };

    // Get all journeys for this user
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // For each journey, delete all related data
    for (const journey of journeys) {
      // Get all interview sessions for this journey
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      // Delete interview messages for each session
      for (const session of sessions) {
        const messages = await ctx.db
          .query("interviewMessages")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
          deletedCounts.interviewMessages++;
        }

        await ctx.db.delete(session._id);
        deletedCounts.interviewSessions++;
      }

      // Delete transitions
      const transitions = await ctx.db
        .query("transitions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const transition of transitions) {
        await ctx.db.delete(transition._id);
        deletedCounts.transitions++;
      }

      // Delete stages
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const stage of stages) {
        await ctx.db.delete(stage._id);
        deletedCounts.stages++;
      }

      // Delete the journey
      await ctx.db.delete(journey._id);
      deletedCounts.journeys++;
    }

    // Delete setup progress
    const setupProgress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const progress of setupProgress) {
      await ctx.db.delete(progress._id);
      deletedCounts.setupProgress++;
    }

    // Delete the user
    await ctx.db.delete(userId);
    deletedCounts.users++;

    return { deletedCounts };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/devReset.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add convex/devReset.ts convex/devReset.test.ts
git commit -m "feat: add Convex cascade delete mutation for dev reset"
```

---

## Task 4: Create Convex client helper

**Files:**
- Create: `scripts/lib/convex-client.ts`

**Step 1: Write the implementation**

Create `scripts/lib/convex-client.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function createConvexClient(): ConvexHttpClient {
  const url = process.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL environment variable is required");
  }
  return new ConvexHttpClient(url);
}

export async function findUserByEmail(
  client: ConvexHttpClient,
  email: string
): Promise<{ _id: Id<"users">; email: string; clerkId?: string; createdAt?: number } | null> {
  // Use a query to find user by email
  const users = await client.query(api.users.getByEmail, { email });
  return users;
}

export { api, internal };
export type { Id };
```

**Step 2: Commit**

```bash
git add scripts/lib/convex-client.ts
git commit -m "feat: add Convex client helper for scripts"
```

---

## Task 5: Add getByEmail query to users.ts

**Files:**
- Modify: `convex/users.ts`

**Step 1: Check existing users.ts exports**

Read `convex/users.ts` to see current structure.

**Step 2: Add getByEmail query**

Add to `convex/users.ts`:

```typescript
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
  },
});
```

**Step 3: Run tests to verify nothing broke**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add convex/users.ts
git commit -m "feat: add getByEmail query for dev reset scripts"
```

---

## Task 6: Create Clerk client helper

**Files:**
- Create: `scripts/lib/clerk-client.ts`

**Step 1: Write the implementation**

Create `scripts/lib/clerk-client.ts`:

```typescript
import { createClerkClient } from "@clerk/backend";

export function createClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }
  return createClerkClient({ secretKey });
}

export async function findClerkUserByEmail(email: string): Promise<string | null> {
  const clerk = createClerk();
  const users = await clerk.users.getUserList({
    emailAddress: [email],
  });

  if (users.data.length === 0) {
    return null;
  }

  return users.data[0].id;
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const clerk = createClerk();
  await clerk.users.deleteUser(clerkUserId);
}
```

**Step 2: Commit**

```bash
git add scripts/lib/clerk-client.ts
git commit -m "feat: add Clerk client helper for dev reset scripts"
```

---

## Task 7: Create full reset module

**Files:**
- Create: `scripts/lib/reset/full.ts`

**Step 1: Write the implementation**

Create `scripts/lib/reset/full.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { deleteClerkUser } from "../clerk-client";

export interface ResetResult {
  convexDeleted: {
    interviewMessages: number;
    interviewSessions: number;
    transitions: number;
    stages: number;
    journeys: number;
    setupProgress: number;
    users: number;
  };
  clerkDeleted: boolean;
}

export async function fullReset(
  client: ConvexHttpClient,
  userId: Id<"users">,
  clerkId: string | undefined
): Promise<ResetResult> {
  // Delete from Convex first
  console.log("🗑️  Deleting Convex data...");
  const convexResult = await client.mutation(internal.devReset.deleteUserData, { userId });

  const counts = convexResult.deletedCounts;
  console.log(`   - ${counts.interviewMessages} interview messages`);
  console.log(`   - ${counts.interviewSessions} interview sessions`);
  console.log(`   - ${counts.transitions} transitions`);
  console.log(`   - ${counts.stages} stages`);
  console.log(`   - ${counts.journeys} journeys`);
  console.log(`   - ${counts.setupProgress} setup progress`);
  console.log(`   - ${counts.users} user record`);

  // Delete from Clerk if we have a clerkId
  let clerkDeleted = false;
  if (clerkId) {
    console.log("🗑️  Deleting from Clerk...");
    try {
      await deleteClerkUser(clerkId);
      clerkDeleted = true;
    } catch (error) {
      console.error("   Warning: Failed to delete from Clerk:", error);
    }
  } else {
    console.log("⚠️  No Clerk ID found, skipping Clerk deletion");
  }

  return {
    convexDeleted: counts,
    clerkDeleted,
  };
}
```

**Step 2: Commit**

```bash
git add scripts/lib/reset/full.ts
git commit -m "feat: add full reset module"
```

---

## Task 8: Create main CLI script

**Files:**
- Create: `scripts/dev-reset.ts`

**Step 1: Write the implementation**

Create `scripts/dev-reset.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Dev Reset Script
 *
 * Resets a user's data in development environment.
 * Usage: bun run scripts/dev-reset.ts user@example.com
 */

import "dotenv/config";
import { validateDevEnvironment } from "./lib/safety";
import { createConvexClient, findUserByEmail } from "./lib/convex-client";
import { fullReset } from "./lib/reset/full";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: bun run scripts/dev-reset.ts <email>");
    console.error("Example: bun run scripts/dev-reset.ts user@example.com");
    process.exit(1);
  }

  // Safety check
  console.log("🔒 Safety check: validating dev environment...");
  try {
    validateDevEnvironment();
    console.log("🔒 Safety check: dev environment confirmed");
  } catch (error) {
    console.error("❌ Safety check failed:", (error as Error).message);
    process.exit(1);
  }

  // Find user
  console.log(`🔍 Finding user: ${email}`);
  const client = createConvexClient();
  const user = await findUserByEmail(client, email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  const createdDate = user.createdAt
    ? new Date(user.createdAt).toISOString().split("T")[0]
    : "unknown";
  console.log(`📋 Found user: ${user._id} (created ${createdDate})`);

  // Perform reset
  const result = await fullReset(client, user._id, user.clerkId);

  if (result.clerkDeleted) {
    console.log("✅ Reset complete - you can now sign up again with this email");
  } else {
    console.log("✅ Convex data reset complete");
    console.log("⚠️  Note: Clerk user was not deleted (no clerkId or deletion failed)");
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
```

**Step 2: Install dotenv for env file loading**

Run: `npm install dotenv`

**Step 3: Commit**

```bash
git add scripts/dev-reset.ts package.json package-lock.json
git commit -m "feat: add main dev-reset CLI script"
```

---

## Task 9: Test end-to-end manually

**Step 1: Generate Convex types**

Run: `npx convex codegen`
Expected: Types generated successfully

**Step 2: Test safety check blocks without env**

Run: `bun run scripts/dev-reset.ts test@example.com`
Expected: Fails with "VITE_CONVEX_URL environment variable is required"

**Step 3: Test with real env (dry run - use non-existent email)**

Run: `bun run scripts/dev-reset.ts nonexistent@example.com`
Expected: "User not found: nonexistent@example.com"

**Step 4: Commit any final fixes if needed**

---

## Task 10: Update design doc with final implementation notes

**Files:**
- Modify: `docs/plans/2026-01-04-dev-reset-scripts-design.md`

**Step 1: Add implementation notes section**

Add to end of design doc:

```markdown
## Implementation Notes

- Uses `dotenv/config` for automatic .env.local loading
- Internal mutation used for cascade delete (testable with convex-test)
- Script exits with code 1 on any failure for scripting integration
```

**Step 2: Commit**

```bash
git add docs/plans/2026-01-04-dev-reset-scripts-design.md
git commit -m "docs: add implementation notes to dev-reset design"
```
