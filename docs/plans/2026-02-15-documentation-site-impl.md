# Documentation Site Content Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create five standalone documentation guides in `docs/` plus a fixture file, with no framework, no build step, and no new dependencies. Each guide answers one specific question a developer would ask after finding Basesignal on GitHub.

**Architecture:** Plain markdown files in `docs/`. No VitePress, Docusaurus, or any doc framework. GitHub renders them natively. One validation test in `packages/core` ensures the example profile fixture stays in sync with the schema. All code examples are derived from the actual package interfaces defined in M008 stories.

**Deliverables:** 6 files total:
- `docs/getting-started.md`
- `docs/data-model.md`
- `docs/mcp-tools.md`
- `docs/crawlers.md`
- `docs/self-hosting.md`
- `docs/fixtures/linear-profile.json`

Plus 1 test file:
- `packages/core/src/__tests__/docs-example.test.ts`

**Key constraint:** The open source packages (`packages/core`, `packages/mcp-server`, `packages/crawlers`, `packages/cli`) are being built in parallel by other M008 stories. The docs must reference the interfaces and types defined in those stories' acceptance criteria and handoff hints. When the packages land, the docs should already match them. If there are discrepancies, the validation test and manual review will catch them.

---

## Task 1: Create the example profile fixture

**Why first:** The fixture is referenced by `data-model.md` and validated by a test. Creating it first means the data model guide can reference concrete fields and values.

**Files:**
- Create: `docs/fixtures/linear-profile.json`

**Step 1: Build the fixture JSON**

Create a complete, realistic ProductProfile JSON representing a scan of Linear (the project management tool). The structure must match the schema defined in `convex/schema.ts` for the `productProfiles` table, adapted to the framework-agnostic types defined in M008-E001-S002.

The fixture must include all top-level sections:
- `basesignal_version` (string, e.g., `"1.0.0"`)
- `metadata` (created, updated, source URL)
- `identity` (productName, description, targetCustomer, businessModel, industry, companyStage, confidence, evidence)
- `revenue` (model, billingUnit, hasFreeTier, tiers, expansionPaths, contractionRisks, confidence, evidence)
- `entities` (items with name/type/properties, relationships, confidence, evidence)
- `journey` (stages with name/description/order, confidence, evidence)
- `definitions` (activation, firstValue, active, atRisk, churn -- each with criteria, timeWindow, reasoning, confidence, source, evidence)
- `outcomes` (items with description/type/linkedFeatures, confidence, evidence)
- `metrics` (items with name/category/formula/linkedTo, confidence, evidence)
- `outputs` (icpProfiles, activationMap, measurementSpec -- matching the output types from `convex/analysis/outputs/types.ts`)
- `completeness` (number 0-100)
- `overallConfidence` (number 0-1)

The fixture should be a realistic, plausible representation of Linear:
- Identity: "Linear" / project management / B2B SaaS / seat-based subscription
- Revenue: seat-based with Free, Standard ($8/seat/mo), Plus ($14/seat/mo) tiers
- Entities: User, Workspace, Project, Issue, Cycle
- Journey: Sign Up -> Create Workspace -> Create Issues -> Invite Team -> Adopt Workflows -> Expand Usage
- Definitions: activation = "Created 3+ issues and invited 1+ team member within 7 days"
- Outputs: 2 ICP profiles, activation map with 4 stages, measurement spec with events

Use realistic confidence scores (0.6-0.9 range) and realistic evidence URLs pointing to `linear.app/features`, `linear.app/pricing`, etc.

**Step 2: Validate the fixture structure**

Manually verify the JSON is valid (no syntax errors) and all sections are present. The fixture should be approximately 200-400 lines of formatted JSON -- comprehensive but not bloated.

**Acceptance:** `docs/fixtures/linear-profile.json` exists, is valid JSON, and contains all top-level ProductProfile sections with realistic Linear data.

---

## Task 2: Create the validation test for the fixture

**Why:** This is the single highest-value sync mechanism between docs and code. When the schema changes and the fixture is not updated, this test fails.

**Files:**
- Create: `packages/core/src/__tests__/docs-example.test.ts`

**Step 1: Write the test**

