# README.md, MIT LICENSE, and CONTRIBUTING.md Design

## Overview

Design the three foundational public-facing documents for the Basesignal open source release: a README that makes someone star the repo in 30 seconds, an MIT LICENSE file, and a CONTRIBUTING.md that makes adding a crawler feel achievable in an afternoon.

## Problem Statement

Basesignal is preparing for open source release (M008). The repository currently has no public-facing documentation. Without a compelling README, clear license, and accessible contribution guide, the project will fail to attract users and contributors regardless of code quality. These documents are the landing page, legal foundation, and onboarding funnel for the entire project.

## Expert Perspectives

### Technical Architect

The README is API documentation for the project itself. Apply the same principle as code APIs: minimal surface area, escape hatches, incremental adoption. A developer should be able to go from "what is this?" to "it's running on my machine" in under 2 minutes of reading. The README has three jobs: (1) explain what it does in one sentence, (2) show it working in 5 lines, (3) point to deeper docs. Everything else is noise.

For the monorepo structure, the root README is the entry point. Per-package READMEs are reference documentation. Don't duplicate content between them. Root README links to package READMEs; package READMEs link back to root. One source of truth per concept.

### Simplification Review

**Verdict: APPROVED** -- with specific cuts.

What to keep:
- One-liner tagline + 3-bullet "what it does" + quick start code block. This is the 30-second scan path.
- Claude Desktop JSON config example. This is the primary use case and the biggest "aha" moment.
- The Crawler interface in CONTRIBUTING.md. Seeing the interface makes contribution feel concrete, not abstract.

What to cut:
- **No feature comparison tables.** These age instantly and invite bikeshedding. "How it works" in 3 sentences replaces a comparison matrix.
- **No badges beyond the essentials.** CI status, npm version, license. No "code coverage" badge (creates pressure to game numbers). No "PRs welcome" badge (CONTRIBUTING.md says this better).
- **No architecture diagrams in the README.** A single `core -> crawlers -> analyzers -> profile` text flow is enough. SVG diagrams belong in docs/, not README.
- **No FAQ section.** FAQs are where unclear documentation goes to hide. If something needs explaining, fix the explanation above.
- **No "Star History" or vanity badges.** Premature for launch.

What to watch:
- The README will be the most-read document in the project. Every sentence must earn its place.
- CONTRIBUTING.md must be specific, not generic. "See our contributing guidelines" is useless. "Here's the Crawler interface, here's a step-by-step" is useful.

## Proposed Solution

### 1. README.md Structure

The README follows a strict information hierarchy: hook, prove it works, explain more, invite contribution.

```
1. Project name + tagline (2 lines)
2. What it does (3-4 bullet points)
3. Quick start: CLI (5 lines of shell commands)
4. Quick start: Claude Desktop (JSON config snippet)
5. Quick start: Docker (2 lines)
6. How it works (one paragraph + text diagram)
7. Packages (table: 5 packages with one-line descriptions)
8. Documentation links
9. Contributing (2 sentences + link to CONTRIBUTING.md)
10. License (1 line)
```

#### Section 1: Project Name + Tagline

```markdown
# Basesignal

**The open standard for product growth models.**

Basesignal scans your product's website and generates a structured growth model — activation definitions, user journey, metric catalog, measurement plan — in 60 seconds. Use it from the CLI, connect it to Claude Desktop via MCP, or self-host with Docker.
```

Rationale: The tagline positions Basesignal as a standard, not just a tool. The one-paragraph description answers "what does it do?" and "how do I use it?" in three sentences.

#### Section 2: What It Does

```markdown
## What it does

- **Scan any B2B SaaS product** — point it at a URL and get a structured product profile with activation definitions, journey stages, entity model, revenue architecture, and metric catalog
- **MCP server for AI assistants** — connect to Claude Desktop, ChatGPT, or Cursor and make every product conversation smarter with structured context
- **Structured data model** — not just text extraction. The profile schema encodes relationships, inference rules, and validation logic
- **Extensible by design** — add crawlers for new data sources, storage adapters for different databases, or LLM providers. No core changes required
```

Rationale: Four bullets, each starting with a bold phrase. Scannable in 5 seconds. Covers the four key value propositions: magic scan, MCP integration, structured data, extensibility.

#### Section 3: Quick Start — CLI

