# Working Examples Design (basic-scan, claude-desktop, custom-crawler)

**Date:** 2026-02-15
**Status:** Draft
**Story:** M008-E006-S004

## Overview

Create three working examples in `examples/` that demonstrate Basesignal usage at increasing levels of sophistication: a minimal CLI scan script, a Claude Desktop configuration walkthrough, and a complete custom crawler implementation. Each example is self-contained, has its own README, and is tested in CI to prevent breakage.

## Problem Statement

The open source release (M008) needs concrete, copy-pasteable examples that answer three questions:

1. **"How do I try this?"** -- The basic-scan example answers in under 30 seconds of reading.
2. **"How do I use this with Claude?"** -- The claude-desktop example gets someone connected in 5 minutes.
3. **"How do I extend this?"** -- The custom-crawler example shows the full contribution workflow.

Without examples, documentation is theory. Examples are proof that the software works and that the interfaces are usable by humans.

## Expert Perspectives

### Technical Architect

The examples should use the published package APIs identically to how a real user would. No internal imports, no reaching into `src/`, no monorepo-specific paths. If the examples need special accommodations that a real npm user would not have, the package APIs are wrong. Each example should be a standalone directory that works after `npm install` -- not a workspace member, not a linked package. The test strategy should verify that the examples compile and that their core logic executes, not that they produce correct analysis results (that is the package tests' job).

### Simplification Reviewer

**Verdict: APPROVED** with constraints.

Keep:
- Three examples. Each serves a distinct user need. None is redundant.
- Standalone directories with their own `package.json`. This proves the packages work outside the monorepo.
- READMEs with numbered steps. The reader should never wonder "what do I do next?"

Watch:
- **Do not over-engineer the test setup.** Examples should be tested with `tsc --noEmit` for type correctness and a simple smoke script, not a full Vitest suite. Examples are not test suites -- they are teaching material that happens to be checked.
- **No fixture data in basic-scan.** It should actually call the scan pipeline (against a mock or with a dry-run flag). If it needs fixture data to work, the CLI is not self-contained enough.
- **The custom-crawler README is the most important file.** It is the contributor's onboarding document. Get this right.

## Proposed Solution

### Directory Structure

```
examples/
  basic-scan/
    README.md             # Step-by-step: install, configure, scan
    scan.ts               # ~20 lines: scan a URL, print the result
    package.json          # Depends on @basesignal/cli
    tsconfig.json         # Strict, ESM
  claude-desktop/
    README.md             # Step-by-step: install, configure Claude Desktop, test
    claude_desktop_config.json    # Config snippet (copy-pasteable)
    package.json          # Depends on @basesignal/mcp-server
    tsconfig.json
  custom-crawler/
    README.md             # Step-by-step: implement, register, test, contribute
    github-readme-crawler.ts      # Complete Crawler implementation
    github-readme-crawler.test.ts # Test with fixture data
    fixtures/
      github-linear-readme.html   # Saved HTML for testing
    package.json          # Depends on @basesignal/crawlers
    tsconfig.json
```

### Example 1: basic-scan

**Purpose:** Show the minimum viable usage of Basesignal. A user reads this and knows the tool works.

**README.md outline:**

```markdown
# Basic Scan Example

Scan a product website and generate a product profile in under a minute.

## Prerequisites

- Node.js 18+
- An Anthropic API key (or OpenAI, or Ollama for local)

## Steps

1. Install the CLI

   npm install -g @basesignal/cli

2. Set your API key

   export ANTHROPIC_API_KEY=sk-ant-...

3. Scan a product

   basesignal scan https://linear.app

4. Save the output

   basesignal scan https://linear.app --output linear-profile.json --format json

## Sample Output

(Include a truncated example of what the markdown summary looks like)

## What Just Happened?

1. Basesignal crawled linear.app (homepage, features, pricing)
2. Ran 7 experiential lenses to extract value patterns
3. Converged and tiered the findings
4. Generated a product profile with identity, journey, definitions, and metrics

## Next Steps

- View the full profile: `basesignal export linear-profile.json --format markdown`
- Connect to Claude Desktop: see ../claude-desktop/
- Build a custom crawler: see ../custom-crawler/
```

**scan.ts:**

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

**Design note:** The basic-scan example wraps the CLI because that is how a real user would use Basesignal for the first time. It does not import `@basesignal/core` directly -- that is a power-user concern. The script is intentionally trivial so the reader focuses on the CLI, not the code.

**Alternative considered and rejected:** A programmatic example using `@basesignal/core` directly. This adds complexity (instantiating crawlers, storage, and LLM providers manually) without teaching the user anything they need in the first 5 minutes. The custom-crawler example covers programmatic usage.

### Example 2: claude-desktop

**Purpose:** Get Basesignal running as an MCP server in Claude Desktop. This is the primary distribution surface.

**README.md outline:**

```markdown
# Claude Desktop Setup

Connect Basesignal to Claude Desktop so you can scan and analyze products
through conversation.

## Prerequisites

- Claude Desktop installed
- Node.js 18+
- An Anthropic API key

## Steps

### 1. Install the MCP server

   npm install -g @basesignal/cli

### 2. Configure Claude Desktop

   Open your Claude Desktop configuration file:

   - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Linux: ~/.config/Claude/claude_desktop_config.json
   - Windows: %APPDATA%\Claude\claude_desktop_config.json

   Add the basesignal server:

   (see claude_desktop_config.json in this directory)

### 3. Restart Claude Desktop

   Quit and reopen Claude Desktop. You should see "basesignal" in the
   MCP servers list (click the hammer icon).

### 4. Test the connection

   In Claude Desktop, type:

   > Can you scan linear.app and tell me about their product?

   Claude will call the scan_product tool and return a product profile summary.

## Available Tools

| Tool | Description |
|------|-------------|
| scan_product | Scan a URL and generate a product profile |
| get_profile | Retrieve a stored product profile |
| list_products | List all scanned products |
| get_definition | Get a specific definition (activation, first value, etc.) |
| update_definition | Refine a definition through conversation |
| export_profile | Export a profile as markdown or JSON |

## Troubleshooting

- "Server not found": Make sure @basesignal/cli is installed globally
- "API key error": Set ANTHROPIC_API_KEY in your shell profile
- "Connection refused": Restart Claude Desktop after config changes

## Configuration Options

Environment variables in the config:

| Variable | Default | Description |
|----------|---------|-------------|
| ANTHROPIC_API_KEY | (required) | Your Anthropic API key |
| BASESIGNAL_PROVIDER | anthropic | LLM provider (anthropic, openai, ollama) |
| BASESIGNAL_MODEL | (provider default) | Model override |
| BASESIGNAL_STORAGE | ~/.basesignal | Storage directory path |
```

**claude_desktop_config.json:**

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

**Design note:** This example is primarily documentation, not code. The `claude_desktop_config.json` is the artifact. The README is the value. No executable script is needed because the MCP server is the executable.

### Example 3: custom-crawler

**Purpose:** Demonstrate how to implement the `Crawler` interface. This is the contributor onboarding path.

**The crawler:** A GitHub README crawler that fetches a repository's README and extracts product information from it. This is a good choice because:
- GitHub is universally known
- README.md files contain product descriptions, features, and value propositions
- The implementation is simple (one HTTP request + markdown parsing)
- It demonstrates a non-website data source (sourceType: `docs`)

**README.md outline:**

```markdown
# Custom Crawler Example: GitHub README

This example implements a custom Basesignal crawler that extracts product
information from GitHub repository READMEs.

## What You Will Build

A crawler that:
- Detects GitHub repository URLs
- Fetches the README.md via GitHub's API
- Extracts the content as markdown
- Returns it as a CrawledPage for the analysis pipeline

## Prerequisites

- Node.js 18+
- Familiarity with TypeScript

## The Crawler Interface

Every Basesignal crawler implements four things:

    interface Crawler {
      name: string;              // Unique identifier
      sourceType: SourceType;    // What kind of data (website, docs, etc.)
      canCrawl(url: string): boolean;      // "Can you handle this URL?"
      crawl(url: string, options?): Promise<CrawlResult>;  // Do the work
    }

## Step-by-Step

### 1. Set up the project

   npm install
   npm run typecheck

### 2. Read the implementation

   Open github-readme-crawler.ts and read through it. Key points:
   - canCrawl() checks for github.com URLs
   - crawl() fetches the README via GitHub's raw content URL
   - The result is wrapped in a CrawlResult with timing and metadata

### 3. Run the tests

   npm test

   The tests use fixture data (saved HTML) so they work offline,
   without hitting GitHub's API.

### 4. Try it live (optional)

   GITHUB_TOKEN=ghp_... npx tsx github-readme-crawler.ts facebook/react

## How to Contribute a Crawler

1. Fork the Basesignal repository
2. Create packages/crawlers/src/your-crawler.ts
3. Implement the Crawler interface
4. Add fixture-based tests
5. Register in packages/crawlers/src/index.ts
6. Submit a PR

See CONTRIBUTING.md for the full contribution guide.
```

**github-readme-crawler.ts:**

```typescript
/**
 * GitHub README Crawler
 *
 * Fetches a GitHub repository's README and returns it as a CrawledPage.
 * Demonstrates how to implement the Basesignal Crawler interface.
 *
 * Usage:
 *   npx tsx github-readme-crawler.ts facebook/react
 */
import type {
  Crawler,
  CrawlResult,
  CrawlOptions,
  CrawledPage,
} from "@basesignal/crawlers";

/**
 * Parses a GitHub URL into owner/repo.
 * Accepts: https://github.com/owner/repo or owner/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle full URLs
  const urlMatch = url.match(
    /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  // Handle owner/repo shorthand
  const shortMatch = url.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
}

export const githubReadmeCrawler: Crawler = {
  name: "github-readme",
  sourceType: "docs",

  canCrawl(url: string): boolean {
    return parseGitHubUrl(url) !== null;
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();
    const parsed = parseGitHubUrl(url);

    if (!parsed) {
      return {
        pages: [],
        timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
        errors: [{ url, error: `Not a valid GitHub URL: ${url}` }],
      };
    }

    const { owner, repo } = parsed;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;

    try {
      const controller = new AbortController();
      if (options?.signal) {
        options.signal.addEventListener("abort", () => controller.abort());
      }
      if (options?.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }

      const response = await fetch(rawUrl, { signal: controller.signal });

      if (!response.ok) {
        return {
          pages: [],
          timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
          errors: [{ url: rawUrl, error: `HTTP ${response.status}: ${response.statusText}` }],
        };
      }

      const content = await response.text();
      const completedAt = Date.now();

      const page: CrawledPage = {
        url: `https://github.com/${owner}/${repo}`,
        pageType: "docs",
        title: `${owner}/${repo} README`,
        content,
        metadata: {
          description: `README from GitHub repository ${owner}/${repo}`,
        },
      };

      return {
        pages: [page],
        timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
        errors: [],
      };
    } catch (error) {
      const completedAt = Date.now();
      return {
        pages: [],
        timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
        errors: [{ url: rawUrl, error: error instanceof Error ? error.message : String(error) }],
      };
    }
  },
};

