# Fresh Convex Setup Instructions

The existing Convex deployments have bundling corruption. Here's how to create a fresh deployment:

## Steps

1. **Delete the corrupted deployment cache**
   ```bash
   cd packages/admin-ui
   rm -rf .convex convex/_generated
   rm .env.local
   ```

2. **Remove any JavaScript artifacts**
   ```bash
   rm convex/*.js convex/*.js.map 2>/dev/null || true
   ```

3. **Create new Convex project** (Interactive - you'll need to do this manually)
   ```bash
   npx convex dev
   ```

   When prompted:
   - Choose "Create a new project"
   - Name it something like "timo-data-platform-fresh"
   - This will create a new deployment and update .env.local

4. **The deployment should now work**
   - The `npx convex dev` command will deploy your schema and functions
   - Once it's running, you can seed data with `npx convex run seed:default`

## Why This Happened

The Convex bundler was seeing duplicate outputs for the same files (entities.js, seed.js) in the cloud deployment state. This corruption can happen when:
- Multiple deployments were attempted with conflicting state
- Build artifacts weren't cleaned between deployments
- TypeScript project references caused double-processing

A fresh deployment avoids all this corrupted state.