```typescript
// packages/core/src/__tests__/docs-example.test.ts
import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("docs example profile", () => {
  test("fixture file exists and is valid JSON", () => {
    const fixturePath = resolve(
      __dirname,
      "../../../../docs/fixtures/linear-profile.json"
    );
    const raw = readFileSync(fixturePath, "utf-8");
    const profile = JSON.parse(raw);

    expect(profile).toBeDefined();
    expect(profile.basesignal_version).toBeDefined();
    expect(profile.identity).toBeDefined();
    expect(profile.identity.productName).toBe("Linear");
  });

  // When ProductProfileSchema exists (from M008-E001-S003), upgrade this test:
  // test("fixture validates against ProductProfile schema", () => {
  //   const profile = JSON.parse(readFileSync(fixturePath, "utf-8"));
  //   expect(() => ProductProfileSchema.parse(profile)).not.toThrow();
  // });
});
```

**Note:** The full Zod validation test is commented out because `ProductProfileSchema` does not exist yet (it is delivered by M008-E001-S003). The test currently validates that the fixture exists and has the expected structure. When the schema lands, uncomment and import the schema for full validation.

**Step 2: Verify the test passes**

Run: `npm test -- docs-example`

If `packages/core` does not exist yet (it is created by M008-E001-S001), this test file should still be created in the planned location. It will become runnable once the monorepo workspace is set up.

**Acceptance:** Test file exists at `packages/core/src/__tests__/docs-example.test.ts`. If the package exists, the test passes. If the package does not exist yet, the file is ready to run when it does.

---

## Task 3: Create `docs/getting-started.md`

**Why:** This is the first doc a developer reads. It must get them from "I found this" to "I ran a scan" in under 5 minutes of reading.

**Files:**
- Create: `docs/getting-started.md`

**Step 1: Write the guide**

Structure:

```markdown
# Getting Started

Brief intro: what Basesignal does (one sentence), what you'll accomplish in this guide (run your first product scan).

## Prerequisites
- Node.js 18+
- An LLM API key (one of: Anthropic, OpenAI, or Ollama for fully local)

## Install

npm install -g @basesignal/cli

## Configure Your LLM Provider

export ANTHROPIC_API_KEY=sk-ant-...
# OR
export OPENAI_API_KEY=sk-...
# OR for local/air-gapped: install Ollama, no API key needed

## Your First Scan

basesignal scan https://linear.app

Show expected output: a summary showing what was discovered (identity, pricing tiers, journey stages, etc.). Use a realistic but condensed example output block.

## View the Full Profile

basesignal export linear-app --format markdown

Show a snippet of the markdown export (identity section + one other section).

basesignal export linear-app --format json > linear-profile.json

## Connect to Claude Desktop

JSON snippet for claude_desktop_config.json:
{
  "mcpServers": {
    "basesignal": {
      "command": "basesignal",
      "args": ["serve", "--transport", "stdio"]
    }
  }
}

## What You Can Do Next

- Understand the data model: [The Product Profile Data Model](./data-model.md)
- Explore MCP tools: [MCP Tools Reference](./mcp-tools.md)
- Build a custom crawler: [Crawlers](./crawlers.md)
- Self-host with Docker: [Self-Hosting](./self-hosting.md)
```

**Key rules:**
- Every command must be copy-pasteable
- The Claude Desktop JSON must be valid and complete
- The example output must be realistic (derived from what the CLI will actually produce)
- No marketing language -- just clear, technical writing
- Use `linear.app` as the example product throughout

**Step 2: Verify relative links**

All links to other docs must use `./` relative paths: `./data-model.md`, `./mcp-tools.md`, `./crawlers.md`, `./self-hosting.md`. These resolve correctly on GitHub.

**Acceptance:** `docs/getting-started.md` exists. Covers installation, first scan with example output, export, Claude Desktop connection, and links to all four other guides.

---

## Task 4: Create `docs/data-model.md`

**Why:** Developers need to understand the ProductProfile structure to build on top of Basesignal or interpret scan results programmatically.

**Files:**
- Create: `docs/data-model.md`

**Step 1: Write the guide**

Structure:

```markdown
# The Product Profile Data Model

## Overview
What a ProductProfile is (structured representation of how a product converts users into revenue). Core data type in Basesignal. Generated by scanning a product's public-facing content.

## Profile Structure
Table showing top-level fields:
| Field | Type | Description |
|-------|------|-------------|
| basesignal_version | string | Schema version (e.g., "1.0.0") |
| identity | CoreIdentity | Product name, description, business model |
| journey | UserJourney | User lifecycle stages |
| definitions | Definitions | Activation, first value, active, churn criteria |
| entities | EntityModel | Users, workspaces, projects |
| outcomes | Outcomes | What users are trying to achieve |
| metrics | MetricCatalog | Metrics with formulas |
| revenue | RevenueArchitecture | Pricing, tiers, expansion paths |
| outputs | Outputs | ICP profiles, activation map, measurement spec |
| completeness | number | Profile completeness (0-100) |
| overallConfidence | number | Aggregate confidence (0-1) |

## Sections

### Core Identity
What it captures. Field reference table. Example from the Linear fixture.

### User Journey
Stages and ordering. How stages connect. Example.

### Definitions
The five definition types: activation, firstValue, active, atRisk, churn.
Each has: criteria, timeWindow, reasoning, confidence, source, evidence.
Example of activation definition from the Linear fixture.

### Entity Model
The "things" in the product: users, workspaces, projects.
Entity items (name, type, properties) and relationships (from, to, type).
Example.

### Outcomes
What users are trying to achieve. Items with description, type, linkedFeatures.
Example.

### Metric Catalog
Metrics with name, category (reach/engagement/value_delivery/value_capture), formula, linkedTo.
Example.

### Revenue Architecture
Pricing model, billing unit, free tier, tiers (name/price/features), expansion paths, contraction risks.
Example from the Linear fixture (Free/Standard/Plus tiers).

### Outputs
Three output artifacts generated from the analysis pipeline:

#### ICP Profiles
Ideal Customer Profile segments with value moment priorities, activation triggers, pain points.

#### Activation Map
Multi-stage activation model with stages, transitions, and drop-off risks.

#### Measurement Spec
Complete tracking specification: entities, events, user state model, coverage metrics.

## Confidence and Evidence
Every section includes a confidence score (0-1) and evidence array (URLs + excerpts).
Explain what confidence means, how evidence links back to source content.

## Schema Versioning
basesignal_version field. Backward compatibility policy (additive changes within minor versions, breaking changes require major version bump).

## Full Example
Link to the complete fixture: [View the full Linear profile](./fixtures/linear-profile.json)

Inline a condensed version (identity + revenue + one definition) with annotations explaining each field.
```

**Key rules:**
- Every section includes a concrete example from `docs/fixtures/linear-profile.json`
- Field reference tables must match the types defined in M008-E001-S002 (ProductProfile types) and the existing `convex/schema.ts` productProfiles shape
- The "Outputs" section references the types from `convex/analysis/outputs/types.ts` (ICPProfile, ActivationMap, MeasurementSpec)
- Link to the full fixture file, do not inline the entire 300+ line JSON

**Acceptance:** `docs/data-model.md` exists. Explains every ProductProfile section with field tables and examples. References the fixture file.

---

## Task 5: Create `docs/mcp-tools.md`

**Why:** Developers connecting Basesignal to Claude Desktop (or any MCP client) need to know what tools are available, what parameters they accept, and what they return.

**Files:**
- Create: `docs/mcp-tools.md`

**Step 1: Write the guide**

Structure:

```markdown
# MCP Tools Reference

## Overview
What the MCP server does. How to connect it (stdio for Claude Desktop, SSE for remote).
Reference to getting-started.md for setup.

## Tools

### scan_product
Crawl a product's website and generate a ProductProfile.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | yes | The product URL to scan |

**Returns:** Human-readable summary of the generated profile (identity, revenue model, journey stages, confidence scores).

**Example conversation:**
> User: "Scan the product at linear.app and tell me about their business model"
> Assistant calls scan_product({ url: "https://linear.app" })
> Assistant: "I scanned Linear and generated a product profile. Here's what I found..."

### get_profile
Retrieve a stored product profile.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| productId | string | no | Product ID. If omitted, lists all stored products. |

**Returns:** Full profile in human-readable markdown format, or a list of available products.

**Example conversation:**
> User: "Show me the profile for Linear"
> Assistant calls get_profile({ productId: "linear-app" })
> Assistant: "Here's the complete product profile for Linear..."

### list_products
List all stored product profiles.

**Parameters:** None

**Returns:** List of products with ID, name, URL, completeness score, and last updated timestamp.

### get_definition
Read a specific definition section from a product profile.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| productId | string | yes | Product ID |
| type | string | yes | Definition type: "activation", "firstValue", "active", "atRisk", or "churn" |

**Returns:** The definition section with criteria, reasoning, confidence, and evidence.

**Example conversation:**
> User: "What's the activation definition for Linear?"
> Assistant calls get_definition({ productId: "linear-app", type: "activation" })
> Assistant: "Linear's activation is defined as..."

### update_definition
Update a definition section in a product profile.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| productId | string | yes | Product ID |
| type | string | yes | Definition type: "activation", "firstValue", "active", "atRisk", or "churn" |
| data | object | yes | New definition data (validated against schema) |

**Returns:** Confirmation with the updated definition.

**Example conversation:**
> User: "Change the activation criteria to require 5 issues instead of 3"
> Assistant calls update_definition({ productId: "linear-app", type: "activation", data: { criteria: [...], ... } })
> Assistant: "I've updated the activation definition..."

### export_profile
Export a product profile in markdown or JSON format.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| productId | string | yes | Product ID |
| format | string | no | "markdown" (default) or "json" |

**Returns:** The full profile in the requested format, suitable for copying into documents or saving to a file.

## Error Handling
Common errors and what they mean:
- "Product not found" -- no profile with that ID exists
- "Invalid URL" -- the URL could not be parsed or reached
- "LLM provider not configured" -- missing API key environment variable
- "Validation failed" -- the data provided to update_definition doesn't match the schema
```

