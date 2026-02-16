# Implementation Plan: Export and Serve CLI Commands

**Task:** basesignal-2p4 (M008-E005-S003)
**Design:** `docs/plans/2026-02-15-export-serve-commands-design.md`
**Story:** `product/stories/M008-E005-S003-export-serve-commands.toml`

---

## Current State

- **No `packages/` directory** exists yet. The monorepo workspace setup (M008-E001-S001, task basesignal-441) has an implementation plan but has not been executed.
- **No `packages/cli/`** exists. The CLI skeleton (M008-E005-S001, task basesignal-6dm) is a blocking dependency -- it creates the CLI package with Commander, config loading, error handling, and placeholder command handlers for scan, export, and serve.
- **No `packages/mcp-server/`** exists. The MCP server extraction (M008-E002-S001) creates the standalone `@basesignal/mcp-server` package with `createServer()` and stdio transport.
- **No `packages/core/`** exists. The core package (M008-E001-S001+) provides the `ProductProfile` type and will house the shared `formatProfile()` / `exportProfileAsMarkdown()` / `exportProfileAsJson()` functions (M008-E002-S005, task basesignal-rom).
- **Existing `server/`** directory has the hosted MCP server with Clerk auth, Express, and Streamable HTTP transport. This is NOT modified by this story.
- **Dependencies:** This story depends on basesignal-6dm (CLI skeleton) and basesignal-rom (export_profile MCP tool). Both are in `plan` status. The CLI skeleton provides the command registration pattern and placeholder handlers. The export_profile story provides the `formatProfile()` functions in `@basesignal/core`.

---

## Assumptions

This plan assumes the following are complete before implementation begins:

1. **packages/core/** exists with `ProductProfile` types and `exportProfileAsJson()` / `exportProfileAsMarkdown()` functions in `packages/core/src/export.ts`.
2. **packages/cli/** exists with the Commander skeleton from M008-E005-S001: `src/index.ts` (entry point), `src/commands/export.ts` (placeholder), `src/commands/serve.ts` (placeholder), `src/config.ts` (loadConfig, env vars), `src/errors.ts` (CLIError, handleError).
3. **packages/mcp-server/** exists with `createServer(config)` from M008-E002-S001 that starts the MCP server on stdio transport.
4. **packages/storage/** exists (or storage adapter interface is defined) with `StorageAdapter` that has `list()` and `load(id)` methods.

If any of these are not yet complete, this story blocks on them.

---

## Steps (in order)

### Step 1: Create `packages/cli/src/lib/resolve-input.ts` -- input type detection

**File:** `packages/cli/src/lib/resolve-input.ts` (NEW)

```typescript
/**
 * Determine whether a CLI argument refers to a file path or a storage ID.
 *
 * File heuristic: contains path separators (/ or \) or ends with .json.
 * Everything else is treated as a storage ID.
 */
export function resolveInput(
  idOrFile: string
): { type: "storage"; id: string } | { type: "file"; path: string } {
  if (
    idOrFile.includes("/") ||
    idOrFile.includes("\\") ||
    idOrFile.endsWith(".json")
  ) {
    return { type: "file", path: idOrFile };
  }
  return { type: "storage", id: idOrFile };
}
```

**Why a separate file:** The design doc specifies this as a standalone helper. It is a pure function, trivially testable in isolation, and keeps the command handler clean.

---

### Step 2: Create `packages/cli/src/lib/resolve-input.test.ts` -- tests for input resolution

**File:** `packages/cli/src/lib/resolve-input.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
import { resolveInput } from "./resolve-input.js";