// --- CLI runner (when executed directly) ---
const repo = process.argv[2];
if (repo) {
  console.log(`Crawling GitHub README for ${repo}...`);
  githubReadmeCrawler.crawl(repo).then((result) => {
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors);
      process.exit(1);
    }
    console.log(`Fetched ${result.pages.length} page(s) in ${result.timing.totalMs}ms`);
    console.log("---");
    console.log(result.pages[0]?.content.slice(0, 500) + "...");
  });
}
```

**github-readme-crawler.test.ts:**

```typescript
import { describe, it, expect } from "vitest";
import { githubReadmeCrawler } from "./github-readme-crawler.js";

describe("githubReadmeCrawler", () => {
  describe("canCrawl", () => {
    it("accepts GitHub URLs", () => {
      expect(githubReadmeCrawler.canCrawl("https://github.com/facebook/react")).toBe(true);
    });

    it("accepts owner/repo shorthand", () => {
      expect(githubReadmeCrawler.canCrawl("facebook/react")).toBe(true);
    });

    it("rejects non-GitHub URLs", () => {
      expect(githubReadmeCrawler.canCrawl("https://linear.app")).toBe(false);
    });

    it("rejects empty strings", () => {
      expect(githubReadmeCrawler.canCrawl("")).toBe(false);
    });
  });

  describe("crawl", () => {
    it("returns a CrawlResult with timing", async () => {
      const result = await githubReadmeCrawler.crawl("invalid-no-slash");
      expect(result.timing).toHaveProperty("startedAt");
      expect(result.timing).toHaveProperty("completedAt");
      expect(result.timing).toHaveProperty("totalMs");
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("returns error for invalid GitHub URL", async () => {
      const result = await githubReadmeCrawler.crawl("not-a-repo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Not a valid GitHub URL");
    });

    it("sets correct page metadata", async () => {
      // This test uses a fixture approach: mock fetch for deterministic results
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response("# Test Repo\n\nA test repository.", {
          status: 200,
          statusText: "OK",
        });

      try {
        const result = await githubReadmeCrawler.crawl("https://github.com/test/repo");
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].pageType).toBe("docs");
        expect(result.pages[0].title).toBe("test/repo README");
        expect(result.pages[0].content).toContain("# Test Repo");
        expect(result.pages[0].url).toBe("https://github.com/test/repo");
        expect(result.errors).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles HTTP errors gracefully", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response("Not Found", { status: 404, statusText: "Not Found" });

      try {
        const result = await githubReadmeCrawler.crawl("https://github.com/no/repo");
        expect(result.pages).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("404");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles network errors gracefully", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error("Network unreachable");
      };

      try {
        const result = await githubReadmeCrawler.crawl("https://github.com/test/repo");
        expect(result.pages).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("Network unreachable");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("interface compliance", () => {
    it("has required properties", () => {
      expect(githubReadmeCrawler.name).toBe("github-readme");
      expect(githubReadmeCrawler.sourceType).toBe("docs");
      expect(typeof githubReadmeCrawler.canCrawl).toBe("function");
      expect(typeof githubReadmeCrawler.crawl).toBe("function");
    });
  });
});
```

**fixtures/github-linear-readme.html:**

A saved snapshot of `https://raw.githubusercontent.com/linear/linear/HEAD/README.md` content, used as a reference fixture. In practice, the tests mock `fetch` rather than reading from the fixture file, but the fixture serves as documentation of what real README content looks like and can be used for manual testing.

### CI Testing Strategy

Examples should not have their own heavy test infrastructure. They are tested at three levels:

**Level 1: Type checking (all examples)**

```bash
# In CI script or package.json "test:examples" script
cd examples/basic-scan && npx tsc --noEmit
cd examples/custom-crawler && npx tsc --noEmit
```

This verifies that the examples compile against the published type definitions. If a package API changes and breaks the example, CI catches it.

**Level 2: Unit tests (custom-crawler only)**

```bash
cd examples/custom-crawler && npx vitest run
```

The custom-crawler has real tests because it implements a real interface. The basic-scan and claude-desktop examples do not need unit tests -- type checking is sufficient.

**Level 3: Lint/validate (claude-desktop only)**

```bash
# Verify the JSON config is valid JSON
node -e "JSON.parse(require('fs').readFileSync('examples/claude-desktop/claude_desktop_config.json'))"
```

**CI integration:**

Add a step to the existing CI workflow (or the new one from M008-E006-S005):

```yaml
test-examples:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
    - run: npm ci
    - name: Build packages (examples depend on published types)
      run: npm run build --workspaces
    - name: Typecheck basic-scan
      working-directory: examples/basic-scan
      run: npm install && npx tsc --noEmit
    - name: Typecheck custom-crawler
      working-directory: examples/custom-crawler
      run: npm install && npx tsc --noEmit
    - name: Test custom-crawler
      working-directory: examples/custom-crawler
      run: npm install && npx vitest run
    - name: Validate claude-desktop config
      run: node -e "JSON.parse(require('fs').readFileSync('examples/claude-desktop/claude_desktop_config.json'))"
```

### Package.json Files

**examples/basic-scan/package.json:**
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

**examples/claude-desktop/package.json:**
```json
{
  "name": "basesignal-example-claude-desktop",
  "private": true,
  "description": "Claude Desktop configuration for Basesignal MCP server",
  "dependencies": {
    "@basesignal/mcp-server": "latest"
  }
}
```

**examples/custom-crawler/package.json:**
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

## Key Decisions

### 1. Examples are NOT workspace members

The examples have their own `package.json` with `@basesignal/*: "latest"` dependencies, not `workspace:*`. This is deliberate. Examples must work the same way a real user would install them. If examples only work because of monorepo workspace resolution, they are lying about the user experience.

During development in the monorepo, we use `npm link` or point to local paths for testing. CI builds the packages first, then runs the examples against the built output.

### 2. basic-scan wraps the CLI, not the SDK

A new user's first experience should be the CLI. Programmatic SDK usage is a second step. The basic-scan example is intentionally thin -- it shows the CLI command, not the internal APIs. This reduces cognitive load and keeps the example under 20 lines.

### 3. GitHub README as the custom crawler subject

Choosing a GitHub README crawler has multiple benefits:
- GitHub is universal (every developer has seen one)
- READMEs are public (no API keys needed for raw content)
- It exercises the full `Crawler` interface without complex HTML parsing
- `sourceType: "docs"` demonstrates a non-website source type
- The implementation is ~80 lines, achievable in an afternoon

Rejected alternatives:
- **HackerNews crawler** -- requires HTML parsing, less clearly "product" content
- **npm package crawler** -- interesting but the npm registry API has rate limits
- **Twitter/X crawler** -- requires auth, blocked by most rate limiters

### 4. Tests mock fetch, not a fixture file reader

The custom-crawler tests mock `globalThis.fetch` to return deterministic responses rather than reading from fixture files on disk. This is simpler (no file path resolution), faster (no I/O), and matches how the `createFixtureCrawler` helper from M008-E003-S004 works conceptually. The fixture HTML file exists as documentation and for manual testing.

### 5. No Vitest in basic-scan or claude-desktop

Type checking via `tsc --noEmit` is sufficient for examples that contain no logic. Adding Vitest to examples that have nothing to test adds dependency weight and false sophistication. The custom-crawler gets Vitest because it has real behavior to verify.

### 6. Each example has exactly one main file

- `basic-scan/scan.ts` -- one file
- `claude-desktop/claude_desktop_config.json` -- one file
- `custom-crawler/github-readme-crawler.ts` -- one file (plus its test)

This constraint forces simplicity. If an example needs multiple files to explain, it is too complex.

## What This Does NOT Do

- **Does not implement the analysis pipeline.** The basic-scan example calls the CLI which calls the pipeline. The example does not need to know how analysis works.
- **Does not test with live network calls.** CI tests are offline (mocked fetch, type checking). Live testing is manual.
- **Does not add the examples to the npm workspace.** Examples are standalone. They are not published, not built by the root `npm run build`, and not part of the dependency graph.
- **Does not create a Docker example.** Docker self-hosting is documented in `docs/self-hosting.md` (M008-E006-S002). A separate `examples/docker/` could come later but is not in scope.
- **Does not create an example for the Storage interface.** Storage adapters are a power-user concern covered in the docs, not in beginner examples.

## Implementation Order

1. Create `examples/` directory structure and all three `package.json` files
2. Write `examples/basic-scan/scan.ts` and `README.md`
3. Write `examples/claude-desktop/claude_desktop_config.json` and `README.md`
4. Write `examples/custom-crawler/github-readme-crawler.ts`, test file, and `README.md`
5. Add `fixtures/github-linear-readme.html` to custom-crawler
6. Add tsconfig.json to basic-scan and custom-crawler
7. Verify type checking passes for all examples (after packages are built)
8. Add CI step for example testing

## Verification Steps

1. `cd examples/basic-scan && npx tsc --noEmit` passes
2. `cd examples/custom-crawler && npx tsc --noEmit` passes
3. `cd examples/custom-crawler && npx vitest run` -- all tests pass
4. `node -e "JSON.parse(require('fs').readFileSync('examples/claude-desktop/claude_desktop_config.json'))"` succeeds
5. `examples/basic-scan/README.md` has numbered steps from install to output
6. `examples/claude-desktop/README.md` has numbered steps from install to first conversation
7. `examples/custom-crawler/README.md` has numbered steps from setup to PR submission
8. No file in `examples/` imports from a path starting with `../../packages/` (no monorepo-internal imports)

## Success Criteria

All five acceptance criteria from the story TOML:

1. `examples/basic-scan/` demonstrates CLI scan with a sample URL
2. `examples/claude-desktop/` contains the `claude_desktop_config.json` snippet and setup instructions
3. `examples/custom-crawler/` demonstrates implementing a custom Crawler
4. Each example has its own `README.md` with step-by-step instructions
5. Custom crawler example includes a complete, runnable crawler implementation

Plus:
- Examples are copy-pasteable and work with minimal setup
- Examples are tested in CI to catch breakage when package APIs change
- No monorepo-internal imports -- examples use published package names
