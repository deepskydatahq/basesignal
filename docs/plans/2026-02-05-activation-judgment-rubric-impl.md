# Activation Level Judgment Rubric - Implementation Plan

> **For Claude:** This is a documentation task. Follow tasks sequentially to create the rubric document.

**Goal:** Create a reusable judgment rubric for evaluating AI-extracted activation levels.

**Architecture:** Single markdown document with rating scale, criteria definitions, worked example, and failure modes.

**Tech Stack:** Markdown documentation only (no code changes).

---

## Background

When the AI extracts multi-level activation (weak→medium→strong→very_strong) from product content, evaluators need a consistent way to judge extraction quality. This rubric provides:

1. Three-tier rating scale (Accurate/Mostly Accurate/Inaccurate)
2. Four pass/fail criteria
3. Worked Miro example showing how to apply the rubric
4. Common failure modes to watch for

**Design doc:** `docs/plans/2026-02-05-activation-judgment-rubric-design.md`

---

## Tasks

### Task 1: Create Rubric Document Structure

**Files:**
- Create: `docs/plans/2026-02-05-activation-validation-rubric.md`

**Step 1: Create the document with header and overview**

Create file with the following content:

```markdown
# Activation Level Validation Rubric

A rubric for judging whether AI-extracted activation levels are accurate and useful.

## When to Use This Rubric

Use this rubric when manually validating activation levels extracted by the AI from product content. Each extraction should be rated before being used in the product P&L framework.

---

## Rating Scale

| Rating | Definition | Action |
|--------|------------|--------|
| **Accurate** | All 4 criteria pass | Use as-is |
| **Mostly Accurate** | 3 criteria pass, 1 partial | Use with minor edits |
| **Inaccurate** | 2+ criteria fail or partial | Re-extract or manual override |

---
```

**Step 2: Verify structure created**

Run: `head -20 docs/plans/2026-02-05-activation-validation-rubric.md`
Expected: Document header and rating scale visible

---

### Task 2: Add Evaluation Criteria

**Files:**
- Modify: `docs/plans/2026-02-05-activation-validation-rubric.md`

**Step 1: Append the four evaluation criteria**

Add to the document:

```markdown
## Evaluation Criteria

### 1. Logical Progression

Does commitment increase at each level?

| Result | Definition |
|--------|------------|
| **Pass** | Clear escalation: solo → engaged → collaborative → team |
| **Partial** | One level out of order or redundant with another |
| **Fail** | No clear progression of commitment |

### 2. Measurability

Can each level be tracked via events?

| Result | Definition |
|--------|------------|
| **Pass** | All levels have `action + count` (e.g., `board.created >= 1`) |
| **Partial** | 1-2 levels missing count or have vague action |
| **Fail** | Majority of levels are unmeasurable |

### 3. Core Value Alignment

Does primary activation (levels 2-3) reflect the product's transformation?

| Result | Definition |
|--------|------------|
| **Pass** | Primary activation clearly maps to product's value proposition |
| **Partial** | Alignment present but indirect |
| **Fail** | Primary activation misses the core value |

**How to check:** Read the product's value prop from scan data → verify levels 2-3 capture that transformation.

### 4. Evidence Grounding

Are levels derived from scan data, not invented?

| Result | Definition |
|--------|------------|
| **Pass** | All levels cite source from scan (features, pricing, onboarding) |
| **Partial** | 1-2 levels lack clear source |
| **Fail** | Levels appear invented without scan evidence |

---
```

**Step 2: Verify criteria added**

Run: `grep -c "###" docs/plans/2026-02-05-activation-validation-rubric.md`
Expected: 4 or more (one per criterion plus others)

---

### Task 3: Add Worked Example

**Files:**
- Modify: `docs/plans/2026-02-05-activation-validation-rubric.md`

**Step 1: Append the Miro worked example**

Add to the document:

```markdown
## Worked Example: Miro

### Product Context

- **Product:** Miro (visual collaboration platform)
- **Value proposition:** "Visual collaboration for teams"
- **Core transformation:** Individual thinking → team visual thinking

### Extracted Activation Levels

| Level | Name | Criteria | Evidence |
|-------|------|----------|----------|
| weak | Setup | `board.created >= 1` | Onboarding requires first board |
| medium | Exploring | `shape.added >= 5` | Canvas is core feature |
| strong | Collaborating | `collaborator.invited >= 1` | "For teams" in value prop |
| very_strong | Team Adoption | `team.members >= 3` | Pricing scales by team |

### Scoring

**1. Logical Progression: Pass**
- Levels show clear escalation: create board (solo) → add shapes (engaged) → invite collaborator (collaborative) → build team (team adoption)
- Each level requires more commitment than the previous

**2. Measurability: Pass**
- All four levels have action + count format
- Events are realistic and trackable: `board.created`, `shape.added`, `collaborator.invited`, `team.members`

**3. Core Value Alignment: Pass**
- Value prop is "visual collaboration for teams"
- Levels 2-3 (Exploring, Collaborating) capture both "visual" (shapes) and "collaboration" (invites)
- Primary activation matches the core transformation

**4. Evidence Grounding: Pass**
- weak: Onboarding flow requires board creation
- medium: Canvas/shapes are prominently featured
- strong: "For teams" appears in marketing
- very_strong: Pricing page shows team tiers

### Overall Rating: Accurate

All 4 criteria pass → use extraction as-is.

---
```

**Step 2: Verify example added**

Run: `grep "Overall Rating" docs/plans/2026-02-05-activation-validation-rubric.md`
Expected: "### Overall Rating: Accurate"

---

### Task 4: Add Common Failure Modes

**Files:**
- Modify: `docs/plans/2026-02-05-activation-validation-rubric.md`

**Step 1: Append failure modes section**

Add to the document:

```markdown
## Common Failure Modes

Watch for these patterns that indicate extraction problems:

| Failure Mode | Example | Criterion Affected |
|--------------|---------|-------------------|
| **No progression** | "Created board" and "Used board" at same commitment level | Logical Progression |
| **Unmeasurable criteria** | "Uses features regularly" (no count) | Measurability |
| **Wrong primary** | Marking level 1 (signup/setup) as primary activation | Core Value Alignment |
| **No evidence** | Levels inferred from generic SaaS patterns, not scan data | Evidence Grounding |
| **Skipped levels** | Jump from "signup" to "team adoption" with no middle | Logical Progression |
| **Vague actions** | "Engages with product" instead of specific event | Measurability |

---

## Quick Reference

**Evaluation checklist:**

- [ ] Progression: Does each level require more commitment?
- [ ] Measurability: Does each level have `action >= count`?
- [ ] Core value: Do levels 2-3 match the product's transformation?
- [ ] Evidence: Does each level cite scan data?

**Rating:**
- 4 pass = Accurate
- 3 pass + 1 partial = Mostly Accurate
- 2+ fail/partial = Inaccurate

---

*Rubric for Mission M002: Discover and model multi-level activation from product content*
*Epic M002-E004: Activation Level Validation & Refinement*
*Story M002-E004-S002: Define judgment criteria for activation level accuracy*
```

**Step 2: Verify failure modes added**

Run: `grep "Common Failure Modes" docs/plans/2026-02-05-activation-validation-rubric.md`
Expected: "## Common Failure Modes"

---

### Task 5: Verify Complete Document

**Step 1: Check document has all sections**

Run: `grep "^## " docs/plans/2026-02-05-activation-validation-rubric.md`

Expected output:
```
## When to Use This Rubric
## Rating Scale
## Evaluation Criteria
## Worked Example: Miro
## Common Failure Modes
## Quick Reference
```

**Step 2: Verify line count is reasonable**

Run: `wc -l docs/plans/2026-02-05-activation-validation-rubric.md`
Expected: ~150-180 lines

---

### Task 6: Commit

**Step 1: Stage and commit the rubric**

```bash
git add docs/plans/2026-02-05-activation-validation-rubric.md
git commit -m "docs: add activation level validation rubric

- Three-tier rating scale (Accurate/Mostly Accurate/Inaccurate)
- Four evaluation criteria with pass/partial/fail definitions
- Worked Miro example showing full scoring
- Common failure modes list
- Quick reference checklist

Story M002-E004-S002: Define judgment criteria for activation level accuracy"
```

---

## Acceptance Criteria Mapping

| Acceptance Criteria | Location in Rubric |
|--------------------|-------------------|
| Defines accurate/mostly accurate/inaccurate | Rating Scale section |
| Criterion: logical progression | Evaluation Criteria #1 |
| Criterion: measurable (action + count) | Evaluation Criteria #2 |
| Criterion: primary activation aligns with core value | Evaluation Criteria #3 |
| Criterion: evidence supports levels | Evaluation Criteria #4 |
| Documented in docs/plans/ for reuse | File location |

---

## File Summary

| File | Purpose |
|------|---------|
| `docs/plans/2026-02-05-activation-validation-rubric.md` | Reusable rubric for judging activation level accuracy |

---

## Verification

After completing all tasks:

1. Document exists at correct path
2. All six sections present
3. Miro example shows complete scoring
4. Acceptance criteria all addressed
5. Committed to git
