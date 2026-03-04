# MCP Server Skeleton Design

## Overview

A standalone Express.js MCP server that accepts connections from AI assistants (Claude Desktop, Cursor, etc.) using the Streamable HTTP transport, authenticates via Clerk OAuth 2.1, and calls Convex for data persistence. This is the foundation that all MCP tools (scan, profile, refinement) will be registered on.

## Problem Statement

Basesignal needs an MCP server that AI assistants can connect to. Without this, the crawling pipeline, profile tools, and refinement tools have no delivery mechanism. This story delivers the minimal skeleton: server starts, accepts connections, authenticates users, and has one placeholder tool to prove the end-to-end flow works.

## Proposed Solution

### Architecture

```
┌──────────────────┐     ┌─────────────────────────────────────┐     ┌─────────────┐
│  MCP Client      │     │  Basesignal MCP Server (Express)    │     │  Clerk      │
│  (Claude Desktop)│     │                                     │     │  (Auth)     │
│                  │     │  GET /.well-known/                   │     │             │
│                  │────>│      oauth-protected-resource       │────>│  OAuth 2.1  │
│                  │     │                                     │     │  flow       │
│                  │────>│  POST /mcp                          │     │             │
│                  │     │    ├─ mcpAuthClerk middleware        │<────│  JWT verify │
│                  │     │    └─ streamableHttpHandler          │     │             │
│                  │     │         └─ McpServer                 │     └─────────────┘
│                  │     │              ├─ ping tool            │
│                  │<────│              └─ (future tools)       │     ┌─────────────┐
│                  │     │                                     │────>│  Convex     │
│                  │     │  Session store (SQLite dev /         │     │  (Database) │
│                  │     │   Redis prod)                        │     └─────────────┘
└──────────────────┘     └─────────────────────────────────────┘
```

### Key Decision: Standalone Server + Convex Backend

The MCP server is a **standalone Express.js application** that uses Convex as its database via the Convex client SDK (`ConvexHttpClient`). This is the right approach because:

1. **MCP SDK requires a Node.js HTTP server** — Convex actions can't host persistent HTTP/SSE connections
2. **Clerk MCP tools have first-class Express support** — `@clerk/mcp-tools/express` provides `mcpAuthClerk`, `streamableHttpHandler`, `protectedResourceHandlerClerk`
3. **Convex stays the database** — all existing tables (users, products, productProfiles, scanJobs, crawledPages) are accessed via `ConvexHttpClient`
4. **Same user pool** — Clerk auth is shared between the web app and MCP server

### Key Decision: Streamable HTTP (not SSE)

The MCP SDK has deprecated standalone SSE transport. Streamable HTTP is the recommended approach:
- HTTP POST for client-to-server communication
- Optional SSE for server-to-client streaming (within the HTTP response)
- Supports both stateful sessions and stateless mode
- All modern MCP clients support it

### Key Decision: Monorepo with Separate Entry Point

The MCP server lives in the same repository as the existing React/Convex app, in a `server/` directory with its own `tsconfig.json` and entry point. Shared types can be imported across boundaries. This avoids the overhead of a separate repo while keeping concerns clean.

```
basesignal/
├── convex/          # Convex backend (shared)
├── src/             # React frontend
├── server/          # MCP server (NEW)
│   ├── index.ts     # Entry point
│   ├── tools/       # MCP tool definitions
│   │   └── ping.ts  # Placeholder tool
│   ├── lib/
│   │   └── convex.ts # ConvexHttpClient setup
│   └── tsconfig.json # Server-specific TS config
├── package.json     # Shared dependencies
└── ...
```

## Design Details

### 1. Server Entry Point (`server/index.ts`)

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { streamableHttpHandler, mcpAuthClerk, protectedResourceHandlerClerk } from "@clerk/mcp-tools/express";
import { registerTools } from "./tools/index.js";

const app = express();

