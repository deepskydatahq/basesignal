# CLI Package Skeleton with Command Structure Design

## Overview

Create the `@basesignal/cli` package at `packages/cli/` with a `basesignal` command exposing three subcommands: `scan`, `export`, and `serve`. The CLI is a thin orchestration layer that composes `@basesignal/core`, crawlers, storage, and the MCP server -- it owns no business logic itself. This story builds the skeleton and argument parsing only; command implementations come in subsequent stories (S002, S003).

## Problem Statement

The M008 open source strategy requires a user-facing entry point: `npm install -g @basesignal/cli && basesignal scan <url>`. Before the scan, export, or serve commands can be implemented, the CLI package must exist with its command structure, option parsing, configuration loading, and error handling patterns established. Without this skeleton, the subsequent stories (S002: scan command, S003: export/serve commands) have no home.

## Expert Perspectives

### Technical Architect

Commander is the right choice. It has the smallest API surface for what we need (subcommands with typed options), the community knows it, and it composes cleanly -- each command is a separate file that registers itself. The critical insight is that the CLI should own zero business logic. Its only job is: parse args, load config from env, construct the right collaborators, call them, format output. If you find yourself writing an `if` statement about product profiles in the CLI, you are in the wrong package.

Configuration via environment variables (not config files) is correct for this stage. A `.basesignalrc` adds a second source of truth before there is a first source of truth. Environment variables are explicit, composable with Docker, and understood by every developer. A config file can be added later when there is real user demand.

### Simplification Reviewer

**Verdict: APPROVED** with one cut.

- **Remove:** No `basesignal init` command. The story does not call for it, no other story depends on it, and environment variables do not need initialization. Ship three commands, not four.
- **Remove:** No config file format decision. Environment variables only. This eliminates `.basesignalrc`, `basesignal.config.ts`, cosmiconfig dependency, config file discovery logic, config merging precedence rules. All of that is complexity with zero users asking for it.
- **Keep:** Commander -- it is inevitable for a CLI with subcommands. The alternative (hand-rolling argument parsing) would be worse.
- **Keep:** Separate file per command -- clean separation that maps to the subsequent stories.
- **Assessment:** The design feels unified. Three commands, one entry point, env-only config. Nothing bolted on.

## Proposed Solution

### CLI Framework: Commander

Commander (v13+) is the dependency. Rationale:
- Most downloaded CLI framework on npm (~170M weekly downloads)
- Built-in TypeScript types
- Subcommand support out of the box
- Zero-config for what we need (no plugin systems, no middleware chains)
- The story explicitly recommends it

Rejected alternatives:
- **yargs** -- more powerful but heavier API surface; parsing DSL is harder to read
- **citty** -- lighter but less community familiarity; unjs ecosystem lock-in
- **custom** -- subcommand routing + option parsing + help text generation is not trivial; no reason to build it

### Package Structure

```
packages/cli/
  package.json          # @basesignal/cli, bin: { basesignal: ./dist/index.js }
  tsconfig.json         # extends root conventions
  tsup.config.ts        # single entry, ESM output only (CLI, not library)
  vitest.config.ts      # node environment
  src/
    index.ts            # #!/usr/bin/env node, program definition, version, global options
    commands/
      scan.ts           # scan subcommand definition (placeholder handler)
      export.ts         # export subcommand definition (placeholder handler)
      serve.ts          # serve subcommand definition (placeholder handler)
    config.ts           # loadConfig() -- reads env vars, returns typed config object
    errors.ts           # CLIError class, handleError() -- user-friendly error formatting
    index.test.ts       # tests for CLI structure (--help, --version, command registration)
    config.test.ts      # tests for config loading (env vars, defaults, missing required)
    errors.test.ts      # tests for error formatting
```

### Entry Point (`src/index.ts`)

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { version } from "../package.json" with { type: "json" };
import { registerScanCommand } from "./commands/scan.js";
import { registerExportCommand } from "./commands/export.js";
import { registerServeCommand } from "./commands/serve.js";
import { handleError } from "./errors.js";

