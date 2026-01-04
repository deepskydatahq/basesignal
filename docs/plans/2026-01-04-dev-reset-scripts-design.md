# Dev Reset Scripts

Scripts to reset user data during development, run with bun.

## Usage

```bash
bun run scripts/dev-reset.ts user@example.com
```

## What It Does

1. Validates we're in a dev environment (refuses to run against prod)
2. Finds the user by email in Convex
3. Deletes all user data from Convex (cascade)
4. Deletes the user from Clerk

After running, you can sign up again with the same email to test onboarding flows.

## File Structure

```
scripts/
  dev-reset.ts          # Entry point
  lib/
    convex-client.ts    # Convex HTTP client setup
    clerk-client.ts     # Clerk backend API wrapper
    safety.ts           # Dev-only enforcement
    reset/
      full.ts           # Full user reset
      # Future: journeys.ts, interviews.ts, etc.

convex/
  devReset.ts           # Internal mutation for cascade delete
```

## Safety Checks

Before any destructive operation, the script verifies:

1. `CONVEX_URL` contains "dev" or is localhost (not production)
2. `CLERK_SECRET_KEY` starts with `sk_test_` (not `sk_live_`)

If either check fails, the script exits with an error.

## Data Deletion Cascade

Deletes in this order (children first):

1. `interviewMessages` - via session → journey → user
2. `interviewSessions` - via journey → user
3. `transitions` - via journey → user
4. `stages` - via journey → user
5. `journeys` - by userId
6. `setupProgress` - by userId
7. `users` - the user record itself
8. Clerk user - via Clerk API

## Convex Internal Mutation

The cascade logic lives in `convex/devReset.ts` as an `internalMutation`. This keeps deletion logic in the backend where it can be:

- Tested with `convex-test`
- Reused if needed elsewhere
- Executed atomically

The bun script is thin: find user, call mutation, call Clerk API.

## Environment Variables

Required in `.env.local`:

```
CONVEX_URL=https://your-dev-deployment.convex.cloud
CLERK_SECRET_KEY=sk_test_xxxxx
```

## Example Output

```
🔒 Safety check: dev environment confirmed
🔍 Finding user: user@example.com
📋 Found user: usr_abc123 (created 2024-01-15)
🗑️  Deleting Convex data...
   - 12 interview messages
   - 3 interview sessions
   - 8 transitions
   - 5 stages
   - 1 journey
   - 1 setup progress
   - 1 user record
🗑️  Deleting from Clerk...
✅ Reset complete
```

## Future: Selective Resets

The `scripts/lib/reset/` folder is designed for adding targeted resets:

- `journeys.ts` - Reset just journeys and related data
- `interviews.ts` - Reset interview sessions and messages
- `onboarding.ts` - Reset setupProgress to re-run onboarding

Each would export a function that takes a user ID and deletes specific data.

## Dependencies

- `@clerk/backend` - Clerk API calls
- `convex/browser` - ConvexHttpClient for queries
- Bun runtime - native fetch, TypeScript support

## Implementation Notes

- Uses `dotenv/config` for automatic .env.local loading
- Internal mutation used for cascade delete (testable with convex-test)
- Script exits with code 1 on any failure for scripting integration
