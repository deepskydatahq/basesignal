# CLAUDE.md - Basesignal

Best practices and conventions for working on Basesignal.

---

## Overview

Basesignal is **context engineering for growth intelligence** — an open source analysis engine that crawls a product's public presence and generates structured growth context: ICP profiles, activation maps, value moments, and measurement specifications.

**Target users:** Developers, product engineers, product managers

**Key concept:** "Point at a URL, get a structured growth profile in 60 seconds."

**How it works:** Crawl → 7 analytical lenses → convergence → ICP profiles, activation maps, measurement specs

For the full vision, see [VISION.md](./VISION.md). For the development workflow, see [HOW_WE_WORK.md](./HOW_WE_WORK.md).

---

## Tech Stack

- **Monorepo:** npm workspaces (`packages/`)
- **Packages:** `@basesignal/core`, `crawlers`, `mcp-server`, `storage`, `cli`
- **AI:** Pluggable LLM providers (Anthropic, OpenAI, Ollama)
- **Storage:** File-based (ProductDirectory) or SQLite
- **Config:** TOML (`basesignal.toml`)
- **Testing:** Vitest
- **Legacy web app:** React 19 + Vite + Convex (coexists as one consumer of the packages)

---

## Development

```bash
# Install dependencies
npm install

# Run tests (all packages)
npm test

# Run tests once (CI mode)
npm run test:run

# Build all packages
npm run build

# Scan a product (CLI)
npx basesignal scan https://example.com

# Start MCP server
npx basesignal serve
```

---

## Development Workflow

This project uses Beads (`bd`) for task tracking and Claude Code sub-agents for autonomous execution. The product layer (Missions → Epics → Stories) feeds into an automated pipeline.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Product Layer (TOML files)                                             │
│                                                                         │
│   product/missions/ → product/epics/ → product/stories/                 │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Execution (Claude Code sub-agents)                                     │
│                                                                         │
│   /execute-mission M014                                                 │
│     Phase 1: Breakdown + LLM triage → Beads tasks                       │
│     Phase 2: Epic sub-agents (parallel, worktree) → PRs                 │
│     Phase 3: /fix-pr-feedback → address review comments                 │
│     Phase 4: Report                                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Post-Implementation                                                    │
│                                                                         │
│   /retro → discover follow-up issues → Beads tasks                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Beads CLI Reference

```bash
# List tasks by label
bd list --label ready --json

# Show task details
bd show <id> --json

# Create task with label
bd create "Title" --labels plan -d "description" --silent

# Update status/labels
bd update <id> --status in_progress
bd update <id> --remove-label plan --add-label ready

# Close task
bd close <id>

# Check status
bd status
```

### Commands

| Command | Description |
|---------|-------------|
| `/execute-mission` | Full autopilot: breakdown → triage → implement → PR feedback → report |
| `/fix-pr-feedback` | Read PR review comments, fix actionable feedback (max 2 rounds) |
| `/retro` | Post-implementation retrospective, discover follow-up issues |

---

## Product Thinking

The full development workflow (vision → value ladder → missions → epics → stories → execution) is documented in [HOW_WE_WORK.md](./HOW_WE_WORK.md). That document is the primary reference for how ideas become shipped features.

### Quick Reference

```
VISION.md              ← "What transformation?" (rarely)
    ↓
VALUES.md              ← "What value?" (when levels change)
    ↓
product/missions/      ← Outcome-oriented work packages
    ↓
/execute-mission       ← Autonomous: breakdown → triage → implement → PR
    ↓
/retro                 ← Discover follow-up issues
```

### The Flow

1. **Direction:** Refine vision and value ladder as needed
2. **Mission:** Define the mission TOML
3. **Execute:** `/execute-mission M014` — everything from breakdown to PRs, autonomous
4. **Review:** Review and merge epic PRs
5. **Retro:** `/retro` — discover follow-up issues

---

## Testing

All packages use Vitest. Tests live alongside source files.

**Commands:**
```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once (CI)
```

**Key patterns:**
- Co-locate tests with source: `foo.ts` → `foo.test.ts`
- Write workflow tests, not isolated assertions
- Use setup functions instead of `beforeEach`
- Each package has its own test config in `vitest.config.ts` or `package.json`

---

## Critical Rules

**Every feature must have tests**
- Write tests for all new functions and modules
- Never mark work complete until `npm test` passes

**Package boundaries matter**
- Each package in `packages/` has its own public API via `src/index.ts`
- Import from package names (`@basesignal/core`), not relative paths across packages
- Keep dependencies between packages explicit in each `package.json`

---

## Key Packages

| Package | Purpose |
|---------|---------|
| `@basesignal/core` | Schema types, validation, scoring algorithms |
| `@basesignal/crawlers` | Pluggable crawlers (Firecrawl, Jina, static) |
| `@basesignal/mcp-server` | Analysis pipeline, MCP server, LLM integration |
| `@basesignal/storage` | Storage adapters (file, SQLite), ProductDirectory |
| `@basesignal/cli` | Command-line interface (`scan`, `init`, `export`, `serve`) |

---

## Huginn Memory (Project-Scoped)

This project is registered in Huginn Memory as `project="basesignal"`.

When using MCP tools (`mcp__huginn-memory__*`), **always pass `project="basesignal"`** on these scoped tools:
- **Memory:** remember, recall, decide, forget, summarize
- **Tasks:** create_task, update_task, list_tasks, get_task, dismiss_task, surface_daily_candidates
- **Agents:** get_agent_profile, update_agent_profile, log_agent_execution, get_agent_metrics, log_feedback, get_feedback_summary, get_content_calendar, update_content_calendar

Global tools (daily entries, cashflow, time tracking, brainstorm, web distillation) do **not** take a project parameter.
