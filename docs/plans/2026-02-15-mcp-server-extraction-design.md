# MCP Server Extraction Design

## Overview

Extract the existing MCP server from `server/` into `packages/mcp-server/` as a standalone, self-hostable package that uses stdio transport (for Claude Desktop) as its primary connection method. The new package drops all Clerk, Convex, and Express dependencies, accepting storage and LLM adapters via constructor injection instead. The existing `server/` directory becomes a thin hosted wrapper that adds Clerk auth and Convex storage on top of the extracted package.

## Problem Statement

The current MCP server in `server/` is tightly coupled to three hosted services: Clerk (authentication), Convex (persistence), and Express (HTTP transport with Streamable HTTP). This makes it impossible to self-host. A user who wants to run Basesignal locally from Claude Desktop cannot do so without Clerk keys, a Convex deployment, and an Express process.

The open source vision (M008) requires a server that starts with a single command, connects over stdio, and stores data locally. The current architecture must be decomposed so the core MCP logic (tool registration, dispatch, response formatting) lives in an independent package, while auth and hosted infrastructure remain optional layers.

## Expert Perspectives

### Technical Architect

The real problem is dependency direction. Today, tool handlers reach directly into Convex (`getConvexClient()`) and Clerk (`withUser()`). Extracting the package means inverting these dependencies: tools declare what they need (a storage interface, a user context), and the host provides it. The package should own the MCP protocol surface (tool registration, transport setup) and nothing else. Keep the API surface to one function: `createServer(config)` that returns a started server. Everything else is config.

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

What to remove:
- **No Express in the package.** Stdio is the only transport for v1. SSE/HTTP can come later when there is a real use case beyond "the hosted SaaS wrapper." The hosted `server/` already handles HTTP.
- **No auth layer in the package.** Self-hosted local use does not need authentication. The `withUser`/`withUserArgs` wrappers stay in `server/` (the hosted layer). The package tools receive a context object directly.
- **No user resolution.** The package does not know about users, Clerk IDs, or user caches. If a host wants user identity, it injects it into the tool context.
- **No handler subdirectory.** The epic mentions `packages/mcp-server/handlers/` but tools and handlers are the same thing in the MCP SDK. One `tools/` directory is enough.

What feels inevitable: tools register on a server, the server connects to a transport, the transport is stdio. Three concepts, three files.

## Proposed Solution

### Package Structure

```
packages/mcp-server/
  package.json            # @basesignal/mcp-server
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              # Public API: createServer, types
    server.ts             # McpServer creation and tool registration
    transport.ts          # Transport factory (stdio, future: SSE)
    types.ts              # ServerConfig, StorageAdapter, LlmProvider interfaces
    tools/
      index.ts            # registerTools(server, context)
      ping.ts             # Health check tool (no dependencies)
```

### Entry Point (`src/index.ts`)

```typescript
export { createServer } from "./server.js";
export type {
  ServerConfig,
  StorageAdapter,
  LlmProvider,
  ToolContext,
} from "./types.js";
```

### Types (`src/types.ts`)

```typescript
/**
 * Adapter interface for persistence.
 * Implementations: SQLiteStorage (default), ConvexStorage (hosted).
 */
export interface StorageAdapter {
  // Defined per-story as tools are added (S002-S005).
  // Skeleton ships with no required methods — just the interface.
}

/**
 * Adapter interface for LLM calls.
 * Implementations: AnthropicProvider, OpenAIProvider, OllamaProvider.
 */
export interface LlmProvider {
  // Defined when analysis pipeline is integrated (S002).
}

/**
 * Configuration for creating an MCP server instance.
 */
export interface ServerConfig {
  /** Package name shown in MCP handshake. Defaults to "basesignal". */
  name?: string;
  /** Package version shown in MCP handshake. Defaults to package version. */
  version?: string;
  /** Storage adapter for persistence. Optional for skeleton (ping works without it). */
  storage?: StorageAdapter;
  /** LLM provider for analysis. Optional for skeleton. */
  llmProvider?: LlmProvider;
  /** Transport type. Defaults to "stdio". */
  transport?: "stdio";
}

/**
 * Context passed to every tool handler.
 * Hosts can extend this (e.g., adding user identity for the hosted SaaS).
 */
export interface ToolContext {
  storage?: StorageAdapter;
  llmProvider?: LlmProvider;
}
```

### Server Factory (`src/server.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import type { ServerConfig, ToolContext } from "./types.js";

export async function createServer(config: ServerConfig = {}) {
  const server = new McpServer({
    name: config.name ?? "basesignal",
    version: config.version ?? "0.1.0",
  });

  const context: ToolContext = {
    storage: config.storage,
    llmProvider: config.llmProvider,
  };

  registerTools(server, context);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
}
```

### Tool Registration (`src/tools/index.ts`)

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import type { ToolContext } from "../types.js";

export function registerTools(server: McpServer, context: ToolContext) {
  registerPingTool(server);
  // Future stories add: scan, profile, definition, export tools
  // Each receives `context` for storage/LLM access
}
```