describe("resolveInput", () => {
  it("treats a bare string as a storage ID", () => {
    expect(resolveInput("abc123")).toEqual({ type: "storage", id: "abc123" });
  });

  it("treats a UUID as a storage ID", () => {
    expect(resolveInput("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toEqual({
      type: "storage",
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
  });

  it("treats a path with / as a file", () => {
    expect(resolveInput("./profile.json")).toEqual({
      type: "file",
      path: "./profile.json",
    });
  });

  it("treats a path with \\ as a file", () => {
    expect(resolveInput("C:\\Users\\data\\profile.json")).toEqual({
      type: "file",
      path: "C:\\Users\\data\\profile.json",
    });
  });

  it("treats a .json extension as a file", () => {
    expect(resolveInput("profile.json")).toEqual({
      type: "file",
      path: "profile.json",
    });
  });

  it("treats an absolute path as a file", () => {
    expect(resolveInput("/home/user/profile.json")).toEqual({
      type: "file",
      path: "/home/user/profile.json",
    });
  });

  it("treats a relative directory path as a file", () => {
    expect(resolveInput("data/my-profile")).toEqual({
      type: "file",
      path: "data/my-profile",
    });
  });
});
```

---

### Step 3: Replace export command placeholder in `packages/cli/src/commands/export.ts`

**File:** `packages/cli/src/commands/export.ts` (MODIFY -- replace placeholder from CLI skeleton)

The CLI skeleton (S001) created this file with a placeholder `action` that prints "export command not yet implemented" and exits. Replace the entire file contents with the real implementation.

```typescript
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { resolveInput } from "../lib/resolve-input.js";
import { exportProfileAsMarkdown, exportProfileAsJson } from "@basesignal/core";
import type { StorageAdapter } from "@basesignal/mcp-server";

export function registerExportCommand(
  program: Command,
  getStorage: () => StorageAdapter
) {
  program
    .command("export [id-or-file]")
    .description("Export a product profile as markdown or JSON")
    .option("-f, --format <format>", "Output format (markdown|json)", "markdown")
    .option("-o, --output <path>", "Write to file instead of stdout")
    .option("-l, --list", "List all stored profiles")
    .action(async (idOrFile: string | undefined, opts: {
      format: string;
      output?: string;
      list?: boolean;
    }) => {
      const storage = getStorage();

      // --list: show all profiles
      if (opts.list) {
        const profiles = await storage.list();
        if (profiles.length === 0) {
          console.log(
            "No profiles stored. Run `basesignal scan <url>` to create one."
          );
          return;
        }
        for (const p of profiles) {
          console.log(`  ${p.id}  ${p.name}  ${p.url}  (${p.updatedAt})`);
        }
        return;
      }

      // Require id-or-file when not listing
      if (!idOrFile) {
        console.error(
          "Error: provide a profile ID or file path. Use --list to see stored profiles."
        );
        process.exit(1);
      }

      // Resolve input type
      const input = resolveInput(idOrFile);
      let profile;

      if (input.type === "file") {
        try {
          const raw = readFileSync(input.path, "utf-8");
          profile = JSON.parse(raw);
        } catch (err) {
          console.error(
            `Error: could not read file "${input.path}": ${err instanceof Error ? err.message : String(err)}`
          );
          process.exit(1);
        }
      } else {
        const loaded = await storage.load(input.id);
        if (!loaded) {
          console.error(
            `Error: profile "${input.id}" not found. Use --list to see stored profiles.`
          );
          process.exit(1);
        }
        profile = loaded;
      }

      // Validate format
      const format = opts.format as "markdown" | "json";
      if (format !== "markdown" && format !== "json") {
        console.error(
          `Error: unsupported format "${opts.format}". Use "markdown" or "json".`
        );
        process.exit(1);
      }

      // Format the profile
      const output =
        format === "json"
          ? exportProfileAsJson(profile)
          : exportProfileAsMarkdown(profile);

      // Output to file or stdout
      if (opts.output) {
        writeFileSync(opts.output, output, "utf-8");
        console.error(`Written to ${opts.output}`);
      } else {
        process.stdout.write(output);
      }
    });
}
```

**Key details:**
- `[id-or-file]` uses square brackets (optional argument) because `--list` does not require it.
- Format validation happens after input loading -- fail fast on missing/bad input before doing work.
- `console.error` for the "Written to" confirmation message, so piped output stays clean.
- File read errors are caught and produce a helpful message (not a stack trace).
- Imports `exportProfileAsMarkdown` and `exportProfileAsJson` from `@basesignal/core` -- the shared format functions from M008-E002-S005.
- Imports `StorageAdapter` from `@basesignal/mcp-server` (or wherever the interface is defined after dependency stories land).

**Signature change note:** The CLI skeleton's `registerExportCommand` takes `(program: Command)`. This implementation changes the signature to `(program: Command, getStorage: () => StorageAdapter)`. The entry point (`src/index.ts`) must be updated to pass the storage factory. See Step 5.

---

### Step 4: Replace serve command placeholder in `packages/cli/src/commands/serve.ts`

**File:** `packages/cli/src/commands/serve.ts` (MODIFY -- replace placeholder from CLI skeleton)

```typescript
import { Command } from "commander";
import type { StorageAdapter, LlmProvider } from "@basesignal/mcp-server";

export function registerServeCommand(
  program: Command,
  getStorage: () => StorageAdapter,
  getProvider: () => LlmProvider
) {
  program
    .command("serve")
    .description("Start the Basesignal MCP server (stdio transport)")
    .action(async () => {
      // Dynamic import to avoid loading MCP server deps for other commands
      const { createServer } = await import("@basesignal/mcp-server");

      // All output goes to stderr so stdout stays clean for MCP JSON-RPC protocol
      console.error("Starting Basesignal MCP server (stdio)...");

      await createServer({
        storage: getStorage(),
        llmProvider: getProvider(),
      });

      console.error("Basesignal MCP server running. Connect from Claude Desktop.");
    });
}
```

**Key details:**
- Dynamic `import()` for `@basesignal/mcp-server` so that running `basesignal export` does not load the entire MCP SDK.
- `console.error` exclusively -- stdout is reserved for MCP JSON-RPC protocol over stdio.
- No `--transport` or `--port` flags (deferred per design doc -- stdio only for v1).
- The design doc's serve command placeholder from S001 had `--port` and `--transport` options. These are removed per the design doc's simplification.
- Signature changes from `(program: Command)` to `(program: Command, getStorage, getProvider)`. See Step 5.

---

### Step 5: Update entry point `packages/cli/src/index.ts` -- pass storage and provider factories

**File:** `packages/cli/src/index.ts` (MODIFY)

The CLI skeleton's entry point calls `registerExportCommand(program)` and `registerServeCommand(program)` with no dependencies. The implementations need storage and LLM provider factories. Update the registrations to pass these.

The exact change depends on how the skeleton is structured, but the modification is:

```diff
 import { registerScanCommand } from "./commands/scan.js";
 import { registerExportCommand } from "./commands/export.js";
 import { registerServeCommand } from "./commands/serve.js";
+import { loadConfig } from "./config.js";
 import { handleError } from "./errors.js";

 const program = new Command()
   .name("basesignal")
   .description("Product profile analysis from the command line")
   .version(version)
   .option("--verbose", "Enable verbose output", false);

+// Lazy factories -- only created when a command that needs them runs
+const getStorage = () => {
+  const config = loadConfig({ verbose: program.opts().verbose });
+  // Import will resolve to the storage package when available
+  // For now, use whatever StorageAdapter implementation exists
+  const { createStorage } = require("@basesignal/storage");
+  return createStorage(config.storagePath);
+};
+
+const getProvider = () => {
+  const config = loadConfig({ verbose: program.opts().verbose });
+  const { createProvider } = require("@basesignal/llm");
+  return createProvider(config);
+};

-registerScanCommand(program);
-registerExportCommand(program);
-registerServeCommand(program);
+registerScanCommand(program, getStorage, getProvider);
+registerExportCommand(program, getStorage);
+registerServeCommand(program, getStorage, getProvider);

 program.parseAsync(process.argv).catch(handleError);
```

**Important:** The exact storage/provider factory implementations depend on which packages exist at implementation time. The factories above are illustrative. The real implementation should:
1. Use dynamic `import()` (not `require()`) since the project is ESM.
2. Import from whatever package provides the storage adapter (likely `@basesignal/storage` or a SQLite adapter in `@basesignal/core`).
3. Import from whatever package provides the LLM provider factory.

The factories are lazy (called inside the command handler, not at registration time) so that `basesignal --help` and `basesignal --version` work without any dependencies being resolved.

---

### Step 6: Create `packages/cli/src/commands/export.test.ts` -- export command tests

**File:** `packages/cli/src/commands/export.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerExportCommand } from "./export.js";

// Mock storage adapter
function createMockStorage(profiles: Array<{
  id: string;
  name: string;
  url: string;
  updatedAt: string;
}> = []) {
  return {
    list: vi.fn().mockResolvedValue(profiles),
    load: vi.fn().mockImplementation(async (id: string) => {
      const match = profiles.find((p) => p.id === id);
      return match ?? null;
    }),
  };
}

// Helper to capture stdout/stderr and exit calls
function setupCapture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | undefined;

  vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
    stdout.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
    stderr.push(args.join(" "));
  });
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code})`);
  });

  return {
    getStdout: () => stdout.join("\n"),
    getStderr: () => stderr.join("\n"),
    getExitCode: () => exitCode,
  };
}

// Helper to run a command with arguments
async function runExport(
  args: string[],
  storage = createMockStorage()
) {
  const program = new Command();
  program.exitOverride(); // Throw on exit instead of calling process.exit
  registerExportCommand(program, () => storage as any);

  try {
    await program.parseAsync(["node", "basesignal", "export", ...args]);
  } catch {
    // Commander throws on exit, expected for error cases
  }
}

describe("export command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("--list", () => {
    it("shows all stored profiles", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        { id: "abc123", name: "Linear", url: "https://linear.app", updatedAt: "2026-02-14" },
        { id: "def456", name: "Notion", url: "https://notion.so", updatedAt: "2026-02-13" },
      ]);

      await runExport(["--list"], storage);

      expect(storage.list).toHaveBeenCalled();
      const output = capture.getStdout();
      expect(output).toContain("abc123");
      expect(output).toContain("Linear");
      expect(output).toContain("https://linear.app");
    });

    it("shows helpful message when no profiles exist", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([]);

      await runExport(["--list"], storage);

      const output = capture.getStdout();
      expect(output).toContain("No profiles stored");
      expect(output).toContain("basesignal scan");
    });
  });

  describe("export by ID", () => {
    it("loads profile from storage and outputs markdown by default", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        { id: "abc123", name: "Linear", url: "https://linear.app", updatedAt: "2026-02-14" },
      ]);
      // Mock load to return a full profile object
      storage.load.mockResolvedValue({
        id: "abc123",
        identity: { productName: "Linear", description: "Issue tracker" },
        completeness: 0.8,
        overallConfidence: 0.7,
      });

      await runExport(["abc123"], storage);

      expect(storage.load).toHaveBeenCalledWith("abc123");
      const output = capture.getStdout();
      expect(output).toContain("Linear");
    });

    it("outputs JSON when --format json is specified", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();
      storage.load.mockResolvedValue({
        id: "abc123",
        identity: { productName: "Linear" },
      });

      await runExport(["abc123", "--format", "json"], storage);

      const output = capture.getStdout();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("prints error and exits 1 when profile not found", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();
      storage.load.mockResolvedValue(null);

      await runExport(["nonexistent-id"], storage);

      const errors = capture.getStderr();
      expect(errors).toContain("not found");
      expect(errors).toContain("--list");
      expect(capture.getExitCode()).toBe(1);
    });
  });

  describe("export from file", () => {
    it("detects file paths via resolveInput", async () => {
      // This test verifies the integration with resolveInput
      // The actual file read will fail in tests, but we verify it tries to read
      const capture = setupCapture();
      const storage = createMockStorage();

      await runExport(["./profile.json"], storage);

      // Should NOT call storage.load (it's a file path, not a storage ID)
      expect(storage.load).not.toHaveBeenCalled();
      // Will error because the file doesn't exist, which is expected
      expect(capture.getExitCode()).toBe(1);
      expect(capture.getStderr()).toContain("could not read file");
    });
  });

  describe("no arguments", () => {
    it("prints usage hint and exits 1 when no id and no --list", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();

      await runExport([], storage);

      const errors = capture.getStderr();
      expect(errors).toContain("provide a profile ID or file path");
      expect(capture.getExitCode()).toBe(1);
    });
  });

  describe("--output flag", () => {
    it("writes to file and prints confirmation to stderr", async () => {
      // This test requires mocking writeFileSync
      // Implementation will use vi.mock for node:fs
      const capture = setupCapture();
      const storage = createMockStorage();
      storage.load.mockResolvedValue({
        id: "abc123",
        identity: { productName: "Linear" },
      });

      // Mock writeFileSync
      const fs = await import("node:fs");
      vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

      await runExport(["abc123", "--output", "out.md"], storage);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "out.md",
        expect.any(String),
        "utf-8"
      );
      expect(capture.getStderr()).toContain("Written to out.md");
    });
  });
});
```

