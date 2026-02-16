# Extract MCP Server into packages/mcp-server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone `packages/mcp-server/` package (`@basesignal/mcp-server`) that starts an MCP server over stdio transport with a `ping` tool, zero Clerk/Convex/Express dependencies, and adapter interfaces for future storage and LLM injection.

**Architecture:** The package is a new npm workspace under `packages/`. It exposes a single public API: `createServer(config?)` which creates an `McpServer`, registers tools, connects stdio transport, and returns the server. A CLI entry point (`src/cli.ts`) enables `npx @basesignal/mcp-server` usage. The existing `server/` directory is NOT modified.

**Tech Stack:** `@modelcontextprotocol/sdk@^1.25.3` (stdio transport), TypeScript 5.9, Vitest 4

**Dependency note:** This story depends on M008-E001-S001 (monorepo workspace setup). If workspaces are not yet configured, Task 1 below handles the minimal workspace setup needed. If M008-E001-S001 has already been completed, skip the workspace parts of Task 1.

---

## Prerequisite Context

### Existing Files You'll Modify

| File | What's There | What Changes |
|------|-------------|--------------|
| `package.json` | Root package.json without workspaces. Has `@modelcontextprotocol/sdk@^1.25.3` in dependencies. | Add `"workspaces": ["packages/*"]` field (if not already present from M008-E001-S001). |
| `tsconfig.json` | References `tsconfig.app.json` and `tsconfig.node.json`. | Add a reference to `packages/mcp-server/tsconfig.json` so `tsc -b` includes it. |
| `vitest.config.ts` | Root vitest config with jsdom environment, React plugin, `@/` alias. Uses `src/test/setup.ts` setupFiles. | No changes -- the package has its own vitest config. Root config already excludes `node_modules` so packages with their own config run independently. |

### New Files You'll Create

| File | Purpose |
|------|---------|
| `packages/mcp-server/package.json` | Package manifest for `@basesignal/mcp-server` |
| `packages/mcp-server/tsconfig.json` | TypeScript config targeting ES2023, ESM, with declaration output |
| `packages/mcp-server/vitest.config.ts` | Vitest config (node environment, no React plugin needed) |
| `packages/mcp-server/src/index.ts` | Public API barrel: re-exports `createServer` and types |
| `packages/mcp-server/src/types.ts` | `ServerConfig`, `StorageAdapter`, `LlmProvider`, `ToolContext` interfaces |
| `packages/mcp-server/src/server.ts` | `createServer()` factory function |
| `packages/mcp-server/src/transport.ts` | `createTransport()` factory (stdio only for now) |
| `packages/mcp-server/src/tools/index.ts` | `registerTools(server, context)` aggregator |
| `packages/mcp-server/src/tools/ping.ts` | Ping tool registration (no auth, no user fields) |
| `packages/mcp-server/src/cli.ts` | `#!/usr/bin/env node` entry point for `npx` usage |
| `packages/mcp-server/src/__tests__/server.test.ts` | Tests for server creation, tool registration, config injection |
| `packages/mcp-server/src/__tests__/ping.test.ts` | Tests for ping tool response format and content |
| `packages/mcp-server/src/__tests__/no-forbidden-imports.test.ts` | Grep-based test ensuring no `@clerk/`, `convex/`, `express` imports |

### Key Patterns from Existing Codebase

**Tool registration** (from `server/tools/ping.ts`):
```typescript
server.registerTool(
  "ping",
  {
    title: "Ping Basesignal",
    description: "...",
  },
  async () => ({
    content: [{ type: "text" as const, text: JSON.stringify({...}) }],
  })
);
```

**Test pattern for tool registration** (from `server/index.test.ts`):
```typescript
const server = new McpServer({ name: "test", version: "0.0.0" });
registerTools(server);
const tools = (server as any)._registeredTools;
expect(Object.keys(tools)).toContain("ping");
```

