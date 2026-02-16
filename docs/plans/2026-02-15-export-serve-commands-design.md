# Export and Serve CLI Commands Design

**Date:** 2026-02-15
**Story:** M008-E005-S003
**Status:** Draft
**Dependencies:** M008-E005-S001 (CLI skeleton), M008-E002-S005 (export_profile MCP tool)

## Problem Statement

The `basesignal` CLI needs two final commands: `export` (convert stored profiles to sharable formats) and `serve` (start the MCP server for AI assistant connections). These are the "output" side of the CLI -- `scan` produces profiles, `export` renders them, and `serve` makes the whole system accessible to AI assistants like Claude Desktop.

The key design tension: `export` and `serve` both overlap with functionality that lives in other packages (`@basesignal/mcp-server` has an `export_profile` tool; the MCP server package has `createServer`). The CLI commands must be thin wrappers that compose existing package functionality, not reimplementations.

## Expert Perspectives

### Technical Architect

The `serve` command is the simplest possible thing: import `createServer` from `@basesignal/mcp-server`, pass it the storage and LLM provider resolved from environment/config, call `start()`. It should be fewer than 20 lines of code. The `export` command has one real decision -- where does the format conversion logic live? It should live in `@basesignal/core` (or a shared location) since both the MCP `export_profile` tool and the CLI `export` command need it. The CLI command is then: load from storage, call `formatProfile()`, write to stdout or file.

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

What to remove:
- **No configuration file for v1.** Environment variables are sufficient. A `basesignal.config.ts` adds a config loading system, file discovery, schema validation -- all for saving a few `export` calls from typing `--format markdown`. If users need it, add it when they ask.
- **No SSE transport in the serve command.** The MCP server extraction design (M008-E002-S001) already decided: stdio only for v1. The `--transport` and `--port` flags in the acceptance criteria are speculative. Ship stdio, add SSE when there is a real remote use case.
- **No interactive profile selection.** `--list` shows profiles. `export <id>` exports one. No interactive picker, no fuzzy search in the terminal. That is UI complexity with no return.

What stays: `export` (load + format + output), `serve` (create server + connect stdio), `--list` (show what is stored). Three capabilities, nothing more.

## Proposed Solution

### Command: `basesignal export`

Loads a profile from storage (by ID) or from a JSON file (by path), converts to the requested format, and outputs to stdout or a file.

```
basesignal export <id-or-file> [options]

Arguments:
  id-or-file    Profile ID (from storage) or path to a .json file

Options:
  --format, -f  Output format: "markdown" | "json" (default: "markdown")
  --output, -o  Write to file instead of stdout
  --list, -l    List all stored profiles (ignores other arguments)
```

#### Input Resolution

The single positional argument is auto-detected:

```typescript
function resolveInput(idOrFile: string): { type: "storage"; id: string } | { type: "file"; path: string } {
  // If the argument looks like a file path (contains / or \ or ends with .json), treat as file
  if (idOrFile.includes("/") || idOrFile.includes("\\") || idOrFile.endsWith(".json")) {
    return { type: "file", path: idOrFile };
  }
  // Otherwise, treat as a storage ID
  return { type: "storage", id: idOrFile };
}
```

This is simple enough that it covers real usage without over-engineering. A file path always has a separator or `.json` extension. A storage ID is a short identifier (UUID or slug).

#### Format Conversion

The conversion logic lives in a shared location, not in the CLI. Both the CLI `export` command and the MCP `export_profile` tool call the same function:

```typescript
// Shared (in @basesignal/core or a shared util)
export function formatProfile(profile: ProductProfile, format: "markdown" | "json"): string;
```

For `json`, this is `JSON.stringify(profile, null, 2)`.

For `markdown`, this produces a structured document with sections:

```markdown
# Product Profile: {name}

**URL:** {url}
**Scanned:** {date}
**Basesignal Version:** {version}

## Core Identity
{identity section with confidence}

## Revenue Model
{revenue details}

## User Journey
{journey stages}

## Value Definitions
{activation, active, first value definitions}

## Measurement Specification
{metrics, events, dimensions}
```

Each section includes confidence scores and evidence sources when available. Missing sections are noted as "Not yet analyzed" rather than omitted or errored.

