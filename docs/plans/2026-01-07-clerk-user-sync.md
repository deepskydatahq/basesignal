# Clerk User Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Clerk user ID not being stored in Convex by implementing webhook-based sync with client-side fallback.

**Architecture:** Two-layer sync - Clerk webhook as primary (server-side, reliable), improved client-side useAuthGuard as fallback (handles edge cases, retries on failure).

**Tech Stack:** Convex HTTP endpoints, Svix webhook verification, React hooks with retry logic.

---

## Task 1: Add Svix Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install svix package**

Run:
```bash
npm install svix
```

**Step 2: Verify installation**

Run:
```bash
npm ls svix
```
Expected: Shows svix version installed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add svix for Clerk webhook verification"
```

---

## Task 2: Create Internal User Mutation (with tests)

**Files:**
- Modify: `convex/users.ts`
- Create: `convex/users.test.ts`

**Step 1: Write the failing test for createFromWebhook**

Create `convex/users.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("users", () => {
  describe("createFromWebhook", () => {
    it("creates a new user with clerk data", async () => {
      const t = convexTest(schema);

      const userId = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_test123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
      });

      expect(userId).toBeDefined();

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).toMatchObject({
        clerkId: "user_test123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        setupStatus: "not_started",
      });
      expect(user?.createdAt).toBeDefined();
    });

    it("returns existing user if clerkId already exists (idempotent)", async () => {
      const t = convexTest(schema);

      // Create first user
      const userId1 = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_existing",
        email: "first@example.com",
        name: "First Name",
      });

      // Try to create again with same clerkId
      const userId2 = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_existing",
        email: "second@example.com",
        name: "Second Name",
      });

      // Should return same user ID
      expect(userId2).toEqual(userId1);

      // Should NOT have updated the data (create is idempotent, not upsert)
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId1);
      });
      expect(user?.email).toBe("first@example.com");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- convex/users.test.ts
```
Expected: FAIL - `internal.users.createFromWebhook` does not exist

**Step 3: Write the createFromWebhook mutation**

Add to `convex/users.ts` (after imports, before other exports):

```typescript
import { internalMutation } from "./_generated/server";

// Called by Clerk webhook - creates user from webhook payload
export const createFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, name, image }) => {
    // Check if user already exists (idempotent)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      image,
      onboardingComplete: false,
      setupStatus: "not_started",
      createdAt: Date.now(),
    });

    return userId;
  },
});
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- convex/users.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add convex/users.ts convex/users.test.ts
git commit -m "feat: add createFromWebhook internal mutation for Clerk webhook"
```

---

## Task 3: Add updateFromWebhook Mutation (with tests)

**Files:**
- Modify: `convex/users.ts`
- Modify: `convex/users.test.ts`

**Step 1: Write the failing test for updateFromWebhook**

Add to `convex/users.test.ts`:

```typescript
  describe("updateFromWebhook", () => {
    it("updates existing user profile data", async () => {
      const t = convexTest(schema);

      // Create user first
      const userId = await t.mutation(internal.users.createFromWebhook, {
        clerkId: "user_update_test",
        email: "old@example.com",
        name: "Old Name",
        image: "https://example.com/old.jpg",
      });

      // Update via webhook
      await t.mutation(internal.users.updateFromWebhook, {
        clerkId: "user_update_test",
        email: "new@example.com",
        name: "New Name",
        image: "https://example.com/new.jpg",
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).toMatchObject({
        clerkId: "user_update_test",
        email: "new@example.com",
        name: "New Name",
        image: "https://example.com/new.jpg",
      });
    });

    it("does nothing if user does not exist", async () => {
      const t = convexTest(schema);

      // Should not throw, just return
      await t.mutation(internal.users.updateFromWebhook, {
        clerkId: "user_nonexistent",
        email: "new@example.com",
      });

      // Verify no user was created
      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_nonexistent"))
          .first();
      });

      expect(user).toBeNull();
    });
  });
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- convex/users.test.ts
```
Expected: FAIL - `internal.users.updateFromWebhook` does not exist

**Step 3: Write the updateFromWebhook mutation**

Add to `convex/users.ts`:

```typescript
// Called by Clerk webhook - updates user profile from webhook payload
export const updateFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, name, image }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!existingUser) {
      // User doesn't exist - ignore (might have been deleted)
      return;
    }

    // Update user profile fields
    await ctx.db.patch(existingUser._id, {
      ...(email !== undefined && { email }),
      ...(name !== undefined && { name }),
      ...(image !== undefined && { image }),
    });
  },
});
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- convex/users.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add convex/users.ts convex/users.test.ts
git commit -m "feat: add updateFromWebhook internal mutation"
```

---

## Task 4: Implement Clerk Webhook HTTP Endpoint

**Files:**
- Modify: `convex/http.ts`

**Step 1: Write the webhook handler**

Replace contents of `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

