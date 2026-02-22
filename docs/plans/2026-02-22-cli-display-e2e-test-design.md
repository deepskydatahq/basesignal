# CLI Display and E2E Pipeline Test Design

## Overview
Add lifecycle states display to CLI scan output (multi-line summary listing + markdown table) and create an E2E pipeline test proving the full pipeline produces valid lifecycle states. Terminal story in M010-E003 dependency chain — assumes all upstream types, schemas, generator, and pipeline wiring are complete.

## Problem Statement
With lifecycle states generation wired into the pipeline (M010-E003-S002), users need to see the results in CLI output, and we need E2E tests proving the full pipeline produces valid lifecycle states.

## Expert Perspectives

### Product
- Summary shows state names with time windows inline — "point at a URL, get a structured growth profile in 60 seconds" means clarity, not brevity
- Multi-line listing matches the journey stages pattern (proven to work)
- A count one-liner ("7 states") tells the user nothing actionable; state names with time windows do
- Markdown export adds full detail (state table with definitions)
- Transitions are machine-level data for JSON consumption, not human-readable output

### Technical
- Design assuming dependency chain is complete — this story is the integration and testing layer
- Use 7 canonical states (new, activated, engaged, at_risk, dormant, churned, resurrected) matching M010-E002-S001 spec
- Follow existing patterns for profile attachment and ProductDirectory persistence
- Simple truthy guard pattern matching existing formatters for `journey`: `if (lifecycleStates?.states)`
- No runtime type guards — E2E test is the safety net for upstream integration
- Two separate markdown formatters exist (CLI `formatters.ts` and export `exportFormatters.ts`) — this story covers CLI only; export formatter is separate scope

### Simplification Review (Round 4)
- **Cut export formatter from scope** — `exportFormatters.ts` is a separate concern; adding lifecycle states there is scope creep for a CLI display story. Defer to a dedicated story.
- Summary format: multi-line state listing (journey pattern), not count one-liner
- Cut transitions from markdown — state table sufficient for humans
- Mock fixture: exactly 2 transitions (minimal validation they exist)
- Consistent guard pattern: `if (lifecycleStates?.states)` everywhere (matches journey pattern)
- Minimal type casting co-located with guard (matches existing `revenue`/`journey` patterns)

## Proposed Solution

### Phase 1: Mock Fixture
**File:** `packages/mcp-server/src/analysis/__tests__/fixtures/responses.ts`

Add `LIFECYCLE_STATES_RESPONSE` — 7 states (new, activated, engaged, at_risk, dormant, churned, resurrected) with entry_criteria, exit_triggers, time_windows, plus 2 transitions. Confidence 0.75, sources from identity/activation_levels/activation_map/value_moments.

**File:** `packages/mcp-server/src/analysis/__tests__/fixtures/mock-llm.ts`

Add routing entry `{ match: "lifecycle states", response: LIFECYCLE_STATES_RESPONSE }` and import.

### Phase 2: CLI Formatters
**File:** `packages/cli/src/formatters.ts`

**formatSummary:** Multi-line listing matching journey stages pattern:

```
Lifecycle States:
  new (0-7 days)
  activated (7-14 days)
  engaged (14-30 days)
  at_risk (7+ days inactive)
  dormant (30+ days inactive)
  churned (60+ days inactive)
  resurrected (return after 30+ days)
```

Guard: `if (lifecycleStates?.states)` with inline type cast.

**formatMarkdown:** `## Lifecycle States` section with table:

```
| State | Definition | Time Window |
| --- | --- | --- |
| new | First visit | 0-7 days |
...
```

No transitions subsection. Same guard pattern.

### Phase 3: scan.ts Profile Attachment
**File:** `packages/cli/src/commands/scan.ts`

Attach `pipelineResult.outputs.lifecycle_states` to profile object (same pattern as activation_map/measurement_spec). Persist via `productDir.writeJson(slug, "outputs/lifecycle-states.json", ...)`.

### Phase 4: Tests

**Formatter tests** (`packages/cli/src/formatters.test.ts`):
- Summary includes state listing when present (`"Lifecycle States:"`, `"new (0-7 days)"`)
- Summary omits section when absent
- Markdown includes state table with headers and rows
- Markdown omits section when absent

