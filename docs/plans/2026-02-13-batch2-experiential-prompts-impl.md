# Batch 2 Experiential Prompts - Implementation Plan

## Task
basesignal-gkv: M007-E001-S002 — Rewrite Batch 2 lens prompts for experiential extraction

## Summary
Replace the SYSTEM_PROMPT constant in three Batch 2 lens files with experiential, user-grounded prompts. Only string constants change — no code, schema, parser, or handler modifications.

## Pattern Reference
Follow the Batch 1 prompt structure established in S001 (see extractTimeCompression.ts lines 102-141):
```
1. Role + core question (1 sentence)
2. Definition paragraph (what lens IS and IS NOT, grounded in user behavior)
3. Field descriptions (name, description, role, confidence, source_urls, lens-specific field)
4. Anti-patterns (2 per lens)
5. Good examples (2 per lens)
6. JSON format example (preserving exact field names)
7. Rules section
```

Additionally, because Batch 2 lenses receive Batch 1 context, each prompt includes a **Batch 1 context priority instruction** (3 lines) to prevent abstract Batch 1 results from contaminating experiential output.

## Steps

### Step 1: Rewrite SYSTEM_PROMPT in extractInfoAsymmetry.ts (lines 88-121)

**Core question:** "What does a user SEE that they couldn't see before? Describe the screen/dashboard/notification."

**Definition:** An information asymmetry is when the product shows users something they had no way to see before — a specific screen, dashboard, chart, or notification that makes previously hidden information visible. It's NOT about abstract "visibility" or "insights" — it's about a concrete UI element that reveals something new.

**Batch 1 context instruction:**
```
Reference context: You may receive previous analysis findings below.
Use them to avoid duplicate naming only. Do not adopt their abstraction level.
Always present findings as concrete user experiences.
```

**Anti-patterns:**
- Abstract visibility: "Gain visibility into performance" — what screen? what data?
- Marketing language: "unlock insights", "enhance transparency", "surface key metrics"

**Good examples:**
- GOOD: "See a heatmap on the Team Dashboard showing which team members have too many tasks this week"
- BAD: "Gain visibility into team workload distribution"
- GOOD: "View a notification badge on the Pipeline page when a deal hasn't had activity in 7 days"
- BAD: "Unlock insights about deal health and pipeline risk"

**Grounding rule:** Every candidate must reference a specific screen, dashboard, notification, or UI element in the product. If you can't point to where in the product this appears, don't include it.

**JSON field:** `information_gained` (preserved exactly)

### Step 2: Rewrite SYSTEM_PROMPT in extractDecisionEnablement.ts (lines 84-117)

**Core question:** "What specific choice does a user make INSIDE the product?"

**Definition:** A decision enablement is a specific choice a user makes within the product interface — clicking a button, selecting an option, choosing a path. It's NOT about abstract business decisions made "because of" the product — it's about in-product choices backed by visible data that the product shows them.

**Batch 1 context instruction:** (same 3-line block as above)

**Anti-patterns:**
- Abstract decisions: "Make better hiring decisions" — what button? what screen?
- Out-of-product decisions: Decisions made in meetings or emails that aren't part of the product UI

**Good examples:**
- GOOD: "Click 'Approve' or 'Reject' on a budget request in the Approvals queue after seeing the cost breakdown chart"
- BAD: "Make data-driven budget allocation decisions"
- GOOD: "Select which leads to contact first from the Priority Score list on the Pipeline page"
- BAD: "Improve sales prioritization effectiveness"

**Grounding rule:** Every candidate must reference a specific screen, button, or selection the user interacts with. If the decision happens outside the product, don't include it.

**JSON field:** `decision_enabled` (preserved exactly)

### Step 3: Rewrite SYSTEM_PROMPT in extractStateTransitions.ts (lines 96-129)

**Core question:** "What changes in a user's workflow after using a specific feature?"

**Definition:** A state transition is a concrete change in how a user works — before they did X manually, now they do Y in the product. Both the "before" and "after" must describe specific user actions or workflows, not abstract capability levels. The transition must be observable: you could watch someone's workday and see the difference.

**Batch 1 context instruction:** (same 3-line block as above)

**Anti-patterns:**
- Abstract state names: "fragmented → unified", "reactive → proactive" — describe what the user actually does differently
- One-sided transitions: Missing either the before or after workflow description

**Good examples:**
- GOOD: "From: Switching between Slack, email, and spreadsheets to collect project updates → To: Opening the Status Dashboard and seeing all updates in a live feed"
- BAD: "From: fragmented communication → To: unified collaboration"
- GOOD: "From: Manually exporting CSV from analytics tool and building pivot tables → To: Clicking 'Generate Report' and sharing a link to a live dashboard"
- BAD: "From: manual reporting → To: automated insights"

**Grounding rule:** Every candidate must describe specific user actions on both sides of the transition. Name the screens, tools, or steps involved. If either side is abstract, don't include it.

**JSON field:** `state_transition` (preserved exactly)

### Step 4: Run tests
```bash
npm test
```
Verify all existing lens tests pass. Tests validate filter, build, and parse functions — not prompt content — so they should pass without modification.

## Acceptance Criteria Checklist

| # | Criterion | Addressed In |
|---|-----------|-------------|
| 1 | info_asymmetry SYSTEM_PROMPT reframed to "What does a user SEE..." | Step 1 |
| 2 | decision_enablement SYSTEM_PROMPT reframed to "What specific choice..." | Step 2 |
| 3 | state_transitions SYSTEM_PROMPT reframed to "What changes in workflow..." | Step 3 |
| 4 | Each prompt includes anti-patterns for marketing language matching Batch 1 | Steps 1-3 (2 anti-patterns each) |
| 5 | Each prompt includes 2 GOOD vs BAD example pairs | Steps 1-3 |
| 6 | Batch 2 context from Batch 1 does not override experiential framing | Steps 1-3 (3-line context priority instruction) |
| 7 | All existing lens tests pass | Step 4 |

## Files Changed
| File | Lines | Change |
|------|-------|--------|
| `convex/analysis/lenses/extractInfoAsymmetry.ts` | 88-121 | Replace SYSTEM_PROMPT |
| `convex/analysis/lenses/extractDecisionEnablement.ts` | 84-117 | Replace SYSTEM_PROMPT |
| `convex/analysis/lenses/extractStateTransitions.ts` | 96-129 | Replace SYSTEM_PROMPT |

## What Does NOT Change
- No code outside SYSTEM_PROMPT string constants
- No changes to filter, build, or parse functions
- No changes to action handlers or test files
- JSON field names: `information_gained`, `decision_enabled`, `state_transition`
- Candidate count range (8-20), confidence levels
