# H6 Validation Comparison Design

## Overview

Manual validation protocol for comparing 7-lens pipeline output against a human-created reference analysis of Linear. Determines whether the system produces accurate value moments, validating hypothesis H6.

No new code is written. The implementer runs existing pipeline functions, captures output, and performs structured manual evaluation.

## Problem Statement

We need to validate that the 7-lens value discovery system produces accurate, meaningful value moments for a known product (Linear). This is the core test of H6: does the system find what matters?

## Expert Perspectives

### Product
- Simplify rating toward binary (maps / doesn't map) for clearer signal
- Add recall floor alongside precision — precision alone can hide missed moments
- The real question: "Does this system help a product leader discover the moments they actually care about?"

### Technical
- Protocol-level design, not command-level — E001/E002 APIs don't exist yet
- Include one data shape example as an escape hatch for implementers
- Follow the `test-activation.mjs` pattern: capture whatever the pipeline produces, work forward

### Simplification Review
- Removed subjective qualitative check (redundant with quantitative metrics)
- Consolidated pipeline execution steps
- Clarified two-tier validation gates (passing vs. strong signal)
- Removed defensive "does not specify" section

## Protocol

### Step 1: Execute Pipeline

Run `runAllLenses(productId)` on the Linear product (from M002), then `runConvergencePipeline()` on the lens results. Capture full JSON output including all tiers.

Reference moments source: S001 output at `docs/reference/linear-value-moments.md`.

### Step 2: Extract and Rate Tier 1 Moments

From convergence output, extract all Tier 1 moments (5+ lens convergence). Expected: 4-6 moments.

Each moment gets this shape:

```json
{
  "id": "vm-001",
  "name": "Complete a development cycle with team visibility",
  "description": "Track issues through sprint/cycle to completion with team-wide progress visibility",
  "tier": 1,
  "convergence_count": 6,
  "contributing_lenses": ["capability_mapping", "effort_elimination", "time_compression", "artifact_creation", "state_transitions", "info_asymmetry"],
  "reference_match": {
    "rating": "accurate",
    "matched_reference": "Complete a cycle with team visibility",
    "notes": "Direct match to primary aha-moment in reference"
  }
}
```

Rating criteria (three-tier per acceptance criteria):
- **Accurate**: Directly matches a reference value moment (same core behavior/outcome)
- **Mostly accurate**: Captures the essence but framing, scope, or specificity differs
- **Inaccurate**: Does not correspond to any reference value moment

### Step 3: Calculate Scores

```
precision = (accurate_count + mostly_accurate_count) / tier_1_total
recall = reference_moments_found / reference_moments_total
```

**Validation gate:** precision >= 70% → H6 validated
**Strong signal:** precision >= 70% AND recall >= 50% → recommend proceeding to M004

Recall is tracked for diagnostic value. If precision passes but recall is very low, that's a warning worth documenting even if H6 technically validates.

### Step 4: Document Results

Create `docs/plans/M003-validation-results.md`:

```markdown
# M003 Validation Results: 7-Lens Value Discovery

**Date:** [execution date]
**Product:** Linear

## Pipeline Execution
- Product ID: [id]
- Total raw candidates: [count across 7 lenses]
- Post-validation candidates: [count after E002 validation]
- Final value moments: [count by tier]
  - Tier 1 (5+ lenses): [count]
  - Tier 2 (3-4 lenses): [count]
  - Tier 3 (1-2 lenses): [count]

## Tier 1 Moments vs Reference

| # | Generated Moment | Lenses | Rating | Matched Reference | Notes |
|---|-----------------|--------|--------|-------------------|-------|
| 1 | [name] | [count] | accurate/mostly/inaccurate | [ref moment or "none"] | [notes] |

## Scoring

- Accurate: [n]
- Mostly accurate: [n]
- Inaccurate: [n]
- **Precision: [n]/[total] = [%]** — Threshold 70%: [PASS/FAIL]
- **Recall: [n]/[total] = [%]** — Floor 50%: [PASS/FAIL]

## Lens Performance

| Lens | Candidates | Contributed to Tier 1 | Notes |
|------|-----------|----------------------|-------|
| Capability Mapping | [n] | [n] | |
| Effort Elimination | [n] | [n] | |
| Info Asymmetry | [n] | [n] | |
| Decision Enablement | [n] | [n] | |
| State Transitions | [n] | [n] | |
| Time Compression | [n] | [n] | |
| Artifact Creation | [n] | [n] | |

## Conclusion
[Validated / Not Validated]

## Learnings
- [What worked well]
- [What didn't work well]
- [If not validated: lens-specific refinement opportunities]
```

### Step 5: Update HYPOTHESES.md

**If validated (precision >= 70%):**
- Change H6 status from `🔵 Testing` to `🟢 Validated`
- Add evidence entry with date, precision score, recall score, Tier 1 count
- Update "Next Steps" to reference output layers (M004)

**If not validated (precision < 70%):**
- Keep H6 at `🔵 Testing` (first test, not final judgment)
- Add evidence entry documenting what was tested and the result
- Document which lenses underperformed and proposed prompt adjustments

**Edge case:** If Tier 1 results fall outside 4-8 moments, document in validation report and reassess lens convergence logic.

## Success Criteria

- Precision >= 70% validates H6
- Precision >= 70% AND recall >= 50% is a strong signal to proceed to M004
- All 8 acceptance criteria addressed in protocol steps

## Alternatives Considered

- **Binary rating** (maps/doesn't map): Product strategist recommended this for clarity. Kept three-tier per explicit acceptance criteria, but the precision calculation effectively uses binary (accurate + mostly = pass).
- **Automated comparison**: Could use embeddings to auto-match moments to reference. Rejected — this is a manual validation story, and automated comparison would need its own validation.
