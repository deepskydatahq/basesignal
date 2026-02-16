# Implementation Plan: Batch 1 Experiential Lens Prompts

**Task:** basesignal-wga
**Story:** M007-E001-S001
**Design:** [2026-02-12-batch1-experiential-prompts-design.md](./2026-02-12-batch1-experiential-prompts-design.md)

## Summary

Rewrite the four Batch 1 lens system prompts to extract user-experienced moments instead of abstract business outcomes. Only prompt text changes — no parser, schema, or handler modifications.

## Steps

### Step 1: Rewrite TIME_COMPRESSION_SYSTEM_PROMPT

**File:** `convex/analysis/lenses/extractTimeCompression.ts` (lines 102-141)

Replace the `TIME_COMPRESSION_SYSTEM_PROMPT` constant with the experiential version:

- **Core question:** "What specific user action goes from waiting to instant inside this product?"
- **Definition:** Reframe from "workflows fast enough to change behavior" to describing what a user clicks/sees that now happens instantly vs. previously requiring wait time
- **Field descriptions:** Keep as-is (name, description, role, confidence, source_urls, time_compression)
- **Anti-patterns:** Keep existing ones (saves a click, abstract velocity, feature-level speed) AND add:
  - Marketing blocklist: "automate, streamline, optimize, leverage, enhance, empower" when not tied to a specific in-app action
  - "Outcomes that could describe any product in the category"
  - "Statements with no specific screen, button, or UI element mentioned"
- **Good vs Bad examples (2-3 pairs):**
  ```
  BAD: "Accelerate sprint velocity through automated planning"
  GOOD: "Click 'Auto-plan sprint' and see issues sorted into the sprint backlog in 3 seconds — previously a 2-hour drag-and-drop session"

  BAD: "Streamline bug triage for faster resolution"
  GOOD: "Open the triage inbox, see each bug pre-labeled with severity and component — engineers fix same-day instead of next-sprint"
  ```
- **Grounding instruction:** "Every candidate must reference a specific screen, UI element, or user action in the product. If you can't point to where in the product this happens, don't include it."
- **JSON format + Rules:** Keep as-is

### Step 2: Update TIME_COMPRESSION test assertions

**File:** `convex/analysis/lenses/extractTimeCompression.test.ts`

Update the `TIME_COMPRESSION_SYSTEM_PROMPT` describe block:
- Change core question assertion from `"What workflows become fast enough to change behavior"` to `"What specific user action goes from waiting to instant"`
- Keep `time_compression` field check
- Keep `Anti-patterns` check, update specific anti-pattern text references
- Add assertion: prompt contains marketing blocklist words ("automate", "streamline", etc.)
- Add assertion: prompt contains grounding instruction about "specific screen, UI element, or user action"
- Add assertion: prompt contains "GOOD" and "BAD" example markers
- Keep `8-20` count check

Parser tests: **No changes** — parser logic is unchanged.

### Step 3: Rewrite EFFORT_ELIMINATION_SYSTEM_PROMPT

**File:** `convex/analysis/lenses/extractEffortElimination.ts` (lines 106-145)

Same structure as Step 1 but for effort elimination:

- **Core question:** "What specific steps does a user skip entirely when using this product?"
- **Definition:** Reframe to describe steps that disappear from the user's workflow — the user literally never navigates to a screen, fills a form, or does a task they used to do
- **Anti-patterns:** Keep existing + add marketing blocklist + grounding patterns
- **Good vs Bad examples:**
  ```
  BAD: "Eliminate manual reporting overhead"
  GOOD: "The 'Project Status' page auto-updates from task completions — no one opens a doc to write a weekly update anymore"

  BAD: "Reduce context-switching between tools"
  GOOD: "Reply to a Slack notification directly from the notification panel — skip switching to Slack, finding the channel, scrolling to the message"
  ```
- **Grounding instruction:** Same shared text
- **JSON format + Rules:** Keep as-is

### Step 4: Update EFFORT_ELIMINATION test assertions

**File:** `convex/analysis/lenses/extractEffortElimination.test.ts`

Update the `EFFORT_ELIMINATION_SYSTEM_PROMPT` describe block:
- Change core question assertion from `"What repetitive or tedious work vanishes entirely"` to `"What specific steps does a user skip entirely"`
- Update anti-pattern text references (old: "faster task creation", "reduces overhead")
- Add marketing blocklist, grounding instruction, and GOOD/BAD assertions

Parser tests: **No changes.**

### Step 5: Rewrite CAPABILITY_MAPPING_SYSTEM_PROMPT

