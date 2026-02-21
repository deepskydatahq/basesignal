import { describe, it, expect } from "vitest";
import { runAnalysisPipeline } from "../pipeline.js";
import { createMockLlm } from "./fixtures/mock-llm.js";
import { SAMPLE_PAGES, EMPTY_PAGES } from "./fixtures/pages.js";
import type { PipelineInput, ProgressEvent } from "../types.js";

describe("runAnalysisPipeline", () => {
  it("runs the full pipeline and returns PipelineResult", async () => {
    const mockLlm = createMockLlm();
    const input: PipelineInput = {
      pages: SAMPLE_PAGES,
    };

    const result = await runAnalysisPipeline(input, mockLlm);

    expect(result.identity).not.toBeNull();
    expect(result.identity?.productName).toBe("Example Product");
    expect(result.activation_levels).not.toBeNull();
    expect(result.activation_levels?.levels.length).toBeGreaterThanOrEqual(2);
    expect(result.lens_candidates.length).toBeGreaterThan(0);
    expect(result.convergence).not.toBeNull();
    expect(result.convergence?.value_moments.length).toBeGreaterThan(0);
    expect(result.outputs.icp_profiles.length).toBeGreaterThanOrEqual(2);
    expect(result.outputs.activation_map).not.toBeNull();
    expect(result.outputs.measurement_spec).not.toBeNull();
    expect(result.execution_time_ms).toBeGreaterThan(0);
    // Multiple LLM calls expected (identity, activation, 7 lenses, clustering, merge per cluster, ICP, activation map, measurement spec)
    expect(mockLlm.callCount).toBeGreaterThan(10);

    // Intermediates should be populated
    expect(result.intermediates).toBeDefined();
    expect(result.intermediates.lens_results.length).toBeGreaterThan(0);
    expect(result.intermediates.validated_candidates.length).toBeGreaterThan(0);
    expect(result.intermediates.clusters).not.toBeNull();
    // Each lens result should have a lens name and candidates
    for (const lr of result.intermediates.lens_results) {
      expect(lr.lens).toBeTruthy();
      expect(Array.isArray(lr.candidates)).toBe(true);
    }
  });

  it("returns empty result when no pages provided", async () => {
    const result = await runAnalysisPipeline({ pages: EMPTY_PAGES }, createMockLlm());
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].phase).toBe("input");
    expect(result.lens_candidates).toHaveLength(0);
    expect(result.identity).toBeNull();
    expect(result.convergence).toBeNull();
    expect(result.intermediates.lens_results).toHaveLength(0);
    expect(result.intermediates.validated_candidates).toHaveLength(0);
    expect(result.intermediates.clusters).toBeNull();
  });

  it("reports progress for each phase", async () => {
    const events: ProgressEvent[] = [];
    const mockLlm = createMockLlm();

    await runAnalysisPipeline(
      { pages: SAMPLE_PAGES },
      mockLlm,
      (event) => events.push(event),
    );

    expect(events.some((e) => e.phase === "identity")).toBe(true);
    expect(events.some((e) => e.phase === "activation_levels")).toBe(true);
    expect(events.some((e) => e.phase === "lenses_batch1")).toBe(true);
    expect(events.some((e) => e.phase === "convergence")).toBe(true);
  });

  it("uses identity result to enrich product context for lenses", async () => {
    const mockLlm = createMockLlm();
    await runAnalysisPipeline({ pages: SAMPLE_PAGES }, mockLlm);

    // The lens calls should include the identity-derived product context
    // Find a lens call (e.g., Capability Mapping)
    const lensCall = mockLlm.calls.find((c) =>
      c.messages.some((m) => m.content.includes("Capability Mapping lens")),
    );
    expect(lensCall).toBeDefined();
    // The user message should contain the product name from identity
    const userMsg = lensCall!.messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Example Product");
  });
});