### Ping Tool (`src/tools/ping.ts`)

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer) {
  server.registerTool(
    "ping",
    {
      title: "Ping Basesignal",
      description:
        "Check that the Basesignal MCP server is running. Returns server status.",
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            status: "ok",
            server: "basesignal",
            version: "0.1.0",
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
  );
}
```

Note: The ping tool deliberately removes `authenticated`, `userId`, `clerkId`, `email`, and `name` fields. Those are hosted-server concerns. The self-hosted ping confirms the server is alive.

### package.json

```json
{
  "name": "@basesignal/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "description": "Self-hostable MCP server for Basesignal product profiling",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "bin": {
    "basesignal-mcp": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  }
}
```

### CLI Entry Point (`src/cli.ts`)

A minimal entry point so users can run the server directly:

```typescript
#!/usr/bin/env node
import { createServer } from "./index.js";

createServer().catch((err) => {
  console.error("Failed to start Basesignal MCP server:", err);
  process.exit(1);
});
```

### Claude Desktop Configuration

After installation, users add to their Claude Desktop config:

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "npx",
      "args": ["@basesignal/mcp-server"]
    }
  }
}
```

Or if installed locally in the monorepo during development:

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "node",
      "args": ["packages/mcp-server/dist/cli.js"]
    }
  }
}
```

### How `server/` Changes (Future)

The existing `server/` becomes a thin hosted wrapper. It continues to use Express, Clerk auth, and Convex. It imports `@basesignal/mcp-server` for tool definitions and adds its own auth layer. This change is NOT part of this story -- it happens after the package stabilizes.

## Key Decisions

### 1. Stdio-only transport for v1

The MCP SDK supports stdio, SSE, and Streamable HTTP transports. For a self-hosted local server, stdio is the correct choice:
- Claude Desktop uses stdio natively (spawns the process, communicates over stdin/stdout)
- No port binding, no CORS, no session management
- The hosted `server/` already handles HTTP transport for the SaaS

SSE transport can be added later behind a config flag if remote connection use cases emerge.

### 2. No auth in the package

Self-hosted means running on your own machine. There is no untrusted client. Authentication is a hosting concern, not a package concern. The `withUser`/`withUserArgs` wrappers, Clerk integration, and user resolution all stay in `server/`.

### 3. Adapter interfaces start empty

`StorageAdapter` and `LlmProvider` are declared as interfaces with no required methods in the skeleton. This is intentional. Methods get added story-by-story as tools that need them are implemented (S002-S005). Starting with empty interfaces avoids speculative API design.

### 4. `createServer()` is the entire public API

One function, one config object. No class hierarchies, no builder pattern, no plugin system. If you want to customize, you pass config. If you want to extend, you register tools on the returned `McpServer` instance directly via the MCP SDK.

### 5. Tools receive context, not global singletons

The current `server/` uses `getConvexClient()` as a global singleton. The package passes a `ToolContext` through registration instead. This makes tools testable (inject mocks) and host-agnostic (inject whatever storage the host provides).

### 6. Package emits declaration files

Using `tsc` with `declaration: true` produces `.d.ts` files alongside `.js`. No bundler needed. The package is consumed as ESM. CJS support is not needed because the MCP SDK itself is ESM-only.

## What This Does NOT Do

- **Does not implement scan, profile, definition, or export tools.** Those are stories S002-S005.
- **Does not create the `@basesignal/core` package.** That is epic M008-E001, a dependency of this epic.
- **Does not set up npm workspaces.** That is M008-E001-S001 (monorepo workspace setup). This design assumes workspaces exist.
- **Does not modify the existing `server/` directory.** The hosted server continues to work unchanged. Refactoring it to use the package is a separate story.
- **Does not add SSE or HTTP transport.** Stdio only for now.
- **Does not add Docker support.** That is a separate epic.
- **Does not add configuration file support (basesignal.config.ts).** Environment variables are sufficient for the skeleton.
- **Does not publish to npm.** Publishing is a separate concern.

## Verification Steps

### Automated (unit tests)

1. **Package structure test:** `packages/mcp-server/` has its own `package.json` with `@modelcontextprotocol/sdk` as a dependency.
2. **No forbidden imports test:** Grep `packages/mcp-server/src/` for `@clerk/`, `convex/`, `express` -- expect zero matches.
3. **Server creation test:** `createServer()` returns without throwing (mocked stdio transport).
4. **Tool registration test:** After `registerTools()`, the server has a `ping` tool registered.
5. **Ping response test:** Calling the ping handler returns `{ status: "ok", server: "basesignal" }`.
6. **Config injection test:** `createServer({ name: "custom" })` sets the server name to "custom".

### Manual

7. **Build:** `cd packages/mcp-server && npm run build` succeeds with no errors.
8. **Claude Desktop:** Add the server to Claude Desktop config, restart, and call the `ping` tool. Verify it responds with status ok.

## Success Criteria

- `packages/mcp-server/` exists as a standalone package with its own `package.json`
- The package has exactly one runtime dependency: `@modelcontextprotocol/sdk`
- `createServer()` starts a server on stdio transport
- The `ping` tool is registered and responds to tool calls
- No imports from `@clerk/`, `convex/`, or `express` exist anywhere in `packages/mcp-server/`
- `ServerConfig` accepts optional `storage` and `llmProvider` adapters
- All unit tests pass
- The server connects successfully from Claude Desktop MCP configuration