```markdown
## Quick start

### CLI

\```bash
npm install -g @basesignal/cli

export ANTHROPIC_API_KEY=sk-ant-...   # or OPENAI_API_KEY

basesignal scan https://linear.app
\```

This crawls the website, analyzes it with your LLM, and outputs a product profile as JSON.
```

Rationale: Three commands. The user goes from zero to result. `linear.app` as example because it's a well-known B2B SaaS that developers recognize.

#### Section 4: Quick Start — Claude Desktop

```markdown
### Claude Desktop

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

\```json
{
  "mcpServers": {
    "basesignal": {
      "command": "npx",
      "args": ["@basesignal/mcp-server"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
\```

Then ask Claude: *"Scan my product at acme.io"*
```

Rationale: This is the "aha" moment. The JSON snippet is copy-pasteable. The prompt example shows the natural language interface.

#### Section 5: Quick Start — Docker

```markdown
### Docker

\```bash
cp .env.example .env          # add your API key
docker compose up
\```

The MCP server starts on stdio, ready for Claude Desktop or any MCP client.
```

Rationale: Two commands. Docker users expect compose. Keep it minimal.

#### Section 6: How It Works

```markdown
## How it works

Basesignal is a pipeline: **crawl** public sources, **analyze** with LLMs using specialized lenses, **converge** into a structured profile.

\```
URL → Crawlers → Analysis Lenses → Convergence → Product Profile
         │              │                │              │
    website          7 lenses        merge &        structured
    pricing       (identity,       deduplicate      schema with
    docs          journey,         + validate       confidence
                  revenue, ...)                      scores
\```

The product profile is a structured document with typed sections: core identity, user journey, activation definitions, entity model, revenue architecture, metric catalog, and measurement plan. Each element has a confidence score and links to the evidence that informed it.
```

Rationale: One text diagram. No SVG, no Mermaid (both render inconsistently across GitHub, npm, and markdown viewers). The pipeline is left-to-right, matching how developers think about data flow.

#### Section 7: Packages

```markdown
## Packages

| Package | Description |
|---------|-------------|
| [`@basesignal/core`](./packages/core) | Product profile schema, validation, and inference rules |
| [`@basesignal/crawlers`](./packages/crawlers) | Pluggable crawler interface and built-in website/pricing crawlers |
| [`@basesignal/storage`](./packages/storage) | Storage adapter interface with SQLite default |
| [`@basesignal/mcp-server`](./packages/mcp-server) | Self-hostable MCP server for AI assistants |
| [`@basesignal/cli`](./packages/cli) | Command-line tool for scanning and exporting profiles |
```

Rationale: Table with links. Each package has one sentence. No version numbers (they change). Links go to per-package READMEs.

#### Section 8: Documentation

```markdown
## Documentation

- [Getting Started](./docs/getting-started.md) — installation, configuration, first scan
- [Data Model](./docs/data-model.md) — the product profile schema explained
- [MCP Tools Reference](./docs/mcp-tools.md) — available tools and their parameters
- [Writing Crawlers](./docs/writing-crawlers.md) — how to add a new data source
- [Self-Hosting Guide](./docs/self-hosting.md) — Docker, environment variables, storage options
- [Schema Specification](./docs/specification/v1.0/) — formal schema for tool interoperability
```

Rationale: Links to docs/. Descriptions tell you what each doc covers so you don't click blindly. The docs themselves are a separate story (M008-E006-S002).

#### Section 9: Contributing

```markdown
## Contributing

Basesignal is open source and contributions are welcome. The easiest way to contribute is to add a new crawler — see the [Crawler Contribution Guide](./CONTRIBUTING.md#adding-a-crawler) for a step-by-step walkthrough.

For bugs, features, and other contributions, see [CONTRIBUTING.md](./CONTRIBUTING.md).
```

Rationale: Two sentences. Points to the concrete "add a crawler" path as the easiest entry point. Does not repeat CONTRIBUTING.md content.

#### Section 10: License

```markdown
## License

[MIT](./LICENSE) — DeepSky Data ApS
```

Rationale: One line. Links to the file. Names the copyright holder.

### 2. LICENSE

Standard MIT license text with `DeepSky Data ApS` as copyright holder and `2026` as year.

