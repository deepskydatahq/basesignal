# Batch 2 Experiential Prompts Design

## Overview
Rewrite the SYSTEM_PROMPT constants in three Batch 2 lens files to produce experiential, user-grounded candidates instead of abstract analytical outputs. Only prompt text changes — no code, schema, parser, or test changes.

## Problem Statement
The Batch 2 lenses (info_asymmetry, decision_enablement, state_transitions) currently produce abstract candidates like "Gain visibility into team performance" instead of experiential ones like "See a heatmap showing who has too many tasks this week." This makes downstream convergence and measurement spec generation produce vague, marketing-style output.

## Expert Perspectives

### Product
- Batch 1 context priority instruction should be a dedicated principle (3-4 lines) that sets hierarchy — not a brief aside that gets buried
- Even though Batch 1 prompts are being rewritten too (S001), the instruction protects against any product's existing abstract Batch 1 results

### Technical
- Only SYSTEM_PROMPT string constants change — no parser, filter, or handler modifications
- JSON field names (information_gained, decision_enabled, state_transition) are preserved exactly
- All existing tests pass because they test functions, not prompt content

### Simplification Review
- Reviewer flagged code duplication in buildBatch1Context/buildKnowledgeContext/filtering — out of scope (existed before, not in ACs)
- Reviewer suggested removing Batch 1 context instruction — kept because AC explicitly requires it
- Applied: reduce anti-patterns to 2 per lens (was 3-4)
- Applied: reduce GOOD/BAD pairs to 2 per lens (was 2-3)
- Applied: remove redundant field description bullets — let JSON example speak for itself

## Proposed Solution

Each prompt follows this simplified structure matching Batch 1 pattern:

```
1. Role + lens introduction (1 line)
2. Core question (experiential reframing per AC)
3. Definition paragraph (what qualifies, grounded in user experience)
4. Batch 1 context priority instruction (3 lines)
5. Anti-patterns (2 per lens: one marketing-language, one lens-specific)
6. GOOD vs BAD example pairs (2 per lens)
7. Grounding rule ("Every candidate must reference a specific screen/UI/action")
8. JSON example (preserving exact field names)
9. Confidence levels
10. Rules section (unchanged constraints)
```

## Design Details

### info_asymmetry
- Core question: "What does a user SEE that they couldn't see before? Describe the screen/dashboard/notification."
- Anti-patterns: (1) Abstract visibility without a specific screen, (2) Marketing language: "unlock insights", "enhance transparency"
- GOOD/BAD pairs focus on: abstract visibility → specific screen element

### decision_enablement
- Core question: "What specific choice does a user make INSIDE the product?"
- Anti-patterns: (1) Abstract decision-making without specifying the screen, (2) Decisions that happen outside the product
- GOOD/BAD pairs focus on: outcome-framed decisions → in-product choices with visible data

### state_transitions
- Core question: "What changes in a user's workflow after using a specific feature?"
- Anti-patterns: (1) Abstract state names ("fragmented → unified"), (2) One-sided transitions missing the before or after
- GOOD/BAD pairs focus on: capability-level shifts → specific workflow action changes on both sides

### Batch 1 Context Instruction (all 3 prompts)
```
Reference context: You may receive previous analysis findings below.
Use them to avoid duplicate naming only. Do not adopt their abstraction level.
Always present findings as concrete user experiences.
```

## What Does NOT Change
- No code outside SYSTEM_PROMPT string constants
- No changes to filter, build, or parse functions
- No changes to action handlers or test files
- JSON field names: information_gained, decision_enabled, state_transition
- Candidate count range (8-20), confidence levels

## Implementation Steps
1. Replace SYSTEM_PROMPT in extractInfoAsymmetry.ts (lines 88-121)
2. Replace SYSTEM_PROMPT in extractDecisionEnablement.ts (lines 84-117)
3. Replace SYSTEM_PROMPT in extractStateTransitions.ts (lines 96-129)
4. Run `npm test` to confirm all tests pass

## Success Criteria
- All 7 acceptance criteria met
- All existing lens tests pass
- Prompts follow consistent structure matching Batch 1 pattern
