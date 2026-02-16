# Experiential Name Validation Design

## Overview

Add a fourth quality check to `validateConvergenceQuality()` that detects when merged value moment names use business verbs instead of user-action verbs. This is a non-blocking warning that monitors LLM prompt quality after the merge/clustering prompt rewrite (M007-E002-S001).

## Problem Statement

The convergence merge prompt currently produces value moment names starting with business verbs ("Gain visibility into workload") rather than experiential user-action verbs ("View a heatmap of team workload"). After the prompt rewrite, this validation serves as a safety net to detect LLM drift back to business language.

## Expert Perspectives

### Technical
- **Exact first-word matching is sufficient** — no stemming needed. LLM prompts enforce imperative/base verb forms, so conjugation variants ("Gaining") are negligible. Stemming adds a dependency and edge cases for minimal gain.
- **This is monitoring, not gating** — false negatives from missed conjugations are acceptable because the check detects prompt drift, not enforces correctness.
- **Use Set for O(1) lookup** — lowercase the extracted first word, check against lowercased Set entries.

### Simplification Review
- Core logic (~15 lines, 2 constants, warn-only) is minimal and correct.
- USER_ACTION_VERBS is required by acceptance criteria but unused by check logic — export it with a comment noting it's a reference constant.
- The warn-only nature is self-evident from the code; no need to over-document it.

## Proposed Solution

### Constants (in `convergeAndTier.ts`)

```typescript
export const BUSINESS_VERBS = new Set([
  "gain", "reduce", "accelerate", "optimize", "streamline",
  "automate", "leverage", "enable", "enhance", "empower",
  "transform", "revolutionize",
]);

/** Reference constant per spec — not used by validation logic. */
export const USER_ACTION_VERBS = new Set([
  "create", "share", "export", "build", "drag", "invite",
  "comment", "vote", "upload", "filter", "tag", "open",
  "view", "configure", "set", "move",
]);
```

### Check Logic (inside `validateConvergenceQuality()`)

```typescript
const businessVerbMoments = result.value_moments.filter((m) => {
  const firstWord = m.name.split(/\s+/)[0]?.toLowerCase();
  return firstWord ? BUSINESS_VERBS.has(firstWord) : false;
});

const namesStatus: QualityStatus = businessVerbMoments.length > 0 ? "warn" : "pass";
const namesMessage = businessVerbMoments.length > 0
  ? `${businessVerbMoments.length} moment(s) use business verbs: ${businessVerbMoments.slice(0, 3).map((m) => `"${m.name}"`).join(", ")}${businessVerbMoments.length > 3 ? ` and ${businessVerbMoments.length - 3} more` : ""}`
  : "All moment names use experiential language";

checks.push({ name: "experiential_names", status: namesStatus, message: namesMessage });
```

### Tests (in `convergeAndTier.test.ts`)

5 test cases:
1. "Gain visibility into workload" -> warns
2. "View a heatmap of team workload" -> passes
3. "Automate protection of sensitive data" -> warns
4. All business verbs -> still only warns (never fail)
5. Multiple offenders -> reports count + up to 3 examples

Plus update existing "healthy result" test to expect 4 checks.

## Alternatives Considered

- **Stemmed/prefix matching** — Catches conjugations like "Gaining" but adds complexity for a monitoring-only check where LLMs use base forms. Rejected per technical architect.
- **Check for presence of user-action verbs instead** — Would reject valid verbs not in the USER_ACTION_VERBS list (e.g., "Discover"). Too restrictive for a non-blocking warning.

## Success Criteria

- All 3 required test cases pass (Gain -> warn, View -> pass, Automate -> warn)
- Check never produces "fail" status
- Existing convergence tests continue to pass
- Warning message is actionable (shows count + examples)
