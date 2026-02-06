# Activation Level Judgment Rubric Design

## Overview

A judgment rubric for evaluating whether AI-extracted activation levels are accurate and useful. Used for manual validation of extraction quality.

## Problem Statement

When the AI extracts multi-level activation (weak→medium→strong→very_strong) from product content, we need a consistent way to judge whether the extraction is good enough to use. Without a rubric, evaluators apply inconsistent standards.

## Expert Perspectives

### Product
- Worked examples are essential for operational utility—without them, criteria like "logical progression" are abstract
- The rubric should achieve "aligned bias"—everyone scoring consistently because you showed them how
- Core value alignment must trace from the product's stated value proposition, not generic assumptions
- The aha-moment lives in middle levels (2-3)—level 1 is onboarding friction, level 4 is monetization

### Technical
- Example structure should use realistic event names so evaluators know what real extraction looks like
- The progression (weak→strong with increasing commitment/collaboration) is sound
- Keep the schema portable: action + count + optional timeWindow

### Simplification Review
- Removed point-based scoring (0-12) in favor of simpler pass/fail per criterion
- Removed separate evaluation checklist (redundant with criteria section)
- Counter-example is a brief list, not a full walkthrough

## Proposed Solution

A markdown document with four components:
1. Rating scale definitions (3 tiers)
2. Four evaluation criteria (each with pass/partial/fail)
3. One worked example (Miro)
4. Common failure modes (brief list)

## Design Details

### Rating Scale

| Rating | Definition |
|--------|------------|
| **Accurate** | All 4 criteria pass |
| **Mostly Accurate** | 3 criteria pass, 1 partial |
| **Inaccurate** | 2+ criteria fail |

### Evaluation Criteria

**1. Logical Progression**
- Pass: Clear escalation in commitment at each level (solo → engaged → collaborative → team)
- Partial: One level out of order or redundant
- Fail: No clear progression

**2. Measurability**
- Pass: All levels have `action + count` criteria (e.g., "board.created >= 1")
- Partial: 1-2 levels missing count or vague action
- Fail: Majority unmeasurable

**3. Core Value Alignment**
- Method: Read product's value prop from scan → verify primary activation (levels 2-3) maps to it
- Pass: Primary activation clearly reflects the product's core transformation
- Partial: Alignment present but indirect
- Fail: Primary activation misses core value

**4. Evidence Grounding**
- Pass: All levels cite source from scan data (feature list, pricing, onboarding)
- Partial: 1-2 levels lack clear source
- Fail: Levels appear invented

### Worked Example: Miro

**Product Context:**
- Value proposition: "Visual collaboration for teams"
- Core transformation: Individual thinking → team visual thinking

**Extracted Levels:**

| Level | Name | Criteria | Evidence |
|-------|------|----------|----------|
| weak | Setup | `board.created >= 1` | Onboarding requires first board |
| medium | Exploring | `shape.added >= 5` | Canvas is core feature |
| strong | Collaborating | `collaborator.invited >= 1` | "For teams" in value prop |
| very_strong | Team Adoption | `team.members >= 3` | Pricing scales by team |

**Scoring:**
- Logical Progression: **Pass** — clear solo → collaborative escalation
- Measurability: **Pass** — all have action + count
- Core Value Alignment: **Pass** — "Collaborating" captures team visual work
- Evidence Grounding: **Pass** — each level cites scan source

**Overall: Accurate**

### Common Failure Modes

- **No progression**: "Created board" and "Used board" at same commitment level
- **Unmeasurable**: "Uses features regularly" (no count)
- **Wrong primary**: Marking level 1 (signup) as primary activation
- **No evidence**: Levels inferred without scan citations

## Alternatives Considered

1. **Point-based scoring (0-12)**: Rejected—adds complexity without improving decisions
2. **Automated validation**: Deferred—manual judgment needed first to learn what matters
3. **Per-product rubric customization**: Rejected—rubric should be product-agnostic

## Success Criteria

- Evaluators achieve consistent ratings on the same extraction (inter-rater reliability)
- Rubric is usable without additional training (self-documenting via example)
- Criteria map directly to acceptance criteria from M002-E004-S002

---
*Design for Product Story: M002-E004-S002 · Created via /brainstorm-auto*