**File:** `convex/analysis/lenses/extractCapabilityMapping.ts` (lines 111-150)

- **Core question:** "What can a user do inside this product that they couldn't do before?"
- **Definition:** Reframe from abstract capability to specific in-product actions — what screen does the user open, what do they click, what result appears
- **Anti-patterns:** Keep existing + add marketing blocklist + grounding patterns
- **Good vs Bad examples:**
  ```
  BAD: "Enable real-time visual collaboration at enterprise scale"
  GOOD: "Open a board and see teammates' cursors moving as they add sticky notes in real-time"

  BAD: "Automate protection of sensitive business information"
  GOOD: "Click 'Board settings' → 'Permissions' and set specific team members as view-only or editor"
  ```
- **Grounding instruction:** Same shared text
- **JSON format + Rules:** Keep as-is

### Step 6: Update CAPABILITY_MAPPING test assertions

**File:** `convex/analysis/lenses/extractCapabilityMapping.test.ts`

Update the `CAPABILITY_MAPPING_SYSTEM_PROMPT` describe block:
- Change core question from `"What new capacities does this product unlock"` to `"What can a user do inside this product that they couldn't do before"`
- Update anti-pattern text references (old: "create tasks", "better organization")
- Add marketing blocklist, grounding instruction, and GOOD/BAD assertions

Parser tests: **No changes.**

### Step 7: Rewrite ARTIFACT_CREATION_SYSTEM_PROMPT

**File:** `convex/analysis/lenses/extractArtifactCreation.ts` (lines 101-140)

- **Core question:** "What specific thing does a user build, export, or share from this product that others use outside the tool?"
- **Definition:** Reframe to describe the creation action — what does the user click to create/export, what format is it, who receives it
- **Anti-patterns:** Keep existing + add marketing blocklist + grounding patterns
- **Good vs Bad examples:**
  ```
  BAD: "Generate comprehensive project documentation"
  GOOD: "Click 'Export roadmap' → get a PDF timeline that the VP presents at the quarterly board meeting"

  BAD: "Create actionable team retrospective outputs"
  GOOD: "At the end of a retro board, click 'Create action items' → tasks appear in the team's backlog with owners assigned"
  ```
- **Grounding instruction:** Same shared text
- **JSON format + Rules:** Keep as-is

### Step 8: Update ARTIFACT_CREATION test assertions

**File:** `convex/analysis/lenses/extractArtifactCreation.test.ts`

Update the `ARTIFACT_CREATION_SYSTEM_PROMPT` describe block:
- Change core question from `"What tangible, shareable outputs do users create with value beyond the tool"` to `"What specific thing does a user build, export, or share from this product"`
- Update anti-pattern text references (old: "generates reports", "sets a status")
- Add marketing blocklist, grounding instruction, and GOOD/BAD assertions

Parser tests: **No changes.**

### Step 9: Run all tests

Run `npm test -- --run convex/analysis/lenses/` to verify:
- All 4 updated prompt assertion tests pass
- All parser tests still pass (unchanged logic)
- No regressions in shared.test.ts, types.test.ts, orchestrate.test.ts

## Files Changed

| File | Change Type |
|------|-------------|
| `convex/analysis/lenses/extractTimeCompression.ts` | Rewrite SYSTEM_PROMPT constant |
| `convex/analysis/lenses/extractEffortElimination.ts` | Rewrite SYSTEM_PROMPT constant |
| `convex/analysis/lenses/extractCapabilityMapping.ts` | Rewrite SYSTEM_PROMPT constant |
| `convex/analysis/lenses/extractArtifactCreation.ts` | Rewrite SYSTEM_PROMPT constant |
| `convex/analysis/lenses/extractTimeCompression.test.ts` | Update prompt assertion tests |
| `convex/analysis/lenses/extractEffortElimination.test.ts` | Update prompt assertion tests |
| `convex/analysis/lenses/extractCapabilityMapping.test.ts` | Update prompt assertion tests |
| `convex/analysis/lenses/extractArtifactCreation.test.ts` | Update prompt assertion tests |

## What Does NOT Change

- Parser functions (parseTimeCompressionResponse, etc.)
- JSON output schema (field names, types, validation)
- InternalAction handlers
- Page filtering, context building utilities
- shared.ts, types.ts
- Parser test cases

## Verification

- `npm test -- --run convex/analysis/lenses/` passes all tests
- Each prompt contains: experiential core question, marketing blocklist, GOOD/BAD examples, grounding instruction
- No changes to any parser or handler code
