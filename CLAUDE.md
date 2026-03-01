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

This project uses Beads (`bd`) as the task engine with a label-based pipeline and a structured product layer (Missions → Epics → Stories).

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Product Layer (TOML files)                                             │
│                                                                         │
│   /brainstorm-epics ──► Mission TOML                                    │
│   /product-epic ──────► /product-mission-breakdown ──► Epic TOMLs       │
│                         /product-epic-breakdown ──► Story TOMLs          │
│                         /product-story-handoff ──► Beads tasks           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Task Pipeline (Beads labels)                                           │
│                                                                         │
│   /new-feature ──┐                                                      │
│   /retro ────────┼──► brainstorm ──► plan ──► ready                     │
│                  │       │             │         │                      │
│                  │  /brainstorm    /plan-issue  /pick-issue             │
│                  │  /brainstorm-auto           run-issue.sh             │
│                  │  brainstorm-issues.sh  plan-issues.sh               │
│                  │                                                      │
│                  └──────────────────────────────────────────┘           │
│                              (retro discovers more tasks)               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Validation                                                             │
│                                                                         │
│   /product-judgment ──► validates story → epic → mission                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Task Statuses (Beads)

Tasks use Beads status + labels:

| Beads State | Label | Description |
|-------------|-------|-------------|
| `open` | `brainstorm` | Needs design exploration |
| `open` | `plan` | Needs implementation plan |
| `open` | `ready` | Has plan, ready to code |
| `in_progress` | — | Currently being worked on |
| `closed` | — | Completed |

### Beads CLI Reference

```bash
# List tasks by label
bd list --label brainstorm --json

# Show task details
bd show <id> --json

# Create task with label
bd create "Title" --labels brainstorm -d "description" --silent

# Update status/labels
bd update <id> --status in_progress
bd update <id> --remove-label brainstorm --add-label plan

# Close task
bd close <id>

# Check status
bd status
```

### Commands

| Command | Description |
|---------|-------------|
| `/new-feature` | Brainstorm idea → design doc → Beads task |
| `/plan-mission` | Plan a mission with codebase exploration and scope mapping |
| `/brainstorm-epics` | Generate mission candidates from vision + value ladder |
| `/brainstorm` | Interactive brainstorm for `brainstorm` queue |
| `/brainstorm-auto` | Autonomous brainstorm with expert personas (from `.claude/experts/`) |
| `/plan-issue` | Process `plan` queue |
| `/pick-issue` | Process `ready` queue |
| `/retro` | Post-implementation analysis |
| `/product-mission-breakdown` | Break mission into epics |
| `/product-epic-breakdown` | Break epic into stories |
| `/product-story-handoff` | Create Beads tasks from ready stories |
| `/product-judgment` | Validate story/epic/mission completion |

### Headless Automation

```bash
# Brainstorm tasks (brainstorm → plan)
./brainstorm-issues.sh              # Single task
./brainstorm-issues.sh --loop       # Process all brainstorm tasks
./brainstorm-issues.sh <task-id>    # Brainstorm specific task

# Plan tasks (plan → ready)
./plan-issues.sh                    # Single task
./plan-issues.sh --loop             # Process all plan tasks
./plan-issues.sh --max 5            # Limit to 5 tasks

# Implement tasks (ready → done)
./run-issue.sh                      # Single task
./run-issue.sh --loop               # Process all ready tasks
./run-issue.sh --max 5              # Limit to 5 tasks
```

All scripts support `--loop`, `--max N`, and `--continue-on-error` flags.

### Parallel Automation

For faster processing, use parallel workers with file-based locking:

```bash
# Parallel brainstorming (3 workers default)
./brainstorm-parallel.sh            # 3 workers
./brainstorm-parallel.sh -w 5       # 5 workers

# Parallel planning (3 workers default)
./plan-parallel.sh                  # 3 workers
./plan-parallel.sh -w 5             # 5 workers

# Parallel implementation with dependency awareness
./run-parallel.sh                   # 3 workers, respects task dependencies
./run-parallel.sh -w 5              # 5 workers
```

Workers automatically skip tasks with unresolved dependencies (registered via `bd dep add`).
The `/product-story-handoff` command registers dependencies when creating tasks from stories.

---

## Product Thinking

The full development workflow (vision → value ladder → missions → epics → stories → tasks → implementation) is documented in [HOW_WE_WORK.md](./HOW_WE_WORK.md). That document is the primary reference for how ideas become shipped features.

### Quick Reference

```
VISION.md              ← "What transformation?" (rarely)
    ↓
VALUES.md              ← "What value?" (when levels change)
    ↓
product/missions/      ← Outcome-oriented work packages
    ↓
product/epics/         ← /product-mission-breakdown creates epic TOMLs
    ↓
product/stories/       ← /product-epic-breakdown creates story TOMLs
    ↓
Beads tasks            ← /product-story-handoff creates bd tasks
    ↓
Task Pipeline → /retro → /product-judgment validates up the hierarchy
```

### Product Commands

| Command | Artifact | Updates |
|---------|----------|---------|
| `/product-vision` | VISION.md | Rarely (pivots only) |
| `/product-values` | VALUES.md | When levels change |
| `/brainstorm-epics` | Mission candidates | From value levels + ideas |
| `/product-mission-breakdown` | Creates epic TOMLs from mission | Per mission |
| `/product-epic-breakdown` | Creates story TOMLs from epic | Per epic |
| `/product-story-handoff` | Creates Beads tasks from stories | When stories are ready |
| `/product-judgment` | Validates completion up hierarchy | After implementation |
| `/product-iteration` | Updates value ladder with learnings | After features |

### The Flow

1. **Direction:** `/product-vision` → `/product-values`
2. **Planning:** `/brainstorm-epics` → mission TOML → `/product-mission-breakdown` → `/product-epic-breakdown`
3. **Handoff:** `/product-story-handoff` → Beads tasks with `brainstorm` label
4. **Implementation:** Task pipeline (brainstorm → plan → ready → implement → close)
5. **Validation:** `/product-judgment` → validates story → epic → mission
6. **Learning:** `/product-iteration` → update value ladder → next cycle

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
- Use `superpowers:subagent-driven-development` for multi-step implementations - it enforces tests per task
- Use `superpowers:finishing-a-development-branch` to verify all tests pass before merging/pushing
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
