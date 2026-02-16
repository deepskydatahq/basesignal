# Implementation Plan: CLI Package Skeleton with Command Structure

**Task:** basesignal-6dm
**Story:** M008-E005-S001
**Design:** [2026-02-15-cli-skeleton-design.md](./2026-02-15-cli-skeleton-design.md)

## Summary

Create the `@basesignal/cli` package at `packages/cli/` with a `basesignal` command exposing three subcommands (`scan`, `export`, `serve`), environment-variable configuration, and error handling. Command handlers are stubs -- implementations come in S002 and S003.

**Prerequisite:** This story depends on M008-E001-S001 (monorepo workspace setup). If `packages/` does not yet exist with npm workspaces configured in the root `package.json`, Step 1 below must handle that setup. If it already exists, skip the workspace parts of Step 1.

## Steps

### Step 1: Create `packages/cli/` directory and `package.json`

**File:** `packages/cli/package.json` (new)

Create the package manifest:

```json
{
  "name": "@basesignal/cli",
  "version": "0.0.1",
  "description": "Product profile analysis from the command line",
  "type": "module",
  "bin": {
    "basesignal": "./dist/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  },
  "peerDependencies": {
    "@basesignal/core": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@basesignal/core": {
      "optional": true
    }
  },
  "license": "MIT"
}
```

If the root `package.json` does not already have a `"workspaces"` field, add:

```json
"workspaces": ["packages/*"]
```

Then run `npm install` from the root to resolve the workspace and install `commander`.

### Step 2: Create `packages/cli/tsconfig.json`

**File:** `packages/cli/tsconfig.json` (new)

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

Key choices:
- Mirrors the root `tsconfig.node.json` conventions (ES2023, strict, bundler resolution)
- `resolveJsonModule` enabled so `index.ts` can import `package.json` for the version string
- `noEmit: true` because tsup handles the build, not tsc

### Step 3: Create `packages/cli/tsup.config.ts`

**File:** `packages/cli/tsup.config.ts` (new)

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

The `banner` option prepends the shebang line so the built output is directly executable without a wrapper script.

### Step 4: Create `packages/cli/vitest.config.ts`

**File:** `packages/cli/vitest.config.ts` (new)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

Node environment (not jsdom) -- this is a CLI package, no DOM needed.

### Step 5: Create `src/errors.ts` -- Error handling utilities

**File:** `packages/cli/src/errors.ts` (new)

Implement:
- `CLIError` class extending `Error` with an optional `hint` string for user-friendly guidance
- `handleError(error: unknown): never` function that formats errors to stderr and exits with code 1:
  - `CLIError` instances: print message + hint
  - Regular `Error` instances: print message only
  - Unknown errors: print generic message
- `requireApiKey(config: BasesignalConfig): string` function that throws `CLIError` with a provider-specific hint when the API key is missing (e.g., "Set ANTHROPIC_API_KEY environment variable")
  - Returns empty string for `ollama` provider (no key needed)

This file is created before `config.ts` because `requireApiKey` imports `BasesignalConfig` from config, but the error types themselves have no dependencies.

**Note:** `requireApiKey` can alternatively live in `config.ts` to avoid a circular dependency. If `errors.ts` needs to import from `config.ts`, move `requireApiKey` into `config.ts` instead and keep `errors.ts` dependency-free.

### Step 6: Create `src/config.ts` -- Configuration loading

**File:** `packages/cli/src/config.ts` (new)

Implement:
- `BasesignalConfig` interface with fields:
  - `provider: "anthropic" | "openai" | "ollama"`
  - `model?: string`
  - `apiKey?: string`
  - `storagePath: string`
  - `verbose: boolean`
- `loadConfig(overrides?: Partial<BasesignalConfig>): BasesignalConfig` function:
  - `provider`: `overrides.provider` > `process.env.BASESIGNAL_PROVIDER` > `"anthropic"`
  - `model`: `overrides.model` > `process.env.BASESIGNAL_MODEL` > `undefined`
  - `apiKey`: resolved via `resolveApiKey()` based on provider
  - `storagePath`: `process.env.BASESIGNAL_STORAGE` > `path.join(os.homedir(), ".basesignal")`
  - `verbose`: `overrides.verbose` > `false`
