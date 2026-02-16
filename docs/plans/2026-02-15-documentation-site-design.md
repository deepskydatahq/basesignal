# Documentation Site Content Design

## Overview

Create comprehensive documentation for the Basesignal open source project at `docs/`. Five standalone guides (getting-started, data-model, mcp-tools, crawlers, self-hosting) plus supporting infrastructure to keep docs accurate as the codebase evolves. This story delivers markdown files in the repository -- not a documentation website framework.

## Problem Statement

The open source release (M008) needs documentation that lets a developer go from "I found this on GitHub" to "I'm running a product scan" in under five minutes. Without clear docs, open source projects die in the gap between "interesting idea" and "I got it working." The README (S001) gets people interested; these docs get them productive.

The five guides map directly to the five acceptance criteria. Each is a standalone document answering one question a developer would ask.

## Expert Perspectives

### Technical Architect

The right question is not "which documentation framework?" but "does this project need a documentation framework at all?" It does not. There are five documents. Markdown in a `docs/` directory is the simplest possible approach, works on GitHub without any build step, and can be upgraded to a docs site later when there are enough pages to justify navigation and search. VitePress, Docusaurus, and Starlight all add a build pipeline, a deployment target, and a configuration surface before a single word of documentation exists. The cost-benefit is wrong for five files.

The harder problem is keeping docs in sync with code. The solution is not automated generation -- it is proximity. Code examples in docs should be extracted from test files or example files that actually run. If an example in a doc does not compile, it should be because the test it was copied from also does not compile. Automated doc generation (TypeDoc, TSDoc) produces reference material, not guides. Guides require narrative, and narratives require a human (or a careful prompt). The right pattern is: guides are handwritten, API reference tables are derived from TypeScript types, and examples are copied from tested code.

### Simplification Reviewer

**Verdict: APPROVED** with cuts.

- **Remove:** No documentation site framework (VitePress, Docusaurus, Starlight, Astro). Five markdown files do not need a build pipeline, a deployment step, navigation config, or a theme. GitHub renders them beautifully. Upgrade later if the docs grow to 20+ pages.
- **Remove:** No auto-generated API reference. TypeDoc/TSDoc generates pages that look comprehensive but are actually unreadable. The five guides should document the API inline with narrative context. If someone wants the type signatures, they can read the TypeScript source -- that is what open source developers actually do.
- **Remove:** No separate hosting decision. GitHub renders markdown. That is the host. No Vercel, Netlify, or GitHub Pages needed.
- **Keep:** The five guides -- they map to real user questions and the acceptance criteria demands them.
- **Keep:** Code examples derived from working code -- this is the single most important quality signal.
- **Assessment:** The design is one thing: five well-written markdown files. No build steps, no deployment, no framework decisions, no automation. That is the simplest version that satisfies every acceptance criterion.

## Proposed Solution

### Framework Decision: Plain Markdown

No documentation framework. No build step. No hosting.

| Option | Verdict | Reason |
|--------|---------|--------|
| **Plain markdown in `docs/`** | **Chosen** | Zero dependencies, GitHub renders it, five files do not need navigation/search |
| VitePress | Rejected | Adds vite config, sidebar config, deployment pipeline for five pages |
| Docusaurus | Rejected | React dependency, MDX, heavy for the scope |
| Starlight/Astro | Rejected | Another framework to maintain, overkill |
| GitHub Pages | Rejected | No build artifact to deploy -- markdown renders natively |

**Escape hatch:** When docs grow beyond ~15 pages and users request search or better navigation, migrate to VitePress. The markdown files will work without modification since VitePress consumes standard markdown. This is a ten-minute migration when the time comes.

### Directory Structure

```
docs/
  getting-started.md      # Installation, first scan, next steps
  data-model.md           # ProductProfile schema with examples
  mcp-tools.md            # Each MCP tool documented
  crawlers.md             # Crawler interface, built-ins, custom howto
  self-hosting.md         # Docker, env vars, configuration
```

That is the entire deliverable. Five files. No subdirectories, no config files, no build artifacts.

The schema specification (`docs/specification/v1.0/`) is a separate story (S003) and is not part of this work.

### Document Designs

