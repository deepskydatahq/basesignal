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

## Critical Rules

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
