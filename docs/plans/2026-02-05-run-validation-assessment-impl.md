# Run Validation Assessment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evaluate extracted activation levels for test products (Miro, Linear, Figma) against the judgment rubric and document results achieving ≥70% pass rate.

**Architecture:** Manual validation workflow using rubric from S002. Access activation levels from database, apply 4-criterion rubric, aggregate patterns and failure modes, document in markdown report.

**Tech Stack:** Convex database queries, markdown documentation

---

## Context

This task executes the validation assessment for story M002-E004-S003. The acceptance criteria are primarily **manual** tasks:

- [manual] Each test product has a completed rubric assessment
- [manual] Assessment documents specific observations per product
- [manual] Common patterns across products are identified
- [manual] Failure modes are documented (what doesn't work)
- [manual] At least 70% of products score 6+ points (mostly accurate or better)
- [integration] Results documented in `docs/plans/2026-02-05-activation-validation-results.md`

## Dependencies

- **S001 (Test Product Set)**: Status `in_progress` - needs Miro, Linear, Figma scanned with activation levels
- **S002 (Judgment Rubric)**: Status `in_progress` - rubric design complete in `docs/plans/2026-02-05-activation-judgment-rubric-design.md`

## Rubric Reference

From `docs/plans/2026-02-05-activation-judgment-rubric-design.md`:

| Criterion | Pass | Partial | Fail |
|-----------|------|---------|------|
| **Logical Progression** | Clear solo → engaged → collaborative → team | One level out of order/redundant | No clear progression |
| **Measurability** | All levels have action + count | 1-2 levels vague | Majority unmeasurable |
| **Core Value Alignment** | Primary activation = product's core transformation | Alignment indirect | Primary misses core value |
| **Evidence Grounding** | All levels cite scan source | 1-2 levels lack source | Levels appear invented |

**Scoring:**
- 3 points: Pass
- 1.5 points: Partial
- 0 points: Fail
- **Total: 12 points max**
- ≥6 points = "Mostly Accurate" or better (passing)

**Expected Reference Aha-Moments:**
- Miro: Board shared + collaborator accesses
- Linear: First issue tracked through completion
- Figma: Design shared + feedback received

---

## Tasks

### Task 1: Verify Test Product Data Availability

**Purpose:** Confirm S001 test products exist with activation levels before proceeding with assessment.

**Step 1: Check for existing test products in database**

Run via Convex dashboard or script:
```bash
# Check if Miro, Linear, Figma products exist with profiles
node -e "
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('./convex/_generated/api.js');
const client = new ConvexHttpClient('https://<your-deployment>.convex.cloud');

async function check() {
  const user = await client.mutation(api.users.getOrCreateByClerkId, {
    clerkId: 'user_dev_test', email: 'test@example.com', name: 'Test User'
  });
  const products = await client.query(api.mcpProducts.list, { userId: user._id });
  console.log('Products:', products.map(p => p.name + ': ' + p.url).join(', '));
}
check();
"
```

**Step 2: Document data availability**

If test products don't have activation levels populated, document this as a finding in the results file and proceed with mock/expected data from the validation design doc.

**Expected:** At least 3 products found (Miro, Linear, Figma)

---

### Task 2: Create Results Document Structure

**Files:**
- Create: `docs/plans/2026-02-05-activation-validation-results.md`

**Step 1: Create results document with header and structure**

```markdown
# Activation Level Validation Results

**Date:** 2026-02-05
**Story:** M002-E004-S003 - Run validation assessment on test product activation levels
**Epic:** M002-E004 - Activation Level Validation & Refinement

## Summary

| Product | Archetype | Score | Rating | Pass? |
|---------|-----------|-------|--------|-------|
| Miro | Collaboration | TBD | TBD | TBD |
| Linear | Project Management | TBD | TBD | TBD |
| Figma | Design Tool | TBD | TBD | TBD |

**Overall Pass Rate:** TBD (target: ≥70%)

---

## Individual Assessments

### Miro

**Product Context:**
- URL: https://miro.com
- Archetype: Collaboration/Whiteboard
- Core Value: Visual collaboration for teams
- Expected Aha-Moment: Board shared + collaborator accesses

**Extracted Activation Levels:**

| Level | Name | Signal | Criteria | Evidence |
|-------|------|--------|----------|----------|
| 1 | TBD | weak | TBD | TBD |
| 2 | TBD | medium | TBD | TBD |
| 3 | TBD | strong | TBD | TBD |
| 4 | TBD | very_strong | TBD | TBD |

**Primary Activation:** Level TBD

**Rubric Assessment:**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Logical Progression | TBD/3 | TBD |
| Measurability | TBD/3 | TBD |
| Core Value Alignment | TBD/3 | TBD |
| Evidence Grounding | TBD/3 | TBD |

**Total Score:** TBD/12
**Rating:** TBD
**Observations:** TBD

---

### Linear

**Product Context:**
- URL: https://linear.app
- Archetype: Project Management
- Core Value: Streamline software project tracking
- Expected Aha-Moment: First issue tracked through completion

**Extracted Activation Levels:**

| Level | Name | Signal | Criteria | Evidence |
|-------|------|--------|----------|----------|
| 1 | TBD | weak | TBD | TBD |
| 2 | TBD | medium | TBD | TBD |
| 3 | TBD | strong | TBD | TBD |
| 4 | TBD | very_strong | TBD | TBD |

**Primary Activation:** Level TBD

**Rubric Assessment:**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Logical Progression | TBD/3 | TBD |
| Measurability | TBD/3 | TBD |
| Core Value Alignment | TBD/3 | TBD |
| Evidence Grounding | TBD/3 | TBD |

**Total Score:** TBD/12
**Rating:** TBD
**Observations:** TBD

---

### Figma

**Product Context:**
- URL: https://figma.com
- Archetype: Design Tool
- Core Value: Collaborative design platform
- Expected Aha-Moment: Design shared + feedback received

**Extracted Activation Levels:**

| Level | Name | Signal | Criteria | Evidence |
|-------|------|--------|----------|----------|
| 1 | TBD | weak | TBD | TBD |
| 2 | TBD | medium | TBD | TBD |
| 3 | TBD | strong | TBD | TBD |
| 4 | TBD | very_strong | TBD | TBD |

**Primary Activation:** Level TBD

**Rubric Assessment:**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Logical Progression | TBD/3 | TBD |
| Measurability | TBD/3 | TBD |
| Core Value Alignment | TBD/3 | TBD |
| Evidence Grounding | TBD/3 | TBD |

**Total Score:** TBD/12
**Rating:** TBD
**Observations:** TBD

---

## Cross-Product Analysis

### Common Patterns

1. TBD

### Failure Modes

1. TBD

### Recommendations for Refinement (S004)

1. TBD

---

## Conclusion

**Pass Rate:** TBD/3 products (TBD%)
**Target:** ≥70% (at least 2/3 products scoring 6+ points)
**Result:** TBD

---
*Assessment completed: 2026-02-05*
*Rubric: docs/plans/2026-02-05-activation-judgment-rubric-design.md*
```

**Step 2: Commit document structure**

```bash
git add docs/plans/2026-02-05-activation-validation-results.md
git commit -m "docs: create activation validation results template

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Retrieve Activation Levels for Each Product

**Purpose:** Get the actual or expected activation levels for each test product.

**Step 1: Check database for activation levels**

For each product (Miro, Linear, Figma), query the productProfiles table:

```javascript
// Query via Convex dashboard or script
const profile = await db.query("productProfiles")
  .withIndex("by_product", q => q.eq("productId", productId))
  .first();

// Check for activation data at either location:
// - profile.definitions?.activation?.levels (new schema)
// - profile.activation?.levels (alternative location)
console.log("Activation:", profile?.definitions?.activation);
```

**Step 2: If data unavailable, use expected mock data**

From `docs/plans/2026-02-05-activation-validation-design.md`, use the TEST_PRODUCTS configuration as the baseline for assessment:

**Miro Expected:**
```
L1: explorer (weak) - create_board >= 1
L2: creator (medium) - create_board >= 2, add_content >= 5
L3: collaborator (strong) - share_board >= 1, collaborator_joins >= 1
L4: team (very_strong) - co_editing_session >= 1
Primary: 3
```

**Linear Expected:**
```
L1: reporter (weak) - create_issue >= 1
L2: contributor (medium) - create_issue >= 3, move_issue_state >= 1
L3: collaborator (strong) - assign_teammate >= 1, teammate_action >= 1
L4: team_rhythm (very_strong) - sprint_complete >= 1
Primary: 3
```

**Figma Expected:**
```
L1: designer (weak) - create_file >= 1
L2: builder (medium) - create_frame >= 5, use_component >= 1
L3: collaborator (strong) - share_file >= 1, receive_comment >= 1
L4: team_design (very_strong) - multiplayer_session >= 1
Primary: 3
```

**Step 3: Document which data source was used**

Note in each product assessment whether data came from:
- Real extraction (database)
- Mock/expected data (from design doc)

---

### Task 4: Assess Miro Against Rubric

**Step 1: Fill in Miro's activation levels in results doc**

Copy activation level data into the Miro section table.

**Step 2: Score Logical Progression (0-3)**

Evaluate: Does the progression follow solo → engaged → collaborative → team?

- explorer (create board) → creator (more boards, content) → collaborator (share + join) → team (co-editing)
- This is clear escalation from individual to collaborative

**Step 3: Score Measurability (0-3)**

Evaluate: Does each level have action + count?

- L1: `create_board >= 1` ✓
- L2: `create_board >= 2, add_content >= 5` ✓
- L3: `share_board >= 1, collaborator_joins >= 1` ✓
- L4: `co_editing_session >= 1` ✓

**Step 4: Score Core Value Alignment (0-3)**

Evaluate: Does primary activation (L3) match Miro's core value?

- Miro's value: "Visual collaboration for teams"
- L3 (collaborator): share_board + collaborator_joins = collaboration begins
- Expected aha-moment: Board shared + collaborator accesses
- This is a direct match

**Step 5: Score Evidence Grounding (0-3)**

Evaluate: Can each level cite scan data source?

- Depends on whether real extraction was used
- If using mock data, score partial (1.5) - mock data implies source but doesn't cite

**Step 6: Calculate total and rating**

- Sum scores
- Apply rating scale:
  - 10-12: Accurate
  - 6-9: Mostly Accurate
  - 0-5: Inaccurate

**Step 7: Document observations**

What worked well? What could be improved?

---

### Task 5: Assess Linear Against Rubric

Same process as Task 4, applied to Linear:

**Step 1: Fill in Linear's activation levels**

**Step 2: Score Logical Progression**
- reporter → contributor → collaborator → team_rhythm
- Solo issue → multiple issues with state changes → team assignment → sprint completion
- Clear escalation

**Step 3: Score Measurability**
- All criteria have action + count format

**Step 4: Score Core Value Alignment**
- Linear's value: Streamline software project tracking
- L3 (collaborator): team assignment + action
- Expected aha-moment: First issue tracked through completion
- Note: L3 focuses on collaboration, but Linear's aha may be completing an issue (L2?)

**Step 5: Score Evidence Grounding**
- Check for source citations

**Step 6: Calculate total and rating**

**Step 7: Document observations**

---

### Task 6: Assess Figma Against Rubric

Same process as Task 4, applied to Figma:

**Step 1: Fill in Figma's activation levels**

**Step 2: Score Logical Progression**
- designer → builder → collaborator → team_design
- Create file → frames + components → share + feedback → multiplayer
- Clear escalation

**Step 3: Score Measurability**
- All criteria have action + count format

**Step 4: Score Core Value Alignment**
- Figma's value: Collaborative design platform
- L3 (collaborator): share_file + receive_comment = feedback received
- Expected aha-moment: Design shared + feedback received
- Direct match

**Step 5: Score Evidence Grounding**
- Check for source citations

**Step 6: Calculate total and rating**

**Step 7: Document observations**

---

### Task 7: Analyze Cross-Product Patterns

**Step 1: Identify common patterns**

Look across all 3 assessments for:
- What scoring patterns recur?
- What do high-scoring products have in common?
- What level naming/structure works consistently?

Likely patterns:
1. All products have L3 as primary (collaboration = core value)
2. Progression follows individual → solo engagement → collaboration → team habit
3. Action names are product-specific but follow `verb_noun` format

**Step 2: Document failure modes**

What doesn't work:
1. Evidence grounding weak when using mock data (no real citations)
2. Primary activation might be L2 for Linear (task completion vs collaboration)
3. timeWindow not consistently used in criteria

**Step 3: Write recommendations for S004**

Based on patterns and failures:
1. If evidence scores low: Improve source citation in extraction prompt
2. If primary activation misaligned: Add product-type heuristics to prompt
3. If measurability issues: Enforce stricter action + count validation

---

### Task 8: Calculate Pass Rate and Finalize

**Step 1: Update summary table**

Fill in the Summary table at top of results doc:

| Product | Score | Rating | Pass? |
|---------|-------|--------|-------|
| Miro | X/12 | X | Yes/No |
| Linear | X/12 | X | Yes/No |
| Figma | X/12 | X | Yes/No |

**Step 2: Calculate pass rate**

- Count products with score ≥ 6 points
- Pass rate = (passing products) / 3
- Target: ≥ 70% (at least 2/3)

**Step 3: Write conclusion**

State whether the 70% target was met and overall assessment quality.

**Step 4: Commit final results**

```bash
git add docs/plans/2026-02-05-activation-validation-results.md
git commit -m "docs: complete activation validation assessment for M002-E004-S003

Assessed Miro, Linear, Figma against judgment rubric.
Pass rate: X% (target: ≥70%)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Close Task

**Step 1: Update Beads task**

```bash
bd update basesignal-z32 --remove-label plan --add-label ready --status open
```

After implementation:
```bash
bd close basesignal-z32
```

---

## Notes

### Data Source Contingency

If S001 (test product set) is not complete:
- Use mock activation data from `docs/plans/2026-02-05-activation-validation-design.md`
- Document this in results as "mock data assessment"
- Score evidence grounding as "partial" (1.5/3) since mock implies but doesn't cite sources

### Scoring Consistency

Apply these rules consistently:
- **Pass (3)**: Criterion fully met, no issues
- **Partial (1.5)**: Minor issues, mostly met
- **Fail (0)**: Criterion not met

### What This Plan Does NOT Include

- Automated validation scripts (this is manual assessment)
- Schema changes (already designed in separate stories)
- Extraction improvements (that's S004)