**Note:** The exact test implementations will need adjustment based on how `@basesignal/core` export functions are imported. If they are not available at test time, they should be mocked via `vi.mock("@basesignal/core", ...)`.

---

### Step 7: Create `packages/cli/src/commands/serve.test.ts` -- serve command tests

**File:** `packages/cli/src/commands/serve.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerServeCommand } from "./serve.js";

describe("serve command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is registered on the program", () => {
    const program = new Command();
    const getStorage = vi.fn();
    const getProvider = vi.fn();

    registerServeCommand(program, getStorage as any, getProvider as any);

    // Commander stores commands internally
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("serve");
  });

  it("has correct description", () => {
    const program = new Command();
    registerServeCommand(program, vi.fn() as any, vi.fn() as any);

    const serveCmd = program.commands.find((c) => c.name() === "serve");
    expect(serveCmd?.description()).toContain("MCP server");
    expect(serveCmd?.description()).toContain("stdio");
  });

  it("calls createServer from @basesignal/mcp-server when run", async () => {
    const mockCreateServer = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@basesignal/mcp-server", () => ({
      createServer: mockCreateServer,
    }));

    const program = new Command();
    program.exitOverride();

    const mockStorage = { list: vi.fn(), load: vi.fn() };
    const mockProvider = {};

    registerServeCommand(
      program,
      () => mockStorage as any,
      () => mockProvider as any
    );

    // Capture stderr to avoid noise
    vi.spyOn(console, "error").mockImplementation(() => {});

    await program.parseAsync(["node", "basesignal", "serve"]);

    expect(mockCreateServer).toHaveBeenCalledWith({
      storage: mockStorage,
      llmProvider: mockProvider,
    });
  });

  it("writes startup messages to stderr, not stdout", async () => {
    vi.doMock("@basesignal/mcp-server", () => ({
      createServer: vi.fn().mockResolvedValue(undefined),
    }));

    const stderrMessages: string[] = [];
    const stdoutMessages: string[] = [];

    vi.spyOn(console, "error").mockImplementation((...args) => {
      stderrMessages.push(args.join(" "));
    });
    vi.spyOn(console, "log").mockImplementation((...args) => {
      stdoutMessages.push(args.join(" "));
    });

    const program = new Command();
    program.exitOverride();
    registerServeCommand(program, vi.fn() as any, vi.fn() as any);

    await program.parseAsync(["node", "basesignal", "serve"]);

    expect(stderrMessages.some((m) => m.includes("Starting"))).toBe(true);
    expect(stdoutMessages).toHaveLength(0);
  });

  it("does not accept --transport or --port flags (deferred)", () => {
    const program = new Command();
    registerServeCommand(program, vi.fn() as any, vi.fn() as any);

    const serveCmd = program.commands.find((c) => c.name() === "serve");
    const optionNames = serveCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--transport");
    expect(optionNames).not.toContain("--port");
  });
});
```

