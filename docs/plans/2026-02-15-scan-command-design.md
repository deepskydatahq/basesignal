# Scan Command Design

## Overview

Implement the `basesignal scan <url>` CLI command that crawls a product website, runs the analysis pipeline, saves the resulting profile to storage, and outputs a summary to stdout. This is the flagship user-facing command -- the single thing a user runs to get value from Basesignal. The scan command is the CLI equivalent of the `scan_product` MCP tool (M008-E002-S003), composing the same pipeline: crawl, analyze (lenses, convergence, outputs), save, display.

## Problem Statement

A user installs Basesignal globally via npm. They want to scan a product and get a structured profile immediately from their terminal. There is no web UI, no Convex backend, no setup beyond an API key. The scan command must compose crawlers, the analysis pipeline, storage, and output formatting into a single coherent experience that takes 30-90 seconds and keeps the user informed throughout.

## Expert Perspectives

### Technical Architect

The scan command is pure composition -- it creates instances of existing packages and wires them together. The important design constraint is that every dependency is injected, not imported as a singleton. The command creates a crawler, an LLM provider, and a storage adapter from configuration, then passes them to an `analyze()` pipeline function. This means the scan command has zero business logic of its own. If you find yourself writing analysis code in the CLI package, something is wrong. The progress reporting is the only CLI-specific concern, and it should use a callback pattern so the pipeline can report phases without knowing it is running in a terminal.

### Simplification Reviewer

**Verdict: APPROVED** -- with specific cuts.

What to keep:
- Three flags: `--output`, `--format`, `--verbose`. These cover the real use cases.
- Simple phase-based progress (not a percentage bar). The pipeline has discrete phases, not a continuous progress metric.
- Friendly error messages with actionable suggestions.

What to cut:
- **No `--lenses` flag.** Lens selection is an expert concern. v1 always runs all lenses. Adding lens filtering means exposing internal pipeline details in the CLI surface. If someone needs this, they can use the MCP tool directly.
- **No `--dry-run` flag for v1.** The story hints at this but it adds a code path that needs testing and has no clear user benefit. Crawling without analyzing is what `curl` does.
- **No `--provider` or `--model` flags on the scan command.** These are environment-level config (`BASESIGNAL_PROVIDER`, `BASESIGNAL_MODEL`). Putting them on the command mixes configuration with invocation. If someone wants to switch providers, they set the env var once, not per scan.

What to watch:
- The output formatting code. Keep it dead simple. A markdown summary to stdout, JSON to file. Do not build a "table" formatter or "compact" format. Two formats, two code paths.

## Proposed Solution

### Command Syntax

```
basesignal scan <url> [options]
```

**Arguments:**
- `<url>` -- Required. The product website URL to scan (e.g., `https://linear.app`).

**Options:**
- `--output <path>` / `-o <path>` -- Save the full profile to a file. Format is inferred from extension (`.json` for JSON, `.md` for markdown). If omitted, only a summary prints to stdout.
- `--format <type>` / `-f <type>` -- Output format: `summary` (default), `json`, `markdown`. Controls what prints to stdout. When `--output` is used, this controls stdout independently from the saved file.
- `--verbose` / `-v` -- Show detailed progress (page URLs as they crawl, lens names as they run, timing per phase).

### Pipeline Composition

The scan command wires together four packages:

```typescript
// packages/cli/src/commands/scan.ts

import type { Command } from "commander";

interface ScanOptions {
  output?: string;
  format: "summary" | "json" | "markdown";
  verbose: boolean;
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan <url>")
    .description("Scan a product website and generate a profile")
    .option("-o, --output <path>", "Save profile to file")
    .option("-f, --format <type>", "Output format: summary, json, markdown", "summary")
    .option("-v, --verbose", "Show detailed progress", false)
    .action(async (url: string, options: ScanOptions) => {
      await runScan(url, options);
    });
}
```

The `runScan` function is the composition core:

```typescript
// packages/cli/src/commands/scan.ts

import { createCrawler } from "@basesignal/crawlers";
import { createProvider } from "@basesignal/core/providers";
import { SQLiteStorage } from "@basesignal/storage";
import { analyzePipeline } from "@basesignal/core/pipeline";
import { resolveConfig } from "../config.js";
import { createProgress } from "../progress.js";
import { formatOutput, writeOutputFile } from "../formatters.js";

async function runScan(url: string, options: ScanOptions): Promise<void> {
  const config = resolveConfig();
  const progress = createProgress(options.verbose);
  const storage = new SQLiteStorage({ path: config.storagePath });

  try {
    // Validate URL
    const parsedUrl = validateUrl(url);

    // Phase 1: Crawl
    progress.start("Crawling", parsedUrl.hostname);
    const crawler = createCrawler();
    const pages = await crawler.crawl(parsedUrl.href, {
      onPage: (pageUrl) => progress.detail(`  ${pageUrl}`),
    });
    progress.done("Crawling", `${pages.length} pages`);

    // Phase 2: Analyze
    progress.start("Analyzing", `${pages.length} pages through 7 lenses`);
    const provider = createProvider(config.provider, config.apiKey, config.model);
    const profile = await analyzePipeline(pages, provider, {
      onPhase: (phase) => progress.detail(`  ${phase}`),
    });
    progress.done("Analyzing", "profile generated");

    // Phase 3: Save
    progress.start("Saving", "to local storage");
    const profileId = await storage.save(profile);
    progress.done("Saving", profileId);

    // Phase 4: Output
    const stdout = formatOutput(profile, options.format);
    console.log(stdout);

    if (options.output) {
      writeOutputFile(options.output, profile);
      progress.done("Saved", options.output);
    }
  } catch (error) {
    handleScanError(error, url);
    process.exit(1);
  } finally {
    storage.close();
  }
}
```

### URL Validation

```typescript
// packages/cli/src/commands/scan.ts

function validateUrl(input: string): URL {
  // Auto-add https:// if missing
  const normalized = input.match(/^https?:\/\//) ? input : `https://${input}`;

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
    return parsed;
  } catch {
    throw new ScanError(
      "invalid-url",
      `"${input}" is not a valid URL`,
      "Example: basesignal scan https://linear.app"
    );
  }
}
```

Key behavior: if the user types `basesignal scan linear.app`, we prepend `https://`. This removes friction without being magical.

### Progress Display

Progress uses `ora` for spinner animation in TTY mode, with a plain-text fallback for piped/CI output.

```typescript
// packages/cli/src/progress.ts

import ora, { type Ora } from "ora";

export interface Progress {
  start(phase: string, detail: string): void;
  detail(message: string): void;
  done(phase: string, result: string): void;
  fail(phase: string, message: string): void;
}

export function createProgress(verbose: boolean): Progress {
  const isTTY = process.stderr.isTTY;
  let spinner: Ora | null = null;

  return {
    start(phase, detail) {
      if (isTTY) {
        spinner = ora(`${phase} ${detail}`).start();
      } else {
        console.error(`[${phase}] ${detail}`);
      }
    },

    detail(message) {
      if (verbose) {
        if (isTTY && spinner) {
          spinner.text = message;
        } else {
          console.error(message);
        }
      }
    },

    done(phase, result) {
      if (isTTY && spinner) {
        spinner.succeed(`${phase} -- ${result}`);
      } else {
        console.error(`[${phase}] done: ${result}`);
      }
    },

    fail(phase, message) {
      if (isTTY && spinner) {
        spinner.fail(`${phase} -- ${message}`);
      } else {
        console.error(`[${phase}] FAILED: ${message}`);
      }
    },
  };
}
```

Design decisions:
- Progress goes to **stderr**, not stdout. This means `basesignal scan linear.app --format json | jq` works -- JSON goes to stdout, progress goes to stderr.
- Non-TTY mode uses simple `[Phase] message` lines. No spinner characters, no ANSI codes.
- Verbose mode shows per-page and per-lens details. Default mode shows only phase transitions.

### Output Formatting

Three formats, each a pure function from `ProductProfile` to `string`:

```typescript
// packages/cli/src/formatters.ts

import type { ProductProfile } from "@basesignal/core";
import { writeFileSync } from "node:fs";
import { extname } from "node:path";

export function formatOutput(
  profile: ProductProfile,
  format: "summary" | "json" | "markdown"
): string {
  switch (format) {
    case "json":
      return JSON.stringify(profile, null, 2);
    case "markdown":
      return formatMarkdown(profile);
    case "summary":
      return formatSummary(profile);
  }
}

function formatSummary(profile: ProductProfile): string {
  const lines: string[] = [];
  const name = profile.identity?.productName ?? "Unknown Product";
  const url = profile.metadata?.url ?? "";

  lines.push(`\n${name}`);
  lines.push(`${url}\n`);

  if (profile.identity?.description) {
    lines.push(profile.identity.description);
    lines.push("");
  }

  if (profile.identity?.targetCustomer) {
    lines.push(`Target: ${profile.identity.targetCustomer}`);
  }

  if (profile.identity?.businessModel) {
    lines.push(`Model:  ${profile.identity.businessModel}`);
  }

  if (profile.revenue?.model) {
    lines.push(`Pricing: ${profile.revenue.model}`);
  }

  if (profile.revenue?.tiers?.length) {
    lines.push(`Plans:   ${profile.revenue.tiers.map((t) => t.name).join(", ")}`);
  }

  // Journey stages
  if (profile.journey?.stages?.length) {
    lines.push("");
    lines.push("Journey:");
    for (const stage of profile.journey.stages) {
      lines.push(`  ${stage.order}. ${stage.name}`);
    }
  }

  // Metrics count
  if (profile.metrics?.items?.length) {
    lines.push("");
    lines.push(`Metrics: ${profile.metrics.items.length} suggested`);
  }

  lines.push("");
  lines.push(`Profile ID: ${profile.id}`);
  lines.push(`Completeness: ${Math.round((profile.completeness ?? 0) * 100)}%`);

  return lines.join("\n");
}

function formatMarkdown(profile: ProductProfile): string {
  const lines: string[] = [];
  const name = profile.identity?.productName ?? "Unknown Product";

  lines.push(`# ${name}\n`);

  if (profile.identity?.description) {
    lines.push(`${profile.identity.description}\n`);
  }

  // Core Identity section
  lines.push("## Core Identity\n");
  if (profile.identity?.targetCustomer) {
    lines.push(`- **Target Customer:** ${profile.identity.targetCustomer}`);
  }
  if (profile.identity?.businessModel) {
    lines.push(`- **Business Model:** ${profile.identity.businessModel}`);
  }
  if (profile.identity?.industry) {
    lines.push(`- **Industry:** ${profile.identity.industry}`);
  }

  // Revenue section
  if (profile.revenue) {
    lines.push("\n## Revenue Architecture\n");
    if (profile.revenue.model) {
      lines.push(`- **Model:** ${profile.revenue.model}`);
    }
    if (profile.revenue.tiers?.length) {
      lines.push("\n### Pricing Tiers\n");
      for (const tier of profile.revenue.tiers) {
        lines.push(`- **${tier.name}** (${tier.price})`);
        for (const feature of tier.features ?? []) {
          lines.push(`  - ${feature}`);
        }
      }
    }
  }

  // Journey section
  if (profile.journey?.stages?.length) {
    lines.push("\n## User Journey\n");
    for (const stage of profile.journey.stages) {
      lines.push(`${stage.order}. **${stage.name}** -- ${stage.description ?? ""}`);
    }
  }

  // Metrics section
  if (profile.metrics?.items?.length) {
    lines.push("\n## Suggested Metrics\n");
    lines.push("| Metric | Category | Formula |");
    lines.push("|--------|----------|---------|");
    for (const m of profile.metrics.items) {
      lines.push(`| ${m.name} | ${m.category} | ${m.formula ?? "--"} |`);
    }
  }

  lines.push(`\n---\n*Profile ID: ${profile.id} | Completeness: ${Math.round((profile.completeness ?? 0) * 100)}%*`);

  return lines.join("\n");
}

export function writeOutputFile(path: string, profile: ProductProfile): void {
  const ext = extname(path).toLowerCase();
  const content =
    ext === ".md" ? formatMarkdown(profile) : JSON.stringify(profile, null, 2);
  writeFileSync(path, content, "utf-8");
}
```

### Error Handling

Errors are classified into categories with specific, actionable messages:

```typescript
// packages/cli/src/errors.ts

export class ScanError extends Error {
  constructor(
    public code: ScanErrorCode,
    message: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = "ScanError";
  }
}

export type ScanErrorCode =
  | "invalid-url"
  | "network-error"
  | "crawl-empty"
  | "missing-api-key"
  | "llm-error"
  | "llm-rate-limit"
  | "storage-error";

export function handleScanError(error: unknown, url: string): void {
  if (error instanceof ScanError) {
    console.error(`\nError: ${error.message}`);
    if (error.suggestion) {
      console.error(`\n  ${error.suggestion}`);
    }
    return;
  }

  // Classify unknown errors into friendly messages
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    console.error(`\nError: Could not reach ${url}`);
    console.error(`\n  Check the URL and your internet connection.`);
  } else if (message.includes("401") || message.includes("api_key")) {
    console.error(`\nError: Invalid API key`);
    console.error(`\n  Set your API key: export ANTHROPIC_API_KEY=sk-...`);
  } else if (message.includes("429") || message.includes("rate_limit")) {
    console.error(`\nError: Rate limited by LLM provider`);
    console.error(`\n  Wait a moment and try again. The scan makes multiple LLM calls.`);
  } else if (message.includes("EACCES") || message.includes("permission")) {
    console.error(`\nError: Permission denied writing to storage`);
    console.error(`\n  Check permissions on ~/.basesignal/ or use --output to write elsewhere.`);
  } else {
    console.error(`\nError: ${message}`);
    console.error(`\n  Run with --verbose for more details.`);
  }
}
```

### Configuration Resolution

The scan command reads configuration from environment variables, matching the CLI skeleton design (M008-E005-S001):

```typescript
// packages/cli/src/config.ts