**Key rules:**
- Tool names must match the MCP tool registrations planned in M008-E002-S003, S004, S005 (scan_product, get_profile, list_products, get_definition, update_definition, export_profile)
- Parameters and types must match the `inputSchema` definitions from those stories
- Every tool has exactly four sections: description, parameters table, returns, example conversation
- Example conversations show natural language triggering each tool -- this is how users will actually interact with them

**Acceptance:** `docs/mcp-tools.md` exists. Documents all 6 MCP tools with parameters, return values, and example conversations.

---

## Task 6: Create `docs/crawlers.md`

**Why:** The crawler system is the primary extension point for community contributions. This guide must make building a custom crawler feel achievable in an afternoon.

**Files:**
- Create: `docs/crawlers.md`

**Step 1: Write the guide**

Structure:

```markdown
# Crawlers

## Overview
What crawlers do (extract content from different source types). How they fit into the scan pipeline (crawl -> analyze -> generate profile).

## Built-in Crawlers
| Crawler | Source Type | What It Crawls |
|---------|------------|---------------|
| WebsiteCrawler | website | Marketing pages, features, about, docs |
| PricingCrawler | pricing | Pricing page structure and tiers |

## The Crawler Interface

```typescript
interface Crawler {
  name: string;
  sourceType: SourceType;
  canCrawl(url: string): boolean;
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}

type SourceType = "website" | "social" | "reviews" | "docs" | "video" | "pricing";

interface CrawlOptions {
  maxPages?: number;   // Default: 20
  maxDepth?: number;   // Default: 2
  timeout?: number;    // Default: 30000 (ms)
  userAgent?: string;
}

interface CrawlResult {
  pages: CrawledPage[];
  timing: {
    startedAt: number;
    completedAt: number;
    totalMs: number;
  };
  errors: { url: string; error: string }[];
}

interface CrawledPage {
  url: string;
  pageType: string;    // "homepage", "features", "pricing", "about", "docs"
  title?: string;
  content: string;
  metadata?: {
    description?: string;
    ogImage?: string;
    structuredData?: unknown;
  };
}
```

## Building a Custom Crawler

### Step 1: Create the File

```
packages/crawlers/src/crawlers/github-readme.ts
```

### Step 2: Implement the Interface

Complete, working example of a GitHubReadmeCrawler that:
- Has name "github-readme" and sourceType "docs"
- canCrawl returns true for github.com URLs
- crawl fetches the README.md from a repo using the GitHub API
- Returns a CrawlResult with one page

```typescript
import type { Crawler, CrawlOptions, CrawlResult } from "../types.js";

export class GitHubReadmeCrawler implements Crawler {
  name = "github-readme";
  sourceType = "docs" as const;

  canCrawl(url: string): boolean {
    return url.includes("github.com");
  }

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();

    // Parse owner/repo from URL
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return {
        pages: [],
        timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
        errors: [{ url, error: "Could not parse GitHub URL" }],
      };
    }

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.raw+json" },
      signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    if (!response.ok) {
      return {
        pages: [],
        timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
        errors: [{ url: apiUrl, error: `GitHub API returned ${response.status}` }],
      };
    }

    const content = await response.text();
    const completedAt = Date.now();

    return {
      pages: [{
        url: `https://github.com/${owner}/${repo}#readme`,
        pageType: "docs",
        title: `${owner}/${repo} README`,
        content,
      }],
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors: [],
    };
  }
}
```

### Step 3: Register It

```typescript
import { CrawlerRegistry } from "@basesignal/crawlers";
import { GitHubReadmeCrawler } from "./github-readme.js";