---

### Step 8: Add `@basesignal/core` and `@basesignal/mcp-server` as dependencies in CLI package.json

**File:** `packages/cli/package.json` (MODIFY)

```diff
 "dependencies": {
-  "commander": "^13.0.0"
+  "commander": "^13.0.0",
+  "@basesignal/core": "workspace:*",
+  "@basesignal/mcp-server": "workspace:*"
 },
```

**Why:** The export command imports `exportProfileAsMarkdown` and `exportProfileAsJson` from `@basesignal/core`. The serve command dynamically imports `createServer` from `@basesignal/mcp-server`. Both are workspace dependencies.

**Note:** If the workspace protocol `workspace:*` is not supported by the project's package manager, use `"*"` instead and rely on npm workspaces resolution.

---

### Step 9: Run `npm install` to link workspace dependencies

```bash
cd /home/tmo/roadtothebeach/tmo/basesignal && npm install
```

This ensures `@basesignal/core` and `@basesignal/mcp-server` are properly symlinked into `node_modules/` for the CLI package.

---

## Verification Commands (in order)

After all changes, run these to confirm the acceptance criteria are met:

```bash
# 1. resolve-input tests pass
cd packages/cli && npx vitest run src/lib/resolve-input.test.ts
# Should show all 7 tests passing

# 2. export command tests pass
cd packages/cli && npx vitest run src/commands/export.test.ts
# Should show all export tests passing

# 3. serve command tests pass
cd packages/cli && npx vitest run src/commands/serve.test.ts
# Should show all serve tests passing

# 4. Full CLI test suite passes
cd packages/cli && npx vitest run
# All tests pass (skeleton tests + new tests)

# 5. TypeScript type-check passes
cd packages/cli && npx tsc --noEmit
# No type errors

# 6. Build succeeds
cd packages/cli && npx tsup
# Produces dist/index.js with shebang

# 7. Existing app tests still pass
cd /home/tmo/roadtothebeach/tmo/basesignal && npm test -- --run
# All existing tests pass (root vitest excludes packages/**)

# 8. Help text shows updated command descriptions
node packages/cli/dist/index.js export --help
# Shows: export [id-or-file], --format, --output, --list options

node packages/cli/dist/index.js serve --help
# Shows: serve, description mentions stdio, NO --transport or --port
```

