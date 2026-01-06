# Basesignal Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dark-themed AstroJS landing page that converts visitors into Discord early adopters.

**Architecture:** Static AstroJS site with Tailwind CSS, 7 section components composed into a single index page. No JavaScript interactivity needed—pure static HTML/CSS output.

**Tech Stack:** AstroJS 4.x, Tailwind CSS 3.x, TypeScript, Inter font

**Design Doc:** `docs/plans/2026-01-06-landing-page-design.md`

---

## Task 1: Project Setup

**Files:**
- Create: `basesignal-landing/package.json`
- Create: `basesignal-landing/astro.config.mjs`
- Create: `basesignal-landing/tailwind.config.mjs`
- Create: `basesignal-landing/tsconfig.json`
- Create: `basesignal-landing/src/styles/global.css`

**Step 1: Create project directory**

```bash
mkdir -p ../basesignal-landing
cd ../basesignal-landing
```

**Step 2: Initialize npm and install dependencies**

```bash
npm init -y
npm install astro @astrojs/tailwind tailwindcss
npm install -D typescript @types/node
```

**Step 3: Create astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
});
```

**Step 4: Create tailwind.config.mjs**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A0A0A',
        'bg-elevated': '#141414',
        'bg-subtle': '#1A1A1A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1A1',
        'text-muted': '#6B6B6B',
        'accent': '#3B82F6',
        'accent-hover': '#2563EB',
        'border-default': '#262626',
        'border-hover': '#404040',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        'content': '1200px',
      },
    },
  },
  plugins: [],
};
```

**Step 5: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Step 6: Create src/styles/global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    @apply bg-bg-primary text-text-primary;
  }
}

@layer components {
  .section-padding {
    @apply py-20 md:py-28 lg:py-32;
  }

  .container-content {
    @apply max-w-content mx-auto px-6;
  }

  .heading-1 {
    @apply text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight;
  }

  .heading-2 {
    @apply text-3xl md:text-4xl font-semibold;
  }

  .body-text {
    @apply text-lg text-text-secondary leading-relaxed;
  }

  .btn-primary {
    @apply inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors;
  }

  .btn-outline {
    @apply inline-flex items-center gap-2 px-6 py-3 border border-border-default text-text-primary font-medium rounded-lg hover:border-border-hover hover:bg-bg-subtle transition-colors;
  }

  .card {
    @apply bg-bg-elevated border border-border-default rounded-xl p-6;
  }
}
```

**Step 7: Verify setup**

Run: `npx astro check`
Expected: No errors (may warn about missing pages)

**Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: initial AstroJS project setup with Tailwind"
```

---

## Task 2: Layout Component

**Files:**
- Create: `basesignal-landing/src/layouts/Layout.astro`
- Create: `basesignal-landing/src/pages/index.astro` (minimal)

**Step 1: Create Layout.astro**

```astro
---
interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  @import '../styles/global.css';
</style>
```

**Step 2: Create minimal index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <p class="text-text-primary p-8">Landing page coming soon...</p>
  </main>
</Layout>
```

**Step 3: Create favicon placeholder**

```bash
mkdir -p public
cat > public/favicon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#000"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-family="system-ui" font-weight="bold" font-size="18">B</text>
</svg>
EOF
```

**Step 4: Verify dev server runs**

Run: `npx astro dev`
Expected: Server starts at localhost:4321, page shows "Landing page coming soon..."

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Layout component and minimal index page"
```

---

## Task 3: Hero Component

**Files:**
- Create: `basesignal-landing/src/components/Hero.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create Hero.astro**

```astro
---
const discordUrl = '#discord'; // Placeholder
const youtubeUrl = '#youtube'; // Placeholder
---

<section class="section-padding">
  <div class="container-content">
    <!-- Header -->
    <header class="flex items-center justify-between mb-16 md:mb-24">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
          <span class="text-black font-bold text-xl">B</span>
        </div>
        <span class="text-xl font-semibold">Basesignal</span>
      </div>
    </header>

    <!-- Hero Content -->
    <div class="text-center max-w-4xl mx-auto">
      <h1 class="heading-1 mb-6">
        Your product needs a P&L
      </h1>
      <p class="body-text max-w-2xl mx-auto mb-10">
        Basesignal generates journey maps, tracking plans, and metric catalogs
        for B&B SaaS – so you can measure what actually matters.
      </p>

      <!-- CTAs -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
        <a href={discordUrl} class="btn-primary">
          Join Discord
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a href={youtubeUrl} class="btn-outline">
          Watch us build
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>

      <!-- Product Mockup Placeholder -->
      <div class="relative">
        <div class="absolute inset-0 bg-accent/20 blur-3xl rounded-full"></div>
        <div class="relative bg-bg-elevated border border-border-default rounded-xl p-8 aspect-video flex items-center justify-center">
          <p class="text-text-muted">[Product mockup placeholder]</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Hero section displays with headline, subheadline, two CTAs, and mockup placeholder

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Hero section component"
```

---

## Task 4: Problem Component

**Files:**
- Create: `basesignal-landing/src/components/Problem.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create Problem.astro**