#### 1. `docs/getting-started.md`

**Question it answers:** "How do I install and use this thing?"

**Structure:**

```markdown
# Getting Started

## Prerequisites
- Node.js 18+
- An LLM API key (Anthropic, OpenAI, or Ollama for local)

## Install
npm install -g @basesignal/cli

## Your First Scan
basesignal scan https://linear.app

(Show expected output -- a condensed ProductProfile in markdown format)

## View the Full Profile
basesignal export linear-app --format markdown

## Connect to Claude Desktop
(JSON snippet for claude_desktop_config.json)

## Next Steps
- [Understand the data model](./data-model.md)
- [Explore MCP tools](./mcp-tools.md)
- [Build a custom crawler](./crawlers.md)
- [Self-host with Docker](./self-hosting.md)
```

**Key principle:** Every command in this guide must be copy-pasteable and produce the described output. The Linear.app example (or equivalent public product) must be tested before docs ship.

**Source of truth for examples:** Run `basesignal scan` against a real URL, capture the output, and paste it into the doc. Re-run before each release to verify output still matches.

#### 2. `docs/data-model.md`

**Question it answers:** "What is a ProductProfile and what does each section mean?"

**Structure:**

```markdown
# The Product Profile Data Model

## Overview
A ProductProfile is a structured representation of how a product converts
users into revenue. It is the core data type in Basesignal.

## Profile Structure
(Table showing top-level fields: identity, journey, definitions, entities,
outcomes, metrics, revenue, outputs)

## Sections

### Core Identity
(What it captures, field reference table, example from a real scan)

### User Journey
(Stages, how they connect, example)

### Definitions
(Activation, First Value, Active, Churn -- what each means, example)

### Entity Model
(Users, workspaces, projects -- the "things" in the product)

### Outcomes
(What users are trying to achieve, example)

### Metric Catalog
(Metrics with formulas, example)

### Revenue Architecture
(Pricing model, tiers, expansion paths, example)

### Outputs
(ICP Profiles, Activation Map, Measurement Spec, Value Moments)

## Schema Versioning
(basesignal_version field, backward compatibility policy)

## Full Example
(Complete ProductProfile JSON for Linear or similar, with annotations)
```

**Key principle:** Every section includes a concrete example from a real product scan. The "Full Example" at the bottom is a complete, valid ProductProfile JSON that could be loaded by `@basesignal/core`'s validation.

**Source of truth:** The example JSON should be generated by running a scan and exported. It should also be validated by the Zod schemas in `@basesignal/core` -- add a test that loads the example and validates it. This is how we keep the doc in sync with the types.

```typescript
// packages/core/src/__tests__/docs-example.test.ts
import { ProductProfileSchema } from "../schemas.js";
import exampleProfile from "../../../../docs/fixtures/linear-profile.json";

test("docs example profile validates against schema", () => {
  expect(() => ProductProfileSchema.parse(exampleProfile)).not.toThrow();
});
```

#### 3. `docs/mcp-tools.md`

**Question it answers:** "What tools does the MCP server expose and how do I use them?"

**Structure:**

```markdown
# MCP Tools Reference

## Overview
The Basesignal MCP server exposes these tools to AI assistants.

## Tools

### scan_product
Crawl a URL and generate a product profile.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url  | string | yes | The product URL to scan |
| options | object | no | Crawl options (maxPages, maxDepth) |

**Returns:** ProductProfile

**Example conversation:**
> User: "Scan the product at linear.app"
> Assistant calls scan_product({ url: "https://linear.app" })
> Assistant: "I've scanned Linear and generated a product profile..."

### get_profile
(Same pattern)

### get_definition
(Same pattern)

### update_definition
(Same pattern)

### export_profile
(Same pattern)
```

**Key principle:** Each tool has the same four sections: description, parameters table, return value, example conversation. The parameters table is derived from the MCP tool registration code in `packages/mcp-server/`. The example conversation shows how a user would trigger the tool through natural language.

**Source of truth:** Tool names, parameters, and descriptions must match the `server.tool()` registrations in the MCP server package. A CI check or manual review step should verify this before each release.

#### 4. `docs/crawlers.md`