```
MIT License

Copyright (c) 2026 DeepSky Data ApS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Key decisions:
- **MIT over Apache 2.0 or GPLv3.** MIT is the simplest, most permissive, and most well-understood. It maximizes adoption. Apache 2.0 adds patent protection but also adds complexity. GPL would prevent proprietary integrations, which conflicts with the "standard" positioning.
- **Copyright holder is `DeepSky Data ApS`**, not an individual name. This is the legal entity.
- **Year is 2026.** Single year, not a range. The year reflects first publication.

### 3. CONTRIBUTING.md Structure

```
1. Welcome + philosophy (3 sentences)
2. Development setup (clone, install, test — 5 commands)
3. Adding a crawler (step-by-step with code)
4. Adding a storage adapter (step-by-step with code)
5. Other contributions (bug fixes, features, docs)
6. PR process (branch, test, submit)
7. Code style (brief conventions)
8. Getting help (where to ask questions)
```

#### Section 1: Welcome

```markdown
# Contributing to Basesignal

Thanks for your interest in contributing. Basesignal is built on the idea that the product profile schema should be an open standard — the more crawlers, storage adapters, and integrations exist, the more useful the standard becomes.

The easiest way to contribute is to **add a new crawler**. If you can write a function that fetches a URL and returns structured data, you can contribute a crawler.
```

Rationale: Three sentences. Sets the "standard" framing. Immediately points to the easiest contribution path.

#### Section 2: Development Setup

```markdown
## Development setup

\```bash
git clone https://github.com/deepskydatahq/basesignal.git
cd basesignal
npm install
npm test              # run all tests
npm run build         # build all packages
\```

The monorepo uses npm workspaces. Each package in `packages/` can be built and tested independently:

\```bash
cd packages/core
npm test
npm run build
\```
```

Rationale: Five commands from clone to verified. Then explains the monorepo structure in two sentences.

#### Section 3: Adding a Crawler

This is the most important section. It must make the task feel concrete and achievable.

```markdown
## Adding a crawler

A crawler fetches data from a source and returns structured pages. Every crawler implements the `Crawler` interface from `@basesignal/crawlers`:

\```typescript
import type { Crawler, CrawlResult } from "@basesignal/crawlers";

export const g2ReviewsCrawler: Crawler = {
  name: "g2-reviews",
  sourceType: "reviews",

  canCrawl(url: string): boolean {
    return url.includes("g2.com/products/");
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();

    // Fetch and parse the G2 product page
    const response = await fetch(url, {
      signal: options?.signal,
      headers: { "User-Agent": options?.userAgent ?? "Basesignal/1.0" },
    });
    const html = await response.text();

    // Extract review data into CrawledPage format
    const pages = parseG2Reviews(html, url);

    return {
      pages,
      timing: {
        startedAt,
        completedAt: Date.now(),
        totalMs: Date.now() - startedAt,
      },
      errors: [],
    };
  },
};
```

### Step by step

1. **Create the crawler file** — `packages/crawlers/src/g2/g2-crawler.ts`

2. **Implement the `Crawler` interface** — four members:
   - `name`: unique identifier (e.g., `"g2-reviews"`)
   - `sourceType`: what kind of data this produces (`"reviews"`, `"social"`, `"video"`, etc.)
   - `canCrawl(url)`: return `true` if this crawler handles the given URL
   - `crawl(url, options)`: fetch the data, return `CrawlResult`

3. **Add tests with fixtures** — save example HTML/JSON responses as test fixtures in `packages/crawlers/src/g2/__fixtures__/`. Test against fixtures, not live URLs:

   \```typescript
   import { readFileSync } from "fs";
   import { g2ReviewsCrawler } from "./g2-crawler";

   test("parses G2 product reviews", async () => {
     // Use a fixture instead of hitting the live site
     const fixture = readFileSync("src/g2/__fixtures__/linear-reviews.html", "utf-8");
     // ... test against fixture
   });
   \```

4. **Register the crawler** — add it to the default registry in `packages/crawlers/src/index.ts`:

   \```typescript
   export { g2ReviewsCrawler } from "./g2/g2-crawler";
   \```

5. **Submit a PR** — see [PR process](#pr-process) below.

### Crawler contribution ideas

These are sources the community can add crawlers for:

- **G2 / Capterra** — extract product reviews and sentiment
- **YouTube** — parse product demo videos and tutorials
- **LinkedIn** — company pages and job postings
- **App Store / Play Store** — app descriptions and reviews
- **Crunchbase** — funding, team size, and company data
- **Product Hunt** — launch information and community feedback
```

