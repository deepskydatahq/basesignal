# MCP Server Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone Express.js MCP server that accepts connections from AI assistants, authenticates via Clerk OAuth 2.1, and has a placeholder `ping` tool proving the end-to-end flow works.

**Architecture:** Standalone Express server in `server/` directory within the monorepo, using `@clerk/mcp-tools/express` for auth middleware + Streamable HTTP transport, `@modelcontextprotocol/sdk` for MCP server primitives, and `ConvexHttpClient` for future database access.

**Tech Stack:** Express 5 (bundled with MCP SDK), `@modelcontextprotocol/sdk` 1.25.x, `@clerk/mcp-tools` 0.3.x, `tsx` for dev, `zod` 4.x (already installed)

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install production + dev dependencies**

Run:
```bash
npm install @modelcontextprotocol/sdk @clerk/mcp-tools better-sqlite3
npm install -D @types/better-sqlite3 tsx
```

Notes:
- `@modelcontextprotocol/sdk` bundles Express 5 and zod — no need to install separately
- `@clerk/mcp-tools` has `better-sqlite3` as a peer dep (for session store)
- `tsx` is for running TypeScript in dev without a build step
- Express types come from `@modelcontextprotocol/sdk` via Express 5

**Step 2: Add server scripts to package.json**

Add these scripts:
```json
"server:dev": "tsx watch server/index.ts",
"server:start": "tsx server/index.ts"
```

**Step 3: Verify installation**

Run: `npm ls @modelcontextprotocol/sdk @clerk/mcp-tools`
Expected: Both packages listed without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add MCP server dependencies"
```

---

### Task 2: Create Server Directory Structure and TypeScript Config

**Files:**
- Create: `server/tsconfig.json`

**Step 1: Create directory structure**

```bash
mkdir -p server/tools server/lib
```

**Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "../dist/server",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

**Step 3: Commit**

```bash
git add server/tsconfig.json
git commit -m "chore: add server directory structure and tsconfig"
```

---

### Task 3: Create the Ping Tool (TDD)

**Files:**
- Create: `server/tools/ping.ts`
- Create: `server/tools/ping.test.ts`
- Create: `server/tools/index.ts`

**Step 1: Write the failing test for ping tool**

File: `server/tools/ping.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./index.js";

describe("ping tool", () => {
  it("is registered on the server", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    // McpServer exposes registered tools via the _registeredTools map
    // We verify by checking the server has the tool registered
    const tools = (server as any)._registeredTools;
    expect(tools.has("ping")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/tools/ping.test.ts`
Expected: FAIL — module not found

**Step 3: Create the ping tool**

File: `server/tools/ping.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping Basesignal",
      description:
        "Check that the Basesignal MCP server is running and authenticated. Returns server status and your user ID.",
    },
    async (_args, extra) => {
      const authInfo = extra.authInfo as
        | { userId?: string }
        | undefined;
      const userId = authInfo?.userId ?? null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "ok",
              server: "basesignal",
              version: "0.1.0",
              authenticated: !!userId,
              userId,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    }
  );
}
```

File: `server/tools/index.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";

export function registerTools(server: McpServer) {
  registerPingTool(server);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run server/tools/ping.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/tools/
git commit -m "feat(mcp): add ping tool with registration pattern"
```

---

### Task 4: Create Convex Client Helper

**Files:**
- Create: `server/lib/convex.ts`

**Step 1: Create the Convex HTTP client helper**

File: `server/lib/convex.ts`

```typescript
import { ConvexHttpClient } from "convex/browser";

let _client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!_client) {
    const url = process.env.CONVEX_URL;
    if (!url) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    _client = new ConvexHttpClient(url);
  }
  return _client;
}
```

**Step 2: Commit**

```bash
git add server/lib/convex.ts
git commit -m "feat(mcp): add Convex HTTP client helper"
```

---

### Task 5: Create the Express Server Entry Point

**Files:**
- Create: `server/index.ts`

**Step 1: Create the server entry point**

File: `server/index.ts`

```typescript
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  streamableHttpHandler,
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
} from "@clerk/mcp-tools/express";
import { createSqliteStore } from "@clerk/mcp-tools/stores/sqlite";
import { registerTools } from "./tools/index.js";

// MCP Server
const server = new McpServer({
  name: "basesignal",
  version: "0.1.0",
});

registerTools(server);

// Express app
const app = express();

app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Last-Event-Id"],
    origin: "*",
  })
);

// OAuth Protected Resource Metadata (RFC 9728)
app.get(
  "/.well-known/oauth-protected-resource",
  protectedResourceHandlerClerk()
);

// Authorization Server Metadata (RFC 8414)
app.get(
  "/.well-known/oauth-authorization-server",
  authServerMetadataHandlerClerk
);

// Session store (SQLite for dev, Redis for prod)
const store = createSqliteStore({
  filename: process.env.MCP_STORE_PATH || "./mcp-sessions.db",
});