const registry = new CrawlerRegistry();
registry.register(new GitHubReadmeCrawler());
```

### Step 4: Test It

```typescript
import { describe, test, expect } from "vitest";
import { GitHubReadmeCrawler } from "./github-readme.js";

describe("GitHubReadmeCrawler", () => {
  const crawler = new GitHubReadmeCrawler();

  test("canCrawl returns true for GitHub URLs", () => {
    expect(crawler.canCrawl("https://github.com/deepskydatahq/basesignal")).toBe(true);
    expect(crawler.canCrawl("https://linear.app")).toBe(false);
  });

  test("crawl returns README content", async () => {
    const result = await crawler.crawl("https://github.com/deepskydatahq/basesignal");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageType).toBe("docs");
    expect(result.errors).toHaveLength(0);
  });
});
```

## Testing Crawlers

How to use fixtures for offline testing:
- Save a response to a fixture file
- Mock the fetch call in tests
- Test canCrawl, error handling, and edge cases separately

## Contributing a Crawler

Link to CONTRIBUTING.md for the PR process. Key requirements:
- Implements the Crawler interface
- Has tests with fixtures
- Does not add heavy dependencies
- Handles errors gracefully (no unhandled rejections)
```

**Key rules:**
- The Crawler interface must match M008-E003-S001 (crawler interface story) exactly
- The custom crawler example must be a complete, working, copy-pasteable implementation
- SourceType values must match the enum from M008-E003-S001: "website", "social", "reviews", "docs", "video", "pricing"
- The example should be the same code that will ship in `examples/custom-crawler/` (S004)

**Acceptance:** `docs/crawlers.md` exists. Documents the Crawler interface, built-in crawlers, and provides a complete custom crawler example with registration and testing.

---

## Task 7: Create `docs/self-hosting.md`

**Why:** Self-hosting (especially with Ollama for air-gapped usage) is a strong differentiator. This guide must get Docker users running in four commands or fewer.

**Files:**
- Create: `docs/self-hosting.md`

**Step 1: Write the guide**

Structure:

```markdown
# Self-Hosting

## Quick Start with Docker

Four commands:

git clone https://github.com/deepskydatahq/basesignal.git
cd basesignal
cp .env.example .env   # Add your API key
docker-compose up

What you get: the Basesignal MCP server running on port 3000, accessible from Claude Desktop.

## Environment Variables

Complete reference table:
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ANTHROPIC_API_KEY | yes* | -- | Anthropic API key for Claude models |
| OPENAI_API_KEY | yes* | -- | OpenAI API key for GPT models |
| BASESIGNAL_PROVIDER | no | anthropic | LLM provider: "anthropic", "openai", or "ollama" |
| BASESIGNAL_MODEL | no | (provider default) | Model override (e.g., "claude-sonnet-4-20250514", "gpt-4o") |
| BASESIGNAL_STORAGE | no | /data | Directory for storing profiles and scan data |
| BASESIGNAL_PORT | no | 3000 | Server port for SSE transport |

*One of ANTHROPIC_API_KEY or OPENAI_API_KEY required unless using Ollama.

## Docker Configuration

Dockerfile explanation:
- Based on node:22-alpine (minimal image)
- Copies packages, installs production dependencies
- Runs the MCP server in SSE mode on port 3000
- Data persisted via Docker volume

docker-compose.yml explanation:
- Single service configuration
- Volume mount for persistent storage
- Environment variable passthrough
- Port mapping

## Storage

Default: SQLite database in the BASESIGNAL_STORAGE directory.
- Profiles, scan results, and crawled pages stored locally
- No external database required
- Volume mount ensures persistence across container restarts

## LLM Provider Configuration

### Anthropic (default)
Set ANTHROPIC_API_KEY. Uses Claude models.

### OpenAI
Set OPENAI_API_KEY and BASESIGNAL_PROVIDER=openai.

### Ollama (fully local, air-gapped)
Install Ollama on the host machine.
Set BASESIGNAL_PROVIDER=ollama.
No API key needed -- runs entirely local.

For Docker: the container needs to reach the host's Ollama server.
Docker Compose example with network_mode or host mapping.

## Connecting from Claude Desktop

JSON config pointing to the Docker container:
{
  "mcpServers": {
    "basesignal": {
      "url": "http://localhost:3000/sse"
    }
  }
}

For stdio transport (no Docker needed):
{
  "mcpServers": {
    "basesignal": {
      "command": "basesignal",
      "args": ["serve", "--transport", "stdio"]
    }
  }
}

## Updating

docker-compose pull
docker-compose up -d

Or pin a specific version in the Dockerfile.

## Running Without Docker

npm install -g @basesignal/cli
basesignal serve --transport stdio

This is the simplest option for local development.
```