**Pipeline E2E test** (`packages/mcp-server/src/analysis/__tests__/pipeline.test.ts`):
- `result.outputs.lifecycle_states` is non-null
- 7+ states with canonical names (new, activated, churned)
- Transitions exist, confidence > 0
- Progress events include `outputs_lifecycle_states`
- Empty pipeline returns null lifecycle_states

## Components

| Component | File | Change |
|-----------|------|--------|
| Mock fixture | `packages/mcp-server/src/analysis/__tests__/fixtures/responses.ts` | Add `LIFECYCLE_STATES_RESPONSE` (7 states, 2 transitions) |
| Mock routing | `packages/mcp-server/src/analysis/__tests__/fixtures/mock-llm.ts` | Add routing entry + import |
| Summary formatter | `packages/cli/src/formatters.ts` | Multi-line listing in `formatSummary()` (journey pattern) |
| Markdown formatter | `packages/cli/src/formatters.ts` | State table in `formatMarkdown()` (no transitions) |
| Profile attachment | `packages/cli/src/commands/scan.ts` | Attach + persist lifecycle_states |
| Formatter tests | `packages/cli/src/formatters.test.ts` | Summary listing + markdown table + absence tests |
| Pipeline E2E test | `packages/mcp-server/src/analysis/__tests__/pipeline.test.ts` | lifecycle_states assertions |

## Out of Scope
- **Export formatter** (`packages/mcp-server/src/tools/exportFormatters.ts`) — lifecycle states section with full rigor (entry criteria, transitions, confidence, evidence) belongs in a dedicated story

## Alternatives Considered
- **One-liner count in summary:** Rejected — "7 states" tells user nothing. State names with time windows are immediately actionable. Journey stages pattern proves multi-line works.
- **Transitions subsection in markdown:** Rejected — machine-level routing data, inconsistent with activation_map/measurement_spec rendering.
- **Reduced mock fixture (3-4 states):** Rejected — acceptance criteria requires 7+ valid states.
- **5+ transitions in mock:** Simplified to 2 — enough to validate transitions exist without over-specifying for CLI display scope.
- **Export formatter in same story:** Rejected by simplification review — separate concern, scope creep for a CLI display story.

## Verified Insertion Points (2026-02-22, re-verified during planning)

Codebase verified — all line numbers confirmed accurate against current `main` branch.

| File | Insertion Point | Context |
|------|----------------|---------|
| `responses.ts` | After line 307 (end of `MEASUREMENT_SPEC_RESPONSE`), before line 309 (`VALIDATION_REVIEW_RESPONSE`) | New `LIFECYCLE_STATES_RESPONSE` export |
| `mock-llm.ts` | Line 5: add import; between lines 22-23 (after measurement spec routing, before validation review routing) | New routing entry |
| `formatters.ts` (summary) | Between lines 74-76 (after metrics section, before footer) | Multi-line state listing |
| `formatters.ts` (markdown) | Between lines 167-169 (after Suggested Metrics, before footer `---`) | `## Lifecycle States` table |
| `scan.ts` (attachment) | After line 117 (after measurement_spec attachment) | Profile attachment |
| `scan.ts` (persistence) | After line 170 (after measurement-spec persistence) | `outputs/lifecycle-states.json` |
| `formatters.test.ts` | Fixture: around line 58 in `fullProfile()`; Tests: after line 105 (summary), after line 139 (markdown) | 4 new test cases |
| `pipeline.test.ts` | After line 25 (after measurement_spec check); after line 67 (progress phase check) | lifecycle_states assertions |

**Upstream dependency:** `basesignal-o0e` (M010-E003-S002 pipeline wiring) must be complete. `PipelineOutputs` (types.ts:125-131) and `OutputsResult` (outputs/index.ts:13-17) currently lack `lifecycle_states` — added by upstream story.

## Success Criteria
- CLI shows lifecycle state names with time windows in summary output
- CLI omits section gracefully when lifecycle states absent
- Markdown export includes full states table
- Pipeline E2E test passes with 7+ valid states from mock LLM
- All existing tests continue to pass
