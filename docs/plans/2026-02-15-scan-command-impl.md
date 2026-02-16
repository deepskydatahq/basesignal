# Implementation Plan: basesignal scan Command

**Task:** basesignal-4d1
**Story:** M008-E005-S002
**Design:** [2026-02-15-scan-command-design.md](./2026-02-15-scan-command-design.md)

## Summary

Implement the `basesignal scan <url>` CLI command that composes crawlers, the analysis pipeline, storage, and output formatting into a single user-facing command. The scan command is pure composition -- it wires together four packages (`@basesignal/crawlers`, `@basesignal/core`, `@basesignal/storage`, and `ora` for progress) with zero business logic of its own. This replaces the placeholder handler from M008-E005-S001 (CLI skeleton).

## Prerequisites

This story depends on:
- **M008-E005-S001** (CLI skeleton) -- `packages/cli/` must exist with Commander setup, `basesignal` binary, `config.ts`, and `errors.ts`
- **M008-E002-S003** (scan_product MCP tool) -- The analysis pipeline must be available as a composable function
- **M008-E003-S001** (Crawler interface) + **M008-E003-S002** (WebsiteCrawler) -- `@basesignal/crawlers` with `WebsiteCrawler`
- **M008-E004-S001** (Storage interface + SQLite) -- `@basesignal/storage` with `SQLiteStorage`
- **M008-E004-S003** (LLM provider interface) -- `@basesignal/core` with `createProvider()` and `LlmProvider`

If any dependency is not yet implemented, the step that depends on it should define local stubs and note the expected import path for later replacement.

## Steps

### Step 1: Add runtime dependencies to `packages/cli/package.json`

**File:** `packages/cli/package.json`

Add the workspace dependencies and `ora` to the CLI package:

- Add `"ora": "^8.0.0"` to `dependencies`
- Change `@basesignal/core` from optional `peerDependencies` to `dependencies` as `"@basesignal/core": "workspace:*"`
- Add `"@basesignal/crawlers": "workspace:*"` to `dependencies`
- Add `"@basesignal/storage": "workspace:*"` to `dependencies`

The `dependencies` section should contain:
```json
{
  "commander": "^13.0.0",
  "ora": "^8.0.0",
  "@basesignal/core": "workspace:*",
  "@basesignal/crawlers": "workspace:*",
  "@basesignal/storage": "workspace:*"
}
```

Remove `@basesignal/core` from `peerDependencies` and `peerDependenciesMeta` since it is now a direct dependency.

Run `npm install` from the repo root after this change.

---

### Step 2: Create the ScanError class and error handler

**File:** `packages/cli/src/errors.ts`

This file may already exist from the CLI skeleton story (M008-E005-S001) with a generic `CLIError`. Extend it with scan-specific error handling.

Add the `ScanError` class with a typed error code:

```typescript
export type ScanErrorCode =
  | "invalid-url"
  | "network-error"
  | "crawl-empty"
  | "missing-api-key"
  | "llm-error"
  | "llm-rate-limit"
  | "storage-error";

export class ScanError extends Error {
  constructor(
    public code: ScanErrorCode,
    message: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "ScanError";
  }
}
```

Add the `handleScanError` function that classifies unknown errors into friendly messages:

- `ScanError` instances: print `error.message` and `error.suggestion` if present
- `ENOTFOUND` / `getaddrinfo` in message: network error, suggest checking URL and internet
- `401` / `api_key` in message: auth error, suggest `export ANTHROPIC_API_KEY=sk-...`
- `429` / `rate_limit` in message: rate limit, suggest waiting
- `EACCES` / `permission` in message: permission error, suggest checking `~/.basesignal/` permissions
- All others: print the error message and suggest `--verbose`

All error output goes to `console.error`, not `console.log`.

**Tests:** `packages/cli/src/errors.test.ts`