**MCP SDK imports:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
```

---

## Tasks

### Task 1: Scaffold package directory and workspace config

**What:** Create the `packages/mcp-server/` directory with `package.json`, `tsconfig.json`, and `vitest.config.ts`. Wire up npm workspaces in the root `package.json` if not already present.

**Files to create:**

1. `packages/mcp-server/package.json`:
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

2. `packages/mcp-server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/__tests__/**"]
}
```

3. `packages/mcp-server/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
  },
});
```

**Files to modify:**

4. Root `package.json` -- add `"workspaces": ["packages/*"]` if not already present.

5. Root `tsconfig.json` -- add `{ "path": "./packages/mcp-server/tsconfig.json" }` to the `references` array.

**Tests:**
- `npm install` from root succeeds (workspaces resolve).
- `cd packages/mcp-server && npx tsc --noEmit` succeeds (after source files are added in later tasks).

**Acceptance criteria:** Package directory exists with correct config files. Workspace is wired.

---

### Task 2: Create type definitions

**What:** Define the adapter interfaces (`StorageAdapter`, `LlmProvider`), the `ServerConfig` type, and the `ToolContext` type. These are intentionally minimal -- methods get added story-by-story as tools require them.

**Files to create:**

1. `packages/mcp-server/src/types.ts`:
```typescript
/**
 * Adapter interface for persistence.
 * Implementations: SQLiteStorage (self-hosted), ConvexStorage (hosted SaaS).
 * Methods are added per-story as tools are implemented (S002-S005).
 */
export interface StorageAdapter {
  // Intentionally empty for skeleton. See design doc section "Key Decisions #3".
}

/**
 * Adapter interface for LLM calls (analysis pipeline).
 * Implementations: AnthropicProvider, OpenAIProvider, OllamaProvider.
 * Methods are added when analysis tools are integrated (S002+).
 */
export interface LlmProvider {
  // Intentionally empty for skeleton. See design doc section "Key Decisions #3".
}

/**
 * Configuration for creating an MCP server instance.
 */
export interface ServerConfig {
  /** Server name shown in MCP handshake. Defaults to "basesignal". */
  name?: string;
  /** Server version shown in MCP handshake. Defaults to "0.1.0". */
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
 * Hosts can extend this (e.g., adding user identity for the hosted SaaS layer).
 */
export interface ToolContext {
  storage?: StorageAdapter;
  llmProvider?: LlmProvider;
}
```

**Tests:** Types are tested implicitly through server creation tests in Task 5. No runtime tests needed for pure type definitions.

**Acceptance criteria:** `types.ts` exports all four interfaces. No imports from `@clerk/`, `convex/`, or `express`.

---

### Task 3: Create the transport factory and ping tool

**What:** Create the transport factory (stdio only) and the ping tool handler. The ping tool is the only tool in the skeleton -- it returns server status without any auth or user fields.

**Files to create:**

1. `packages/mcp-server/src/transport.ts`:
```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerConfig } from "./types.js";

/**
 * Create a transport based on config.
 * Currently only stdio is supported (for Claude Desktop local use).
 */
export function createTransport(_config: ServerConfig) {
  // Only stdio for v1. SSE/HTTP can be added behind a config flag later.
  return new StdioServerTransport();
}
```

2. `packages/mcp-server/src/tools/ping.ts`:
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer, version: string) {
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
            version,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
  );
}
```

Note: The ping tool receives `version` as a parameter so it reflects the configured server version. It deliberately omits `authenticated`, `userId`, `clerkId`, `email`, and `name` -- those are hosted-server concerns.

3. `packages/mcp-server/src/tools/index.ts`:
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import type { ToolContext } from "../types.js";

export function registerTools(
  server: McpServer,
  context: ToolContext,
  version: string
) {
  registerPingTool(server, version);
  // Future stories add: scan, profile, definition, export tools.
  // Each receives `context` for storage/LLM access.
}
```

Note: `context` is passed through even though ping does not use it. This establishes the pattern for future tools.

**Tests:** Tool tests are in Task 5.

**Acceptance criteria:** Ping tool registered with correct metadata and response format. No forbidden imports.

---

### Task 4: Create the server factory, CLI entry point, and barrel export

**What:** Implement `createServer()` -- the single public API. Wire up the barrel export in `index.ts`. Create the CLI entry point.

**Files to create:**

1. `packages/mcp-server/src/server.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { createTransport } from "./transport.js";
import type { ServerConfig, ToolContext } from "./types.js";

