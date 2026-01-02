# Basesignal

Product performance measurement platform using a structured P&L framework.

## What It Does

Basesignal helps product teams measure what matters by connecting product analytics (Amplitude) to a structured framework:

| Layer | What It Measures |
|-------|------------------|
| **Reach** | New user volume, trial starts, activation rate |
| **Engagement** | Active rate, feature adoption, usage intensity |
| **Value Delivery** | User-defined activation/active rules, derived account states |
| **Value Capture** | Conversion, retention, expansion rates |

**Key idea:** Every business has a P&L. Your product should too.

## Features

- **Amplitude Integration** - Connect your Amplitude project, select events to sync
- **Account Mapping** - Define which field identifies accounts (user_id, device_id, or user property)
- **Activity Definitions** - Create canonical activities from raw events (simple rename, filtered, or synthetic combinations)
- **Value Rules** - DSL for defining account states:
  - "Activated = did 2 of [activity A, B, C] in first 14 days"
  - "Active = did any of [activity A, B] in last 30 days"
- **Journey Editor** - AI-assisted journey mapping with visual graph builder

## Tech Stack

- **Frontend**: React 19 + Vite + React Router v7
- **Backend**: Convex (serverless database + functions)
- **Styling**: Tailwind CSS + Clarity UI design system
- **Graph Visualization**: React Flow
- **AI**: Claude API (for journey interview)
- **Auth**: Clerk

## Quick Start

```bash
# Install dependencies
npm install

# Terminal 1: Start Convex backend
npx convex dev

# Terminal 2: Start frontend
npm run dev

# Open http://localhost:5173
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
VITE_CONVEX_URL=<your-convex-deployment-url>
CONVEX_DEPLOYMENT=<your-convex-deployment>
VITE_CLERK_PUBLISHABLE_KEY=<your-clerk-key>
```

Convex environment variables (set via `npx convex env`):
```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>  # For AI interview feature
CLERK_WEBHOOK_SECRET=<your-clerk-webhook-secret>
```

## Project Structure

```
basesignal/
├── src/
│   ├── components/
│   │   ├── ui/          # Clarity UI design system components
│   │   ├── journey/     # Journey editor components
│   │   ├── interview/   # AI interview panel
│   │   └── overview/    # Overview interview components
│   ├── routes/          # Page components
│   └── lib/             # Utilities
├── convex/
│   ├── schema.ts        # Database schema
│   ├── journeys.ts      # Journey CRUD
│   ├── stages.ts        # Stage mutations
│   ├── ai.ts            # Claude API integration
│   └── utils/           # Validation utilities
└── public/
```

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint code
npm test             # Run tests
npx convex deploy    # Deploy Convex to production
```
