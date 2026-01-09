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

This project uses a three-stage issue pipeline with Claude Code commands.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   /new-feature ──┐                                                      │
│   /retro ────────┼──► stage:brainstorm ──► stage:plan ──► stage:ready   │
│                  │         │                   │              │         │
│                  │  /brainstorm-issue     /plan-issue    /pick-issue    │
│                  │                       plan-issues.sh   run-issue.sh  │
│                  │                                            │         │
│                  └────────────────────────────────────────────┘         │
│                              (retro discovers more issues)              │
│                                                                         │
│   /brainstorm-epics ──► product-epic ──► stage:brainstorm (children)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Issue Stages

| Stage | Label | Description |
|-------|-------|-------------|
| **Brainstorm** | `stage:brainstorm` | Needs design exploration |
| **Plan** | `stage:plan` | Needs implementation plan |
| **Ready** | `stage:ready` | Has plan, ready to code |

### Commands

| Command | Description |
|---------|-------------|
| `/new-feature` | Brainstorm idea → design doc → GitHub issue |
| `/brainstorm-epics` | Generate epic candidates from vision + roadmap |
| `/brainstorm-issue` | Process `stage:brainstorm` queue |
| `/plan-issue` | Process `stage:plan` queue |
| `/pick-issue` | Process `stage:ready` queue |
| `/retro` | Post-implementation analysis |

### Headless Automation

```bash
# Plan issues (stage:plan → stage:ready)
./plan-issues.sh                    # Single issue
./plan-issues.sh --loop             # Process all plan issues
./plan-issues.sh --max 5            # Limit to 5 issues

# Implement issues (stage:ready → done)
./run-issue.sh                      # Single issue
./run-issue.sh --loop               # Process all ready issues
./run-issue.sh --random --max 5     # Random 5 issues
```

Both scripts support `--continue-on-error` to keep going if an issue fails.

---

## Product Thinking

Strategic product commands that sit above the development workflow.

```
VISION.md          ← "What transformation?" (rarely)
    ↓
ROADMAP.md         ← "Where investing?" (periodic)
    ↓
HYPOTHESES.md      ← "What bets?" (living)
    ↓
product epic       ← "What tasks test this?" (per hypothesis)
    ↓
Epic + Issues → Issue Pipeline → /retro
    ↓
product iteration  ← "What did we learn?"
```

### Product Commands

| Command | Document | Updates |
|---------|----------|---------|
| `product vision` | VISION.md | Rarely (pivots only) |
| `product roadmap` | ROADMAP.md | Periodic (monthly/quarterly) |
| `product hypotheses` | HYPOTHESES.md | Constantly (living) |
| `product epic` | Creates GitHub epic + issues | Per hypothesis |
| `product iteration` | Updates HYPOTHESES.md | After features |

### The Flow

1. **Starting:** `product vision` → `product roadmap` → `product hypotheses`
2. **Day-to-day:** `product epic` → creates epic + `stage:brainstorm` child issues
3. **After feature:** `product iteration` → update learnings → next hypothesis

### Special Labels

| Label | Purpose |
|-------|---------|
| `hypothesis` | Issue tests a product hypothesis |
| `epic` | Large issue that breaks into children |

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
