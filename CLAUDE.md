# CLAUDE.md - Basesignal

Best practices and conventions for working on Basesignal.

---

## Overview

Basesignal is a SaaS for measuring product performance using a structured P&L framework.

**Target users:** Product leaders, executives, finance teams

**Key concept:** "Every business has a P&L. Your product should too."

---

## P&L Framework

| Layer | What It Measures |
|-------|------------------|
| **Reach** | New user volume, trial starts, activation rate |
| **Engagement** | Active rate, feature adoption, usage intensity |
| **Value Delivery** | User-defined activation/active rules, derived account states |
| **Value Capture** | Conversion, retention, expansion rates |

---

## Tech Stack

- **Frontend**: React 19 + Vite + React Router v7
- **Backend**: Convex (serverless)
- **Styling**: Tailwind CSS + Clarity UI design system
- **Graph**: React Flow
- **AI**: Claude API
- **Auth**: Clerk

---

## Development

```bash
# Install dependencies
npm install

# Terminal 1: Start Convex backend
npx convex dev

# Terminal 2: Start frontend dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
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
| `/brainstorm-epics` | Generate mission candidates from vision + roadmap |
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

Strategic product commands that sit above the development workflow, using a structured hierarchy of TOML files.

```
VISION.md              ← "What transformation?" (rarely)
    ↓
ROADMAP.md             ← "Where investing?" (periodic)
    ↓
HYPOTHESES.md          ← "What bets?" (living)
    ↓
product/missions/      ← /product-epic creates mission TOML (per hypothesis)
    ↓
product/epics/         ← /product-mission-breakdown creates epic TOMLs
    ↓
product/stories/       ← /product-epic-breakdown creates story TOMLs
    ↓
Beads tasks            ← /product-story-handoff creates bd tasks
    ↓
Task Pipeline → /retro → /product-judgment validates up the hierarchy
    ↓
product iteration      ← "What did we learn?"
```

### Product Commands

| Command | Artifact | Updates |
|---------|----------|---------|
| `/product-vision` | VISION.md | Rarely (pivots only) |
| `/product-roadmap` | ROADMAP.md | Periodic (monthly/quarterly) |
| `/product-hypotheses` | HYPOTHESES.md | Constantly (living) |
| `/product-epic` | Creates mission TOML + breakdowns | Per hypothesis |
| `/product-mission-breakdown` | Creates epic TOMLs from mission | Per mission |
| `/product-epic-breakdown` | Creates story TOMLs from epic | Per epic |
| `/product-story-handoff` | Creates Beads tasks from stories | When stories are ready |
| `/product-judgment` | Validates completion up hierarchy | After implementation |
| `/product-iteration` | Updates HYPOTHESES.md | After features |

### The Flow

1. **Starting:** `/product-vision` → `/product-roadmap` → `/product-hypotheses`
2. **Planning:** `/product-epic` → mission TOML → `/product-mission-breakdown` → `/product-epic-breakdown`
3. **Handoff:** `/product-story-handoff` → Beads tasks with `brainstorm` label
4. **Implementation:** Task pipeline (brainstorm → plan → ready → implement → close)
5. **Validation:** `/product-judgment` → validates story → epic → mission
6. **Learning:** `/product-iteration` → update hypotheses → next cycle

---

## Testing

Follow the testing skill at `.claude/skills/testing.md` for detailed patterns.

**Quick reference:**
- **Convex functions**: Use `convex-test` for business logic
- **React components**: Use RTL with setup functions
- **Pure functions**: Use Vitest directly

**Commands:**
```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once
```

**Key patterns:**
- Use `getByRole` as primary query
- Use `userEvent.setup()` for interactions
- Write workflow tests, not isolated assertions
- Use setup functions instead of `beforeEach`

---

## Critical Rules

**Every feature must have tests**
- Write tests for all new Convex functions and React components
- Use `superpowers:subagent-driven-development` for multi-step implementations - it enforces tests per task
- Use `superpowers:finishing-a-development-branch` to verify all tests pass before merging/pushing
- Never mark work complete until `npm test` passes

**Never mutate Convex state outside of mutations**
- Queries are read-only - use `useQuery()` for reading
- Mutations modify state - use `useMutation()` for create/update/delete
- Never edit `convex/_generated/` files (auto-generated)

**React 19 conventions**
- Functional components with hooks (no class components)
- Hooks at top level (never in conditions/loops)
- Custom hooks start with `use` prefix

**Convex backend must stay in sync**
- Run `npx convex dev` during local development
- Schema changes require redeployment

---

## Code Patterns

**Component structure**

```typescript
export function JourneyCard({ journeyId }: Props) {
  const journey = useQuery(api.journeys.get, { id: journeyId })
  if (!journey) return <div>Loading...</div>

  const handleClick = () => { ... }
  return <div onClick={handleClick}>{journey.name}</div>
}
```

**Convex patterns**

```typescript
// Queries (read-only)
const journeys = useQuery(api.journeys.list)

// Mutations (create/update/delete)
const create = useMutation(api.journeys.create)
await create({ name: "First Value Journey", ... })
```

---

## Key Features

- **Journey Editor** - AI-assisted journey mapping with React Flow
- **Overview Interview** - Guided interview to map user lifecycle
- **Activity Validation** - Entity + Action format enforcement
- **Amplitude Integration** - Connect and map Amplitude events
