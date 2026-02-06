# Activation Prompt Design

## Overview

Design for ACTIVATION_SYSTEM_PROMPT constant that instructs Claude to extract 3-4 activation levels from product website content. The prompt follows extractIdentity.ts pattern but simplified based on review feedback.

## Problem Statement

Basesignal needs to extract multi-level activation definitions from product content (marketing pages, help docs, case studies). The LLM must identify the progression from first touch to full adoption, marking which level represents the "aha-moment" where core value is realized.

## Expert Perspectives

### Product
- Signal strength maps to user commitment level, not feature complexity
- Distinction between strong and very_strong is **irreversibility**
- Primary activation follows the product's stated transformation, not social proof
- Use generic archetypes to force discovery from content, not pattern-matching
- Activation is about commitment escalation (weak → medium → strong → very_strong)

### Technical
- Single overallConfidence at result level (not duplicated per-level)
- Quote directly in evidence excerpts, synthesize in criteria/reasoning
- Return partial results with low confidence rather than empty
- Follow extractIdentity.ts structure

### Simplification Review

**Removed:**
- Behavioral language guidance section (Claude knows these patterns)
- Confidence scoring rules as separate section (embed in examples)
- "Partial results over empty" framing (implementation detail)
- Two of three archetype examples (one is sufficient)

**Simplified:**
- Signal strength mapping: 4-line table, no prose
- Primary activation rules: one principle, one example
- Target ~700 words instead of ~1500

## Proposed Solution

Create ACTIVATION_SYSTEM_PROMPT (~700 words) with:

1. **Role** (1 paragraph) - Product analyst identifying user activation progression
2. **JSON output schema** - Copy from ActivationLevelsResult types
3. **Signal strength mapping** - 4-line table
4. **One example** - B2B SaaS/collaboration tool with 4 levels
5. **Primary activation rule** - One sentence principle
6. **Output constraint** - JSON only

## Design Details

### Prompt Structure

```typescript
export const ACTIVATION_SYSTEM_PROMPT = `You are a product analyst identifying user activation progression. Extract 3-4 levels representing the journey from first touch to full adoption.

Return JSON matching this structure:

{
  "levels": [
    {
      "level": 1,
      "name": "explorer",
      "signalStrength": "weak",
      "criteria": [{"action": "create_first_item", "count": 1}],
      "reasoning": "Initial exploration shows curiosity",
      "confidence": 0.7,
      "evidence": [{"url": "...", "excerpt": "..."}]
    }
  ],
  "primaryActivation": 3,
  "overallConfidence": 0.75
}

## Signal Strength (Commitment Escalation)

weak: Individual exploration (created first item, browsed content)
medium: Learning the product (used template, completed setup)
strong: Core value realized (shared, collaborated, first outcome)
very_strong: Team adoption (multiple active users, recurring usage)

## Example: Project Management Tool

Level 1 (weak): Created first project or task
Level 2 (medium): Organized tasks with labels/priorities, set due dates
Level 3 (strong): Assigned task to teammate or integrated with other tool
Level 4 (very_strong): 5+ team members with activity in last 30 days

primaryActivation: 3 (assignment proves collaborative value)

## Primary Activation

The level where the product's core value proposition becomes real. Not the most advanced level—the aha-moment. For Miro: when someone else accesses a shared board. For Linear: when a task moves through the workflow.

## Criteria Format

- action: snake_case verb (create_board, invite_member)
- count: how many times (1 for one-time, higher for patterns)
- timeWindow: optional timing ("first_7d", "first_30d")

## Confidence

overallConfidence reflects source quality:
- 0.8+: Help docs or case studies with explicit behaviors
- 0.5-0.8: Feature pages with action descriptions
- <0.5: Inferred from marketing only

## Rules

- Return ONLY valid JSON
- Always 3-4 levels, numbered 1-4
- Each level needs at least 1 criterion
- primaryActivation must reference existing level`;
```

### File Location

`convex/analysis/extractActivationLevels.ts` - After type definitions from S001

### Testing

Unit tests verify:
1. ACTIVATION_SYSTEM_PROMPT is exported and non-empty
2. Contains required field names (levels, primaryActivation, overallConfidence)
3. Contains all signal strengths (weak, medium, strong, very_strong)
4. Contains example with criteria format

## Alternatives Considered

1. **Three archetype examples** - Rejected; one example is sufficient and prevents pattern-matching
2. **Detailed behavioral language guidance** - Rejected; Claude knows these patterns
3. **Per-level confidence philosophy** - Rejected; overallConfidence + evidence arrays are sufficient

## Success Criteria

- [ ] Prompt extracts meaningful activation levels from varied product content
- [ ] Signal strengths correctly reflect commitment escalation
- [ ] Primary activation identifies the aha-moment accurately
- [ ] Evidence quotes support the extracted levels