// Clerk webhook endpoint
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get Svix headers for verification
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    // Get request body
    const body = await request.text();

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    let payload: WebhookPayload;

    try {
      payload = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookPayload;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 401 });
    }

    // Handle the event
    const { type, data } = payload;

    try {
      switch (type) {
        case "user.created": {
          const email = data.email_addresses?.[0]?.email_address;
          const name = [data.first_name, data.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

          await ctx.runMutation(internal.users.createFromWebhook, {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
          });
          break;
        }

        case "user.updated": {
          const email = data.email_addresses?.[0]?.email_address;
          const name = [data.first_name, data.last_name]
            .filter(Boolean)
            .join(" ") || undefined;

          await ctx.runMutation(internal.users.updateFromWebhook, {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
          });
          break;
        }

        case "user.deleted": {
          // Optional: handle user deletion
          // For now, we'll leave the user record (soft delete approach)
          console.log(`User deleted in Clerk: ${data.id}`);
          break;
        }

        default:
          console.log(`Unhandled webhook event type: ${type}`);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error(`Error handling webhook event ${type}:`, err);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

// Type definitions for Clerk webhook payload
interface WebhookPayload {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

export default http;
```

**Step 2: Verify Convex dev server accepts the changes**

Run:
```bash
npx convex dev --once
```
Expected: Deployment succeeds without errors

**Step 3: Commit**

```bash
git add convex/http.ts
git commit -m "feat: add Clerk webhook HTTP endpoint with Svix verification"
```

---

## Task 5: Fix Client-Side Query Timing

**Files:**
- Modify: `src/hooks/useAuthGuard.ts`

**Step 1: Fix the query skip condition**

In `src/hooks/useAuthGuard.ts`, change line 11 from:

```typescript
const user = useQuery(api.users.current);
```

To:

```typescript
// Skip query until signed in (prevents race condition with JWT propagation)
const user = useQuery(api.users.current, isSignedIn ? {} : "skip");
```

**Step 2: Verify the app still loads**

Run:
```bash
npm run dev
```
Expected: App loads without errors, auth flow works

**Step 3: Commit**

```bash
git add src/hooks/useAuthGuard.ts
git commit -m "fix: skip user query until signed in to prevent race condition"
```

---

## Task 6: Add Retry Logic to Client-Side Sync

**Files:**
- Modify: `src/hooks/useAuthGuard.ts`

**Step 1: Add retry utility and update useEffect**

Replace the entire `src/hooks/useAuthGuard.ts` file:

```typescript
import { useAuth, useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback } from "react";

export type SetupStatus = "not_started" | "in_progress" | "complete" | undefined;

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry if it's not an auth error
      if (!lastError.message.includes("Not authenticated")) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export function useAuthGuard() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user: clerkUser } = useUser();

  // Skip query until signed in (prevents race condition with JWT propagation)
  const user = useQuery(api.users.current, isSignedIn ? {} : "skip");

  const setupProgress = useQuery(
    api.setupProgress.current,
    isSignedIn ? {} : "skip"
  );
  const createOrGetUser = useMutation(api.users.createOrGetUser);

  // Track if we've already attempted user creation
  const creationAttemptedRef = useRef(false);

  // Create user with retry logic
  const createUserWithRetry = useCallback(async () => {
    if (creationAttemptedRef.current) return;
    creationAttemptedRef.current = true;

    try {
      await retryWithBackoff(() => createOrGetUser());
    } catch (err) {
      console.error("Failed to create user after retries:", err);
      // Reset so user can retry on next sign-in
      creationAttemptedRef.current = false;
    }
  }, [createOrGetUser]);

  // Create user in Convex on first sign-in (fallback if webhook missed)
  useEffect(() => {
    if (isSignedIn && authLoaded && user === null) {
      createUserWithRetry();
    }
  }, [isSignedIn, authLoaded, user, createUserWithRetry]);

  // Reset creation attempted flag when signing out
  useEffect(() => {
    if (!isSignedIn) {
      creationAttemptedRef.current = false;
    }
  }, [isSignedIn]);

  // Derive setup status from user record
  const setupStatus: SetupStatus = user?.setupStatus as SetupStatus;

  // For backwards compatibility during migration
  const needsOnboarding = user && user.onboardingComplete === false && !setupStatus;
  const needsSetup = setupStatus === "not_started" || setupStatus === undefined;
  const setupInProgress = setupStatus === "in_progress";
  const setupComplete = setupStatus === "complete";

  return {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !authLoaded || (isSignedIn && user === undefined),
    user,
    clerkUser,
    // Legacy (for migration)
    needsOnboarding,
    // New setup mode
    setupStatus,
    setupProgress,
    needsSetup,
    setupInProgress,
    setupComplete,
  };
}
```

**Step 2: Verify the app still works**

Run:
```bash
npm run dev
```
Expected: App loads, auth works, no console errors

**Step 3: Run linter**

Run:
```bash
npm run lint
```
Expected: No lint errors

**Step 4: Commit**

```bash
git add src/hooks/useAuthGuard.ts
git commit -m "feat: add retry logic with exponential backoff to user creation"
```

---

## Task 7: Run All Tests and Verify

**Files:** None (verification only)

**Step 1: Run all tests**

Run:
```bash
npm run test:run
```
Expected: All tests pass

**Step 2: Run type check**

Run:
```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 3: Run lint**

Run:
```bash
npm run lint
```
Expected: No lint errors

**Step 4: Final commit if any fixes needed**

If any fixes were required:
```bash
git add -A
git commit -m "fix: address test/lint issues"
```

---

## Post-Implementation: Clerk Webhook Configuration

After deployment, configure Clerk webhook:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks
2. Click "Add Endpoint"
3. Endpoint URL: `https://<your-convex-deployment>.convex.site/clerk-webhook`
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Copy the "Signing Secret"
6. Set in Convex: `npx convex env set CLERK_WEBHOOK_SECRET <signing-secret>`