- `ScanError` carries code, message, and optional suggestion
- `handleScanError` with a `ScanError` prints message + suggestion to stderr
- `handleScanError` classifies `ENOTFOUND` as network error
- `handleScanError` classifies `401` as auth error
- `handleScanError` classifies `429` as rate limit error
- `handleScanError` classifies `EACCES` as permission error
- `handleScanError` falls back to generic message for unknown errors

Mock `console.error` in tests to capture output.

---

### Step 3: Create the progress display module

**File:** `packages/cli/src/progress.ts`

Create the `Progress` interface and `createProgress` factory:

```typescript
export interface Progress {
  start(phase: string, detail: string): void;
  detail(message: string): void;
  done(phase: string, result: string): void;
  fail(phase: string, message: string): void;
}
```

The `createProgress(verbose: boolean)` function returns a `Progress` implementation:

- Check `process.stderr.isTTY` for TTY detection
- **TTY mode:** Use `ora` for spinner animation. `start()` creates a new spinner via `ora(text).start()`. `done()` calls `spinner.succeed()`. `fail()` calls `spinner.fail()`. `detail()` updates `spinner.text` only if `verbose` is true.
- **Non-TTY mode (piped/CI):** Use `console.error()` with `[Phase] message` format. No ANSI codes, no spinner characters.
- **Verbose mode:** `detail()` messages are displayed. In non-verbose mode, `detail()` is a no-op.

Key design constraint: all progress output goes to **stderr**, never stdout. This ensures `basesignal scan url --format json | jq` works correctly.

**Tests:** `packages/cli/src/progress.test.ts`

- Mock `ora` (or the module) to verify spinner method calls in TTY mode
- Mock `console.error` to verify plain text output in non-TTY mode
- Verify verbose mode shows detail messages
- Verify non-verbose mode suppresses detail messages
- Verify all output goes to stderr (no stdout pollution)

For TTY testing, mock `process.stderr.isTTY`. For non-TTY testing, set it to `undefined` or `false`.

---

### Step 4: Create the output formatters module

**File:** `packages/cli/src/formatters.ts`

Create three pure functions, each transforming a `ProductProfile` into a `string`:

**`formatOutput(profile, format)`** -- dispatch function:
- `"json"` -> `JSON.stringify(profile, null, 2)`
- `"markdown"` -> `formatMarkdown(profile)`
- `"summary"` -> `formatSummary(profile)`

**`formatSummary(profile)`** -- compact text summary:
- Product name and URL on separate lines
- Description if present
- Target customer, business model, pricing model, plan names
- Journey stages as a numbered list
- Metrics count
- Profile ID and completeness percentage
- Use optional chaining throughout (`profile.identity?.productName ?? "Unknown Product"`)

**`formatMarkdown(profile)`** -- full markdown document:
- `# ProductName` heading
- `## Core Identity` section with target customer, business model, industry
- `## Revenue Architecture` section with model, pricing tiers (name + price + features)
- `## User Journey` section with numbered stages
- `## Suggested Metrics` section as a markdown table (name, category, formula)
- Footer with profile ID and completeness

**`writeOutputFile(path, profile)`** -- file writer:
- Infer format from file extension: `.md` -> markdown, everything else -> JSON
- Use `writeFileSync` from `node:fs`

Import `ProductProfile` type from `@basesignal/core`. If the type is not yet available, define a local interface matching the design doc's usage and add a `// TODO: import from @basesignal/core when available` comment.

**Tests:** `packages/cli/src/formatters.test.ts`

Create a test fixture -- a complete `ProductProfile` object with all sections populated:

