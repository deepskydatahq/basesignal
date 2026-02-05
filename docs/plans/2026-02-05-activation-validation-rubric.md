# Activation Level Validation Rubric

Rubric for evaluating the accuracy of extracted activation levels from product websites.

## Rating Scale

- **Accurate (10-12 points)**: Levels are logical, measurable, and primary activation correctly identifies the aha-moment
- **Mostly Accurate (6-9 points)**: Levels are reasonable but minor issues (e.g., criteria too vague, wrong primary)
- **Inaccurate (0-5 points)**: Levels don't make sense for the product or miss the core value prop

## Evaluation Criteria

### 1. Logical Progression (0-3 points)

Measures whether activation levels follow a natural progression from initial exploration to full value realization.

| Score | Description |
|-------|-------------|
| **3** | Clear progression from individual exploration → core value realization → team/habit adoption. Signal strengths follow weak → medium → strong → very_strong order. |
| **2** | Progression exists but some levels feel out of order, redundant, or signal strengths don't match the journey stage. |
| **1** | No clear progression, levels seem arbitrary or don't tell a coherent adoption story. |
| **0** | No levels extracted or only one level. |

### 2. Measurable Criteria (0-3 points)

Evaluates whether the criteria for each level are specific and trackable.

| Score | Description |
|-------|-------------|
| **3** | Each level has specific action + count criteria (e.g., `create_board >= 1`, `invite_member >= 2`). Optional timeWindow is meaningful. |
| **2** | Most levels have measurable criteria, but some are vague (e.g., "uses features", "engages with content"). |
| **1** | Criteria are mostly vague or unmeasurable (e.g., "becomes active", "shows interest"). |
| **0** | No criteria specified or criteria are completely unusable. |

**Good Criteria Examples:**
- `create_project >= 1`
- `invite_member >= 2` with `timeWindow: "first_7d"`
- `complete_workflow >= 1`
- `share_document >= 1`

**Bad Criteria Examples:**
- `use_product >= 1` (too vague)
- `engage_with_features >= 5` (not specific)
- `become_active >= 1` (not measurable)

### 3. Primary Activation Alignment (0-3 points)

Assesses whether the identified primary activation (aha-moment) matches the product's core value proposition.

| Score | Description |
|-------|-------------|
| **3** | Primary activation correctly identifies when users first experience the product's core value. Matches expected aha-moment for the product archetype. |
| **2** | Primary activation is close but slightly off (e.g., identifies collaboration but at wrong level, or misses key action). |
| **1** | Primary activation misses the core value proposition entirely (e.g., identifies signup as aha-moment for a collaboration tool). |
| **0** | No primary activation identified. |

**Expected Aha-Moments by Product Archetype:**

| Archetype | Expected Primary Activation |
|-----------|----------------------------|
| **Collaboration** (Miro, Notion, Google Docs) | Sharing + someone accessing/editing |
| **Productivity** (Linear, Asana, Todoist) | First task/issue completed through workflow |
| **Design** (Figma, Canva) | Design shared + feedback received |
| **Developer** (GitHub, Vercel, Netlify) | First deployment or successful integration |
| **Communication** (Slack, Discord) | Team conversation replaces existing channel |

### 4. Evidence Quality (0-3 points)

Evaluates the supporting evidence provided for each activation level.

| Score | Description |
|-------|-------------|
| **3** | Evidence excerpts directly support each level. Average 1.5+ evidence items per level from onboarding docs, help content, or case studies. |
| **2** | Some evidence is relevant, some is weak. Average 0.5-1.5 evidence items per level. |
| **1** | Evidence doesn't clearly support the inferred levels, or < 0.5 evidence items per level. |
| **0** | No evidence provided. |

## Total Score Interpretation

| Total | Rating | Meaning |
|-------|--------|---------|
| **10-12** | Accurate | Ready for production use. Minor polish may improve but fundamentals are correct. |
| **6-9** | Mostly Accurate | Usable with caveats. Review specific weak areas and consider prompt refinements. |
| **0-5** | Inaccurate | Not usable. Requires significant prompt engineering or additional data sources. |

## Test Product Set

| Product | URL | Archetype | Expected Aha-Moment |
|---------|-----|-----------|---------------------|
| Miro | miro.com | Collaboration | Board shared + collaborator accesses it |
| Linear | linear.app | Productivity | First issue tracked through completion |
| Figma | figma.com | Design | Design shared + feedback received |

## Success Criteria

**Minimum for production:**
- 70%+ of products score Accurate (10-12) or Mostly Accurate (6-9)
- No product scores 0 points in any single criterion
- Average total score ≥ 8

## Running the Validation

1. **Scan Products**: Create and scan each test product using the app UI
2. **Extract Activation**: Run `extractActivationLevels` via Convex dashboard
3. **Score Results**: Run `npx tsx scripts/test-activation-accuracy.ts`
4. **Document Findings**: Record scores and observations below

## Validation Results

**Status**: Implementation complete, ready for live testing.

To run validation:
1. Ensure VITE_CONVEX_URL and ANTHROPIC_API_KEY are set
2. Create test products via app UI (Miro, Linear, Figma)
3. Run scan pipeline for each
4. In Convex dashboard, invoke `extractActivationLevels` internal action
5. Score results using `npx tsx scripts/test-activation-accuracy.ts`

### Initial Implementation (with Refinements)

The extractor was built with all refinements from M002-E004-S004 already incorporated.
Validation should start from this refined state - there is no "pre-refinement" baseline.

| Product | Progression | Criteria | Primary | Evidence | Total | Rating |
|---------|-------------|----------|---------|----------|-------|--------|
| Miro | Pending | Pending | Pending | Pending | - | - |
| Linear | Pending | Pending | Pending | Pending | - | - |
| Figma | Pending | Pending | Pending | Pending | - | - |

### Post-Testing Refinements (if needed)

| Product | Progression | Criteria | Primary | Evidence | Total | Rating |
|---------|-------------|----------|---------|----------|-------|--------|
| TBD | - | - | - | - | - | - |

## Identified Refinements

Refinements applied based on M002-E004-S004 story guidance:

### Prompt Improvements

1. **Product archetype examples**: Added specific aha-moment examples for collaboration (Miro, Figma, Notion), productivity (Linear, Asana), developer (GitHub, Vercel), and communication (Slack, Discord) tools.

2. **Measurable criteria format**: Prompt now requires specific action + count format with explicit good/bad examples:
   - Good: `{"action": "create_project", "count": 1}`
   - Bad: `{"action": "use_product", "count": 1}` - marked as too vague

3. **Signal strength definitions**: Clear mapping from weak (exploration) → medium (learning) → strong (value realized) → very_strong (team adoption).

4. **Evidence quality guidance**: Prompt specifies preference for help docs and case studies over marketing copy, with confidence adjustments.

5. **Confidence scoring bands**: Explicit ranges (0.8-1.0 for explicit docs, 0.6-0.8 for feature pages, etc.)

### Page Filtering Improvements

1. **Priority ordering**: Changed from simple filter to prioritized sort:
   - onboarding (highest) > help > customers > features > homepage (lowest)

2. **Activation-relevant page types**: Included onboarding, help, customers, features, homepage - excluding pricing/legal/other.

### Other Improvements

1. **Product identity context**: Extraction uses existing identity (name, description, target customer) to inform value prop identification.

2. **Schema-compatible output**: Converts multi-level data to schema format while preserving full levels array for future use.

3. **Comprehensive validation**: Parser validates signal strength, level numbers, criteria format, and primaryActivation references.
