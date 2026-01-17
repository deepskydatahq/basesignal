# Basesignal

Outcome-driven product analytics for B2B SaaS. Transform how you measure product performance by shifting from interaction-driven tracking (clicks) to outcome-driven measurement (user success).

**Key idea:** Every business has a P&L. Your product should too.

## What It Does

Basesignal helps product teams measure what matters using a structured P&L framework:

| Layer | What It Measures |
|-------|------------------|
| **Reach** | New user volume, trial starts, activation rate |
| **Engagement** | Active rate, feature adoption, usage intensity |
| **Value Delivery** | User-defined activation/active rules, derived account states |
| **Value Capture** | Conversion, retention, expansion rates |

## Features

- **AI-Guided Overview Interview** - 15-minute guided interview that maps your user journey
- **Profile Dashboard** - Central hub showing product measurement completeness
- **User Journey Map** - Visual representation of user stages from signup to value
- **First Value Definition** - Define and track when users first experience value
- **Metric Catalog** - Auto-generated metrics derived from your measurement plan
- **Measurement Plan** - Structured entities, activities, and properties for tracking
- **Amplitude Integration** - Connect your analytics and map events to activities

## Tech Stack

- **Frontend**: React 19 + Vite + React Router v7
- **Backend**: Convex (serverless database + functions)
- **Styling**: Tailwind CSS + Clarity UI design system
- **Graph Visualization**: React Flow
- **AI**: Claude API (for journey interview)
- **Auth**: Clerk
- **Hosting**: Cloudflare Pages

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

Set in your environment or `.env.local`:

```bash
VITE_CONVEX_URL=<your-convex-deployment-url>
CONVEX_DEPLOYMENT=<your-convex-deployment>
VITE_CLERK_PUBLISHABLE_KEY=<your-clerk-key>
```

Convex environment variables (set via `npx convex env set`):
```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>
CLERK_WEBHOOK_SECRET=<your-clerk-webhook-secret>
```

## Project Structure

```
basesignal/
├── src/
│   ├── components/
│   │   ├── ui/           # Clarity UI design system
│   │   ├── profile/      # Profile page sections
│   │   ├── metrics/      # Metric catalog components
│   │   ├── measurement/  # Measurement plan components
│   │   ├── interview/    # AI interview panel
│   │   ├── journey/      # Journey editor (React Flow)
│   │   ├── overview/     # Overview interview components
│   │   ├── setup/        # Setup wizard flow
│   │   └── settings/     # Settings page
│   ├── routes/           # Page components
│   ├── shared/           # Shared utilities and templates
│   └── lib/              # Auth and utilities
├── convex/
│   ├── schema.ts         # Database schema
│   ├── profile.ts        # Profile data queries
│   ├── interviews.ts     # Interview sessions
│   ├── journeys.ts       # Journey CRUD
│   ├── stages.ts         # Journey stages
│   ├── measurementPlan.ts # Entities, activities, properties
│   ├── metricCatalog.ts  # Metric generation
│   ├── firstValue.ts     # First value definitions
│   ├── ai.ts             # Claude API integration
│   └── amplitude.ts      # Amplitude integration
├── docs/plans/           # Design docs and implementation plans
└── *.sh                  # Automation scripts
```

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint code
npm test             # Run tests (watch mode)
npm run test:run     # Run tests once
```

## Deployment

```bash
# Deploy Convex backend
npx convex deploy

# Deploy frontend to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name basesignal
```

## Issue Pipeline

This project uses a three-stage issue pipeline:

```
stage:brainstorm → stage:plan → stage:ready → done
```

Automation scripts:
```bash
./brainstorm-issues.sh --loop    # Design all brainstorm issues
./plan-issues.sh --loop          # Create plans for all plan issues
./run-issue.sh --loop            # Implement all ready issues
```

## Documentation

For detailed development workflow, code patterns, and conventions, see **[CLAUDE.md](./CLAUDE.md)**.

## License

Proprietary - DeepSky Data ApS