const program = new Command()
  .name("basesignal")
  .description("Product profile analysis from the command line")
  .version(version)
  .option("--verbose", "Enable verbose output", false);

registerScanCommand(program);
registerExportCommand(program);
registerServeCommand(program);

program.parseAsync(process.argv).catch(handleError);
```

### Command Definitions

Each command file exports a `register*Command(program)` function that adds the subcommand. The handler bodies are stubs that print "Not yet implemented" -- S002 and S003 fill them in.

**scan.ts:**
```typescript
export function registerScanCommand(program: Command) {
  program
    .command("scan <url>")
    .description("Crawl a URL and generate a product profile")
    .option("-o, --output <file>", "Save output to file")
    .option("-f, --format <format>", "Output format (json|markdown)", "markdown")
    .option("--provider <provider>", "LLM provider (anthropic|openai|ollama)")
    .option("--model <model>", "LLM model override")
    .action(async (url, options) => {
      // Placeholder -- implemented in M008-E005-S002
      console.error("scan command not yet implemented");
      process.exit(1);
    });
}
```

**export.ts:**
```typescript
export function registerExportCommand(program: Command) {
  program
    .command("export <source>")
    .description("Export a stored profile to a different format")
    .option("-f, --format <format>", "Output format (json|markdown)", "markdown")
    .option("-o, --output <file>", "Save output to file")
    .option("-l, --list", "List all stored profiles")
    .action(async (source, options) => {
      // Placeholder -- implemented in M008-E005-S003
      console.error("export command not yet implemented");
      process.exit(1);
    });
}
```

**serve.ts:**
```typescript
export function registerServeCommand(program: Command) {
  program
    .command("serve")
    .description("Start the Basesignal MCP server")
    .option("-p, --port <port>", "Port number", "3000")
    .option("--transport <transport>", "Transport type (stdio|sse)", "stdio")
    .action(async (options) => {
      // Placeholder -- implemented in M008-E005-S003
      console.error("serve command not yet implemented");
      process.exit(1);
    });
}
```

### Configuration (`src/config.ts`)

Environment variables only. No config files.

```typescript
export interface BasesignalConfig {
  provider: "anthropic" | "openai" | "ollama";
  model?: string;
  apiKey?: string;
  storagePath: string;
  verbose: boolean;
}

export function loadConfig(overrides?: Partial<BasesignalConfig>): BasesignalConfig {
  return {
    provider: (overrides?.provider ?? process.env.BASESIGNAL_PROVIDER ?? "anthropic") as BasesignalConfig["provider"],
    model: overrides?.model ?? process.env.BASESIGNAL_MODEL ?? undefined,
    apiKey: resolveApiKey(overrides?.provider ?? process.env.BASESIGNAL_PROVIDER ?? "anthropic"),
    storagePath: process.env.BASESIGNAL_STORAGE ?? defaultStoragePath(),
    verbose: overrides?.verbose ?? false,
  };
}

function resolveApiKey(provider: string): string | undefined {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY;
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  return undefined; // ollama doesn't need a key
}

function defaultStoragePath(): string {
  return join(homedir(), ".basesignal");
}
```

### Error Handling (`src/errors.ts`)

```typescript
export class CLIError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = "CLIError";
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(`Error: ${error.message}`);
    if (error.hint) console.error(`Hint: ${error.hint}`);
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("An unexpected error occurred");
  }
  process.exit(1);
}
```

A specific case for missing API keys:

```typescript
export function requireApiKey(config: BasesignalConfig): string {
  if (config.provider === "ollama") return ""; // not needed
  if (!config.apiKey) {
    throw new CLIError(
      `No API key found for provider "${config.provider}"`,
      config.provider === "anthropic"
        ? "Set ANTHROPIC_API_KEY environment variable"
        : "Set OPENAI_API_KEY environment variable"
    );
  }
  return config.apiKey;
}
```

### package.json

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

Notes:
- `bin` entry makes `basesignal` available as a global command after `npm install -g`
- `@basesignal/core` is a peer dependency marked optional -- the skeleton does not import it yet, but subsequent stories will
- ESM only (no CJS) -- CLIs do not need dual format
- `commander` is the sole runtime dependency

### tsup.config.ts

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,  // CLI, not a library -- no .d.ts needed
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

The `banner` option prepends the shebang line so the built output is directly executable.

### Dependencies (What This Package Will Eventually Import)

The skeleton has no imports from sibling packages. The dependency graph when fully wired (S002+S003):

```
@basesignal/cli
  -> @basesignal/core       (types, validation)
  -> @basesignal/crawlers   (website, pricing crawlers)
  -> @basesignal/storage    (SQLite adapter)
  -> @basesignal/mcp-server (serve command)
  -> commander              (argument parsing)