**Question it answers:** "What crawlers exist, and how do I build a new one?"

**Structure:**

```markdown
# Crawlers

## Overview
Crawlers extract content from different sources. Basesignal ships with
built-in crawlers and supports custom ones.

## Built-in Crawlers
| Crawler | Source Type | What It Crawls |
|---------|------------|---------------|
| WebsiteCrawler | website | Marketing site, features, about pages |
| PricingCrawler | pricing | Pricing page structure and tiers |

## The Crawler Interface

```typescript
interface Crawler {
  name: string;
  sourceType: SourceType;
  canCrawl(url: string): boolean;
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}
```

## Building a Custom Crawler

### Step 1: Create the file
### Step 2: Implement the interface
### Step 3: Register it
### Step 4: Test it

(Complete working code for a simple crawler, e.g., GitHubReadmeCrawler)

## Testing Crawlers
(How to use fixtures, the test helpers, running tests)
```

**Key principle:** The "Building a Custom Crawler" section is the most important part. It should be a complete, working example that someone can copy, modify, and PR back in an afternoon. The code in this section should be identical to `examples/custom-crawler/` (S004).

**Source of truth:** The Crawler interface definition must match `packages/crawlers/src/types.ts`. The custom crawler example should be the same code as `examples/custom-crawler/src/index.ts`. If the interface changes, both the doc and the example break -- which is the desired behavior.

#### 5. `docs/self-hosting.md`

**Question it answers:** "How do I run Basesignal on my own infrastructure?"

**Structure:**

```markdown
# Self-Hosting

## Quick Start with Docker

```bash
git clone https://github.com/deepskydatahq/basesignal.git
cd basesignal
cp .env.example .env   # Add your API key
docker-compose up
```

## Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ANTHROPIC_API_KEY | yes* | — | Anthropic API key |
| OPENAI_API_KEY | yes* | — | OpenAI API key |
| BASESIGNAL_PROVIDER | no | anthropic | LLM provider |
| BASESIGNAL_MODEL | no | — | Model override |
| BASESIGNAL_STORAGE | no | /data | Storage directory |

*One of ANTHROPIC_API_KEY or OPENAI_API_KEY required unless using Ollama.

## Docker Configuration
(Dockerfile explained, image details, volume mounts)

## Storage Options
(SQLite default, file path configuration)

## LLM Provider Configuration
(Anthropic, OpenAI, Ollama setup -- including local Ollama for air-gapped)

## Connecting from Claude Desktop
(JSON config pointing to the Docker container)

## Updating
(docker-compose pull, version pinning)
```

**Key principle:** The Docker quick start must work in four commands or fewer. Every environment variable must be documented with its type, default, and what happens when it is missing. The Ollama section is important -- it enables fully local, air-gapped usage, which is a strong differentiator.

**Source of truth:** Environment variables must match `packages/cli/src/config.ts` and `docker/docker-compose.yml`. The Docker commands must be tested against the actual Dockerfile (S004).

### Keeping Docs in Sync with Code

No automated generation. Instead, three mechanisms:

1. **Validation test for the data model example.** A test in `@basesignal/core` loads the example profile JSON from `docs/fixtures/` and validates it against the Zod schema. If types change and the example is not updated, the test fails. This is the highest-value sync mechanism.

2. **Code examples copied from tested sources.** The custom crawler example in `docs/crawlers.md` is identical to the code in `examples/custom-crawler/`. The CLI commands in `docs/getting-started.md` are tested manually before each release. There is no tooling that does this automatically -- the discipline is that the person writing the release notes also runs through the getting-started guide.

3. **A `docs` label in the PR template.** When a PR changes files in `packages/*/src/types.ts`, `packages/mcp-server/src/tools/`, `packages/crawlers/src/types.ts`, or `packages/cli/src/config.ts`, the PR template reminds the author to check if docs need updating. This is a checklist item, not an automated check.

No TypeDoc. No TSDoc generation. No docs build step. The overhead of maintaining generated docs infrastructure exceeds the value for five handwritten files.

### Hosting Decision: None

GitHub renders markdown. That is the documentation site.

When someone visits the repository, they see `docs/` in the file tree. Each file has a descriptive name. GitHub renders them with a table of contents sidebar. Links between docs work with relative paths (`./data-model.md`).

