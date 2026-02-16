# Batch 1 Experiential Lens Prompts Design

## Overview

Rewrite the four Batch 1 lens system prompts (time_compression, effort_elimination, capability_mapping, artifact_creation) to produce candidates grounded in what users DO inside the product — specific user actions, screens, and visible results — instead of abstract business outcomes.

## Problem Statement

Current prompts produce abstract marketing-language candidates like "Automate protection of sensitive business information." The goal is experiential candidates like "Set board-level permissions to restrict editing." The prompts need tighter core questions, anti-pattern guardrails, and good/bad examples to anchor the LLM toward observable user experiences.

## Expert Perspectives

### Product
- Core questions should be single, tight sentences — not multi-part questions
- Time Compression tightened from 3-part question to: "What specific user action goes from waiting to instant inside this product?"
- Capability Mapping tightened to: "What can a user do inside this product that they couldn't do before?"
- Effort Elimination and Artifact Creation approved as proposed
- "screen → click → result" detail belongs in follow-up guidance, not the core question
- Tests should check for behavioral keywords ("screen," "click," "skip," "instant") not outcome words

### Technical
- Prompt-only changes — zero parser, schema, or handler modifications
- Existing test structure stays; only prompt-checking assertions update
- Each prompt follows identical structure: role + core question + definition + fields + anti-patterns + examples + grounding + format + rules

### Simplification Review
- Reviewer flagged existing code duplication (shared parsers, handler factories) as out of scope — task explicitly says "Only rewrite prompt text"
- Valid in-scope suggestion: extract shared prompt sections (marketing blocklist, grounding instruction) into constants — noted as future option but kept inline for now since prompts may diverge per lens
- Prompt rewriting itself is well-designed and focused

## Proposed Solution

Rewrite each `*_SYSTEM_PROMPT` constant in-place with this structure:

1. **Role + core question** (1 tight sentence per lens)
2. **Definition** (what the lens IS and IS NOT, grounded in user behavior)
3. **Field descriptions** (unchanged from current — same JSON schema)
4. **Anti-patterns** (behavioral grounding + marketing blocklist)
5. **Good vs Bad examples** (2-3 lens-specific pairs)
6. **Grounding instruction** ("Every candidate must reference a specific screen, UI element, or user action")
7. **JSON output format** (unchanged)
8. **Rules** (unchanged)

### Core Questions

| Lens | New Core Question |
|------|-------------------|
| Time Compression | "What specific user action goes from waiting to instant inside this product?" |
| Effort Elimination | "What specific steps does a user skip entirely when using this product?" |
| Capability Mapping | "What can a user do inside this product that they couldn't do before?" |
| Artifact Creation | "What specific thing does a user build, export, or share from this product that others use outside the tool?" |

### Shared Elements (identical in all 4 prompts)

**Marketing blocklist:**
> Banned words unless tied to a specific in-app action: automate, streamline, optimize, leverage, enhance, empower

**Grounding instruction:**
> Every candidate must reference a specific screen, UI element, or user action in the product. If you can't point to where in the product this happens, don't include it.

### Lens-Specific Examples

Each lens gets 2-3 Good/Bad pairs showing the same idea framed abstractly (BAD) then experientially (GOOD). Examples use generic product scenarios (project management, CRM, design tools) to be product-agnostic.

## Design Details

### Files Changed

| File | Change |
|------|--------|
| `convex/analysis/lenses/extractTimeCompression.ts` | Rewrite SYSTEM_PROMPT (lines ~102-141) |
| `convex/analysis/lenses/extractEffortElimination.ts` | Rewrite SYSTEM_PROMPT (lines ~106-145) |
| `convex/analysis/lenses/extractCapabilityMapping.ts` | Rewrite SYSTEM_PROMPT (lines ~111-150) |
| `convex/analysis/lenses/extractArtifactCreation.ts` | Rewrite SYSTEM_PROMPT (lines ~101-140) |
| Test files for each | Update prompt-checking assertions |

### What Does NOT Change

- Parser functions (parseTimeCompressionResponse, etc.)
- JSON output schema (field names, types, validation)
- InternalAction handlers
- Page filtering, context building utilities
- shared.ts
- Parser tests

### Test Strategy

Replace old substring checks with new ones that verify:
- Core experiential question text
- Marketing blocklist keywords present
- Good/Bad example pairs present
- Grounding instruction present
- Lens-specific field name present
- Candidate count (8-20)

## Alternatives Considered

1. **Extract shared prompt sections into constants** — Would reduce duplication but adds abstraction layer. Deferred since prompts may need per-lens tuning.
2. **Refactor to handler factories** — Out of scope per task constraints ("only rewrite prompt text").

## Success Criteria

- All 4 prompts reframed from business-outcome to user-experience language
- Each prompt has marketing blocklist, good/bad examples, grounding instruction
- All existing tests pass (with updated assertions)
- No changes to parsers, schema, or handlers
