# Activation Level Validation Rubric

**Story:** M002-E004-S002 — Define judgment criteria for activation level accuracy
**Epic:** M002-E004 — Activation Level Validation & Refinement
**Mission:** M002 — Discover and model multi-level activation from product content

## Purpose

This rubric defines how to judge whether AI-extracted activation levels are accurate and useful. It is used by both human reviewers and AI judges (agent-judgment) when validating extraction results across products.

---

## Rating Scale

| Rating | Score | Definition |
|--------|-------|------------|
| **Accurate** | 10–12 points | Levels are logical, measurable, and primary activation correctly identifies the product's aha-moment. Ready for use in measurement recommendations. |
| **Mostly Accurate** | 6–9 points | Levels are reasonable but have minor issues — e.g., one criterion is vague, progression has a gap, or primary activation is close but slightly off. Usable with minor edits. |
| **Inaccurate** | 0–5 points | Levels don't make sense for the product, miss the core value proposition, or lack measurable criteria. Requires re-extraction or significant manual correction. |

---

## Evaluation Criteria

### 1. Logical Progression (0–3 points)

Levels should show a clear progression from weak to strong activation signals, reflecting increasing user investment and value realization.

| Score | Description |
|-------|-------------|
| **3** | Clear progression from individual exploration → core value realization → team/habit adoption. Each level represents a meaningfully distinct stage. |
| **2** | Progression exists but some levels feel out of order, redundant, or the gap between adjacent levels is unclear. |
| **1** | No clear progression. Levels seem arbitrary or don't reflect increasing engagement depth. |
| **0** | Levels are random or inversely ordered. |

**What to look for:**
- L1 should represent the earliest meaningful action (individual, exploratory)
- Middle levels should reflect increasing depth or breadth of usage
- Highest level should represent the product's deepest value (often team/collaborative or habitual)
- Each level should be clearly distinguishable from the previous one

### 2. Measurable Criteria (0–3 points)

Each activation level must have criteria defined as **action + count** (with optional timeWindow), so they can be measured from analytics data.

| Score | Description |
|-------|-------------|
| **3** | Every level has specific criteria: action + count + optional timeWindow. Example: "Create board (count ≥ 3, timeWindow: 7d)". |
| **2** | Most levels have measurable criteria but one or two are vague. Example: "Uses collaboration features" without specifying which action or count. |
| **1** | Criteria are mostly vague or unmeasurable. Example: "Engages with the product regularly". |
| **0** | No measurable criteria provided. |

**What to look for:**
- Each criterion names a specific action (verb + noun): "create board", "invite member", "complete task"
- Each criterion has a count threshold: ≥ 1, ≥ 3, ≥ 5
- timeWindow is used where frequency matters (e.g., "within 7 days" vs "ever")
- Criteria are trackable via product analytics events

### 3. Primary Activation Alignment (0–3 points)

The level marked as "primary activation" should correctly identify the product's aha-moment — the point where users first experience the core value proposition.

| Score | Description |
|-------|-------------|
| **3** | Primary activation correctly identifies the aha-moment. For Miro, this is "share board + collaborator accesses it" (collaboration = core value). |
| **2** | Primary activation is close but slightly off — it captures a related behavior but not the precise moment of core value realization. |
| **1** | Primary activation misses the core value proposition entirely — it identifies a generic action rather than the unique value this product provides. |
| **0** | No primary activation identified, or it contradicts the product's value proposition. |

**What to look for:**
- The primary activation should reflect what makes THIS product uniquely valuable (not generic SaaS onboarding)
- It should match known aha-moments for the product category
- It typically falls at L2 or L3 (not L1 which is too early, not L4 which is advanced)

### 4. Evidence Quality (0–3 points)

Evidence excerpts from crawled content should directly support each inferred activation level.

| Score | Description |
|-------|-------------|
| **3** | Evidence excerpts directly support each level. Sources include pricing pages, feature descriptions, onboarding docs, or case studies that mention the specific behaviors. |
| **2** | Some evidence is relevant but some levels are inferred with weak or tangential support. |
| **1** | Evidence doesn't meaningfully support the inferred levels. Levels appear to be guessed rather than derived from content. |
| **0** | No evidence provided, or evidence contradicts the levels. |

**What to look for:**
- Each level should cite specific pages or excerpts from the crawled content
- Evidence should mention the behaviors that define the activation criteria
- Higher confidence scores should correlate with stronger evidence
- Levels without evidence should have lower confidence

---

## Scoring Summary

| Criterion | Max Points |
|-----------|-----------|
| Logical Progression | 3 |
| Measurable Criteria | 3 |
| Primary Activation Alignment | 3 |
| Evidence Quality | 3 |
| **Total** | **12** |

