# Clerk User Sync Design

## Problem

When users sign up or log in via Clerk, their Clerk user ID is not reliably saved to the Convex database. This breaks the ability to link user data to authenticated users.

**Root cause:** Race condition between Clerk auth state and Convex JWT propagation. The client-side sync triggers before the JWT is ready, fails silently, and never retries.

## Solution

Two-layer sync strategy: webhook as primary, improved client-side as fallback.

```
┌─────────────────────────────────────────────────────────┐
│                    PRIMARY: Webhook                      │
│  Clerk → user.created event → Convex HTTP endpoint      │
│  • Triggered server-side when user signs up             │
│  • Svix signature verification                          │
│  • Creates user record immediately                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (fallback if webhook missed)
┌─────────────────────────────────────────────────────────┐
│                  SECONDARY: Client-side                  │
│  useAuthGuard → createOrGetUser mutation                │
│  • Fixed timing: skip query until JWT ready             │
│  • Retry logic: exponential backoff on failure          │
│  • Idempotent: safe if webhook already created user     │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Webhook Endpoint

**File:** `convex/http.ts`

- POST `/clerk-webhook` endpoint
- Svix signature verification using `CLERK_WEBHOOK_SECRET`
- Handle events: `user.created`, `user.updated`, `user.deleted`

**Payload structure:**
```typescript
{
  type: "user.created" | "user.updated" | "user.deleted",
  data: {
    id: "user_xxx",           // clerkId
    email_addresses: [{email_address: string, id: string}],
    first_name: string,
    last_name: string,
    image_url: string
  }
}
```

### 2. Internal Mutation

**File:** `convex/users.ts`

New `createFromWebhook` internal mutation:
- Takes clerkId, email, name, image directly (no auth context needed)
- Checks for existing user (idempotent)
- Called only by HTTP handler (not exposed to client)

### 3. Client-Side Fixes

**File:** `src/hooks/useAuthGuard.ts`

Fix 1 - Skip query until authenticated:
```typescript
const user = useQuery(api.users.current, isSignedIn ? {} : "skip");
```

Fix 2 - Retry with exponential backoff:
- Retry up to 3 times on failure
- Delays: 500ms, 1000ms, 2000ms
- Log error only after all retries exhausted

Fix 3 - Better loading state:
- Account for skipped query state
- Prevent loading flash

### 4. Dependencies

Add `svix` package for webhook signature verification.

## Security

- Svix signature verification before any database operations
- Internal mutation not callable from client
- Webhook secret in Convex environment variables

## Testing

**Webhook tests:**
- `createFromWebhook` creates user with correct fields
- `createFromWebhook` is idempotent
- `createFromWebhook` handles updates

**Client-side tests:**
- Query skipped when not signed in
- Retry logic attempts 3 times
- Success on retry clears error state

## Configuration

Clerk webhook setup (one-time):
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://<convex-deployment>.convex.site/clerk-webhook`
3. Select events: `user.created`, `user.updated`, `user.deleted`
4. Copy signing secret to Convex env as `CLERK_WEBHOOK_SECRET`
