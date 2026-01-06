# Basesignal Landing Page Design

## Overview

A focused landing page that explains Basesignal and converts visitors into early adopters. Not a full marketing site—a single page that does one job well.

**Type:** Marketing/Website
**Priority:** Critical (launch blocker)
**Tech stack:** AstroJS + Tailwind CSS (separate project)

## Goals

1. Explain the product clearly in 30 seconds
2. Drive Discord signups (primary CTA)
3. Drive YouTube subscribes (secondary CTA)
4. Set expectations: early product, building in public

## Key Decisions

| Decision | Choice |
|----------|--------|
| Tech stack | AstroJS (static site, separate from main app) |
| Visual theme | Dark (like Matter reference) |
| Accent color | Blue (#3B82F6) |
| Headline | "Your product needs a P&L" |
| Primary CTA | Join Discord for early access |
| Secondary CTA | Subscribe on YouTube |

## Project Structure

```
basesignal-landing/
├── src/
│   ├── layouts/
│   │   └── Layout.astro        # Base HTML, meta tags, fonts
│   ├── pages/
│   │   └── index.astro         # Single landing page
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── Problem.astro
│   │   ├── Solution.astro
│   │   ├── HowItWorks.astro
│   │   ├── BuildingInPublic.astro
│   │   ├── EarlyAccess.astro
│   │   └── Footer.astro
│   └── styles/
│       └── global.css          # Tailwind + custom styles
├── public/
│   └── images/                 # Mockups, OG image (placeholders)
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── tsconfig.json
```

**Location:** `/basesignal-landing` alongside the main `/basesignal` app

## Design Tokens

### Colors (Dark Theme)

```css
/* Backgrounds */
--bg-primary: #0A0A0A;      /* Main background */
--bg-elevated: #141414;     /* Cards, contrasting sections */
--bg-subtle: #1A1A1A;       /* Hover states */

/* Text */
--text-primary: #FFFFFF;    /* Headlines */
--text-secondary: #A1A1A1;  /* Body text */
--text-muted: #6B6B6B;      /* Captions */

/* Accent (Blue) */
--accent: #3B82F6;          /* Primary buttons, links */
--accent-hover: #2563EB;    /* Button hover */
--accent-subtle: rgba(59, 130, 246, 0.1);  /* Highlights */

/* Borders */
--border-default: #262626;  /* Dividers */
--border-hover: #404040;    /* Interactive states */
```

### Typography

- **Font:** Inter
- **Headline (h1):** 64px / bold / tight tracking
- **Section headers (h2):** 40px / semibold
- **Body:** 18px / regular / relaxed line-height
- **Small/labels:** 14px / medium

### Spacing

- **Section padding:** 120px vertical
- **Max content width:** 1200px, centered
- **Component gaps:** 24-48px scale

## Page Sections

### 1. Hero

**Content:**
- Minimal header: logo left, no navigation (single-page scroll)
- Headline: "Your product needs a P&L" (64px, bold, centered)
- Subheadline: "Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS—so you can measure what actually matters."
- Primary CTA: "Join Discord" (blue button)
- Secondary CTA: "Watch us build →" (outline button)
- Product mockup below with subtle glow effect
- Optional: subtle grid pattern or gradient in background

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [B] Basesignal                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   Your product needs a P&L                  │
│                                                             │
│         Basesignal generates journey maps, tracking         │
│        plans, and metric catalogs for B2B SaaS – so         │
│           you can measure what actually matters.            │
│                                                             │
│        [Join Discord ↗]        [Watch us build →]           │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │     [Product mockup]        │                │
│              └─────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Problem

**Content:**
- Header: "Tracking is broken"
- 3 pain points in cards:
  1. "You're tracking clicks, not outcomes"
  2. "Your events are inconsistent and undocumented"
  3. "You have data but can't answer 'is it working?'"
- Pull quote: "Stakeholders don't trust the numbers."
- Tone: empathetic, not doom

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                     Tracking is broken                      │
│                                                             │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│   │ Pain 1      │   │ Pain 2      │   │ Pain 3      │      │
│   └─────────────┘   └─────────────┘   └─────────────┘      │
│                                                             │
│          "Stakeholders don't trust the numbers."            │
└─────────────────────────────────────────────────────────────┘
```

### 3. Solution

**Content:**
- Header: "Outcome-focused measurement in 15 minutes"
- 3 outputs with mockups (alternating left/right layout):
  1. **User Journey Map** - "See how users move from signup to value to revenue"
  2. **Measurement Plan** - "Know exactly what to track, organized by entity and action"
  3. **Metric Catalog** - "6-8 core metrics with definitions, formulas, and how to improve them"
- Closing: "We interview you. You get a measurement foundation that usually takes a week."

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│           Outcome-focused measurement in 15 minutes         │
│                                                             │
│   [Mockup]  User Journey Map                                │
│             Description...                                  │
│                                                             │
│             Measurement Plan  [Mockup]                      │
│             Description...                                  │
│                                                             │
│   [Mockup]  Metric Catalog                                  │
│             Description...                                  │
│                                                             │
│        "We interview you. You get a measurement             │
│         foundation that usually takes a week."              │
└─────────────────────────────────────────────────────────────┘
```

### 4. How It Works

**Content:**
- Header: "How it works"
- 3 numbered steps:
  1. **Answer questions about your product** - "Our guided interview asks about your user journey, first value moment, and core actions"
  2. **We generate your measurement foundation** - "Journey map, tracking plan, and metrics—all connected"
  3. **Know what to track and why** - "Clear docs you can hand to engineering or use to audit your current setup"
- Visual: connecting line/dots between steps

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                       How it works                          │
│                                                             │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐            │
│   │    01     │   │    02     │   │    03     │            │
│   │ Answer    │   │ We        │   │ Know what │            │
│   │ questions │   │ generate  │   │ to track  │            │
│   └───────────┘   └───────────┘   └───────────┘            │
│         ●─────────────●─────────────●                       │
└─────────────────────────────────────────────────────────────┘
```

### 5. Building in Public

**Content:**
- Header: "Built with you, not for you"
- Body: "Basesignal is in early development. We're building in public—watch our weekly sprint planning and demos. Early adopters get direct access and shape what we build."
- What they'll see:
  - Sprint planning (what we're building next)
  - Sprint demos (what we shipped)
  - Behind the scenes (product decisions explained)
- CTA: "Subscribe on YouTube →" (outline button)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  (bg-elevated section)                                      │
│                                                             │
│                Built with you, not for you                  │
│                                                             │
│          Description text...                                │
│                                                             │
│   What you'll see:                                          │
│   ▶ Sprint planning                                         │
│   ▶ Sprint demos                                            │
│   ▶ Behind the scenes                                       │
│                                                             │
│              [Subscribe on YouTube →]                       │
└─────────────────────────────────────────────────────────────┘
```

### 6. Early Access CTA

**Content:**
- Header: "Join the early adopters"
- Benefits:
  - Be one of the first to use Basesignal
  - Direct access to support via Discord
  - Your feedback shapes the product
- CTA: "Join Discord for early access ↗" (large blue button)
- Disclaimer: "This is an early product. Things will break. We'll fix them fast."

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                  Join the early adopters                    │
│                                                             │
│   ✓  Be one of the first to use Basesignal                 │
│   ✓  Direct access to support via Discord                  │
│   ✓  Your feedback shapes the product                      │
│                                                             │
│         [Join Discord for early access ↗]                   │
│                                                             │
│         "This is an early product. Things will break.       │
│                   We'll fix them fast."                     │
└─────────────────────────────────────────────────────────────┘
```

### 7. Footer

**Content:**
- Logo + "Basesignal"
- Links: Discord · YouTube · LinkedIn
- Attribution: "A DeepSky Data product"

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  [B] Basesignal                                             │
│                                                             │
│  Discord  ·  YouTube  ·  LinkedIn                           │
│                                                             │
│              A DeepSky Data product                         │
└─────────────────────────────────────────────────────────────┘
```

## Placeholders Needed

| Asset | Notes |
|-------|-------|
| Discord invite link | Placeholder URL for now |
| YouTube channel URL | Placeholder URL for now |
| Product mockups (3) | Journey map, measurement plan, metric catalog |
| OG image | For social sharing |
| Favicon | Reuse "B" logo |

## Design References

- **Matter** (provided screenshot) - dark theme, clean typography, product mockups
- **Linear** - clean, product-focused
- **PostHog** - technical but friendly
- **Superhuman** - confident, premium

## Responsive Behavior

- **Desktop (1200px+):** Full layouts as designed
- **Tablet (768-1199px):** 2-column grids become stacked, reduced padding
- **Mobile (<768px):** Single column, smaller typography (h1: 40px, h2: 28px), vertical step flow

## Implementation Notes

1. Use AstroJS with static output (no SSR needed)
2. Tailwind config should define custom colors as CSS variables
3. Inter font via Google Fonts or self-hosted
4. All images should have placeholder versions checked in
5. Consider subtle animations: fade-in on scroll, button hover effects
6. Background: subtle dot grid or gradient for depth

## Next Steps

1. Set up AstroJS project with Tailwind
2. Implement Layout and base styles
3. Build each section component
4. Add placeholder images
5. Test responsive behavior
6. Deploy to staging for review