export interface CLIConfig {
  provider: "anthropic" | "openai" | "ollama";
  apiKey: string;
  model?: string;
  storagePath?: string;
}

export function resolveConfig(): CLIConfig {
  const provider = (process.env.BASESIGNAL_PROVIDER ?? "anthropic") as CLIConfig["provider"];

  const apiKeyEnvMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    ollama: "", // Ollama doesn't need an API key
  };

  const apiKeyEnv = apiKeyEnvMap[provider];
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] ?? "" : "";

  if (provider !== "ollama" && !apiKey) {
    throw new ScanError(
      "missing-api-key",
      `No API key found for ${provider}`,
      `Set ${apiKeyEnv}: export ${apiKeyEnv}=your-key-here`
    );
  }

  return {
    provider,
    apiKey,
    model: process.env.BASESIGNAL_MODEL,
    storagePath: process.env.BASESIGNAL_STORAGE,
  };
}
```

### Terminal Output Example

Default scan (TTY):

```
$ basesignal scan linear.app

  Crawling linear.app -- 12 pages
  Analyzing 12 pages through 7 lenses -- profile generated
  Saving to local storage -- a1b2c3d4-e5f6-7890-abcd-ef1234567890

Linear
https://linear.app

The issue tracking tool that streamlines software projects, sprints, tasks, and bug tracking.

Target: Engineering teams and product managers
Model:  B2B SaaS
Pricing: subscription
Plans:   Free, Standard, Plus, Enterprise

Journey:
  1. Awareness
  2. Signup
  3. Activation
  4. Engagement
  5. Conversion
  6. Retention

Metrics: 18 suggested

Profile ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Completeness: 85%
```

JSON piped to file (non-TTY):

```
$ basesignal scan linear.app --format json > profile.json
[Crawling] linear.app
[Crawling] done: 12 pages
[Analyzing] 12 pages through 7 lenses
[Analyzing] done: profile generated
[Saving] to local storage
[Saving] done: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Error (missing API key):

```
$ basesignal scan linear.app

Error: No API key found for anthropic

  Set ANTHROPIC_API_KEY: export ANTHROPIC_API_KEY=your-key-here
```

Error (invalid URL):

```
$ basesignal scan not-a-url://what

Error: "not-a-url://what" is not a valid URL

  Example: basesignal scan https://linear.app
```

## Package Structure

```
packages/cli/src/
  index.ts              # Entry point, registers commands
  config.ts             # Environment variable resolution
  errors.ts             # ScanError class and handleScanError
  progress.ts           # TTY-aware progress display
  formatters.ts         # summary, json, markdown formatters
  commands/
    scan.ts             # scan command registration and runScan
    export.ts           # (future: M008-E005-S003)
    serve.ts            # (future: M008-E005-S003)
  commands/scan.test.ts # Tests for scan command
  formatters.test.ts    # Tests for output formatters
  progress.test.ts      # Tests for progress display
  errors.test.ts        # Tests for error classification
```

## Key Decisions

1. **Progress on stderr, output on stdout.** This is the Unix convention. It means `basesignal scan linear.app --format json | jq .identity` works correctly. Progress messages never corrupt the JSON output.

2. **No `--lenses` flag.** Lens selection is pipeline internals. Exposing it in the CLI surface creates a coupling between the user interface and the analysis implementation. v1 runs all 7 lenses. If selective lens runs become needed, they belong in the programmatic API or MCP tool, not the CLI.

3. **No `--dry-run` flag.** The story suggested it for testing crawlers, but `curl` already exists. A dry-run adds a code path that needs its own tests and has no clear user benefit. Cut it.

4. **No `--provider`/`--model` command flags.** These are session-level configuration, not per-scan options. Environment variables (`BASESIGNAL_PROVIDER`, `BASESIGNAL_MODEL`) are the right mechanism. This keeps the command surface minimal and avoids the pattern where every command grows the same 5 provider flags.

5. **Auto-prepend `https://`.** Typing `basesignal scan linear.app` should work. This is a small convenience that eliminates the most common user error (forgetting the protocol). The explicit URL with protocol still works.