- `formatSummary` produces expected output for a full profile (check for product name, URL, target, model, journey stages, metrics count, profile ID, completeness)
- `formatSummary` handles partial profile (missing identity, missing revenue, missing journey)
- `formatSummary` handles empty profile (all sections null/undefined)
- `formatMarkdown` produces valid markdown with all sections
- `formatMarkdown` handles empty/missing sections gracefully (no `## Revenue Architecture` heading if no revenue data)
- `formatOutput` with `"json"` returns valid JSON string
- `formatOutput` with `"summary"` calls formatSummary
- `formatOutput` with `"markdown"` calls formatMarkdown
- `writeOutputFile` with `.json` extension writes JSON content (mock `writeFileSync`)
- `writeOutputFile` with `.md` extension writes markdown content (mock `writeFileSync`)

---

### Step 5: Update config.ts for scan command needs

**File:** `packages/cli/src/config.ts`

The CLI skeleton (S001) defines `loadConfig()` / `resolveConfig()` with basic env var reading. Ensure the config module:

1. Returns a `CLIConfig` type with `provider`, `apiKey`, `model`, and `storagePath` fields
2. Resolves the API key from the provider-specific env var (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
3. Throws a `ScanError` with code `"missing-api-key"` if a non-Ollama provider has no API key set
4. Defaults `storagePath` to `process.env.BASESIGNAL_STORAGE` or `undefined` (let SQLiteStorage use its default `~/.basesignal/data.db`)

If the skeleton already has this, verify it matches. If the skeleton used `CLIError` instead of `ScanError`, update the import to use `ScanError` from `errors.ts`.

**Tests:** Update `packages/cli/src/config.test.ts` if needed:

- Missing API key for anthropic provider throws ScanError with code `"missing-api-key"`
- Ollama provider does not require API key
- `BASESIGNAL_STORAGE` env var is read into `storagePath`

---

### Step 6: Implement the scan command -- URL validation

**File:** `packages/cli/src/commands/scan.ts`

Start building the scan command file. First, implement `validateUrl()`:

```typescript
function validateUrl(input: string): URL {
  const normalized = input.match(/^https?:\/\//) ? input : `https://${input}`;
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("bad protocol");
    }
    return parsed;
  } catch {
    throw new ScanError(
      "invalid-url",
      `"${input}" is not a valid URL`,
      "Example: basesignal scan https://linear.app",
    );
  }
}
```

Key behaviors:
- Bare domains like `linear.app` get `https://` prepended automatically
- Non-HTTP protocols are rejected
- Invalid strings produce a `ScanError` with a usage example

**Tests:** Add to `packages/cli/src/commands/scan.test.ts`:

- `validateUrl("https://example.com")` returns URL with href `https://example.com/`
- `validateUrl("http://example.com")` returns URL with http protocol
- `validateUrl("example.com")` returns URL with `https://example.com/` (auto-prepend)
- `validateUrl("linear.app")` returns URL with `https://linear.app/`
- `validateUrl("ftp://example.com")` throws ScanError with code `"invalid-url"`
- `validateUrl("not-a-url://what")` throws ScanError with code `"invalid-url"`
- `validateUrl("")` throws ScanError with code `"invalid-url"`

---

### Step 7: Implement the scan command -- registerScanCommand and runScan

**File:** `packages/cli/src/commands/scan.ts`

Replace the placeholder handler from the CLI skeleton with the full implementation.

**`registerScanCommand(program)`:**
- Register `scan <url>` command on the Commander program
- Options: `-o, --output <path>`, `-f, --format <type>` (default: `"summary"`), `-v, --verbose` (default: `false`)
- Remove `--provider` and `--model` options if the skeleton included them (design decision: these are env vars, not per-command flags)
- Action handler calls `runScan(url, options)` and catches errors via `handleScanError`

**`runScan(url, options)` -- the composition core:**

This is the main orchestration function. It creates instances, wires them together, and runs the pipeline:

```
1. resolveConfig()          -> config
2. createProgress(verbose)  -> progress
3. new SQLiteStorage(...)   -> storage (in try/finally for cleanup)
4. validateUrl(url)         -> parsedUrl
5. PHASE 1 - CRAWL:
   - progress.start("Crawling", hostname)
   - new WebsiteCrawler() or createCrawler()
   - crawler.crawl(parsedUrl.href)
   - If pages empty, throw ScanError("crawl-empty")
   - progress.done("Crawling", `${pages.length} pages`)
6. PHASE 2 - ANALYZE:
   - progress.start("Analyzing", `${pages.length} pages through 7 lenses`)
   - createProvider(config) or createProviderFromEnv()
   - analyzePipeline(pages, provider, { onPhase callback })
   - progress.done("Analyzing", "profile generated")
7. PHASE 3 - SAVE:
   - progress.start("Saving", "to local storage")
   - storage.save(profile)
   - progress.done("Saving", profileId)
8. PHASE 4 - OUTPUT:
   - formatOutput(profile, options.format) -> stdout via console.log
   - If options.output, writeOutputFile(options.output, profile)
```

The `finally` block calls `storage.close()` to release the SQLite connection regardless of success or failure.

**Import mapping** (adapt to actual package exports):
- `WebsiteCrawler` from `@basesignal/crawlers` -- if a `createCrawler()` factory exists, use it; otherwise construct `new WebsiteCrawler()`
- `createProvider` or `createProviderFromEnv` from `@basesignal/core/llm` or `@basesignal/core`
- `SQLiteStorage` from `@basesignal/storage`
- `runAnalysisPipeline` or `analyzePipeline` from `@basesignal/core/pipeline` or `@basesignal/mcp-server/analysis`
- `resolveConfig` / `loadConfig` from `../config.js`
- `createProgress` from `../progress.js`
- `formatOutput`, `writeOutputFile` from `../formatters.js`
- `ScanError`, `handleScanError` from `../errors.js`

If the analysis pipeline function is not yet exported from a package, create a local adapter that maps the crawler's `CrawlResult.pages` to the pipeline's `PipelineInput` format and calls the pipeline. Note this as a temporary measure with a TODO.

**Tests:** `packages/cli/src/commands/scan.test.ts`

These tests mock all external dependencies (crawler, LLM provider, storage, pipeline):

- `runScan` calls crawl, analyze, save in sequence (verify call order via mock)
- `runScan` passes crawled pages to the analysis pipeline
- `runScan` saves the analysis result to storage
- `runScan` prints formatted output to stdout (mock `console.log`)
- `runScan` writes to file when `--output` is provided
- `runScan` calls `storage.close()` even when an error occurs (test the finally block)
- `runScan` throws ScanError with code `"crawl-empty"` when crawler returns zero pages
- `runScan` with `--format json` outputs JSON to stdout
- `runScan` with `--format markdown` outputs markdown to stdout
- `runScan` with `--verbose` creates verbose progress (verify progress.detail is called)

For mocking the pipeline and storage, create simple mock objects:

```typescript
const mockCrawler = {
  name: "website",
  sourceType: "website" as const,
  canCrawl: () => true,
  crawl: vi.fn().mockResolvedValue({
    pages: [{ url: "https://example.com", pageType: "homepage", content: "Hello", title: "Example" }],
    timing: { startedAt: 0, completedAt: 100, totalMs: 100 },
    errors: [],
  }),
};

const mockStorage = {
  save: vi.fn().mockResolvedValue("test-profile-id"),
  load: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
  close: vi.fn(),
};
```

Use `vi.mock()` to mock the package imports. The pipeline mock should return a realistic `ProductProfile` object.

---

### Step 8: Update the CLI entry point to register the scan command

**File:** `packages/cli/src/index.ts`

The entry point should already call `registerScanCommand(program)` from the skeleton. Verify:

- The import path for `registerScanCommand` points to `./commands/scan.js`
- The `program.parseAsync(process.argv).catch(handleError)` is in place
- No changes needed if the skeleton wired this correctly

If the skeleton used a different error handler, ensure `handleScanError` is called within the scan command's action handler (not at the top level), since the top-level handler should remain generic for all commands.

---

### Step 9: Verify build and type-checking

