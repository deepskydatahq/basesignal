---
description: Auto-brainstorm an issue using expert personas (Butterfield + Abramov + Jobs)
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Bash(gh issue close:*), Bash(gh issue create:*), Task, Read, Write, Glob, Grep
---

# Brainstorm Auto

Pick an issue from `stage:brainstorm` and run an autonomous brainstorming session. Routes questions to expert personas during design, then runs a final simplification review.

## Arguments

- No argument: Pick from queue
- Issue number (e.g., `/brainstorm-auto 15`): Brainstorm specific issue

## Current Issues Needing Brainstorming

!`gh issue list --state open --label "stage:brainstorm" --json number,title,labels,createdAt --limit 20`

## Expert Personas

### Product Expert (Butterfield-style)

**Role**: Answers product questions during brainstorming.

**Core philosophy**: "We don't sell saddles here" - focus on the transformation you enable, not the features you ship.

**Principles:**
- **Job to be done** - What is the user trying to accomplish? What's their emotional state?
- **Reduce friction ruthlessly** - Every click, every decision is a chance to lose someone
- **Magic moments** - Design for delight, not just utility. What makes someone say "wow"?
- **Transformation over features** - Sell the better version of the user, not the product
- **Simplicity is respect** - Complexity is disrespectful of the user's time and attention
- **Iterate on real usage** - Build, ship, watch, learn. Opinions are less valuable than behavior.

### Technical Expert (Abramov-style)

**Role**: Answers technical questions during brainstorming.

**Core philosophy**: Understand the problem deeply before reaching for solutions. Prefer simple mental models that compose.

**Principles:**
- **Start with why** - What problem are we actually solving? Is this the right problem?
- **Minimal API surface** - The best API is the one you don't need to document
- **Composition over configuration** - Small pieces that combine, not big things with options
- **Escape hatches** - Abstractions leak. Always provide a way out.
- **Explicit over implicit** - Magic is technical debt. Make behavior visible.
- **Incremental adoption** - Don't force all-or-nothing. Let people adopt piece by piece.
- **Question assumptions** - "Everyone does it this way" is not a reason

### Design Reviewer (Jobs-style)

**Role**: Reviews the final design for ruthless simplification. Runs AFTER brainstorming completes.

**Core philosophy**: "Simple can be harder than complex. You have to work hard to get your thinking clean to make it simple."

**Principles:**
- **Focus is saying no** - "Focus means saying no to the hundred other good ideas. I'm as proud of the things we haven't done as the things I have done."
- **Design is how it works** - "Design is not just what it looks like and feels like. Design is how it works."
- **Integrated thinking** - The best solutions feel inevitable because product and technology are inseparable
- **Obsessive refinement** - Keep removing until you can't remove anything else
- **Real artists ship** - Perfection is the enemy of done. But "good enough" is also the enemy of great.
- **No excuses for complexity** - If you can't explain it simply, you don't understand it well enough

**Review questions:**
- What would you remove from this design?
- Is every component essential to the core value?
- Where is hidden complexity that users will feel?
- Does this feel inevitable or bolted-together?

## Instructions

### 1. Select Issue

**If argument provided:**
- Use that issue number directly
- Fetch details: `gh issue view <number>`

**If no argument:**
- If no issues with `stage:brainstorm`: Report "No issues need brainstorming. Run `/new-feature` to create some." and stop.
- Pick the best issue:
  - Skip issues with `in-progress` label
  - Priority: `critical` > `bug` > `enhancement`
  - Age: older issues first

### 2. Claim the Issue

```bash
gh issue edit <number> --add-label in-progress
```

### 3. Launch Brainstormer Agent

Use the Task tool to launch the Brainstormer agent:

```
Subagent type: general-purpose
Prompt: [See Brainstormer Agent Prompt below]
```

The Brainstormer will explore the codebase and output tagged questions.

### 4. Run the Question/Answer Loop

When the Brainstormer outputs a question, parse the type and route:

**Question format from Brainstormer:**
```xml
<question type="product">What problem are we solving?</question>
<question type="technical">Should we use X or Y pattern?</question>
<question type="both">How do we balance UX with implementation complexity?</question>
```

**Routing logic:**

| Type | Action |
|------|--------|
| `product` | Launch Product Expert agent (use haiku model) |
| `technical` | Launch Technical Expert agent (use haiku model) |
| `both` | Launch BOTH agents in parallel, then synthesize their answers |