#### Implementation

```typescript
// packages/cli/src/commands/export.ts
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";

export function registerExportCommand(program: Command, getStorage: () => StorageAdapter) {
  program
    .command("export [id-or-file]")
    .description("Export a product profile as markdown or JSON")
    .option("-f, --format <format>", "Output format", "markdown")
    .option("-o, --output <path>", "Write to file instead of stdout")
    .option("-l, --list", "List all stored profiles")
    .action(async (idOrFile, opts) => {
      const storage = getStorage();

      // --list: show all profiles
      if (opts.list) {
        const profiles = await storage.list();
        if (profiles.length === 0) {
          console.log("No profiles stored. Run `basesignal scan <url>` to create one.");
          return;
        }
        for (const p of profiles) {
          console.log(`  ${p.id}  ${p.name}  ${p.url}  (${p.updatedAt})`);
        }
        return;
      }

      if (!idOrFile) {
        console.error("Error: provide a profile ID or file path. Use --list to see stored profiles.");
        process.exit(1);
      }

      // Resolve input
      const input = resolveInput(idOrFile);
      let profile: ProductProfile;

      if (input.type === "file") {
        const raw = readFileSync(input.path, "utf-8");
        profile = JSON.parse(raw);
      } else {
        const loaded = await storage.load(input.id);
        if (!loaded) {
          console.error(`Error: profile "${input.id}" not found. Use --list to see stored profiles.`);
          process.exit(1);
        }
        profile = loaded;
      }

      // Format
      const output = formatProfile(profile, opts.format);

      // Output
      if (opts.output) {
        writeFileSync(opts.output, output, "utf-8");
        console.error(`Written to ${opts.output}`);
      } else {
        process.stdout.write(output);
      }
    });
}
```

#### List Output Format

The `--list` flag outputs a simple table to stderr-safe stdout:

```
  a1b2c3d4  Linear      https://linear.app      (2026-02-14)
  e5f6g7h8  Notion      https://notion.so       (2026-02-13)
  i9j0k1l2  Figma       https://figma.com       (2026-02-12)
```

No color, no boxes, no ASCII art. Just ID, name, URL, and date. Pipe-friendly.

### Command: `basesignal serve`

Starts the MCP server for AI assistant connections. This is the thinnest possible wrapper around `@basesignal/mcp-server`.

```
basesignal serve [options]

Options:
  (none for v1 -- stdio transport is the only mode)
```

#### Implementation

```typescript
// packages/cli/src/commands/serve.ts
import { Command } from "commander";

export function registerServeCommand(
  program: Command,
  getStorage: () => StorageAdapter,
  getProvider: () => LlmProvider
) {
  program
    .command("serve")
    .description("Start the Basesignal MCP server (stdio transport)")
    .action(async () => {
      const { createServer } = await import("@basesignal/mcp-server");

      // All output goes to stderr so stdout stays clean for MCP protocol
      console.error("Starting Basesignal MCP server (stdio)...");

      await createServer({
        storage: getStorage(),
        llmProvider: getProvider(),
      });

      // Server is now running on stdio. Process stays alive until stdin closes.
      console.error("Basesignal MCP server running. Connect from Claude Desktop.");
    });
}
```

Key detail: `console.error` for human-readable messages. `stdout` is reserved for the MCP JSON-RPC protocol when using stdio transport. Any `console.log` in the serve command would corrupt the protocol stream.

#### Claude Desktop Configuration

