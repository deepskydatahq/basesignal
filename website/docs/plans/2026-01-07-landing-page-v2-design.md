# Basesignal Landing Page V2 - Design Document

> **For Claude:** Use this design to update the existing landing page components.

**Goal:** Update landing page messaging to focus on outcome-driven vs interaction-driven tracking belief chain.

**Key change:** New messaging structure that walks visitors through a belief progression from "we track lots but can't answer questions" to "outcomes are what matter" to "join early access".

---

## Page Structure (10 sections)

1. Hero
2. Problem (validation)
3. Reframe (new)
4. ProductIntro (new)
5. Roadmap (new)
6. HowItWorks
7. BuildingInPublic
8. Objection (new)
9. EarlyAccess
10. Footer

---

## Section 1: Hero

**File:** `src/components/Hero.astro` (update)

**Content:**
- Header: Centered logo (unchanged)
- Headline: "100 events. Zero answers."
- Subheadline: "Your tracking plan measures clicks, pageviews, and button taps. But can you answer: 'Are users succeeding in our product?'"
- Follow-up: "Probably not. Because interactions don't measure outcomes."
- CTA: "Join Early Access" → Discord link
- Remove: YouTube button, product mockup placeholder

---

## Section 2: Problem Validation

**File:** `src/components/Problem.astro` (update)

**Content:**
- Header: "The problem with interaction-driven tracking"
- Lead-in: "Your tracking plan probably looks like this:"
- Code block with monospace events:
  - button_clicked
  - page_viewed
  - form_submitted
  - feature_used
  - signup_completed
- Explanation: "These tell you WHAT users did. They don't tell you WHETHER users succeeded."
- Closing: "You can have perfect tracking of every click and still have no idea if your product is actually working."

**Visual:** Code block styled with bg-bg-elevated, monospace font

---

## Section 3: Reframe

**File:** `src/components/Reframe.astro` (new)

**Content:**
- Header: "What if you measured outcomes instead?"
- Lead-in: "An outcome isn't a click. It's a result—the thing you want users to achieve."
- Comparison table:
  | Interaction (what you track now) | Outcome (what you should measure) |
  |----------------------------------|-----------------------------------|
  | completed_signup | User successfully onboarded and ready to use |
  | used_feature | User got value from core feature |
  | logged_in | User is on track to become retained |
- Closing: "When you define outcomes first, you can finally answer: 'Is our product helping users succeed?'" (accent color)

**Visual:** Table with left column muted/monospace, right column readable

---

## Section 4: ProductIntro

**File:** `src/components/ProductIntro.astro` (new)

**Content:**
- Header: "Build your outcome-driven tracking plan"
- Lead-in: "Basesignal helps you move from tracking interactions to measuring outcomes:"
- Three bullets with arrows:
  - Map user journeys from first touch to success
  - Define what outcomes matter at each stage
  - Create product metrics that measure real performance
- Screenshot placeholder with glow effect

---

## Section 5: Roadmap

**File:** `src/components/Roadmap.astro` (new)

**Content:**
- Header: "Where we're headed"
- Lead-in: "Basesignal is being built in three phases. Join early access to shape the product with us."
- Three phase cards:

**Phase 1 (highlighted, accent border, NOW badge):**
- Title: "Define Outcomes"
- Description: "Map your user journey. Define what success looks like at each stage. Create an outcome-driven tracking plan that tells you what to measure."
- Screenshot placeholder

**Phase 2 (dimmed, NEXT badge):**
- Title: "Product Performance Metrics"
- Description: "See how your product performs across the user journey. Understand conversion between stages. Identify where you're losing revenue potential."
- Screenshot placeholder

**Phase 3 (dimmed, FUTURE badge):**
- Title: "Feature & Segment Intelligence"
- Description: "Connect outcomes to features and user segments. Discover which features drive the most value. Identify which micro-segments generate the most revenue potential."
- Screenshot placeholder

---

## Section 6: HowItWorks

**File:** `src/components/HowItWorks.astro` (update)

**Content:**
- Header: "How it works"
- Three numbered steps:

**Step 1: Define your outcomes**
"What does user success look like at each stage? Map the journey from first visit to loyal user."

**Step 2: Identify the signals**
"What events or behaviors indicate an outcome was achieved? Now you know what to actually track."

**Step 3: Measure what matters**
"Create product metrics tied to real outcomes—not vanity metrics tied to clicks."

**Visual:** Numbered circles with accent background

---

## Section 7: BuildingInPublic

**File:** `src/components/BuildingInPublic.astro` (simplify)

**Content:**
- Header: "Building in public"
- Text: "Follow along as I build Basesignal from scratch."
- Inline links: YouTube, Discord (with icons)

**Visual:** Compact, centered, subtle

---

## Section 8: Objection

**File:** `src/components/Objection.astro` (new)

**Content:**
- Quote: "But I need to fix my tracking first..."
- Response: "You don't need better tracking. You need to know what to track."
- Follow-up: "When you start with outcomes, the right events become obvious. The noise falls away. You stop debating tools and start measuring what matters."

**Visual:** Quote in italic/muted, no section header

---

## Section 9: EarlyAccess

**File:** `src/components/EarlyAccess.astro` (update)

**Content:**
- Header: "Join the early access"
- Lead-in: "Basesignal is in early development. Join our Discord to:"
- Three benefits with arrows:
  - Get early access to the tool
  - Shape the product roadmap
  - Connect with other product analytics folks
- CTA: "Join Discord" button with Discord icon
- Subtext: "Free. No credit card. Just early access."

---

## Section 10: Footer

**File:** `src/components/Footer.astro` (simplify)

**Content:**
- Logo (small)
- "Built by Timo" with link

**Visual:** Minimal, border-top

---

## Files to Remove

- `src/components/Solution.astro`

---

## Style Notes

- Keep existing dark theme, blue accent, typography
- No style changes, only content/structure changes
