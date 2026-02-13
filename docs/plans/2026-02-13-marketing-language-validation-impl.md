# Implementation Plan: Marketing-Language Detection (M007-E001-S003)

## Overview

Add marketing-language detection to the candidate validation pipeline in `validateCandidates.ts`. Two new constants, one new function, one pipeline integration line, and corresponding tests.

## Tasks

### Task 1: Add constants (validateCandidates.ts)

Add after the existing `VAGUE_PHRASES` constant (line 44):

```typescript
/** Regex patterns for marketing verbs that indicate abstract business outcomes */
export const MARKETING_LANGUAGE_PATTERNS: RegExp[] = [
  /\bautomate\b/i,
  /\bstreamline\b/i,
  /\boptimize\b/i,
  /\bleverage\b/i,
  /\benhance\b/i,
  /\bempower\b/i,
  /\baccelerate\b/i,
  /\brevolutionize\b/i,
  /\btransform\b/i,
];

/** Abstract outcome phrases that indicate marketing language */
export const ABSTRACT_OUTCOME_PATTERNS: string[] = [
  "at scale",
  "cross-functional",
  "end-to-end",
  "enterprise-grade",
  "best-in-class",
  "next-generation",
];
```

### Task 2: Add `isMarketingLanguage()` function (validateCandidates.ts)

Add after `hasUnverifiedFeatureRef()` (after line 137), before `buildKnownFeaturesSet()`:

```typescript
/**
 * Check if a candidate uses marketing language without referencing a specific product surface.
 * Checks name+description against marketing verb patterns and abstract outcome phrases.
 * Returns null (not flagged) if a known feature is also referenced.
 */
export function isMarketingLanguage(
  name: string,
  description: string,
  knownFeatures: Set<string>
): string | null {
  const text = `${name} ${description}`.toLowerCase();

  // Check marketing verb patterns
  for (const pattern of MARKETING_LANGUAGE_PATTERNS) {
    if (pattern.test(name) || pattern.test(description)) {
      // Escape hatch: not flagged if text references a known product surface
      for (const feature of knownFeatures) {
        if (text.includes(feature)) return null;
      }
      return `Contains marketing language: "${name.split(" ").slice(0, 4).join(" ")}..."`;
    }
  }

  // Check abstract outcome phrases
  for (const phrase of ABSTRACT_OUTCOME_PATTERNS) {
    if (text.includes(phrase)) {
      for (const feature of knownFeatures) {
        if (text.includes(feature)) return null;
      }
      return `Contains abstract outcome phrase: "${phrase}"`;
    }
  }

  return null;
}
```

Key decisions:
- Follows same signature pattern as `isVagueCandidate()` / `hasUnverifiedFeatureRef()` but adds `knownFeatures` param
- Escape hatch: if the text also references a known product feature (from `knownFeatures` set), return null — same substring matching approach as `hasUnverifiedFeatureRef()`
- Returns explanation string on match (same as other check functions)

### Task 3: Integrate into `runValidationPipeline()` (validateCandidates.ts)

Add after the existing `hasUnverifiedFeatureRef` check (line 338), inside the deterministic checks block:

```typescript
const marketingFlag = isMarketingLanguage(
  candidate.name,
  candidate.description,
  knownFeatures
);
if (marketingFlag) flags.push(marketingFlag);
```

Single-line addition. Flagged candidates flow through existing `applyLlmReview()` — no changes needed there.

### Task 4: Add unit tests (validateCandidates.test.ts)

Add new `describe("isMarketingLanguage")` block after the existing `hasUnverifiedFeatureRef` tests. Tests required by ACs:

```typescript
describe("isMarketingLanguage", () => {
  const knownFeatures = new Set(["board", "permissions"]);

  it("flags 'Automate protection of sensitive business information'", () => {
    const result = isMarketingLanguage(
      "Automate protection of sensitive business information",
      "Protect sensitive data automatically",
      new Set()
    );
    expect(result).not.toBeNull();
    expect(result).toContain("marketing language");
  });

  it("does NOT flag 'Set board-level permissions to restrict editing'", () => {
    const result = isMarketingLanguage(
      "Set board-level permissions to restrict editing",
      "Configure permissions on the board to control who can edit",
      knownFeatures
    );
    expect(result).toBeNull();
  });

  it("flags 'Streamline cross-functional collaboration workflows'", () => {
    const result = isMarketingLanguage(
      "Streamline cross-functional collaboration workflows",
      "Improve team collaboration across departments",
      new Set()
    );
    expect(result).not.toBeNull();
  });

  it("does NOT flag 'Share a board link with the marketing team'", () => {
    const result = isMarketingLanguage(
      "Share a board link with the marketing team",
      "Send a link to the board so the marketing team can view it",
      knownFeatures
    );
    expect(result).toBeNull();
  });

  it("flags abstract outcome phrases without product surface", () => {
    const result = isMarketingLanguage(
      "Enterprise-grade security at scale",
      "Provides enterprise-grade security for organizations",
      new Set()
    );
    expect(result).not.toBeNull();
    expect(result).toContain("abstract outcome");
  });

  it("does not flag when known feature is referenced", () => {
    const result = isMarketingLanguage(
      "Optimize board layout for readability",
      "Improve the board arrangement",
      knownFeatures
    );
    expect(result).toBeNull();
  });
});
```

### Task 5: Add integration test for pipeline with marketing candidates

Add marketing-language candidates to the existing `runValidationPipeline` fixture or add a new test:

```typescript
it("flags marketing-language candidates in full pipeline", () => {
  const marketingResults: LensResult[] = [
    {
      lens: "Functional Value",
      candidates: [
        {
          id: "ml-1",
          name: "Automate protection of sensitive business information",
          description: "Protect sensitive data automatically",
        },
        {
          id: "ml-2",
          name: "Set board-level permissions to restrict editing",
          description: "Configure permissions on the board to control editing",
        },
        {
          id: "ml-3",
          name: "Streamline cross-functional collaboration workflows",
          description: "Improve team collaboration across departments",
        },
      ],
    },
  ];

  const features = new Set(["board", "permissions"]);
  const results = runValidationPipeline(marketingResults, features);

  const ml1 = results.find((r) => r.id === "ml-1");
  const ml2 = results.find((r) => r.id === "ml-2");
  const ml3 = results.find((r) => r.id === "ml-3");

  expect(ml1?.validation_status).not.toBe("valid"); // flagged
  expect(ml2?.validation_status).toBe("valid");      // not flagged (has product surface)
  expect(ml3?.validation_status).not.toBe("valid"); // flagged
});
```

### Task 6: Update imports in test file

Add `isMarketingLanguage` to the existing import statement at the top of the test file.

### Task 7: Run tests and verify

```bash
npm run test:run
```

All existing tests must still pass. All new tests must pass.

## Files Changed

| File | Change |
|------|--------|
| `convex/analysis/convergence/validateCandidates.ts` | Add 2 constants, 1 function, 1 pipeline integration line |
| `convex/analysis/convergence/validateCandidates.test.ts` | Add unit tests + integration test |

## Risks

- **"board" substring match**: The escape hatch uses substring matching. "Set board-level permissions" contains "board" which is in `knownFeatures`, so it won't be flagged. This is the intended behavior per the AC. Same approach as existing `hasUnverifiedFeatureRef()`.
- **"Share a board link with the marketing team"** — contains no marketing verb patterns or abstract phrases. The word "marketing" in context is not a verb pattern. Not flagged. Correct.
- **No existing test breakage**: The new check adds flags for candidates that weren't previously flagged. Existing pipeline tests use candidates without marketing language, so they remain unaffected.