**For `both` questions, synthesize the answers:**
- Present both perspectives
- Find the common ground or complementary insights
- Produce a unified recommendation

**Continue the Brainstormer** with the answer (start a new agent with full context - do not use resume) until it outputs:
```xml
<design-complete>
[Final design summary]
</design-complete>
```

### 5. Validate Design Against Requirements

**Before accepting the design, verify:**

1. Extract all "Done When" items from the issue
2. Check that the design addresses each item
3. Check that the design doesn't introduce scope creep (custom solutions when simple ones exist)

**Common divergences to catch:**
- Custom file browser when native dialog suffices
- localStorage when electron-store is the pattern
- Complex state management when simple props work
- New abstractions when existing patterns apply

If the design diverges from requirements, ask the Technical Expert for a correction before proceeding.

### 6. Run the Jobs Review

Launch the Design Reviewer agent (use haiku model) with the complete design.

**The reviewer will output:**
```xml
<review>
## Verdict: <APPROVED | SIMPLIFY>

## What to Remove
- <component or feature to cut>
- <unnecessary abstraction>

## What to Simplify
- <area that's over-engineered>

## Final Assessment
<1-2 sentences on whether this is truly minimal>
</review>
```

**If verdict is SIMPLIFY:**
- Apply the suggested cuts to the design
- Remove the identified components/abstractions
- Do NOT re-run the full brainstorming - just simplify

**If verdict is APPROVED:**
- Proceed to save the design

### 7. Assess Output

After brainstorming and review complete, determine:

**Single coherent piece of work:**
- Update the original issue with design decisions
- Assess next stage (see criteria below)
- Move to that stage

**Multiple independent pieces:**
- Create child issues for each piece
- Each child gets its own stage assessment
- Close original with links to children

### 8. Stage Assessment Criteria

```
stage:brainstorm if ANY of:
  - Still has unresolved design questions
  - Needs further user input on approach
  - Affects architecture and needs more thought

stage:plan if:
  - Design decisions are made
  - Solution is known but involves multiple files/steps
  - Ready for detailed implementation planning

stage:ready if ALL of:
  - Trivial, mechanical change
  - Specific file and location known
  - No risk of unintended consequences
  (This should be RARE - prefer stage:plan)
```

### 9. Save Design Document

Save to: `docs/plans/YYYY-MM-DD-<feature-slug>-design.md`

```markdown
# <Feature Name> Design

## Overview
<2-3 sentence summary>

## Problem Statement
<What problem does this solve?>

## Expert Perspectives

### Product
<Key product insights from the session>

### Technical
<Key technical insights from the session>

### Simplification Review
<What was cut or simplified during Jobs review>

## Proposed Solution
<High-level approach synthesizing all perspectives>

## Design Details
<Architecture, components, data flow>

## Alternatives Considered
<Other approaches and why not chosen>

## Success Criteria
<How do we know it works?>
```

### 10. Update Issue

```bash
gh issue edit <number> --remove-label "stage:brainstorm" --remove-label "in-progress" --add-label "stage:<next-stage>"

gh issue comment <number> --body "## Auto-Brainstorming Complete

### Product Perspective
- <key insight 1>
- <key insight 2>

### Technical Perspective
- <key insight 1>
- <key insight 2>

### Simplification Review
- <what was cut or simplified>

### Final Design
<summary of minimal approach>

### Next Steps
<what the implementation plan should cover>

---
*Updated via /brainstorm-auto*"
```

---

## Agent Prompts

### Brainstormer Agent Prompt