```astro
---
const painPoints = [
  {
    title: "You're tracking clicks, not outcomes",
    description: "Pageviews and button clicks don't tell you if your product is delivering value."
  },
  {
    title: "Your events are inconsistent",
    description: "No naming conventions, no documentation, no one knows what's actually being tracked."
  },
  {
    title: "You can't answer 'is it working?'",
    description: "You have dashboards full of data but still can't answer the one question that matters."
  }
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-12">
      Tracking is broken
    </h2>

    <div class="grid md:grid-cols-3 gap-6 mb-12">
      {painPoints.map((point) => (
        <div class="card">
          <div class="w-2 h-2 rounded-full bg-accent mb-4"></div>
          <h3 class="text-lg font-semibold mb-2">{point.title}</h3>
          <p class="text-text-secondary text-sm">{point.description}</p>
        </div>
      ))}
    </div>

    <p class="text-center text-text-muted italic text-lg">
      "Stakeholders don't trust the numbers."
    </p>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Problem section with 3 cards and pull quote below Hero

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Problem section component"
```

---

## Task 5: Solution Component

**Files:**
- Create: `basesignal-landing/src/components/Solution.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create Solution.astro**

```astro
---
const outputs = [
  {
    title: "User Journey Map",
    description: "See how users move from signup to value to revenue. Visual flow of your product's user lifecycle.",
    align: "left"
  },
  {
    title: "Measurement Plan",
    description: "Know exactly what to track, organized by entity and action. A complete tracking specification.",
    align: "right"
  },
  {
    title: "Metric Catalog",
    description: "6-8 core metrics with definitions, formulas, and how to improve them. Your measurement bible.",
    align: "left"
  }
];
---