```

These are added as stories are implemented, not upfront.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI framework | Commander v13 | Most familiar, minimal API, built-in TypeScript types, subcommand support |
| Config mechanism | Environment variables only | Explicit, Docker-friendly, no config file discovery complexity |
| Output format | ESM only | CLI binary, not a library -- dual format unnecessary |
| Shebang | tsup banner option | Cleaner than a separate build step |
| Command files | One file per command | Maps to subsequent stories, clean separation |
| Stub handlers | Print error + exit(1) | Honest about unimplemented state, does not silently succeed |
| @basesignal/core dep | Optional peer | Skeleton does not import it; avoids circular dependency during scaffolding |
| --verbose as global option | On the program, not per command | Consistent across all commands, forwarded to config |
| No config file | Intentional omission | Zero users, zero use cases yet -- env vars sufficient |
| No `init` command | Intentional omission | Nothing to initialize when config is env vars |

## What This Does NOT Do

- **Implement scan/export/serve logic** -- command handlers are stubs. S002 and S003 fill them in.
- **Import from sibling packages** -- no `@basesignal/core`, `@basesignal/crawlers`, etc. Those dependencies are added when needed.
- **Create config files** -- no `.basesignalrc`, `basesignal.config.ts`, or cosmiconfig setup.
- **Add an `init` command** -- not in the acceptance criteria, not needed for env-var config.
- **Set up Docker** -- that is S004.
- **Configure npm publishing** -- that is S004.
- **Add progress indicators (ora, spinners)** -- that is S002 when the scan command needs them.
- **Modify the existing server/ code** -- the MCP server in `server/` is the hosted version with Clerk auth. The CLI's `serve` command will use `@basesignal/mcp-server` (a different package, no auth).

## Verification Steps

1. `npm install` from root resolves `@basesignal/cli` workspace
2. `cd packages/cli && npx tsc --noEmit` passes with zero errors
3. `cd packages/cli && npx tsup` produces `dist/index.js` with shebang
4. `node packages/cli/dist/index.js --help` prints:
   ```
   Usage: basesignal [options] [command]

   Product profile analysis from the command line

   Options:
     -V, --version     output the version number
     --verbose          Enable verbose output (default: false)
     -h, --help        display help for command

   Commands:
     scan <url>        Crawl a URL and generate a product profile
     export <source>   Export a stored profile to a different format
     serve             Start the Basesignal MCP server
     help [command]    display help for a command
   ```
5. `node packages/cli/dist/index.js --version` prints `0.0.1`
6. `node packages/cli/dist/index.js scan --help` shows scan-specific options
7. `cd packages/cli && npx vitest run` -- all tests pass
8. `BASESIGNAL_PROVIDER=anthropic` with no `ANTHROPIC_API_KEY` -- `requireApiKey()` throws CLIError with helpful hint
9. Existing app unaffected: `npm run dev` and `npm test` from root still work

## Success Criteria

All six acceptance criteria from the story:

1. `packages/cli/` has `package.json` with name `@basesignal/cli` and `bin` entry
2. `basesignal --help` shows available commands: scan, export, serve
3. `basesignal --version` shows the package version
4. `basesignal scan --help` shows scan command options (url, output, format, provider)
5. CLI reads configuration from environment variables (API keys, storage path, provider)
6. Missing required config (e.g., no API key) shows helpful error message

Plus:
- Zero changes to existing `src/`, `convex/`, or `server/` code
- Clean foundation for S002 (scan implementation) and S003 (export/serve implementation)