- `resolveApiKey(provider: string): string | undefined` (private):
  - `"anthropic"` -> `process.env.ANTHROPIC_API_KEY`
  - `"openai"` -> `process.env.OPENAI_API_KEY`
  - `"ollama"` -> `undefined` (no key needed)
- `requireApiKey(config: BasesignalConfig): string` function (moved here from errors.ts to keep errors.ts dependency-free):
  - Throws `CLIError` with hint if key is missing for non-ollama providers
  - Returns `""` for ollama

### Step 7: Create `src/commands/scan.ts` -- Scan command definition

**File:** `packages/cli/src/commands/scan.ts` (new)

```typescript
import type { Command } from "commander";

export function registerScanCommand(program: Command): void {
  program
    .command("scan <url>")
    .description("Crawl a URL and generate a product profile")
    .option("-o, --output <file>", "Save output to file")
    .option("-f, --format <format>", "Output format (json|markdown)", "markdown")
    .option("--provider <provider>", "LLM provider (anthropic|openai|ollama)")
    .option("--model <model>", "LLM model override")
    .action(async (_url: string, _options: Record<string, unknown>) => {
      console.error("scan command not yet implemented");
      process.exit(1);
    });
}
```

Stub handler prints error and exits with code 1. Implemented in M008-E005-S002.

### Step 8: Create `src/commands/export.ts` -- Export command definition

**File:** `packages/cli/src/commands/export.ts` (new)

```typescript
import type { Command } from "commander";

export function registerExportCommand(program: Command): void {
  program
    .command("export <source>")
    .description("Export a stored profile to a different format")
    .option("-f, --format <format>", "Output format (json|markdown)", "markdown")
    .option("-o, --output <file>", "Save output to file")
    .option("-l, --list", "List all stored profiles")
    .action(async (_source: string, _options: Record<string, unknown>) => {
      console.error("export command not yet implemented");
      process.exit(1);
    });
}
```

Stub handler. Implemented in M008-E005-S003.

### Step 9: Create `src/commands/serve.ts` -- Serve command definition

**File:** `packages/cli/src/commands/serve.ts` (new)

```typescript
import type { Command } from "commander";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the Basesignal MCP server")
    .option("-p, --port <port>", "Port number", "3000")
    .option("--transport <transport>", "Transport type (stdio|sse)", "stdio")
    .action(async (_options: Record<string, unknown>) => {
      console.error("serve command not yet implemented");
      process.exit(1);
    });
}
```

Stub handler. Implemented in M008-E005-S003.

### Step 10: Create `src/index.ts` -- Entry point

**File:** `packages/cli/src/index.ts` (new)

```typescript
import { Command } from "commander";
import { registerScanCommand } from "./commands/scan.js";
import { registerExportCommand } from "./commands/export.js";
import { registerServeCommand } from "./commands/serve.js";
import { handleError } from "./errors.js";

const program = new Command()
  .name("basesignal")
  .description("Product profile analysis from the command line")
  .version("0.0.1")
  .option("--verbose", "Enable verbose output", false);

registerScanCommand(program);
registerExportCommand(program);
registerServeCommand(program);

program.parseAsync(process.argv).catch(handleError);
```

**Note on version:** The design shows importing version from `package.json` via `import ... with { type: "json" }`. However, this requires `resolveJsonModule` + import attributes support in the bundler. If that causes issues with tsup or TypeScript, hardcode the version string as `"0.0.1"` for now -- it can be made dynamic in a later story. The important thing is `basesignal --version` works.

### Step 11: Write tests for error handling

**File:** `packages/cli/src/errors.test.ts` (new)

