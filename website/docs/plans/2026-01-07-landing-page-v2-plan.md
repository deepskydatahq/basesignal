# Landing Page V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update landing page messaging to outcome-driven vs interaction-driven belief chain.

**Architecture:** Update existing Astro components with new content, create 4 new components (Reframe, ProductIntro, Roadmap, Objection), remove Solution component, update page assembly.

**Tech Stack:** AstroJS 5.x, Tailwind CSS

---

## Context

- Design doc: `docs/plans/2026-01-07-landing-page-v2-design.md`
- Dev server: `npm run dev` (likely on port 4321 or 4322)
- Build: `npm run build`
- No unit tests for Astro components - verify via build success

---

### Task 1: Update Hero Component

**Files:**
- Modify: `src/components/Hero.astro`

**Step 1: Update Hero.astro with new content**

Replace entire file content:

```astro
---
const discordUrl = '#discord'; // Placeholder
---

<section class="section-padding">
  <div class="container-content">
    <!-- Header -->
    <header class="flex items-center justify-center mb-16 md:mb-24">
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
        100 events. Zero answers.
      </h1>
      <p class="body-text max-w-2xl mx-auto mb-4">
        Your tracking plan measures clicks, pageviews, and button taps.
        But can you answer: "Are users succeeding in our product?"
      </p>
      <p class="body-text max-w-2xl mx-auto mb-10 text-text-muted">
        Probably not. Because interactions don't measure outcomes.
      </p>

      <!-- Single CTA -->
      <a href={discordUrl} class="btn-primary">
        Join Early Access
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Hero.astro
git commit -m "feat: update hero with outcome-driven messaging"
```

---

### Task 2: Update Problem Component

**Files:**
- Modify: `src/components/Problem.astro`

**Step 1: Update Problem.astro with code display**

Replace entire file content:

```astro
---
const events = [
  'button_clicked',
  'page_viewed',
  'form_submitted',
  'feature_used',
  'signup_completed'
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-8">
      The problem with interaction-driven tracking
    </h2>

    <p class="body-text text-center mb-8">
      Your tracking plan probably looks like this:
    </p>

    <!-- Code/Event Display -->
    <div class="max-w-md mx-auto bg-bg-elevated border border-border-default rounded-xl p-6 mb-8">
      <div class="space-y-2">
        {events.map((event) => (
          <code class="block text-text-muted font-mono text-sm">{event}</code>
        ))}
      </div>
    </div>

    <!-- Explanation -->
    <div class="max-w-2xl mx-auto text-center">
      <p class="body-text mb-4">
        These tell you <span class="text-text-primary font-medium">what</span> users did.
      </p>
      <p class="body-text mb-4">
        They don't tell you <span class="text-text-primary font-medium">whether</span> users succeeded.
      </p>
      <p class="text-text-muted italic">
        You can have perfect tracking of every click and still have no idea if your product is actually working.
      </p>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Problem.astro
git commit -m "feat: update problem section with code display"
```

---

### Task 3: Create Reframe Component

**Files:**
- Create: `src/components/Reframe.astro`

**Step 1: Create Reframe.astro**

```astro
---
const comparisons = [
  {
    interaction: 'completed_signup',
    outcome: 'User successfully onboarded and ready to use'
  },
  {
    interaction: 'used_feature',
    outcome: 'User got value from core feature'
  },
  {
    interaction: 'logged_in',
    outcome: 'User is on track to become retained'
  }
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-6">
      What if you measured outcomes instead?
    </h2>

    <p class="body-text text-center mb-12">
      An outcome isn't a click. It's a result—the thing you want users to achieve.
    </p>

    <!-- Comparison Table -->
    <div class="max-w-3xl mx-auto mb-12 overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border-default">
            <th class="text-left py-4 px-4 text-text-muted font-medium">
              Interaction (what you track now)
            </th>
            <th class="text-left py-4 px-4 text-text-primary font-medium">
              Outcome (what you should measure)
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-default">
          {comparisons.map((row) => (
            <tr>
              <td class="py-4 px-4 font-mono text-sm text-text-muted">{row.interaction}</td>
              <td class="py-4 px-4 text-text-secondary">{row.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <!-- Conclusion -->
    <p class="body-text text-center max-w-2xl mx-auto">
      When you define outcomes first, you can finally answer:<br />
      <span class="text-accent font-medium">"Is our product helping users succeed?"</span>
    </p>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Reframe.astro
git commit -m "feat: add reframe section with comparison table"
```

---

### Task 4: Create ProductIntro Component

**Files:**
- Create: `src/components/ProductIntro.astro`

**Step 1: Create ProductIntro.astro**

