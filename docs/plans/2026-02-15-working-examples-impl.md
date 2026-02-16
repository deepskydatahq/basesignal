# Implementation Plan: Working Examples (basic-scan, claude-desktop, custom-crawler)

**Task:** basesignal-vy3 — M008-E006-S004: Working examples (basic-scan, claude-desktop, custom-crawler)
**Design:** docs/plans/2026-02-15-working-examples-design.md

## Context

Create three standalone examples in `examples/` that demonstrate Basesignal usage at increasing levels of sophistication. Each example is self-contained with its own `package.json` and `README.md`. Examples use published `@basesignal/*` package names (not monorepo-internal paths) so they faithfully represent the real user experience.

This story depends on:
- **M008-E005-S002** (scan command) — the basic-scan example wraps the `basesignal scan` CLI
- **M008-E003-S004** (crawler testing infra) — the custom-crawler example imports from `@basesignal/crawlers`

## Approach

Eight steps: create directory structure, write each example (basic-scan, claude-desktop, custom-crawler), add the fixture file, add tsconfig files, verify type-checking, and add CI testing.

No monorepo workspace membership — examples are standalone directories with `"latest"` dependencies on `@basesignal/*` packages.

## Implementation Steps

### Step 1: Create directory structure

Create the following directories:

```
examples/
  basic-scan/
  claude-desktop/
  custom-crawler/
    fixtures/
```

Command: `mkdir -p examples/basic-scan examples/claude-desktop examples/custom-crawler/fixtures`

### Step 2: Create `examples/basic-scan/`

**2a. `examples/basic-scan/package.json`**

Create with:

```json
{
  "name": "basesignal-example-basic-scan",
  "private": true,
  "type": "module",
  "scripts": {
    "scan": "npx tsx scan.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@basesignal/cli": "latest"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "~5.9.3"
  }
}
```

**2b. `examples/basic-scan/tsconfig.json`**

Create with strict ESM config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["*.ts"]
}
```

**2c. `examples/basic-scan/scan.ts`**

Create the minimal scan script (~15 lines) from the design doc. This wraps the CLI via `execSync` because a new user's first experience should be the CLI, not the SDK.

```typescript
/**
 * Basic Basesignal scan example.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scan.ts https://linear.app
 */
import { execSync } from "node:child_process";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scan.ts <url>");
  process.exit(1);
}

console.log(`Scanning ${url}...`);
const result = execSync(`npx basesignal scan ${url}`, {
  encoding: "utf-8",
  env: { ...process.env },
  stdio: ["pipe", "pipe", "inherit"],
});

console.log(result);
```

**2d. `examples/basic-scan/README.md`**

Write the README with numbered steps following the design doc outline:
1. Prerequisites (Node.js 18+, Anthropic API key)
2. Install the CLI
3. Set API key
4. Scan a product URL
5. Save output to file
6. Sample output (truncated example)
7. "What Just Happened?" section explaining the pipeline stages
8. Next Steps (links to claude-desktop and custom-crawler examples)

Key details:
- Title: "Basic Scan Example"
- Subtitle: "Scan a product website and generate a product profile in under a minute."
- Include both the CLI command approach and the `npx tsx scan.ts` approach
- Keep the sample output realistic but brief (10-15 lines)

### Step 3: Create `examples/claude-desktop/`

**3a. `examples/claude-desktop/package.json`**

```json
{
  "name": "basesignal-example-claude-desktop",
  "private": true,
  "description": "Claude Desktop configuration for Basesignal MCP server"
}
```

Note: No `type: "module"` or build scripts. This example is documentation, not executable code. The `package.json` exists to declare the dependency relationship but the primary artifact is the config JSON file.

**3b. `examples/claude-desktop/claude_desktop_config.json`**

```json
{
  "mcpServers": {
    "basesignal": {
      "command": "npx",
      "args": ["-y", "@basesignal/mcp-server"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
      }
    }
  }
}
```

This must be valid JSON (tested in CI).

**3c. `examples/claude-desktop/README.md`**

Write the README following the design doc outline:
1. Prerequisites (Claude Desktop installed, Node.js 18+, Anthropic API key)
2. Install the MCP server (`npm install -g @basesignal/cli`)
3. Configure Claude Desktop — include all three OS paths (macOS, Linux, Windows)
4. Restart Claude Desktop
5. Test the connection (sample prompt: "Can you scan linear.app and tell me about their product?")
6. Available Tools table (scan_product, get_profile, list_products, get_definition, update_definition, export_profile)
7. Troubleshooting section (server not found, API key error, connection refused)
8. Configuration Options table (ANTHROPIC_API_KEY, BASESIGNAL_PROVIDER, BASESIGNAL_MODEL, BASESIGNAL_STORAGE)

Key details:
- Title: "Claude Desktop Setup"
- Subtitle: "Connect Basesignal to Claude Desktop so you can scan and analyze products through conversation."
- Reference the `claude_desktop_config.json` file in this directory rather than embedding it inline (tell the reader to copy it)

### Step 4: Create `examples/custom-crawler/` source files

**4a. `examples/custom-crawler/package.json`**

```json
{
  "name": "basesignal-example-custom-crawler",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "crawl": "npx tsx github-readme-crawler.ts"
  },
  "dependencies": {
    "@basesignal/crawlers": "latest"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  }
}
```

**4b. `examples/custom-crawler/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["*.ts"]
}
```

**4c. `examples/custom-crawler/github-readme-crawler.ts`**

Create the full crawler implementation from the design doc (~80 lines). Key implementation points:

1. `parseGitHubUrl(url)` helper — accepts both `https://github.com/owner/repo` and `owner/repo` shorthand, returns `{ owner, repo } | null`
2. `githubReadmeCrawler` object implementing `Crawler` interface:
   - `name: "github-readme"`
   - `sourceType: "docs"`
   - `canCrawl(url)` — delegates to `parseGitHubUrl`
   - `crawl(url, options?)` — fetches `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`, handles `AbortSignal` and timeout from options, wraps result in `CrawlResult`