<section class="section-padding bg-bg-elevated">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-16">
      Outcome-focused measurement in 15 minutes
    </h2>

    <div class="space-y-12 md:space-y-16">
      {outputs.map((output, index) => (
        <div class={`flex flex-col ${output.align === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}>
          <!-- Mockup -->
          <div class="flex-1 w-full">
            <div class="bg-bg-primary border border-border-default rounded-xl p-6 aspect-video flex items-center justify-center">
              <p class="text-text-muted">[{output.title} mockup]</p>
            </div>
          </div>
          <!-- Text -->
          <div class="flex-1">
            <h3 class="text-2xl font-semibold mb-3">{output.title}</h3>
            <p class="body-text">{output.description}</p>
          </div>
        </div>
      ))}
    </div>

    <p class="text-center body-text mt-16 max-w-2xl mx-auto">
      We interview you about your product. You get a measurement foundation that usually takes a week to build.
    </p>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Solution from '../components/Solution.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
    <Solution />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Solution section with 3 alternating mockup/text rows and closing statement

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Solution section component"
```

---

## Task 6: HowItWorks Component

**Files:**
- Create: `basesignal-landing/src/components/HowItWorks.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create HowItWorks.astro**

```astro
---
const steps = [
  {
    number: "01",
    title: "Answer questions about your product",
    description: "Our guided interview asks about your user journey, first value moment, and core actions."
  },
  {
    number: "02",
    title: "We generate your measurement foundation",
    description: "Journey map, tracking plan, and metrics—all connected and ready to use."
  },
  {
    number: "03",
    title: "Know what to track and why",
    description: "Clear documentation you can hand to engineering or use to audit your current setup."
  }
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-16">
      How it works
    </h2>

    <div class="grid md:grid-cols-3 gap-8 relative">
      <!-- Connecting line (hidden on mobile) -->
      <div class="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-border-default"></div>

      {steps.map((step) => (
        <div class="text-center relative">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-elevated border border-border-default mb-6">
            <span class="text-accent font-bold text-xl">{step.number}</span>
          </div>
          <h3 class="text-lg font-semibold mb-3">{step.title}</h3>
          <p class="text-text-secondary text-sm">{step.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Solution from '../components/Solution.astro';
import HowItWorks from '../components/HowItWorks.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
    <Solution />
    <HowItWorks />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: 3 numbered steps in a row with connecting line

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add HowItWorks section component"
```

---

## Task 7: BuildingInPublic Component

**Files:**
- Create: `basesignal-landing/src/components/BuildingInPublic.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create BuildingInPublic.astro**

```astro
---
const youtubeUrl = '#youtube'; // Placeholder

const content = [
  { label: "Sprint planning", description: "What we're building next" },
  { label: "Sprint demos", description: "What we shipped" },
  { label: "Behind the scenes", description: "Product decisions explained" }
];
---

<section class="section-padding bg-bg-elevated">
  <div class="container-content max-w-3xl">
    <h2 class="heading-2 text-center mb-6">
      Built with you, not for you
    </h2>

    <p class="body-text text-center mb-10">
      Basesignal is in early development. We're building in public—watch our
      weekly sprint planning and demos. Early adopters get direct access and
      shape what we build.
    </p>

    <div class="card mb-10">
      <p class="text-sm font-medium text-text-muted mb-4">What you'll see:</p>
      <div class="space-y-3">
        {content.map((item) => (
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <div>
              <span class="font-medium">{item.label}</span>
              <span class="text-text-secondary"> — {item.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div class="text-center">
      <a href={youtubeUrl} class="btn-outline">
        Subscribe on YouTube
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Solution from '../components/Solution.astro';
import HowItWorks from '../components/HowItWorks.astro';
import BuildingInPublic from '../components/BuildingInPublic.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
    <Solution />
    <HowItWorks />
    <BuildingInPublic />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Building in Public section with content list and YouTube CTA

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add BuildingInPublic section component"
```

---

## Task 8: EarlyAccess Component

**Files:**
- Create: `basesignal-landing/src/components/EarlyAccess.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create EarlyAccess.astro**

```astro
---
const discordUrl = '#discord'; // Placeholder

const benefits = [
  "Be one of the first to use Basesignal",
  "Direct access to support via Discord",
  "Your feedback shapes the product"
];
---

<section class="section-padding">
  <div class="container-content max-w-2xl text-center">
    <h2 class="heading-2 mb-8">
      Join the early adopters
    </h2>

    <div class="space-y-3 mb-10">
      {benefits.map((benefit) => (
        <div class="flex items-center justify-center gap-3">
          <svg class="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-lg">{benefit}</span>
        </div>
      ))}
    </div>

    <a href={discordUrl} class="btn-primary text-lg px-8 py-4">
      Join Discord for early access
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>

    <p class="text-text-muted mt-8 text-sm">
      This is an early product. Things will break. We'll fix them fast.
    </p>
  </div>
</section>
```

**Step 2: Update index.astro**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Solution from '../components/Solution.astro';
import HowItWorks from '../components/HowItWorks.astro';
import BuildingInPublic from '../components/BuildingInPublic.astro';
import EarlyAccess from '../components/EarlyAccess.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
    <Solution />
    <HowItWorks />
    <BuildingInPublic />
    <EarlyAccess />
  </main>
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Early Access section with benefits list, large Discord CTA, and disclaimer

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add EarlyAccess section component"
```

---

## Task 9: Footer Component

**Files:**
- Create: `basesignal-landing/src/components/Footer.astro`
- Modify: `basesignal-landing/src/pages/index.astro`

**Step 1: Create Footer.astro**

```astro
---
const links = [
  { label: "Discord", url: "#discord" },
  { label: "YouTube", url: "#youtube" },
  { label: "LinkedIn", url: "#linkedin" }
];
---

<footer class="py-12 border-t border-border-default">
  <div class="container-content">
    <div class="flex flex-col items-center gap-6">
      <!-- Logo -->
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <span class="text-black font-bold">B</span>
        </div>
        <span class="font-semibold">Basesignal</span>
      </div>

      <!-- Links -->
      <div class="flex items-center gap-2 text-text-muted text-sm">
        {links.map((link, index) => (
          <>
            <a href={link.url} class="hover:text-text-primary transition-colors">
              {link.label}
            </a>
            {index < links.length - 1 && <span>·</span>}
          </>
        ))}
      </div>

      <!-- Attribution -->
      <p class="text-text-muted text-sm">
        A DeepSky Data product
      </p>
    </div>
  </div>
</footer>
```

**Step 2: Update index.astro (final version)**

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Solution from '../components/Solution.astro';
import HowItWorks from '../components/HowItWorks.astro';
import BuildingInPublic from '../components/BuildingInPublic.astro';
import EarlyAccess from '../components/EarlyAccess.astro';
import Footer from '../components/Footer.astro';
---

<Layout
  title="Basesignal - Your product needs a P&L"
  description="Basesignal generates journey maps, tracking plans, and metric catalogs for B2B SaaS – so you can measure what actually matters."
>
  <main>
    <Hero />
    <Problem />
    <Solution />
    <HowItWorks />
    <BuildingInPublic />
    <EarlyAccess />
  </main>
  <Footer />
</Layout>
```

**Step 3: Verify in browser**

Run: `npx astro dev`
Expected: Complete landing page with all 7 sections and footer

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Footer component, complete landing page"
```

---

## Task 10: Final Polish & Build Verification

**Files:**
- Modify: Various components for polish
- Create: `basesignal-landing/public/images/.gitkeep`

**Step 1: Create images directory placeholder**

```bash
mkdir -p public/images
touch public/images/.gitkeep
```

**Step 2: Verify production build**

Run: `npx astro build`
Expected: Build succeeds, output in `dist/` folder

**Step 3: Preview production build**

Run: `npx astro preview`
Expected: Production build serves correctly at localhost:4321

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: add images placeholder, verify production build"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | Setup | AstroJS + Tailwind project initialization |
| 2 | Layout | Base HTML template with meta tags |
| 3 | Hero | Headline, CTAs, product mockup placeholder |
| 4 | Problem | 3 pain point cards with pull quote |
| 5 | Solution | 3 outputs with alternating mockups |
| 6 | HowItWorks | 3 numbered steps with connecting line |
| 7 | BuildingInPublic | Content list and YouTube CTA |
| 8 | EarlyAccess | Benefits list and main Discord CTA |
| 9 | Footer | Logo, links, attribution |
| 10 | Polish | Images placeholder, build verification |

**Total tasks:** 10
**Estimated commits:** 10
