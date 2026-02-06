# Activation Extraction Refinement Design

## Overview

Design a refinement protocol for activation level extraction that enables iterative improvement based on validation findings. Start simple, add infrastructure only when patterns emerge from real data.

## Problem Statement

Activation level extraction needs to achieve 70%+ accuracy. When extraction fails, we need a systematic way to diagnose issues, apply targeted fixes, and measure improvement - without building speculative infrastructure.

## Expert Perspectives

### Product
Product leaders need a repeatable process, not multiple frameworks. The protocol should answer: "if this fails, we do this, measure this, and know in 2 hours whether it worked." Focus on transformation of raw extraction into reliable data, not on tools for managing refinements.

### Technical
Separate configuration from code so we can iterate on extraction logic without touching implementation. Treat extraction like a data pipeline where config is the experiment variable and code is stable infrastructure.

### Simplification Review

**Verdict: SIMPLIFY**

Cuts applied:
- Removed separate config file with versioning ceremony - use git history instead
- Removed ValidationResults format with separate markdown file - use database
- Removed changelog fields in config objects - changelogs belong in git
- Removed 4-step formal protocol - describe what actually happens

The original design built infrastructure for experimentation not yet done. Start minimal: update prompts inline, test, commit when stable.

## Proposed Solution

### Approach: Inline Refinement with Git History

Instead of a config management system, use what already exists:
1. **Config location:** Keep prompt and filter settings inline in `extractActivationLevels.ts`
2. **Version control:** Git commits track what changed and why
3. **Validation storage:** Database alongside product profiles (queryable)
4. **Measurement:** Compare extraction results before/after in test script

### Refinement Workflow

**When extraction fails:**
1. Run extraction on test products
2. Identify specific failure pattern (prompt issue vs. filtering issue vs. data issue)
3. Edit the relevant constant or function in `extractActivationLevels.ts`
4. Re-run on same products
5. If accuracy improves, commit with message explaining the refinement
6. If still < 70%, repeat from step 2

**Failure categories and fixes:**

| Failure Type | Symptom | Fix Location |
|-------------|---------|--------------|
| Primary activation misidentified | Wrong aha-moment selected | `ACTIVATION_SYSTEM_PROMPT` - add product archetype examples |
| Criteria not measurable | Vague criteria like "engaged" | `ACTIVATION_SYSTEM_PROMPT` - enforce action + count format |
| Weak higher-level evidence | Levels 2-3 unconvincing | `filterActivationPages` - prioritize help docs, case studies |
| Missing activation data | Very low confidence | Data source issue - may need better crawl coverage |

### File Structure

```
convex/analysis/
  extractActivationLevels.ts   # Main extraction with inline config
  extractActivationLevels.test.ts  # Tests including accuracy checks

scripts/
  test-activation-accuracy.mjs  # Runs extraction on sample products, reports accuracy
```

### Key Constants (in extractActivationLevels.ts)

```typescript
// Page types to include for activation analysis
const ACTIVATION_PAGE_TYPES = [
  "pricing",
  "features",
  "signup",
  "help",        // Good for level criteria
  "case-study",  // Good for higher-level evidence
];

// System prompt - update inline, commit changes with rationale
const ACTIVATION_SYSTEM_PROMPT = `You are analyzing a product to identify activation levels...

IMPORTANT: Each criterion MUST include:
- Specific action verb (created, shared, invited, completed)
- Count or threshold (1 project, 3 team members, 5 workflows)
- Optional time window (within 7 days, per week)

Product archetype examples:
- Collaboration tool: sharing → engagement → team adoption
- Productivity tool: setup → first workflow → habit formation
- Creative tool: first creation → sharing → feedback received
...`;
```

### Measuring Accuracy

Create a test script that:
1. Runs extraction on 10-20 sample products
2. Compares output against expected results (manual or from validation file)
3. Reports accuracy percentage
4. Identifies which products failed and why

```bash
# Run accuracy check
node scripts/test-activation-accuracy.mjs

# Output example:
# Accuracy: 65% (13/20 products)
# Failures:
# - Product A: Primary activation misidentified (prompt issue)
# - Product B: Criteria not measurable (prompt issue)
# - Product C: Low confidence (data issue)
```

### Success Criteria

- [ ] Accuracy script exists and runs
- [ ] Baseline accuracy measured (whatever it is)
- [ ] At least one refinement cycle completed
- [ ] Post-refinement accuracy >= 70%
- [ ] Git history shows refinement rationale

## Design Details

### What We're NOT Building

- Config versioning system with v1/v2/v3 exports
- Separate config file (`src/configs/activationExtractionConfig.ts`)
- Markdown validation results file
- Formal 4-step protocol document
- ValidationResult interface with metadata

These can be added later if real patterns emerge from actual refinement work.

### What We ARE Building

1. **extractActivationLevels.ts** - The extraction function with inline config
2. **test-activation-accuracy.mjs** - Script to measure accuracy
3. **Git commits** - Document each refinement with rationale

## Alternatives Considered

### Versioned Config Objects
Export `configs.v1`, `configs.v2` etc. in a separate file. Rejected because it adds infrastructure before we have data showing it's needed. Git provides version history for free.

### Validation Results Markdown File
Log each validation run to `docs/validation-results.md`. Rejected because validation results should be queryable in the database, not in markdown files.

### Parameterized Functions
Pass config objects to extraction functions. Rejected for now - can be added when we have 2-3 extractors showing the same pattern.

## Success Criteria

How we know refinement is working:
1. Accuracy script reports >= 70%
2. No product scores "Inaccurate" (< 6 points on rubric)
3. Refinement rationale documented in git commits