---

## Gotchas and Edge Cases

### 1. Dependency ordering
This story cannot be implemented until M008-E005-S001 (CLI skeleton) and M008-E002-S005 (export_profile MCP tool, which includes the `@basesignal/core` format functions) are complete. The Beads dependencies already reflect this (basesignal-6dm and basesignal-rom both block basesignal-2p4).

### 2. StorageAdapter interface shape
The design doc references `storage.list()` and `storage.load(id)`. The exact return types depend on how `StorageAdapter` is defined in `@basesignal/mcp-server` or `@basesignal/core`. The `list()` method must return an array of objects with at least `{ id, name, url, updatedAt }`. The `load()` method must return `ProductProfile | null`. If the interface does not yet have these methods when this story is implemented, they need to be added to the interface (coordinate with the storage story).

### 3. Dynamic import for serve command
The `serve` command uses `await import("@basesignal/mcp-server")` instead of a top-level import. This avoids loading the MCP SDK, stdio transport, and all tool registration code when the user runs `basesignal export` or `basesignal --help`. This is a real performance consideration since the MCP SDK is not small.

### 4. Commander optional argument with `--list` flag
The export command uses `[id-or-file]` (optional positional argument) because `--list` does not need it. Commander handles this correctly -- the positional arg is `undefined` when omitted. The handler checks for `--list` first, then requires the positional arg.