**Key rules:**
- Docker quick start must be four commands or fewer
- Every environment variable must be documented with type, default, and what happens when missing
- The Ollama section is critical -- it enables fully local, air-gapped usage
- Environment variables must match what M008-E005-S001 (CLI skeleton) defines: ANTHROPIC_API_KEY, OPENAI_API_KEY, BASESIGNAL_PROVIDER, BASESIGNAL_MODEL, BASESIGNAL_STORAGE
- Docker configuration must match M008-E005-S004 (Docker/npm distribution)
- Claude Desktop JSON must be valid and match MCP SDK conventions

**Acceptance:** `docs/self-hosting.md` exists. Covers Docker quick start (4 commands), all environment variables, all 3 LLM providers including Ollama, Claude Desktop connection for both SSE and stdio, and updating.

---

## Task 8: Verify cross-document links and overall quality

**Why:** All five docs link to each other. Broken links on GitHub are a poor first impression.

**Files:**
- Read (verify): All five docs + fixture

**Step 1: Verify all relative links resolve**

Check every `[text](./file.md)` link in each doc:
- `getting-started.md` links to: `./data-model.md`, `./mcp-tools.md`, `./crawlers.md`, `./self-hosting.md`
- `data-model.md` links to: `./fixtures/linear-profile.json`, `./getting-started.md` (optional)
- `mcp-tools.md` links to: `./getting-started.md` (for setup reference)
- `crawlers.md` links to: CONTRIBUTING.md (one level up: `../CONTRIBUTING.md`)
- `self-hosting.md` links to: `./getting-started.md` (optional)

**Step 2: Verify no framework files were introduced**

Confirm that no files were created outside the planned set:
- No `docs/index.md`, `docs/.vitepress/`, `docs/docusaurus.config.js`, etc.
- No new entries in any `package.json`
- No new dependencies added anywhere

**Step 3: Verify the fixture is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('docs/fixtures/linear-profile.json', 'utf-8')); console.log('valid')"`

**Step 4: Verify each doc has appropriate structure**

Each doc should have:
- A title heading (`# Title`)
- An overview section
- Concrete code examples or reference tables
- Links to related docs

**Acceptance:** All relative links between docs resolve correctly. No framework files, config files, or dependencies were added. The fixture is valid JSON. Each doc follows the planned structure.

---

## Summary of Files

| File | Purpose |
|------|---------|
| `docs/fixtures/linear-profile.json` | Complete example ProductProfile for the data model guide and validation test |
| `packages/core/src/__tests__/docs-example.test.ts` | Validates the fixture against the schema (upgraded when schema lands) |
| `docs/getting-started.md` | Installation, first scan, Claude Desktop setup, next steps |
| `docs/data-model.md` | ProductProfile schema explanation with field tables and examples |
| `docs/mcp-tools.md` | All 6 MCP tools with parameters, returns, and example conversations |
| `docs/crawlers.md` | Crawler interface, built-ins, complete custom crawler tutorial |
| `docs/self-hosting.md` | Docker setup, environment variables, LLM providers, updating |

## Dependencies

- **Blocked by:** M008-E005-S004 (Docker/npm distribution) -- the self-hosting guide cannot be finalized until Docker setup exists
- **Reads from:** M008-E001-S002 (types), M008-E002-S001/S003/S004/S005 (MCP tools), M008-E003-S001 (crawler interface), M008-E005-S001 (CLI)
- **Feeds into:** M008-E006-S001 (README links to these docs), M008-E006-S004 (examples reference crawler tutorial)

## What This Does NOT Do

- Build a documentation website (no VitePress, Docusaurus, Starlight)
- Generate API reference docs (no TypeDoc, no TSDoc)
- Set up hosting (GitHub renders markdown natively)
- Write the schema specification (that is S003)
- Create the examples directory (that is S004)
- Add any dependencies to any package