const DEFAULT_NAME = "basesignal";
const DEFAULT_VERSION = "0.1.0";

/**
 * Create and start a Basesignal MCP server.
 *
 * This is the entire public API. Pass config to customize the server name,
 * version, storage adapter, or LLM provider. By default, connects over
 * stdio (for Claude Desktop).
 *
 * @example
 * ```typescript
 * import { createServer } from "@basesignal/mcp-server";
 * await createServer();
 * ```
 */
export async function createServer(config: ServerConfig = {}) {
  const name = config.name ?? DEFAULT_NAME;
  const version = config.version ?? DEFAULT_VERSION;

  const server = new McpServer({ name, version });

  const context: ToolContext = {
    storage: config.storage,
    llmProvider: config.llmProvider,
  };

  registerTools(server, context, version);

  const transport = createTransport(config);
  await server.connect(transport);

  return server;
}
```

2. `packages/mcp-server/src/index.ts`:
```typescript
export { createServer } from "./server.js";
export type {
  ServerConfig,
  StorageAdapter,
  LlmProvider,
  ToolContext,
} from "./types.js";
```

3. `packages/mcp-server/src/cli.ts`:
```typescript
#!/usr/bin/env node
import { createServer } from "./server.js";

createServer().catch((err) => {
  console.error("Failed to start Basesignal MCP server:", err);
  process.exit(1);
});
```

**Tests:** Server creation tests are in Task 5.

**Acceptance criteria:** `createServer()` is the sole public API. CLI entry point exists with shebang. Barrel exports types and `createServer`.

---

### Task 5: Write tests

**What:** Write all unit tests for the package. Tests verify: package structure, no forbidden imports, server creation, tool registration, ping response format, and config injection.

**Files to create:**

1. `packages/mcp-server/src/__tests__/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";
import type { ToolContext } from "../types.js";

describe("MCP server", () => {
  function createTestServer(name = "test", version = "0.0.1") {
    const server = new McpServer({ name, version });
    const context: ToolContext = {};
    registerTools(server, context, version);
    return server;
  }

  it("registers the ping tool", () => {
    const server = createTestServer();
    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toContain("ping");
  });

  it("registers exactly one tool in the skeleton", () => {
    const server = createTestServer();
    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools)).toHaveLength(1);
  });

  it("accepts custom server name via config", () => {
    const server = createTestServer("my-custom-server");
    // McpServer stores the name internally; verify it was constructed.
    // The server existing without error is the primary assertion.
    expect(server).toBeDefined();
  });
});
```

2. `packages/mcp-server/src/__tests__/ping.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "../tools/ping.js";

describe("ping tool", () => {
  it("is registered with correct metadata", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const ping = tools["ping"];
    expect(ping).toBeDefined();
    expect(ping.description).toBe(
      "Check that the Basesignal MCP server is running. Returns server status."
    );
  });

  it("returns status ok with server info", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].callback;
    const result = await pingHandler({});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("ok");
    expect(parsed.server).toBe("basesignal");
    expect(parsed.version).toBe("0.0.1");
    expect(parsed.timestamp).toBeDefined();
  });

  it("does NOT include user identity fields", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerPingTool(server, "0.0.1");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].callback;
    const result = await pingHandler({});
    const parsed = JSON.parse(result.content[0].text);

    // These fields belong to the hosted server, not the open-source package
    expect(parsed).not.toHaveProperty("authenticated");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("clerkId");
    expect(parsed).not.toHaveProperty("email");
    expect(parsed).not.toHaveProperty("name");
  });

  it("reflects the configured version", async () => {
    const server = new McpServer({ name: "test", version: "2.0.0" });
    registerPingTool(server, "2.0.0");

    const tools = (server as any)._registeredTools;
    const pingHandler = tools["ping"].callback;
    const result = await pingHandler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.version).toBe("2.0.0");
  });
});
```

3. `packages/mcp-server/src/__tests__/no-forbidden-imports.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..");

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...getAllTsFiles(full));
    } else if (full.endsWith(".ts") && !full.includes("__tests__")) {
      files.push(full);
    }
  }
  return files;
}