// MCP server instance
const server = new McpServer({
  name: "basesignal",
  version: "0.1.0",
});

// Register all tools
registerTools(server);

// OAuth Protected Resource Metadata (RFC 9728)
app.get("/.well-known/oauth-protected-resource", protectedResourceHandlerClerk());

// MCP endpoint with Clerk auth
app.post("/mcp", mcpAuthClerk, streamableHttpHandler(server));

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Basesignal MCP server running on port ${PORT}`);
});
```

### 2. Tool Registration Pattern (`server/tools/index.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";

export function registerTools(server: McpServer) {
  registerPingTool(server);
  // Future: registerScanTool(server);
  // Future: registerProfileTools(server);
}
```

### 3. Placeholder Tool (`server/tools/ping.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPingTool(server: McpServer) {
  server.tool(
    "ping",
    "Check that the Basesignal MCP server is running and authenticated",
    {},
    async (_args, { authInfo }) => {
      const userId = (authInfo as any)?.userId;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "ok",
              server: "basesignal",
              version: "0.1.0",
              authenticated: !!userId,
              userId: userId ?? null,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      };
    }
  );
}
```

### 4. Convex Client (`server/lib/convex.ts`)

```typescript
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) throw new Error("CONVEX_URL environment variable required");

export const convex = new ConvexHttpClient(convexUrl);
```

This client will be used by future tools to call Convex queries and mutations. For the skeleton, the ping tool doesn't need it.

### 5. Environment Variables

```
# Required
CLERK_PUBLISHABLE_KEY=pk_test_...   # Same as web app
CLERK_SECRET_KEY=sk_test_...         # Same as web app
CONVEX_URL=https://<your-deployment>.convex.cloud

# Optional
PORT=3001                            # Default 3001
NODE_ENV=development
```

### 6. TypeScript Configuration (`server/tsconfig.json`)

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
    "declaration": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 7. NPM Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "server:dev": "tsx watch server/index.ts",
    "server:build": "tsc -p server/tsconfig.json",
    "server:start": "node dist/server/index.js"
  }
}
```

### 8. New Dependencies

```
@modelcontextprotocol/sdk     # MCP server framework
@clerk/mcp-tools              # Clerk OAuth helpers for MCP
express                        # HTTP server
tsx                            # TypeScript execution for dev
@types/express                 # Type definitions
```

## Testing Strategy

### Unit Tests (`server/tools/ping.test.ts`)

Test the ping tool handler directly without starting the server:
- Returns expected JSON structure
- Includes authentication status
- Returns correct version

### Integration Test (manual)

1. Start server: `npm run server:dev`
2. Configure Claude Desktop to connect to `http://localhost:3001/mcp`
3. Call the `ping` tool
4. Verify authenticated response

### Health Check Test

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

## Alternatives Considered

### Hono Instead of Express

Hono is lighter and has MCP SDK support (`@modelcontextprotocol/hono`). However, `@clerk/mcp-tools/express` provides battle-tested auth middleware, and Express is more widely understood. The overhead difference is negligible for this use case.

### Convex HTTP Actions as MCP Endpoint

Convex's `httpAction` could theoretically serve MCP requests, but:
- No support for SSE streaming within HTTP actions
- No session management
- No way to integrate the MCP SDK's transport layer
- Would require reimplementing the MCP protocol manually

### Separate Repository

A dedicated repo would be cleaner in theory but adds friction: shared types need to be published as packages, CI/CD is duplicated, and the Convex schema can't be easily shared.

## Open Questions

None — the design decisions are straightforward and well-supported by existing tooling.

## Success Criteria

- Server starts and responds to health checks
- `/.well-known/oauth-protected-resource` returns valid RFC 9728 metadata
- MCP client (Claude Desktop) can connect and authenticate via Clerk
- `ping` tool returns expected response with auth info
- Foundation is ready for Story 1.2 (full auth flow) and Story 2.x (scan tools)