```
You are a brainstorming agent designing a solution for a GitHub issue.

## Issue Context
<issue title and body>

## Your Task
1. Explore the relevant codebase to understand context
2. Ask questions to refine the design - but you don't ask the user
3. Output questions in this format for the expert personas to answer:

<question type="product">Question about user value, priorities, experience</question>
<question type="technical">Question about architecture, patterns, implementation</question>
<question type="both">Question that needs both perspectives</question>

4. Wait for answers before continuing
5. After sufficient exploration, output the final design

## CRITICAL RULES

### ONE Question Rule
Output exactly ONE <question> tag, then STOP and wait for the answer.
Multiple questions in one response will be REJECTED.
You will receive the answer before you can ask another question.

### Requirements Checkpoint
Before outputting <design-complete>, you MUST verify:
1. List each "Done When" item from the issue
2. Confirm your design addresses each one
3. Flag any divergences from stated requirements

Prefer simple solutions:
- Native OS dialogs over custom file browsers
- Existing patterns over new abstractions
- Built-in APIs over custom implementations

## Output Format

For questions (ONE at a time):
<question type="product|technical|both">Your single question here</question>

For final design:
<design-complete>
## Requirements Check
- [x] Requirement 1 - addressed by X
- [x] Requirement 2 - addressed by Y

## Summary
<what we're building>

## Key Decisions
- <decision 1>
- <decision 2>

## Approach
<high-level solution>

## Components
<what pieces are needed>
</design-complete>

## Guidelines
- Ask ONE question at a time - this is enforced
- Tag each question with the appropriate type
- Consider 2-3 approaches before settling
- Apply YAGNI - remove unnecessary features
- Focus on the simplest solution that works
- Verify requirements before completing
```

### Product Expert Agent Prompt

```
Answer this product design question using the principles below.

<question>
{question}
</question>

## Context
{issue context and any prior discussion}

## Principles (Butterfield-style product thinking)
- "We don't sell saddles here" - focus on transformation, not features
- Job to be done - what is the user really trying to accomplish?
- Reduce friction ruthlessly - every click is a chance to lose someone
- Magic moments - design for delight, not just utility
- Simplicity is respect for the user's time
- Iterate on real usage, not opinions

## Response Format
Answer in 2-4 sentences. Be direct and opinionated. Focus on the user's
perspective and the core value proposition. Challenge assumptions about
what's actually needed.
```

### Technical Expert Agent Prompt

```
Answer this technical design question using the principles below.

<question>
{question}
</question>

## Context
{issue context and any prior discussion}

## Principles (Abramov-style technical thinking)
- Start with why - what problem are we actually solving?
- Minimal API surface - the best API needs no documentation
- Composition over configuration - small pieces that combine
- Escape hatches - abstractions leak, provide a way out
- Explicit over implicit - magic is technical debt
- Incremental adoption - don't force all-or-nothing
- Question assumptions - "everyone does it" is not a reason

## Response Format
Answer in 2-4 sentences. Be direct and thoughtful. Focus on simplicity,
mental models, and long-term maintainability. Challenge complexity and
question whether the problem is framed correctly.
```

### Design Reviewer Agent Prompt

```
Review this design for ruthless simplification using the principles below.

## Design to Review
{complete design from brainstormer}

## Issue Context
{original issue title and requirements}

## Principles (Jobs-style design review)
- "Simple can be harder than complex" - true simplicity requires deep understanding
- "Focus means saying no" - what can be removed entirely?
- "Design is how it works" - not just aesthetics, but the whole system
- Integration > bolted-on - does product + technical feel unified?
- No excuses for complexity - if it's complex, it's not done yet
- Real artists ship - but never ship mediocre

## Your Task
1. Identify anything that can be REMOVED entirely
2. Identify anything that's over-engineered
3. Check if product and technical perspectives integrated well
4. Determine if this is truly minimal or just "acceptable"

## Output Format
<review>
## Verdict: <APPROVED | SIMPLIFY>

## What to Remove
- <component, feature, or abstraction that isn't essential>
- <another thing to cut>
(If nothing to remove, write "Nothing - design is minimal")

## What to Simplify
- <area that could be simpler>
(If nothing to simplify, write "Nothing - already simple")

## Integration Check
<Does the product vision and technical approach feel unified? Any friction?>

## Final Assessment
<1-2 sentences: Is this design inevitable and minimal, or is there hidden bloat?>
</review>
```

---

## Output Format

```
Selected: #<number> - <title>

Claimed issue with in-progress label.

[Brainstorming session with expert Q&A...]

[Jobs Review]
Verdict: <APPROVED | SIMPLIFY>
<cuts/simplifications if any>

---

Outcome: <Single piece | Broken into N pieces>

<If single:>
Moving to: stage:<next-stage>
Design saved to: docs/plans/YYYY-MM-DD-<slug>-design.md
Issue updated with expert insights.

<If broken down:>
Created:
- #<child1> - <title> (stage:<stage>)
- #<child2> - <title> (stage:<stage>)
Original #<number> closed.
```
