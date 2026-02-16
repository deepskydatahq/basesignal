import { describe, it, expect } from "vitest";
import { runAllLenses, buildBatch1ContextSummary } from "../../lenses/index.js";
import { createMockLlm, createFailingMockLlm } from "../fixtures/mock-llm.js";
import { SAMPLE_PAGES } from "../fixtures/pages.js";
import type { LensResult } from "@basesignal/core";

describe("runAllLenses", () => {
  it("returns results from all 7 lenses", async () => {
    const mockLlm = createMockLlm();
    const result = await runAllLenses(SAMPLE_PAGES, mockLlm);

    expect(result.batch1Results).toHaveLength(4);
    expect(result.batch2Results).toHaveLength(3);
    expect(result.allCandidates.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.execution_time_ms).toBeGreaterThan(0);

    // Verify lens types
    const lensTypes = [...result.batch1Results, ...result.batch2Results].map((r) => r.lens);
    expect(lensTypes).toContain("capability_mapping");
    expect(lensTypes).toContain("effort_elimination");
    expect(lensTypes).toContain("time_compression");
    expect(lensTypes).toContain("artifact_creation");
    expect(lensTypes).toContain("info_asymmetry");
    expect(lensTypes).toContain("decision_enablement");
    expect(lensTypes).toContain("state_transitions");
  });

  it("captures errors from failed lenses but continues", async () => {
    const mockLlm = createFailingMockLlm("Capability Mapping lens");
    const result = await runAllLenses(SAMPLE_PAGES, mockLlm);

    // Capability mapping failed, 3 other batch1 + 3 batch2 should succeed
    expect(result.batch1Results).toHaveLength(3);
    expect(result.batch2Results).toHaveLength(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].lens).toBe("capability_mapping");
  });

  it("batch 2 runs with partial batch 1 context when some fail", async () => {
    const mockLlm = createFailingMockLlm("Effort Elimination lens");
    const result = await runAllLenses(SAMPLE_PAGES, mockLlm);

    // Batch 2 should still run with context from 3 successful batch 1 lenses
    expect(result.batch2Results).toHaveLength(3);
    expect(result.batch1Results).toHaveLength(3);
  });

  it("includes product context in lens calls", async () => {
    const mockLlm = createMockLlm();
    await runAllLenses(SAMPLE_PAGES, mockLlm, {
      name: "TestApp",
      description: "A great app",
    });

    // Find a lens call and verify product context is in user message
    const capabilityCall = mockLlm.calls.find((c) =>
      c.messages.some((m) => m.content.includes("Capability Mapping lens")),
    );
    const userMsg = capabilityCall?.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("TestApp");
  });
});

describe("buildBatch1ContextSummary", () => {
  it("produces correct structure with top 5 candidates per lens", () => {
    const batch1Results: LensResult[] = [
      {
        lens: "capability_mapping",
        candidates: Array.from({ length: 8 }, (_, i) => ({
          id: `c-${i}`,
          lens: "capability_mapping" as const,
          name: `Candidate ${i}`,
          description: `Description ${i}`,
          role: "User",
          confidence: "medium" as const,
          source_urls: [],
        })),
        candidate_count: 8,
        execution_time_ms: 100,
      },
    ];

    const context = buildBatch1ContextSummary(batch1Results);

    expect(context.capability_mapping).toBeDefined();
    expect(context.capability_mapping.candidates).toHaveLength(5);
    expect(context.capability_mapping.candidates[0].name).toBe("Candidate 0");
  });

  it("returns empty context for empty results", () => {
    const context = buildBatch1ContextSummary([]);
    expect(Object.keys(context)).toHaveLength(0);
  });
});