### 5. `process.exit` in command handlers
The design doc calls `process.exit(1)` for error cases. In tests, this must be mocked. The test helper uses `vi.spyOn(process, "exit")` and throws to prevent actual termination. Alternatively, Commander's `exitOverride()` can be used.

### 6. stdout vs stderr discipline
- `console.log` and `process.stdout.write` are for profile data (export output, list output).
- `console.error` is for human messages ("Written to file", "Starting server...", errors).
- The serve command MUST NOT write anything to stdout -- it is reserved for MCP JSON-RPC.

### 7. `registerExportCommand` and `registerServeCommand` signature changes
The CLI skeleton (S001) registered commands with `(program: Command)` only. This story changes signatures to accept storage and provider factories. The entry point (`src/index.ts`) must be updated to provide these. If S001 is the only consumer, this is a clean change. If other code imports these registration functions, update those call sites too.

### 8. Format function import path
The design doc says format functions live in `@basesignal/core`. The export_profile design specifically puts them in `packages/core/src/export.ts` and exports them from the package index. The CLI import is:
```typescript
import { exportProfileAsMarkdown, exportProfileAsJson } from "@basesignal/core";
```
If `@basesignal/core` does not yet export these (because the export_profile story is in progress), this will be a type error. Coordinate with that story or stub the imports temporarily.

---

## Files Summary

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `packages/cli/src/lib/resolve-input.ts` | CREATE | Input type detection (file vs storage ID) |
| 2 | `packages/cli/src/lib/resolve-input.test.ts` | CREATE | Tests for resolveInput |
| 3 | `packages/cli/src/commands/export.ts` | MODIFY | Replace placeholder with real export command |
| 4 | `packages/cli/src/commands/serve.ts` | MODIFY | Replace placeholder with real serve command |
| 5 | `packages/cli/src/index.ts` | MODIFY | Pass storage/provider factories to command registrations |
| 6 | `packages/cli/src/commands/export.test.ts` | CREATE | Tests for export command |
| 7 | `packages/cli/src/commands/serve.test.ts` | CREATE | Tests for serve command |
| 8 | `packages/cli/package.json` | MODIFY | Add @basesignal/core and @basesignal/mcp-server dependencies |

**Total: 8 touchpoints (4 modified, 4 created)**

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Covered In |
|---------------------|------------|
| `export <id-or-file> --format markdown` outputs markdown to stdout | Step 3 (export.ts handler), Step 6 (export.test.ts) |
| `export <id-or-file> --format json --output file.json` saves to file | Step 3 (export.ts --output flag), Step 6 (--output test) |
| `export --list` shows all stored profiles | Step 3 (export.ts --list), Step 6 (--list tests) |
| `serve` starts MCP server on stdio transport (default) | Step 4 (serve.ts handler), Step 7 (serve.test.ts) |
| `serve --transport sse --port 3000` starts with SSE transport | **Deferred** (per design doc, stdio only for v1) |
| `serve` works with Claude Desktop MCP configuration | Step 4 (serve.ts produces correct stdio behavior), Manual verification |