```astro
---
const features = [
  'Map user journeys from first touch to success',
  'Define what outcomes matter at each stage',
  'Create product metrics that measure real performance'
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-6">
      Build your outcome-driven tracking plan
    </h2>

    <p class="body-text text-center max-w-2xl mx-auto mb-12">
      Basesignal helps you move from tracking interactions to measuring outcomes:
    </p>

    <!-- Feature bullets -->
    <div class="flex flex-col md:flex-row justify-center gap-8 mb-12">
      {features.map((feature) => (
        <div class="flex items-start gap-3">
          <span class="text-accent">→</span>
          <span class="text-text-secondary">{feature}</span>
        </div>
      ))}
    </div>

    <!-- Product Screenshot Placeholder -->
    <div class="relative max-w-4xl mx-auto">
      <div class="absolute inset-0 bg-accent/20 blur-3xl rounded-full"></div>
      <div class="relative bg-bg-elevated border border-border-default rounded-xl p-8 aspect-video flex items-center justify-center">
        <p class="text-text-muted">[Product screenshot placeholder]</p>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/ProductIntro.astro
git commit -m "feat: add product intro section"
```

---

### Task 5: Create Roadmap Component

**Files:**
- Create: `src/components/Roadmap.astro`

**Step 1: Create Roadmap.astro**

```astro
---
const phases = [
  {
    status: 'NOW',
    statusLabel: 'Early Access',
    title: 'Define Outcomes',
    description: 'Map your user journey. Define what success looks like at each stage. Create an outcome-driven tracking plan that tells you what to measure.',
    isActive: true
  },
  {
    status: 'NEXT',
    statusLabel: '',
    title: 'Product Performance Metrics',
    description: 'See how your product performs across the user journey. Understand conversion between stages. Identify where you\'re losing revenue potential.',
    isActive: false
  },
  {
    status: 'FUTURE',
    statusLabel: '',
    title: 'Feature & Segment Intelligence',
    description: 'Connect outcomes to features and user segments. Discover which features drive the most value. Identify which micro-segments generate the most revenue potential.',
    isActive: false
  }
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-4">
      Where we're headed
    </h2>

    <p class="body-text text-center mb-12">
      Basesignal is being built in three phases. Join early access to shape the product with us.
    </p>

    <!-- Phase Cards -->
    <div class="grid md:grid-cols-3 gap-6">
      {phases.map((phase) => (
        <div class:list={['card', { 'border-accent': phase.isActive, 'opacity-75': !phase.isActive }]}>
          <div class="flex items-center gap-2 mb-4">
            <span class:list={[
              'text-xs font-medium px-2 py-1 rounded',
              phase.isActive ? 'bg-accent/20 text-accent' : 'bg-bg-subtle text-text-muted'
            ]}>
              {phase.status}
            </span>
            {phase.statusLabel && (
              <span class="text-text-muted text-sm">{phase.statusLabel}</span>
            )}
          </div>
          <h3 class="text-lg font-semibold mb-3">{phase.title}</h3>
          <p class="text-text-secondary text-sm mb-4">
            {phase.description}
          </p>
          <div class="bg-bg-subtle border border-border-default rounded-lg p-4 aspect-video flex items-center justify-center">
            <span class="text-text-muted text-xs">[Screenshot]</span>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Roadmap.astro
git commit -m "feat: add roadmap section with three phases"
```

---

### Task 6: Update HowItWorks Component

**Files:**
- Modify: `src/components/HowItWorks.astro`

**Step 1: Update HowItWorks.astro with new content**

Replace entire file content:

```astro
---
const steps = [
  {
    number: '1',
    title: 'Define your outcomes',
    description: 'What does user success look like at each stage? Map the journey from first visit to loyal user.'
  },
  {
    number: '2',
    title: 'Identify the signals',
    description: 'What events or behaviors indicate an outcome was achieved? Now you know what to actually track.'
  },
  {
    number: '3',
    title: 'Measure what matters',
    description: 'Create product metrics tied to real outcomes—not vanity metrics tied to clicks.'
  }
];
---

<section class="section-padding">
  <div class="container-content">
    <h2 class="heading-2 text-center mb-12">
      How it works
    </h2>

    <div class="grid md:grid-cols-3 gap-8">
      {steps.map((step) => (
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
            {step.number}
          </div>
          <h3 class="text-lg font-semibold mb-2">{step.title}</h3>
          <p class="text-text-secondary text-sm">
            {step.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/HowItWorks.astro
git commit -m "feat: update how it works with outcome-focused steps"
```

---

### Task 7: Simplify BuildingInPublic Component

**Files:**
- Modify: `src/components/BuildingInPublic.astro`

**Step 1: Simplify BuildingInPublic.astro**

Replace entire file content:

```astro
---
const youtubeUrl = '#youtube'; // Placeholder
const discordUrl = '#discord'; // Placeholder
---

<section class="section-padding">
  <div class="container-content">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="heading-2 mb-4">
        Building in public
      </h2>
      <p class="body-text mb-6">
        Follow along as I build Basesignal from scratch.
      </p>
      <div class="flex items-center justify-center gap-6">
        <a href={youtubeUrl} class="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          YouTube
        </a>
        <a href={discordUrl} class="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Discord
        </a>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/BuildingInPublic.astro
git commit -m "feat: simplify building in public section"
```

---

### Task 8: Create Objection Component

**Files:**
- Create: `src/components/Objection.astro`

**Step 1: Create Objection.astro**

```astro
<section class="section-padding">
  <div class="container-content">
    <div class="max-w-2xl mx-auto text-center">
      <p class="text-text-muted italic text-lg mb-6">
        "But I need to fix my tracking first..."
      </p>
      <p class="body-text">
        You don't need better tracking. You need to know what to track.
      </p>
      <p class="text-text-secondary mt-4">
        When you start with outcomes, the right events become obvious.
        The noise falls away. You stop debating tools and start measuring what matters.
      </p>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Objection.astro
git commit -m "feat: add objection handling section"
```

---

### Task 9: Update EarlyAccess Component

**Files:**
- Modify: `src/components/EarlyAccess.astro`

**Step 1: Update EarlyAccess.astro**

Replace entire file content:

```astro
---
const discordUrl = '#discord'; // Placeholder
const benefits = [
  'Get early access to the tool',
  'Shape the product roadmap',
  'Connect with other product analytics folks'
];
---

<section class="section-padding">
  <div class="container-content">
    <div class="max-w-2xl mx-auto text-center">
      <h2 class="heading-2 mb-6">
        Join the early access
      </h2>

      <p class="body-text mb-8">
        Basesignal is in early development. Join our Discord to:
      </p>

      <div class="flex flex-col items-center gap-3 mb-8">
        {benefits.map((benefit) => (
          <div class="flex items-center gap-3">
            <span class="text-accent">→</span>
            <span class="text-text-secondary">{benefit}</span>
          </div>
        ))}
      </div>

      <a href={discordUrl} class="btn-primary">
        Join Discord
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      </a>

      <p class="text-text-muted text-sm mt-4">
        Free. No credit card. Just early access.
      </p>
    </div>
  </div>
</section>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/EarlyAccess.astro
git commit -m "feat: update early access with discord focus"
```

---

### Task 10: Simplify Footer Component

**Files:**
- Modify: `src/components/Footer.astro`

**Step 1: Simplify Footer.astro**

Replace entire file content:

```astro
---
const timoUrl = '#'; // Placeholder
---

<footer class="py-8 border-t border-border-default">
  <div class="container-content">
    <div class="flex flex-col md:flex-row items-center justify-between gap-4">

      <!-- Logo -->
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 bg-white rounded flex items-center justify-center">
          <span class="text-black font-bold text-sm">B</span>
        </div>
        <span class="text-sm font-medium">Basesignal</span>
      </div>

      <!-- Built by -->
      <p class="text-text-muted text-sm">
        Built by <a href={timoUrl} class="text-text-secondary hover:text-text-primary transition-colors">Timo</a>
      </p>

    </div>
  </div>
</footer>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat: simplify footer"
```

---

### Task 11: Update Page Assembly

**Files:**
- Modify: `src/pages/index.astro`
- Delete: `src/components/Solution.astro`

**Step 1: Update index.astro with new component order**

Replace entire file content:

```astro
---
import Layout from '../layouts/Layout.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Reframe from '../components/Reframe.astro';
import ProductIntro from '../components/ProductIntro.astro';
import Roadmap from '../components/Roadmap.astro';
import HowItWorks from '../components/HowItWorks.astro';
import BuildingInPublic from '../components/BuildingInPublic.astro';
import Objection from '../components/Objection.astro';
import EarlyAccess from '../components/EarlyAccess.astro';
import Footer from '../components/Footer.astro';
---

<Layout
  title="Basesignal - 100 events. Zero answers."
  description="Your tracking measures clicks, not outcomes. Basesignal helps you build an outcome-driven tracking plan."
>
  <main>
    <Hero />
    <Problem />
    <Reframe />
    <ProductIntro />
    <Roadmap />
    <HowItWorks />
    <BuildingInPublic />
    <Objection />
    <EarlyAccess />
  </main>
  <Footer />
</Layout>
```

**Step 2: Delete Solution.astro**

Run: `rm src/components/Solution.astro`

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/pages/index.astro
git rm src/components/Solution.astro
git commit -m "feat: update page assembly with new section order"
```

---

### Task 12: Final Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no warnings

**Step 2: Start dev server and verify visually**

Run: `npm run dev`
Expected: All 10 sections render correctly in order

**Step 3: Final commit if any cleanup needed**

If all looks good, no commit needed.
