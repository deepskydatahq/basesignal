# Implementation Plan: README.md, MIT LICENSE, and CONTRIBUTING.md

**Task:** basesignal-avd
**Story:** M008-E006-S001
**Design:** [2026-02-15-readme-license-contributing-design.md](./2026-02-15-readme-license-contributing-design.md)

## Summary

Create the three foundational public-facing documents for the Basesignal open source release: a README.md that communicates what Basesignal does in 30 seconds, an MIT LICENSE file, and a CONTRIBUTING.md that makes adding a crawler feel achievable in an afternoon. Also create a .env.example file for the open source project (replacing the existing one which targets the current Convex-based web app).

## Context

The repository currently has:
- `README.md` — describes the existing Convex/React web app (will be **replaced entirely**)
- `.env.example` — contains Convex/Google OAuth config (will be **replaced entirely**)
- No `LICENSE` file
- No `CONTRIBUTING.md`

After M008 completes, the repository will be a monorepo with `packages/` (core, crawlers, storage, mcp-server, cli). This story writes the documents that describe that future state. The README references package paths, CLI commands, and Docker setup that will exist once earlier M008 stories are complete.

## Steps

### Step 1: Create LICENSE file

**File:** `LICENSE` (new file)

Write the standard MIT license text with:
- Copyright holder: `DeepSky Data ApS`
- Year: `2026`

Exact content:

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

This is the simplest step. No decisions to make — the design doc specifies the exact text.

### Step 2: Replace README.md

**File:** `README.md` (replace existing)

Replace the entire contents of the current README (which describes the Convex/React web app) with the open source project README. Follow the exact structure from the design doc, sections 1-10:

**Section 1: Badges + Project name + tagline**

Three badges on one line (CI, npm version, MIT license), then the project name and tagline:

```markdown
[![CI](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml/badge.svg)](https://github.com/deepskydatahq/basesignal/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@basesignal/cli.svg)](https://www.npmjs.com/package/@basesignal/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

# Basesignal

**The open standard for product growth models.**

Basesignal scans your product's website and generates a structured growth model — activation definitions, user journey, metric catalog, measurement plan — in 60 seconds. Use it from the CLI, connect it to Claude Desktop via MCP, or self-host with Docker.
```

**Section 2: What it does**

Four bullet points with bold lead phrases. Copy directly from design doc section 2.

**Section 3: Quick start -- CLI**

Three commands: `npm install -g`, `export ANTHROPIC_API_KEY`, `basesignal scan`. Use `linear.app` as the example URL. Copy from design doc section 3.

**Section 4: Quick start -- Claude Desktop**

JSON config snippet for `~/.config/claude/claude_desktop_config.json`. Include the "Then ask Claude" prompt example. Copy from design doc section 4.

**Section 5: Quick start -- Docker**

Two commands: `cp .env.example .env` and `docker compose up`. Copy from design doc section 5.

**Section 6: How it works**

One paragraph describing the pipeline + text diagram (`URL -> Crawlers -> Analysis Lenses -> Convergence -> Product Profile`). One follow-up paragraph about the structured profile sections. Copy from design doc section 6.

**Section 7: Packages**

Table with 5 packages, each with a relative link to `./packages/<name>` and a one-line description. Copy from design doc section 7.

**Section 8: Documentation**

Bulleted list of links to `docs/` files (getting-started, data-model, mcp-tools, writing-crawlers, self-hosting, specification). Copy from design doc section 8.

**Section 9: Contributing**

Two sentences pointing to CONTRIBUTING.md with the "add a crawler" path highlighted. Copy from design doc section 9.

**Section 10: License**

One line: `[MIT](./LICENSE) -- DeepSky Data ApS`. Copy from design doc section 10.

### Step 3: Create CONTRIBUTING.md

**File:** `CONTRIBUTING.md` (new file)

Create the full contribution guide with sections 1-8 from the design doc:

**Section 1: Welcome + philosophy** -- three sentences, "open standard" framing, points to crawler path.

**Section 2: Development setup** -- five commands (clone, cd, npm install, npm test, npm run build) + workspace explanation.

**Section 3: Adding a crawler** -- the most important section. Include:
- The full `Crawler` interface example (G2 reviews crawler)
- Five numbered steps: create file, implement interface, add tests with fixtures, register the crawler, submit PR
- Fixture-based testing example
- "Crawler contribution ideas" list (G2/Capterra, YouTube, LinkedIn, App Store, Crunchbase, Product Hunt)

**Section 4: Adding a storage adapter** -- show the `StorageAdapter` interface (save, load, list, delete, search, close) with a Postgres example class. Point to SQLite as reference.

**Section 5: Other contributions** -- four bullets: bug fixes, features, documentation, tests.

**Section 6: PR process** -- five numbered steps: fork, change, test, build, submit. "Small, focused PRs" guidance.

**Section 7: Code style** -- five bullets: TypeScript strict, no `any`, tests required, descriptive names, small functions.

**Section 8: Getting help** -- two channels: GitHub Issues (bugs/features), GitHub Discussions (questions/ideas).

### Step 4: Replace .env.example

**File:** `.env.example` (replace existing)

Replace the current content (which has Convex/Google OAuth/Sync Service config) with the open source configuration template from the design doc:

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

### Step 5: Verify all files

Manual verification checklist:
- `LICENSE` contains the exact MIT license text with "DeepSky Data ApS" and "2026"
- `README.md` has all 10 sections in order: badges + name/tagline, what it does, CLI quick start, Claude Desktop quick start, Docker quick start, how it works, packages table, documentation links, contributing, license
- `README.md` has exactly 3 badges: CI, npm version, MIT license
- `README.md` code blocks have correct syntax highlighting hints (bash, json)
- `CONTRIBUTING.md` has all 8 sections in order: welcome, dev setup, adding a crawler, adding a storage adapter, other contributions, PR process, code style, getting help
- `CONTRIBUTING.md` includes the full `Crawler` interface code with G2 reviews example
- `CONTRIBUTING.md` includes the `StorageAdapter` interface
- `.env.example` has commented-out variables with descriptions
- All internal links are correct (`./LICENSE`, `./CONTRIBUTING.md`, `./packages/*`, `./docs/*`)

## Files Changed

| File | Change Type |
|------|-------------|
| `LICENSE` | New file — MIT license |
| `README.md` | Replace entirely — open source project README |
| `CONTRIBUTING.md` | New file — contribution guide |
| `.env.example` | Replace entirely — open source config template |

## What Does NOT Change

- No per-package `packages/*/README.md` files (those are M008-E006-S002 scope)
- No `docs/` content files (those are M008-E006-S002 scope)
- No `.github/` issue templates or CI workflows (those are M008-E006-S005 scope)
- No `examples/` directory (that is M008-E006-S004 scope)
- No code changes of any kind — this story is documentation only
- `CLAUDE.md` is not modified (it is an internal development file, not public-facing)

## Verification

- All four files exist at the repository root: `LICENSE`, `README.md`, `CONTRIBUTING.md`, `.env.example`
- `LICENSE` is the exact MIT text with correct copyright
- `README.md` renders correctly as markdown (no broken syntax, code blocks have lang hints)
- `CONTRIBUTING.md` includes full Crawler and StorageAdapter interface code
- `.env.example` has documented configuration variables for the open source project
- No references to the old Convex/React web app remain in the replaced files