Rationale: Shows the full interface with a real example (G2 reviews). The step-by-step is numbered and concrete. Fixture-based testing is shown because it's the expected pattern. The "contribution ideas" list gives specific targets — a contributor can pick one and start immediately.

#### Section 4: Adding a Storage Adapter

```markdown
## Adding a storage adapter

Storage adapters implement the `StorageAdapter` interface from `@basesignal/storage`:

\```typescript
import type { StorageAdapter, ProfileSummary } from "@basesignal/storage";
import type { ProductProfile } from "@basesignal/core";

export class PostgresStorage implements StorageAdapter {
  async save(profile: ProductProfile): Promise<string> { /* ... */ }
  async load(id: string): Promise<ProductProfile | null> { /* ... */ }
  async list(): Promise<ProfileSummary[]> { /* ... */ }
  async delete(id: string): Promise<boolean> { /* ... */ }
  async search(query: string): Promise<ProfileSummary[]> { /* ... */ }
  close(): void { /* ... */ }
}
\```

Six methods: `save`, `load`, `list`, `delete`, `search`, `close`. See the [SQLite adapter](./packages/storage/src/sqlite.ts) as a reference implementation.
```

Rationale: Shows the interface. Points to the existing SQLite adapter as a concrete example. Shorter than the crawler section because storage adapters are less common contributions.

#### Section 5: Other Contributions

```markdown
## Other contributions

- **Bug fixes** — open an issue first to discuss, then submit a PR with a test that reproduces the bug
- **Features** — open an issue to discuss the design before writing code
- **Documentation** — improvements to docs/ or package READMEs are always welcome
- **Tests** — more test coverage is always valuable
```

#### Section 6: PR Process

```markdown
## PR process

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure the build succeeds: `npm run build`
5. Submit a pull request with a clear description of what you changed and why

PRs are reviewed within a few days. Small, focused PRs are easier to review and merge.
```

Rationale: Five steps. No elaborate process. "Small, focused PRs" is the most important guideline.

#### Section 7: Code Style

```markdown
## Code style

- TypeScript strict mode
- No `any` types — use `unknown` and narrow
- Tests for all new functionality
- Descriptive variable names over comments
- Keep functions small and focused
```

Rationale: Five bullet points. These are the conventions that actually matter. No mention of formatting tools (those are enforced by CI, not by humans reading docs).

#### Section 8: Getting Help

```markdown
## Getting help

- **GitHub Issues** — for bugs and feature requests
- **GitHub Discussions** — for questions, ideas, and general conversation
```

Rationale: Two channels. No Slack or Discord yet (premature for launch). GitHub-native keeps everything in one place.

### 4. Badge Selection

Three badges, no more:

```markdown
[![CI](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml/badge.svg)](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@basesignal/cli.svg)](https://www.npmjs.com/package/@basesignal/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
```

Rationale:
- **CI badge** — shows the project is actively maintained and tests pass. Links to the CI workflow.
- **npm version** — shows the latest published version. Uses `@basesignal/cli` as the user-facing package.
- **License badge** — MIT. Immediately signals permissiveness to open source developers.

What is excluded and why:
- **No code coverage badge.** Coverage percentages create pressure to game numbers and don't correlate with code quality.
- **No "PRs welcome" badge.** CONTRIBUTING.md communicates this better than a badge.
- **No download count badge.** Vanity metric that's zero at launch (embarrassing) and distracting later.
- **No "Star History" badge.** Premature.
- **No dependency badges.** They add noise and go stale.

### 5. Monorepo README Strategy

The root README is the entry point. Per-package READMEs are reference docs.

#### Root README (detailed above)
- Overview, quick start, architecture, links
- Does NOT duplicate per-package API documentation
- Links to per-package READMEs for details

#### Per-Package READMEs (separate story — M008-E006-S002 scope)

Each `packages/*/README.md` follows a consistent template:

```markdown
# @basesignal/<package-name>

One-sentence description.

## Installation

\```bash
npm install @basesignal/<package-name>
\```

## Usage

[Primary use case code example]

## API

[Type signatures and descriptions]

## License

[MIT](../../LICENSE)
```

Per-package READMEs are NOT part of this story. They are documented here for context but belong to M008-E006-S002 (Documentation). This story creates the root README, LICENSE, and CONTRIBUTING.md only.