6. **`ora` for spinners.** It is the standard Node.js spinner library, handles TTY detection, and degrades gracefully. No custom spinner implementation needed.

7. **`--output` infers format from extension.** `.json` writes JSON, `.md` writes markdown. No need for a separate `--output-format` flag. This is what users expect.

8. **Callback-based progress reporting.** The pipeline accepts `onPhase` and `onPage` callbacks rather than importing `ora` directly. This means the same pipeline runs in the MCP server (where progress would go through MCP notifications) and the CLI (where progress goes to stderr) without change.

## What This Does NOT Do

- **No interactive mode.** The scan runs and exits. No prompts, no confirmations, no "press enter to continue."
- **No parallel scans.** One URL per invocation. Batch scanning is a script concern (`for url in ...; do basesignal scan $url; done`).
- **No caching or incremental re-scan.** Every scan starts fresh. Profile deduplication (same URL scanned twice) overwrites by URL, tracked by profile ID.
- **No custom crawler configuration.** The crawler package decides page limits, timeouts, and selectors. The scan command does not expose these.
- **No webhook or notification on completion.** This is a CLI tool. The exit code (0 for success, 1 for failure) is the notification mechanism.

## Dependencies

This story depends on:
- **M008-E005-S001** (CLI skeleton) -- Commander setup, `basesignal` binary, environment config
- **M008-E002-S003** (scan_product MCP tool) -- The analysis pipeline that scan composes

It consumes:
- `@basesignal/crawlers` -- `createCrawler()`, `crawler.crawl(url)`
- `@basesignal/core` -- `ProductProfile` type, `analyzePipeline()`, `createProvider()`
- `@basesignal/storage` -- `SQLiteStorage`, `StorageAdapter`

## Verification Steps

1. `basesignal scan https://linear.app` crawls, analyzes, saves, and prints a summary to stdout
2. `basesignal scan https://linear.app --format json` prints the full profile as JSON
3. `basesignal scan https://linear.app --format markdown` prints the profile as markdown
4. `basesignal scan https://linear.app --output profile.json` saves JSON to file and prints summary to stdout
5. `basesignal scan https://linear.app --output profile.md` saves markdown to file
6. `basesignal scan https://linear.app --verbose` shows per-page crawl progress and per-lens analysis progress
7. `basesignal scan https://linear.app --format json | jq .identity` works (progress on stderr, JSON on stdout)
8. `basesignal scan not-a-url` prints a friendly error with usage example
9. Running without `ANTHROPIC_API_KEY` set prints a friendly error with the export command
10. Network failure (unreachable URL) prints a friendly error suggesting the user check the URL
11. Profile appears in `basesignal export --list` after scan (storage persistence)
12. Running scan twice for the same URL creates or updates the profile (not duplicated)

## Test Strategy

**Unit tests (formatters.test.ts):**
- `formatSummary` produces expected output for a full profile
- `formatSummary` handles partial profiles (missing sections)
- `formatMarkdown` produces valid markdown with all sections
- `formatMarkdown` handles empty/missing sections gracefully
- `writeOutputFile` infers JSON format from .json extension
- `writeOutputFile` infers markdown format from .md extension

**Unit tests (errors.test.ts):**
- `ScanError` carries code, message, and suggestion
- `handleScanError` classifies ENOTFOUND as network error
- `handleScanError` classifies 401/api_key as auth error
- `handleScanError` classifies 429/rate_limit as rate limit error
- `handleScanError` falls back to generic message for unknown errors

**Unit tests (progress.test.ts):**
- TTY mode uses ora spinner (mock ora, verify calls)
- Non-TTY mode writes plain text to stderr
- Verbose mode includes detail messages
- Non-verbose mode skips detail messages

**Unit tests (scan.test.ts):**
- `validateUrl` accepts `https://example.com`
- `validateUrl` prepends `https://` to bare domains
- `validateUrl` rejects invalid protocols
- `runScan` calls crawl, analyze, save in sequence (mock all dependencies)
- `runScan` writes to file when `--output` is provided
- `runScan` calls `storage.close()` even on error (finally block)

**Integration test (manual or CI):**
- End-to-end scan of a known URL produces a valid, non-empty profile

## Success Criteria

- `basesignal scan <url>` runs the full pipeline and prints a markdown summary to stdout
- `basesignal scan <url> --output profile.json` saves the profile as JSON to the specified file
- `basesignal scan <url> --format markdown` outputs as markdown instead of the default summary
- Progress is shown during execution (crawling... analyzing... generating...)
- Profile is automatically saved to storage (retrievable later via list/export)
- Scan errors produce helpful messages (invalid URL, network error, LLM error, missing API key)