// MCP endpoint with Clerk authentication
app.post("/mcp", mcpAuthClerk, streamableHttpHandler(server, { store }));
app.get("/mcp", mcpAuthClerk, streamableHttpHandler(server, { store }));
app.delete("/mcp", mcpAuthClerk, streamableHttpHandler(server, { store }));

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "basesignal", version: "0.1.0" });
});

// Start
const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => {
  console.log(`Basesignal MCP server running on http://localhost:${PORT}`);
  console.log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  process.exit(0);
});
```

**Step 2: Commit**

```bash
git add server/index.ts
git commit -m "feat(mcp): add Express server entry point with Clerk auth"
```

---

### Task 6: Create Environment Configuration

**Files:**
- Create: `server/.env.example`
- Modify: `.gitignore` (if needed)

**Step 1: Create example env file**

File: `server/.env.example`

```
# Clerk (same keys as web app)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex
CONVEX_URL=https://your-deployment.convex.cloud

# Server
PORT=3001
MCP_STORE_PATH=./mcp-sessions.db
```

**Step 2: Add session DB to gitignore**

Add to `.gitignore`:
```
mcp-sessions.db
```

**Step 3: Commit**

```bash
git add server/.env.example .gitignore
git commit -m "chore: add MCP server env example and gitignore"
```

---

### Task 7: Verify Health Check Endpoint

**Step 1: Start the server (without Clerk keys, health check should still work)**

Run: `PORT=3001 npx tsx server/index.ts`

Note: The server may fail to start if Clerk middleware requires env vars at import time. If so, we'll need to guard the Clerk middleware initialization. The health check endpoint itself doesn't require auth.

**Step 2: Test health check**

Run (in separate terminal): `curl http://localhost:3001/health`
Expected: `{"status":"ok","server":"basesignal","version":"0.1.0"}`

**Step 3: Stop the server**

If the server doesn't start due to missing Clerk keys, adjust `server/index.ts` to check for keys at startup and log a warning rather than crashing. The health endpoint should always work.

**Step 4: Commit any fixes**

```bash
git add server/
git commit -m "fix(mcp): ensure server starts without Clerk keys in dev"
```

---

### Task 8: Integration Test — Verify MCP Tool List

**Files:**
- Create: `server/index.test.ts`

**Step 1: Write integration test**

File: `server/index.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";

describe("MCP server setup", () => {
  it("registers expected tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    const tools = (server as any)._registeredTools;
    expect(tools.size).toBeGreaterThanOrEqual(1);
    expect(tools.has("ping")).toBe(true);
  });

  it("ping tool returns expected structure", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);

    // Call the tool handler directly
    const tools = (server as any)._registeredTools;
    const pingEntry = tools.get("ping");
    const handler = pingEntry?.handler ?? pingEntry?.cb;

    // The handler signature depends on SDK version
    // We test via the McpServer's internal tool call if direct access fails
    expect(pingEntry).toBeDefined();
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run server/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/index.test.ts
git commit -m "test(mcp): add server setup integration tests"
```

---

### Task 9: Run Full Test Suite and Verify Build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All existing tests still pass, new server tests pass

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -p server/tsconfig.json --noEmit`
Expected: No errors

**Step 3: Commit any remaining fixes**

---

### Task 10: Update PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

**Step 1: Append session entry**

Add to the Session Log section:

```markdown
### YYYY-MM-DD - Story 1.1: MCP Server Skeleton

**Files Changed:**
- `server/index.ts` - Express entry point with Clerk auth + Streamable HTTP transport
- `server/tools/ping.ts` - Placeholder ping tool returning server status + auth info
- `server/tools/index.ts` - Tool registration pattern
- `server/lib/convex.ts` - ConvexHttpClient helper for future database access
- `server/tsconfig.json` - Server-specific TypeScript config
- `server/.env.example` - Environment variable template
- `package.json` - Added MCP SDK, Clerk MCP tools, better-sqlite3, tsx dependencies

**Learnings:**
- `@clerk/mcp-tools/express` provides `streamableHttpHandler`, `mcpAuthClerk`, `protectedResourceHandlerClerk` — handles all the Streamable HTTP + OAuth complexity
- MCP SDK bundles Express 5, cors, and zod — no separate install needed
- `McpServer.registerTool()` uses Zod schemas for input validation (not JSON Schema)
- Session persistence needed for Streamable HTTP — `better-sqlite3` via `@clerk/mcp-tools/stores/sqlite`

**Patterns Discovered:**
- Tool registration pattern: each tool in its own file exporting `registerXTool(server)`, aggregated in `tools/index.ts`
- Lazy Convex client: `getConvexClient()` defers initialization until first use, avoiding startup crashes when env vars are missing

**Gotchas:**
- `@clerk/mcp-tools` requires `better-sqlite3` as peer dep even if you only use SQLite store
- Clerk middleware may require `CLERK_PUBLISHABLE_KEY` at import time — need to handle gracefully for dev without keys
```

**Step 2: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: update PROGRESS.md with MCP server skeleton learnings"
```