### 6. File Placement

```
basesignal/
  README.md              ← root README (this story)
  LICENSE                ← MIT license (this story)
  CONTRIBUTING.md        ← contribution guide (this story)
  .env.example           ← template for environment variables (referenced by README)
  packages/
    core/README.md       ← (M008-E006-S002 scope)
    crawlers/README.md   ← (M008-E006-S002 scope)
    storage/README.md    ← (M008-E006-S002 scope)
    mcp-server/README.md ← (M008-E006-S002 scope)
    cli/README.md        ← (M008-E006-S002 scope)
  docs/                  ← (M008-E006-S002 scope)
```

## Key Decisions

1. **README structure follows the "30-second scan" principle.** A developer scrolling through the README should understand what Basesignal does, see it working, and know how to contribute — all within 30 seconds of scanning bold text and code blocks.

2. **CONTRIBUTING.md leads with the Crawler interface.** The full `Crawler` interface code and a realistic example (G2 reviews) are included directly. This makes the contribution path concrete, not abstract. "Implement four members" is achievable. "See our architecture docs" is not.

3. **Three badges, no more.** CI, npm version, license. Each serves a specific trust signal. Everything else is noise at launch.

4. **No architecture diagrams.** A text-based pipeline flow (`URL -> Crawlers -> Analysis -> Profile`) renders everywhere and is easier to maintain than SVG or Mermaid. Detailed architecture belongs in docs/.

5. **Root README does not duplicate package READMEs.** One sentence per package in a table, with links. Duplication creates maintenance burden and inconsistency.

6. **MIT license.** Maximum adoption, simplest terms, most well-understood. Consistent with the "open standard" positioning.

7. **No FAQ, no comparison tables, no star history.** Each of these is either premature (star history), maintenance-heavy (comparison tables), or a sign of unclear documentation (FAQ). If something needs explaining, fix the explanation in the relevant section.

8. **.env.example file.** The README references `cp .env.example .env` for Docker setup. This file should contain commented-out variables with descriptions. It is a lightweight deliverable of this story since the README references it.

## What This Does NOT Do

- **No per-package READMEs.** Those belong to M008-E006-S002 (Documentation).
- **No docs/ content.** The README links to docs/ but the content is M008-E006-S002.
- **No GitHub issue templates.** Those belong to M008-E006-S005 (CI, GitHub, Release).
- **No CI workflow.** The README includes a CI badge, but the workflow itself is M008-E006-S005.
- **No examples/ directory.** Those belong to M008-E006-S004 (Examples).
- **No docs site (VitePress, Docusaurus).** That is a separate decision for M008-E006-S002.

## .env.example Content

```bash
# Basesignal Configuration
# Copy this file to .env and fill in your API key.

# LLM Provider — set ONE of these:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Storage (optional — defaults to ~/.basesignal/data.db)
# BASESIGNAL_STORAGE_PATH=./data/basesignal.db

# Crawl settings (optional)
# BASESIGNAL_MAX_PAGES=50
# BASESIGNAL_CRAWL_TIMEOUT=60000
```

## Verification Steps

1. **README renders correctly on GitHub** — all markdown renders, code blocks have syntax highlighting, links work, badges display (badges will 404 until CI and npm publish are set up, which is expected).
2. **30-second scan test** — a developer unfamiliar with Basesignal can explain what it does after scanning bold text and code blocks for 30 seconds.
3. **Copy-paste test** — the CLI quick start commands, Claude Desktop JSON config, and Docker commands are copy-pasteable and syntactically correct.
4. **LICENSE file** — contains the exact MIT license text with "DeepSky Data ApS" copyright and 2026 year.
5. **CONTRIBUTING.md** — includes the full Crawler interface code, a realistic example (G2 reviews), step-by-step instructions, and PR process.
6. **.env.example** — contains commented-out variables matching the configuration the CLI and MCP server expect.

## Success Criteria

- README.md includes: tagline, what it does, install instructions, quick start, text architecture diagram
- README.md includes Claude Desktop config example and CLI usage examples
- README.md links to docs/ for detailed documentation
- LICENSE contains MIT license text with "DeepSky Data ApS" copyright
- CONTRIBUTING.md explains: setup, adding crawlers, adding storage adapters, PR process
- CONTRIBUTING.md includes the Crawler interface code and step-by-step instructions
- .env.example exists with documented configuration variables