3. CLI runner at bottom — when executed directly with `process.argv[2]`, calls `crawl()` and prints a snippet

Import types from `@basesignal/crawlers` (not internal paths):

```typescript
import type {
  Crawler,
  CrawlResult,
  CrawlOptions,
  CrawledPage,
} from "@basesignal/crawlers";
```

**4d. `examples/custom-crawler/github-readme-crawler.test.ts`**

Create the test file from the design doc with three describe blocks:

1. **`canCrawl`** (4 tests):
   - Accepts GitHub URLs → `true`
   - Accepts `owner/repo` shorthand → `true`
   - Rejects non-GitHub URLs → `false`
   - Rejects empty strings → `false`

2. **`crawl`** (5 tests):
   - Returns `CrawlResult` with timing properties for invalid input
   - Returns error for invalid GitHub URL (not matching `owner/repo`)
   - Sets correct page metadata (mock `globalThis.fetch` → verify `pageType`, `title`, `content`, `url`)
   - Handles HTTP errors gracefully (mock 404 → verify `errors` array)
   - Handles network errors gracefully (mock throw → verify `errors` array)

3. **`interface compliance`** (1 test):
   - Verifies `name`, `sourceType`, `canCrawl`, `crawl` properties exist with correct types

Tests mock `globalThis.fetch` with try/finally to restore the original. No fixture file I/O needed.

### Step 5: Create fixture file

**`examples/custom-crawler/fixtures/github-linear-readme.html`**

Save a representative snapshot of a GitHub README for Linear. This is documentation/reference material, not used by automated tests (tests mock fetch instead). Content should be a realistic markdown README (~50-80 lines) that includes:
- Project title and description
- Features list
- Installation instructions
- A note that this is a saved snapshot for testing reference

### Step 6: Create `examples/custom-crawler/README.md`

This is the most important file in the examples (per design doc review). Write it following the design doc outline:

1. Title: "Custom Crawler Example: GitHub README"
2. "What You Will Build" — 4 bullet points (detect GitHub URLs, fetch README, extract content, return CrawledPage)
3. Prerequisites (Node.js 18+, TypeScript familiarity)
4. "The Crawler Interface" — show the 4-member interface with brief descriptions
5. Step-by-step:
   - Set up the project (`npm install`, `npm run typecheck`)
   - Read the implementation (point to `github-readme-crawler.ts`, explain `canCrawl` and `crawl`)
   - Run the tests (`npm test`)
   - Try it live (optional, with `GITHUB_TOKEN`)
6. "How to Contribute a Crawler" — 6-step guide (fork, create file, implement, test, register, PR)
7. Link to CONTRIBUTING.md

### Step 7: Add CI testing step

**File:** `.github/workflows/ci.yml`

Add a new job `test-examples` after the existing `build` job. The job:

1. Checks out code
2. Sets up Node.js 20 (matching existing CI)
3. Installs root dependencies (`npm ci`)
4. Builds packages (`npm run build --workspaces`) — examples depend on built type definitions
5. Typechecks `basic-scan`: `cd examples/basic-scan && npm install && npx tsc --noEmit`
6. Typechecks `custom-crawler`: `cd examples/custom-crawler && npm install && npx tsc --noEmit`
7. Tests `custom-crawler`: `cd examples/custom-crawler && npx vitest run`
8. Validates `claude-desktop` config JSON: `node -e "JSON.parse(require('fs').readFileSync('examples/claude-desktop/claude_desktop_config.json'))"`

Important: This job should be added as a separate `test-examples` job so it runs in parallel with the main `build` job and does not block existing CI.