Run from the repo root:

```bash
cd packages/cli && npx tsc --noEmit    # Type-check
cd packages/cli && npx tsup             # Build
cd packages/cli && npx vitest run       # Tests
```

All three must pass. Fix any type errors, import resolution issues, or test failures.

---

### Step 10: Manual verification of command-line behavior

After the build passes, verify the command-line interface:

```bash
# Help text shows updated scan options
node packages/cli/dist/index.js scan --help

# Should show:
#   Usage: basesignal scan [options] <url>
#   Options:
#     -o, --output <path>   Save profile to file
#     -f, --format <type>   Output format: summary, json, markdown (default: "summary")
#     -v, --verbose         Show detailed progress (default: false)
#     -h, --help            display help for command

# Missing API key shows friendly error
node packages/cli/dist/index.js scan https://linear.app
# Should print: Error: No API key found for anthropic
#               Set ANTHROPIC_API_KEY: export ANTHROPIC_API_KEY=your-key-here

# Invalid URL shows friendly error
node packages/cli/dist/index.js scan not-a-url://what
# Should print: Error: "not-a-url://what" is not a valid URL
#               Example: basesignal scan https://linear.app
```

This step is manual verification only -- not automated tests.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/cli/package.json` | Modify | Add ora, @basesignal/core, @basesignal/crawlers, @basesignal/storage dependencies |
| `packages/cli/src/errors.ts` | Modify | Add ScanError class, ScanErrorCode type, handleScanError function |
| `packages/cli/src/errors.test.ts` | Create | Tests for ScanError and handleScanError |
| `packages/cli/src/progress.ts` | Create | Progress interface and createProgress factory with ora/TTY support |
| `packages/cli/src/progress.test.ts` | Create | Tests for progress display in TTY and non-TTY modes |
| `packages/cli/src/formatters.ts` | Create | formatOutput, formatSummary, formatMarkdown, writeOutputFile |
| `packages/cli/src/formatters.test.ts` | Create | Tests for all output formatters |
| `packages/cli/src/config.ts` | Modify | Ensure ScanError thrown for missing API key |
| `packages/cli/src/config.test.ts` | Modify | Tests for missing API key producing ScanError |
| `packages/cli/src/commands/scan.ts` | Modify | Replace placeholder with full scan implementation |
| `packages/cli/src/commands/scan.test.ts` | Create | Tests for validateUrl, runScan composition, error handling |
| `packages/cli/src/index.ts` | Verify | Ensure scan command registration is wired correctly |

## Acceptance Criteria Mapping

| Acceptance Criterion | Steps |
|---|---|
| `basesignal scan <url>` runs the full pipeline and prints a summary to stdout | Steps 6, 7, 8 |
| `basesignal scan <url> --output profile.json` saves profile as JSON to file | Steps 4, 7 (writeOutputFile) |
| `basesignal scan <url> --format markdown` outputs as markdown | Steps 4, 7 (formatOutput dispatch) |
| Progress is shown during execution | Step 3 (progress module), Step 7 (phase callbacks) |
| Profile is automatically saved to storage | Step 7 (storage.save in Phase 3) |
| Scan errors produce helpful messages | Steps 2, 5, 6, 7 (ScanError + handleScanError) |

## Test Strategy

**Unit tests (per module):**
- `errors.test.ts` -- ScanError construction, handleScanError classification (7 cases)
- `progress.test.ts` -- TTY vs non-TTY output, verbose vs non-verbose (4 cases)
- `formatters.test.ts` -- Summary, markdown, JSON output for full/partial/empty profiles (11 cases)
- `scan.test.ts` -- URL validation (7 cases), runScan composition and error paths (10 cases)

**Total: ~32 test cases across 4 test files.**

All tests mock external dependencies. No live network calls, no real LLM API calls, no file system writes (except mocked writeFileSync). Storage tests use in-memory mocks, not SQLite.