Test cases:
1. **CLIError has correct name and message** -- `new CLIError("test")` has `name === "CLIError"` and `message === "test"`
2. **CLIError stores hint** -- `new CLIError("msg", "hint text")` has `hint === "hint text"`
3. **CLIError hint is optional** -- `new CLIError("msg")` has `hint === undefined`
4. **handleError formats CLIError with hint** -- mock `console.error` and `process.exit`, call `handleError(new CLIError("msg", "hint"))`, verify both message and hint are printed
5. **handleError formats CLIError without hint** -- verify only message is printed, no "Hint:" line
6. **handleError formats regular Error** -- `handleError(new Error("boom"))` prints `"Error: boom"`
7. **handleError formats unknown error** -- `handleError("string")` prints generic message
8. **handleError exits with code 1** -- all cases call `process.exit(1)`

Use `vi.spyOn(console, "error")` and `vi.spyOn(process, "exit")` with `.mockImplementation(() => { throw new Error("exit"); })` to capture behavior without actually exiting.

### Step 12: Write tests for configuration

**File:** `packages/cli/src/config.test.ts` (new)

Test cases:
1. **Default config** -- `loadConfig()` returns `provider: "anthropic"`, `model: undefined`, `storagePath` ending in `.basesignal`, `verbose: false`
2. **Overrides take precedence** -- `loadConfig({ provider: "openai", verbose: true })` returns those values
3. **BASESIGNAL_PROVIDER env var** -- set `process.env.BASESIGNAL_PROVIDER = "openai"`, `loadConfig()` returns `provider: "openai"`. Clean up env after.
4. **BASESIGNAL_MODEL env var** -- set `process.env.BASESIGNAL_MODEL = "gpt-4"`, `loadConfig()` returns `model: "gpt-4"`
5. **BASESIGNAL_STORAGE env var** -- set `process.env.BASESIGNAL_STORAGE = "/tmp/test"`, `loadConfig()` returns `storagePath: "/tmp/test"`
6. **ANTHROPIC_API_KEY resolved for anthropic provider** -- set env var, verify `apiKey` field is populated
7. **OPENAI_API_KEY resolved for openai provider** -- set env var + provider override, verify correct key
8. **Ollama has no API key** -- `loadConfig({ provider: "ollama" })` returns `apiKey: undefined`
9. **Overrides beat env vars** -- set `BASESIGNAL_PROVIDER=anthropic`, call `loadConfig({ provider: "openai" })`, returns `provider: "openai"`
10. **requireApiKey throws CLIError for anthropic without key** -- unset `ANTHROPIC_API_KEY`, call `requireApiKey()`, verify CLIError with hint mentioning `ANTHROPIC_API_KEY`
11. **requireApiKey throws CLIError for openai without key** -- similar, hint mentions `OPENAI_API_KEY`
12. **requireApiKey returns empty string for ollama** -- no error thrown
13. **requireApiKey returns key when present** -- set `ANTHROPIC_API_KEY`, verify returned value

Use `beforeEach`/`afterEach` (or save/restore pattern) to manage `process.env` mutations without leaking between tests. Alternatively, use a helper that saves and restores env for each test.

### Step 13: Write tests for CLI structure

**File:** `packages/cli/src/index.test.ts` (new)

Test the CLI command structure by importing Commander and verifying registration:

1. **Program has correct name** -- import and parse, verify `program.name() === "basesignal"`
2. **Program has version** -- `program.version() === "0.0.1"`
3. **Program has --verbose option** -- verify option is registered
4. **Three commands registered** -- `program.commands` has length 3
5. **scan command exists with correct usage** -- find command named "scan", verify `<url>` argument, verify options: `--output`, `--format`, `--provider`, `--model`
6. **export command exists with correct usage** -- find command named "export", verify `<source>` argument, verify options: `--format`, `--output`, `--list`
7. **serve command exists with correct usage** -- find command named "serve", verify options: `--port`, `--transport`
8. **scan --format defaults to markdown** -- verify default value
9. **serve --port defaults to 3000** -- verify default value
10. **serve --transport defaults to stdio** -- verify default value

**Approach:** Rather than spawning a subprocess, construct the program object directly by importing the registration functions and calling them on a fresh `Command()` instance. This keeps tests fast and deterministic.