Note: The CI step depends on the monorepo workspace setup (M008-E001) and package builds being functional. If packages do not exist yet at implementation time, the CI job can be initially set to `continue-on-error: true` or gated behind a condition, and hardened once the packages are built.

### Step 8: Verify

Run verification checks:

1. `cd examples/basic-scan && npx tsc --noEmit` — passes (no type errors)
2. `cd examples/custom-crawler && npx tsc --noEmit` — passes
3. `cd examples/custom-crawler && npx vitest run` — all 10 tests pass
4. `node -e "JSON.parse(require('fs').readFileSync('examples/claude-desktop/claude_desktop_config.json'))"` — succeeds
5. Each README has numbered step-by-step instructions
6. No file in `examples/` imports from `../../packages/` or any monorepo-internal path
7. All imports use `@basesignal/*` published package names

## Files Created

| File | Purpose |
|------|---------|
| `examples/basic-scan/package.json` | Standalone package declaring `@basesignal/cli` dependency |
| `examples/basic-scan/tsconfig.json` | Strict ESM TypeScript config |
| `examples/basic-scan/scan.ts` | ~15-line CLI wrapper script |
| `examples/basic-scan/README.md` | Step-by-step: install, configure, scan, inspect output |
| `examples/claude-desktop/package.json` | Minimal package metadata |
| `examples/claude-desktop/claude_desktop_config.json` | Copy-pasteable MCP server config |
| `examples/claude-desktop/README.md` | Step-by-step: install, configure Claude Desktop, test |
| `examples/custom-crawler/package.json` | Standalone package declaring `@basesignal/crawlers` dependency |
| `examples/custom-crawler/tsconfig.json` | Strict ESM TypeScript config |
| `examples/custom-crawler/github-readme-crawler.ts` | Complete `Crawler` implementation (~80 lines) |
| `examples/custom-crawler/github-readme-crawler.test.ts` | 10 tests covering canCrawl, crawl, and interface compliance |
| `examples/custom-crawler/fixtures/github-linear-readme.html` | Reference fixture (documentation, not used by automated tests) |
| `examples/custom-crawler/README.md` | Step-by-step: setup, read code, test, try live, contribute |

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Add `test-examples` job with typecheck, vitest, and JSON validation steps |

## Acceptance Criteria Mapping

| Criterion | Satisfied By |
|-----------|-------------|
| `examples/basic-scan/` demonstrates CLI scan with a sample URL | Step 2: `scan.ts` wraps `basesignal scan <url>`, README shows full workflow |
| `examples/claude-desktop/` contains config snippet and setup instructions | Step 3: `claude_desktop_config.json` + detailed README |
| `examples/custom-crawler/` demonstrates implementing a custom Crawler | Step 4: `github-readme-crawler.ts` implements the full `Crawler` interface |
| Each example has its own `README.md` with step-by-step instructions | Steps 2d, 3c, 6: Each README has numbered steps |
| Custom crawler example includes a complete, runnable crawler implementation | Step 4c: `github-readme-crawler.ts` is executable via `npx tsx`, has CLI runner |

## Risks

1. **Packages do not exist yet.** The `@basesignal/cli`, `@basesignal/mcp-server`, and `@basesignal/crawlers` packages are being built in parallel stories. Type checking in CI will fail until those packages are published or built locally. Mitigation: the CI job can use `continue-on-error: true` initially.

2. **Interface drift.** The `Crawler` interface types used in the custom-crawler example are based on the design in M008-E003-S001. If the interface changes during implementation, the example must be updated. Mitigation: CI type checking catches this automatically.

3. **MCP tool names may change.** The "Available Tools" table in the claude-desktop README lists tool names (`scan_product`, `get_profile`, etc.) that are defined in M008-E005. If those names change, the README becomes inaccurate. Mitigation: these are documentation strings, not code — easy to update.

## Order of Implementation

1. Step 1 — directory structure (no dependencies)
2. Steps 2a, 2b — basic-scan package.json and tsconfig (no dependencies)
3. Step 2c — basic-scan scan.ts (no dependencies)
4. Step 2d — basic-scan README.md (depends on scan.ts content)
5. Steps 3a, 3b — claude-desktop package.json and config JSON (no dependencies)
6. Step 3c — claude-desktop README.md (depends on config JSON)
7. Steps 4a, 4b — custom-crawler package.json and tsconfig (no dependencies)
8. Step 4c — custom-crawler github-readme-crawler.ts (no dependencies)
9. Step 4d — custom-crawler test file (depends on 4c)
10. Step 5 — fixture file (no dependencies)
11. Step 6 — custom-crawler README.md (depends on 4c)
12. Step 7 — CI workflow update (depends on all examples existing)
13. Step 8 — verification (depends on all above)