If and when the project grows to 15+ documentation pages and users request search or versioned docs, migrate to VitePress. The migration is trivial -- VitePress reads standard markdown -- and the decision can be deferred until there is real demand.

### What Goes in `docs/fixtures/`

One file:

```
docs/
  fixtures/
    linear-profile.json   # Complete ProductProfile from scanning linear.app
```

This fixture serves double duty:
- The data-model guide references it as the "Full Example"
- The validation test loads it to verify it matches the schema

It is generated by running an actual scan and is committed to the repo. It is not auto-generated on every build.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Documentation framework | None (plain markdown) | Five files do not need a build pipeline, navigation, or search |
| Hosting | GitHub (renders markdown natively) | Zero deployment, zero maintenance, upgradeable to VitePress later |
| API reference generation | None (TypeDoc/TSDoc rejected) | Generated reference docs are unreadable; narrative guides are better for five pages |
| Keeping docs in sync | Validation test + manual discipline | One test for the data model example; human review for the rest |
| Example profile product | Linear (or equivalent public product) | Well-known B2B SaaS, complex enough to show all profile sections |
| Fixture location | `docs/fixtures/` | Co-located with docs, testable from `@basesignal/core` |
| When to add a docs site | When docs exceed ~15 pages and users request search | Premature optimization otherwise |

## What This Does NOT Do

- **Build a documentation website.** No VitePress, Docusaurus, Starlight, or any other framework. Markdown files in a directory.
- **Generate API reference docs.** No TypeDoc, no TSDoc extraction, no automated doc generation.
- **Set up hosting.** No GitHub Pages, Vercel, Netlify, or CI for docs deployment.
- **Write the schema specification.** That is S003 (`docs/specification/v1.0/`).
- **Create the examples directory.** That is S004 (`examples/`). However, the custom crawler code in `docs/crawlers.md` should match what S004 delivers.
- **Create the README or CONTRIBUTING.md.** That is S001.
- **Add per-package README files.** Those are part of the individual package stories.
- **Set up CI for docs.** The only automated check is the profile validation test, which runs as part of `@basesignal/core`'s test suite.

## Dependencies

- **Blocked by M008-E005-S004 (Docker/npm distribution):** The self-hosting guide cannot be written until the Docker setup exists.
- **Reads from M008-E001-S002 (type system):** The data model guide documents the ProductProfile types.
- **Reads from M008-E002-S001 (MCP server):** The MCP tools guide documents the registered tools.
- **Reads from M008-E003-S001 (crawler interface):** The crawlers guide documents the Crawler interface.
- **Reads from M008-E005-S001 (CLI):** The getting-started guide uses CLI commands.
- **Feeds into M008-E006-S001 (README):** The README links to these docs.
- **Feeds into M008-E006-S004 (examples):** The crawlers guide references the custom-crawler example.

## Verification Steps

1. `docs/getting-started.md` exists and covers installation, first scan, and next steps
2. `docs/data-model.md` exists and explains the ProductProfile schema with examples
3. `docs/mcp-tools.md` exists and documents each MCP tool with parameters and examples
4. `docs/crawlers.md` exists and explains the Crawler interface and how to build custom crawlers
5. `docs/self-hosting.md` exists and covers Docker setup, environment variables, and configuration
6. `docs/fixtures/linear-profile.json` exists and validates against `@basesignal/core` schema
7. All code examples in docs are derived from working code (manually verified)
8. Relative links between docs resolve correctly on GitHub
9. No build step, no framework config, no deployment pipeline introduced

## Success Criteria

All six acceptance criteria from the story:

1. `docs/getting-started.md`: installation, first scan, next steps
2. `docs/data-model.md`: ProductProfile schema with examples
3. `docs/mcp-tools.md`: each tool with parameters and examples
4. `docs/crawlers.md`: interface and custom crawler howto
5. `docs/self-hosting.md`: Docker, env vars, configuration
6. All code examples derived from working code

Plus:
- Zero new dependencies added to any package
- Zero build steps introduced
- Clear upgrade path to VitePress when the time comes
- Docs readable both on GitHub and locally