**Rating thresholds:**
- **Accurate:** 10–12 points
- **Mostly Accurate:** 6–9 points
- **Inaccurate:** 0–5 points

---

## Worked Example: Miro

### Extracted Activation Levels

| Level | Name | Signal Strength | Criteria |
|-------|------|----------------|----------|
| L1 | Individual Explorer | weak | Create board (count ≥ 1) |
| L2 | Active Creator | medium | Create board (count ≥ 3, timeWindow: 7d) + Use template (count ≥ 1) |
| L3 | Collaborative Value | strong | Share board (count ≥ 1) + Collaborator accesses board (count ≥ 1) |
| L4 | Team Adoption | very strong | Multiple collaborators editing (count ≥ 3) + Boards shared across team (count ≥ 2, timeWindow: 14d) |

**Primary Activation:** L3 (Collaborative Value)

### Scoring

**1. Logical Progression: 3/3**
- L1 (individual exploration) → L2 (deeper individual usage) → L3 (collaboration, core value) → L4 (team adoption)
- Each level is clearly distinguishable and represents increasing investment
- Progression matches Miro's user journey from solo whiteboarding to team collaboration

**2. Measurable Criteria: 3/3**
- Every level specifies action + count
- L2 and L4 include timeWindow for frequency-based criteria
- All actions are trackable: "create board", "use template", "share board", "collaborator accesses board"

**3. Primary Activation Alignment: 3/3**
- L3 correctly identifies Miro's aha-moment: collaboration
- Miro's core value is real-time visual collaboration — a board shared and accessed by a collaborator is precisely when this value is realized
- Not too early (L1/L2 are individual actions) and not too late (L4 is advanced team behavior)

**4. Evidence Quality: 3/3**
- Miro's marketing pages emphasize "online collaborative whiteboard platform"
- Pricing tiers mention team features and collaboration limits
- Case studies describe team adoption patterns matching L3 → L4 progression
- Feature pages detail board sharing, real-time editing, and template usage

**Total: 12/12 — Accurate**

---

## Common Failure Modes

| Failure Mode | Symptom | Example | Fix |
|-------------|---------|---------|-----|
| **Generic levels** | Levels apply to any SaaS, not this specific product | L1: "Sign up", L2: "Use a feature", L3: "Invite someone" | Levels should reference product-specific actions (e.g., "create board" not "use a feature") |
| **Missing aha-moment** | Primary activation is set to L1 (signup) or L4 (advanced) | Primary = "Create account" for Miro | Primary should capture core value realization, typically L2 or L3 |
| **Unmeasurable criteria** | Criteria use subjective language | "Finds value in the product", "Regularly engages" | Replace with action + count: "Create board (count ≥ 3, timeWindow: 7d)" |
| **Redundant levels** | Two levels describe essentially the same behavior | L2: "Create 2 boards" vs L3: "Create 3 boards" | Levels should differ in kind (not just count) — e.g., solo use vs collaborative use |
| **Wrong progression** | Collaborative action placed before solo exploration | L1: "Share board", L2: "Create board" | Reorder so individual actions precede social/collaborative ones |
| **Weak evidence** | High confidence scores but levels cite irrelevant pages | Confidence 0.9 but evidence is from legal/privacy pages | Evidence should come from feature pages, pricing, onboarding, or case studies |
| **Category mismatch** | Activation pattern doesn't match product type | Sales-led CRM scored like PLG collaboration tool | Consider the product's go-to-market: PLG → individual trial path; sales-led → admin setup path |

---

## Known Product Aha-Moments (Reference)

Use these when validating primary activation alignment:

| Product | Aha-Moment | Why |
|---------|-----------|-----|
| **Miro** | Board shared + collaborator accesses it | Core value = real-time visual collaboration |
| **Linear** | First issue tracked through completion | Core value = fast, structured project management |
| **Figma** | Design shared + feedback received | Core value = collaborative design with live feedback |
| **Slack** | Team communication replaces email | Core value = real-time team messaging |
| **Notion** | Workspace used by team for shared knowledge | Core value = collaborative knowledge management |
| **HubSpot** | First contact tracked through pipeline stage | Core value = CRM pipeline visibility |

---

## Usage

This rubric is used in the following contexts:

1. **Agent-judgment validation** — AI judges score extraction results using these criteria during automated testing (M002-E004 epic)
2. **Manual review** — Human reviewers use the rating scale when spot-checking results
3. **Prompt refinement** — Low scores on specific criteria guide improvements to the extraction prompts
4. **Regression testing** — Re-run validation after prompt changes to ensure scores don't decrease