Alternatively, if the entry point is structured so the program is exported (or the registration is testable separately), test the registration functions directly. If the entry point immediately calls `parseAsync`, extract the program creation into a factory function (`createProgram()`) that can be imported and tested without triggering `parseAsync`.

**Refactor for testability:** If needed, split `src/index.ts` into:
- `src/program.ts` -- exports `createProgram()` which builds and returns the `Command` instance
- `src/index.ts` -- imports `createProgram()`, calls `program.parseAsync(process.argv).catch(handleError)`

Then tests import `createProgram()` from `src/program.ts`.

### Step 14: Build and verify

Run from the repo root:

```bash
# Install deps (resolves workspace + commander)
npm install

# Type check
cd packages/cli && npx tsc --noEmit

# Build
cd packages/cli && npx tsup

# Verify shebang in output
head -1 packages/cli/dist/index.js
# Should show: #!/usr/bin/env node

# Verify CLI works
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js scan --help
node packages/cli/dist/index.js export --help
node packages/cli/dist/index.js serve --help

# Run tests
cd packages/cli && npx vitest run

# Verify existing app still works
npm test
```

### Step 15: Verify existing app is unaffected

Run from the repo root:

```bash
npm test
npm run build
```

Confirm zero changes to `src/`, `convex/`, or `server/` directories. The workspace addition should not break the existing Vite + React + Convex setup.

## Files Changed

| File | Change Type |
|------|-------------|
| `package.json` (root) | Add `"workspaces": ["packages/*"]` (if not already present) |
| `packages/cli/package.json` | New -- package manifest with bin entry |
| `packages/cli/tsconfig.json` | New -- TypeScript configuration |
| `packages/cli/tsup.config.ts` | New -- Build configuration |
| `packages/cli/vitest.config.ts` | New -- Test configuration |
| `packages/cli/src/index.ts` | New -- Entry point (or thin wrapper calling `createProgram()`) |
| `packages/cli/src/program.ts` | New (optional) -- `createProgram()` factory for testability |
| `packages/cli/src/commands/scan.ts` | New -- Scan subcommand definition (stub) |
| `packages/cli/src/commands/export.ts` | New -- Export subcommand definition (stub) |
| `packages/cli/src/commands/serve.ts` | New -- Serve subcommand definition (stub) |
| `packages/cli/src/config.ts` | New -- Environment variable config loading |
| `packages/cli/src/errors.ts` | New -- CLIError class + handleError + requireApiKey |
| `packages/cli/src/index.test.ts` | New -- CLI structure tests |
| `packages/cli/src/config.test.ts` | New -- Config loading tests |
| `packages/cli/src/errors.test.ts` | New -- Error handling tests |

## What Does NOT Change

- `src/` (React app code)
- `convex/` (Convex backend)
- `server/` (hosted MCP server)
- `vitest.config.ts` (root -- only applies to existing app)
- `tsconfig.json` (root -- may optionally add a project reference, but not required)
- Any existing test files

## Acceptance Criteria Mapping

| Criterion | Covered By |
|-----------|------------|
| `packages/cli/` has `package.json` with name `@basesignal/cli` and bin entry | Step 1 |
| `basesignal --help` shows available commands: scan, export, serve | Steps 7-10, tested in Step 13 |
| `basesignal --version` shows the package version | Step 10, tested in Step 13 |
| `basesignal scan --help` shows scan command options | Step 7, tested in Step 13 |
| CLI reads configuration from environment variables | Step 6, tested in Step 12 |
| Missing required config shows helpful error message | Steps 5-6, tested in Steps 11-12 |

## Verification

- `cd packages/cli && npx tsc --noEmit` passes with zero errors
- `cd packages/cli && npx tsup` produces `dist/index.js` with shebang
- `node packages/cli/dist/index.js --help` lists scan, export, serve commands
- `node packages/cli/dist/index.js --version` prints `0.0.1`
- `node packages/cli/dist/index.js scan --help` shows `--output`, `--format`, `--provider`, `--model`
- `cd packages/cli && npx vitest run` -- all tests pass
- `npm test` from root -- existing app tests still pass