After running `npm install -g @basesignal/cli`, users add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "basesignal",
      "args": ["serve"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

This is the primary distribution mechanism for AI assistant access. The `basesignal serve` command is what Claude Desktop spawns as a child process.

### Configuration: Environment Variables Only

No configuration file for v1. Environment variables are the configuration mechanism, consistent with the CLI skeleton story (M008-E005-S001):

| Variable | Purpose | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | (required for scan/analysis) |
| `OPENAI_API_KEY` | OpenAI API key | (alternative provider) |
| `BASESIGNAL_STORAGE` | Storage directory path | `~/.basesignal` |
| `BASESIGNAL_PROVIDER` | LLM provider name | `anthropic` |
| `BASESIGNAL_MODEL` | Model to use | Provider default |

The `export` command works without an API key (it reads stored data). The `serve` command needs an API key only if scan/analysis tools are called.

### File Structure (additions to packages/cli/)

```
packages/cli/src/
  commands/
    export.ts         # export command registration
    serve.ts          # serve command registration
    scan.ts           # (already exists from S002)
  lib/
    format.ts         # formatProfile() — or imported from @basesignal/core
    resolve-input.ts  # resolveInput() helper
  index.ts            # (already exists — add command registrations)
```

### Format Conversion: Where It Lives

The `formatProfile()` function is needed by both:
1. CLI `export` command (this story)
2. MCP `export_profile` tool (M008-E002-S005)

It belongs in `@basesignal/core` since it operates on the `ProductProfile` type that `core` owns. If `core` is not yet built when this story is implemented, it can start in `packages/cli/src/lib/format.ts` and be extracted to core later. The interface stays the same either way.

## What This Does NOT Do

- **No configuration file** (`basesignal.config.ts`, `.basesignalrc`). Environment variables are sufficient. Add a config file when users demonstrate need.
- **No SSE transport flag.** The `--transport sse --port 3000` option from the acceptance criteria is deferred. Stdio is the only transport for v1. The acceptance criteria for SSE transport should be updated to reflect this decision (consistent with the MCP server extraction design).
- **No interactive profile picker.** `--list` shows profiles. The user copies the ID. No `inquirer` prompt, no fuzzy search.
- **No colored output.** Plain text. No `chalk`, no `kleur`. Works in every terminal, every pipe.
- **No profile filtering for list.** `--list` shows everything. Filtering (by date, by name) is premature for v1.

## Acceptance Criteria Reconciliation

The story's acceptance criteria include SSE transport (`basesignal serve --transport sse --port 3000`). The MCP server extraction design (already approved) explicitly defers SSE to a future story. This design follows that decision:

| Acceptance Criterion | Status |
|---------------------|--------|
| `export <id-or-file> --format markdown` outputs markdown to stdout | Included |
| `export <id-or-file> --format json --output file.json` saves to file | Included |
| `export --list` shows all stored profiles | Included |
| `serve` starts MCP server on stdio transport (default) | Included |
| `serve --transport sse --port 3000` starts with SSE transport | Deferred (stdio only for v1) |
| `serve` works with Claude Desktop MCP configuration | Included |

The SSE criterion can be addressed in a follow-up story when remote connection use cases are validated.

## Verification Steps

### Automated (unit tests)

1. **Export markdown:** `basesignal export <id> --format markdown` produces valid markdown with expected sections for a stored profile.
2. **Export JSON:** `basesignal export <id> --format json` produces valid JSON matching the ProductProfile schema.
3. **Export to file:** `basesignal export <id> --output out.json` writes to the file and prints confirmation to stderr.
4. **Export from file:** `basesignal export ./profile.json` reads from a JSON file instead of storage.
5. **Export list:** `basesignal export --list` prints profile summaries (id, name, url, date).
6. **Export missing:** `basesignal export nonexistent-id` prints a helpful error and exits with code 1.
7. **Export no args:** `basesignal export` (no id, no --list) prints usage hint and exits with code 1.
8. **Serve starts:** `basesignal serve` calls `createServer` from `@basesignal/mcp-server` with storage and provider from environment.
9. **Serve stderr only:** The serve command writes human messages to stderr, never stdout.
10. **Resolve input:** `resolveInput("abc123")` returns storage type; `resolveInput("./file.json")` returns file type.

### Manual

11. **Claude Desktop integration:** Add `basesignal serve` to Claude Desktop config, restart, verify the server connects and the `ping` tool responds.
12. **Round-trip:** `basesignal scan <url>`, then `basesignal export --list` shows the profile, then `basesignal export <id> --format markdown` produces readable output.

## Success Criteria

- `basesignal export` loads profiles from storage or file and outputs markdown or JSON
- `basesignal export --list` shows all stored profiles
- `basesignal serve` starts the MCP server on stdio transport
- `serve` writes human messages to stderr only (stdout reserved for MCP protocol)
- Format conversion logic is shared (or shareable) with the MCP `export_profile` tool
- All unit tests pass
- Claude Desktop can connect to `basesignal serve` and call tools