describe("no forbidden imports", () => {
  const FORBIDDEN = ["@clerk/", "convex/", '"express"', "'express'"];
  const sourceFiles = getAllTsFiles(srcDir);

  it("has source files to check", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  for (const file of sourceFiles) {
    const relative = file.replace(srcDir, "src");
    it(`${relative} has no forbidden imports`, () => {
      const content = readFileSync(file, "utf-8");
      for (const forbidden of FORBIDDEN) {
        expect(content).not.toContain(forbidden);
      }
    });
  }
});
```

**How to verify:** Run `cd packages/mcp-server && npx vitest run` -- all tests should pass.

**Acceptance criteria:** All 6+ tests pass. Tests cover: tool registration, ping response format, no user identity fields, version injection, forbidden import check.

---

### Task 6: Verify build and final checks

**What:** Run the TypeScript build, verify outputs, run all tests, and confirm the root project still works.

**Steps (manual verification, not a file creation task):**

1. Build the package:
   ```bash
   cd packages/mcp-server && npm run build
   ```
   Expected: `dist/` directory created with `.js`, `.d.ts`, and `.js.map` files. No errors.

2. Verify dist structure:
   ```
   packages/mcp-server/dist/
     index.js, index.d.ts
     server.js, server.d.ts
     transport.js, transport.d.ts
     types.js, types.d.ts
     cli.js
     tools/
       index.js, index.d.ts
       ping.js, ping.d.ts
   ```

3. Run package tests:
   ```bash
   cd packages/mcp-server && npx vitest run
   ```
   Expected: All tests pass.

4. Run root tests (ensure nothing broke):
   ```bash
   npm test -- --run
   ```
   Expected: Existing tests still pass.

5. Verify no forbidden dependencies in `packages/mcp-server/package.json`:
   - Only `@modelcontextprotocol/sdk` in `dependencies`
   - No `@clerk/`, `convex`, `express`, `cors`, `dotenv`

6. Verify `dist/cli.js` has the shebang line and is functional:
   ```bash
   head -1 packages/mcp-server/dist/cli.js
   # Should show: #!/usr/bin/env node
   ```

**Acceptance criteria:** Build succeeds. All package tests pass. Root tests unaffected. Single runtime dependency confirmed.

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `package.json` | Add `"workspaces": ["packages/*"]` |
| MODIFY | `tsconfig.json` | Add reference to `packages/mcp-server/tsconfig.json` |
| CREATE | `packages/mcp-server/package.json` | Package manifest |
| CREATE | `packages/mcp-server/tsconfig.json` | TypeScript config |
| CREATE | `packages/mcp-server/vitest.config.ts` | Vitest config |
| CREATE | `packages/mcp-server/src/index.ts` | Public API barrel |
| CREATE | `packages/mcp-server/src/types.ts` | Adapter interfaces and config types |
| CREATE | `packages/mcp-server/src/server.ts` | `createServer()` factory |
| CREATE | `packages/mcp-server/src/transport.ts` | Transport factory (stdio) |
| CREATE | `packages/mcp-server/src/tools/index.ts` | Tool registration aggregator |
| CREATE | `packages/mcp-server/src/tools/ping.ts` | Ping tool (no auth) |
| CREATE | `packages/mcp-server/src/cli.ts` | CLI entry point |
| CREATE | `packages/mcp-server/src/__tests__/server.test.ts` | Server creation tests |
| CREATE | `packages/mcp-server/src/__tests__/ping.test.ts` | Ping tool tests |
| CREATE | `packages/mcp-server/src/__tests__/no-forbidden-imports.test.ts` | Import guard tests |

**Total:** 2 files modified, 13 files created.
