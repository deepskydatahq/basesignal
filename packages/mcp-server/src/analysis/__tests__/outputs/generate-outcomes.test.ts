import { describe, it, expect } from "vitest";
import {
  generateOutcomes,
  parseOutcomesResponse,
  buildOutcomesPrompt,
} from "../../outputs/generate-outcomes.js";
import type { LlmProvider, ValueMoment, IdentityResult, ICPProfile } from "../../types.js";

// --- Fixtures ---

const sampleIdentity: IdentityResult = {
  productName: "TestApp",
  description: "A collaboration tool for dev teams",
  targetCustomer: "Developers",
  businessModel: "B2B SaaS",
  industry: "DevTools",
  confidence: 0.8,
  evidence: [],
};

const sampleValueMoments: ValueMoment[] = [
  {
    id: "vm-1",
    name: "Quick setup",
    description: "Set up project in seconds",
    tier: 1,
    lens_count: 3,
    lenses: ["jtbd"],
    roles: ["Developer"],
    product_surfaces: ["Onboarding", "Dashboard"],
    contributing_candidates: [],
  },
  {
    id: "vm-2",
    name: "Team sharing",
    description: "Share boards with team members",
    tier: 2,
    lens_count: 2,
    lenses: ["workflows"],
    roles: ["Team Lead"],
    product_surfaces: ["Boards", "Sharing"],
    contributing_candidates: [],
  },
];

const sampleICPProfiles: ICPProfile[] = [
  {
    id: "icp-1",
    name: "Dev Lead",
    description: "Leads a dev team building software",
    value_moment_priorities: [{ moment_id: "vm-1", priority: 1, relevance_reason: "Core" }],
    activation_triggers: ["create_project"],
    pain_points: ["Slow setup", "Poor collaboration"],
    success_metrics: ["Setup < 1 min", "Team adoption > 80%"],
    confidence: 0.8,
    sources: [],
  },
];

const validOutcomesResponse = JSON.stringify([
  {
    description: "Reduce onboarding time for new developers",
    type: "user",
    linkedFeatures: ["Onboarding", "Dashboard"],
  },
  {
    description: "Increase team collaboration through board sharing",
    type: "business",
    linkedFeatures: ["Boards", "Sharing"],
  },
  {
    description: "Improve feature adoption via guided setup flow",
    type: "product",
    linkedFeatures: ["Onboarding"],
  },
]);

function createMockLlm(response: string): LlmProvider {
  return {
    complete: async () => response,
  } as LlmProvider;
}

// --- Tests ---

describe("parseOutcomesResponse", () => {
  it("parses valid JSON array with required fields", () => {
    const result = parseOutcomesResponse(validOutcomesResponse);

    expect(result).toHaveLength(3);
    expect(result[0].description).toBe("Reduce onboarding time for new developers");
    expect(result[0].type).toBe("user");
    expect(result[0].linkedFeatures).toEqual(["Onboarding", "Dashboard"]);
    expect(result[1].type).toBe("business");
    expect(result[2].type).toBe("product");
  });

  it("throws on non-array input", () => {
    expect(() => parseOutcomesResponse(JSON.stringify({ foo: "bar" }))).toThrow(
      "Expected JSON array",
    );
  });

  it("throws on entry missing description", () => {
    expect(() =>
      parseOutcomesResponse(JSON.stringify([{ type: "business", linkedFeatures: [] }])),
    ).toThrow("missing required field: description");
  });

  it("throws on entry missing type", () => {
    expect(() =>
      parseOutcomesResponse(
        JSON.stringify([{ description: "Some outcome", linkedFeatures: [] }]),
      ),
    ).toThrow("missing required field: type");
  });

  it("throws on invalid type value", () => {
    expect(() =>
      parseOutcomesResponse(
        JSON.stringify([{ description: "Some outcome", type: "invalid", linkedFeatures: [] }]),
      ),
    ).toThrow('invalid type: "invalid"');
  });

  it("throws on entry missing linkedFeatures", () => {
    expect(() =>
      parseOutcomesResponse(
        JSON.stringify([{ description: "Some outcome", type: "business" }]),
      ),
    ).toThrow("missing required field: linkedFeatures");
  });

  it("throws on non-object entry", () => {
    expect(() => parseOutcomesResponse(JSON.stringify(["not an object"]))).toThrow(
      "must be an object",
    );
  });

  it("filters non-string values from linkedFeatures", () => {
    const result = parseOutcomesResponse(
      JSON.stringify([
        { description: "Outcome", type: "business", linkedFeatures: ["Feature1", 42, "Feature2", null] },
      ]),
    );
    expect(result[0].linkedFeatures).toEqual(["Feature1", "Feature2"]);
  });
});

describe("buildOutcomesPrompt", () => {
  it("includes identity info when provided", () => {
    const prompt = buildOutcomesPrompt([], sampleIdentity, []);
    expect(prompt).toContain("TestApp");
    expect(prompt).toContain("collaboration tool");
    expect(prompt).toContain("Developers");
  });

  it("includes value moment details", () => {
    const prompt = buildOutcomesPrompt(sampleValueMoments, null, []);
    expect(prompt).toContain("Quick setup");
    expect(prompt).toContain("Tier 1");
    expect(prompt).toContain("Onboarding, Dashboard");
    expect(prompt).toContain("Developer");
  });

  it("includes ICP profile details", () => {
    const prompt = buildOutcomesPrompt([], null, sampleICPProfiles);
    expect(prompt).toContain("Dev Lead");
    expect(prompt).toContain("Slow setup");
    expect(prompt).toContain("Team adoption > 80%");
  });
});

describe("generateOutcomes", () => {
  it("returns OutcomeItem[] with description, type, linkedFeatures", async () => {
    const llm = createMockLlm(validOutcomesResponse);

    const result = await generateOutcomes(sampleValueMoments, sampleIdentity, sampleICPProfiles, llm);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("description");
    expect(result[0]).toHaveProperty("type");
    expect(result[0]).toHaveProperty("linkedFeatures");
  });

  it("includes business, user, and product outcome types", async () => {
    const llm = createMockLlm(validOutcomesResponse);

    const result = await generateOutcomes(sampleValueMoments, sampleIdentity, sampleICPProfiles, llm);

    const types = result.map((o) => o.type);
    expect(types).toContain("business");
    expect(types).toContain("user");
    expect(types).toContain("product");
  });

  it("linkedFeatures are extracted from value moment product_surfaces and names", async () => {
    const llm = createMockLlm(validOutcomesResponse);

    const result = await generateOutcomes(sampleValueMoments, sampleIdentity, sampleICPProfiles, llm);

    // The mock response includes product surfaces from value moments
    const allLinkedFeatures = result.flatMap((o) => o.linkedFeatures);
    expect(allLinkedFeatures).toContain("Onboarding");
    expect(allLinkedFeatures).toContain("Dashboard");
    expect(allLinkedFeatures).toContain("Boards");
  });

  it("returns empty array when value_moments is empty", async () => {
    const llm = createMockLlm("should not be called");

    const result = await generateOutcomes([], sampleIdentity, sampleICPProfiles, llm);

    expect(result).toEqual([]);
  });

  it("works with null identity", async () => {
    const llm = createMockLlm(validOutcomesResponse);

    const result = await generateOutcomes(sampleValueMoments, null, sampleICPProfiles, llm);

    expect(result).toHaveLength(3);
  });

  it("works with empty ICP profiles", async () => {
    const llm = createMockLlm(validOutcomesResponse);

    const result = await generateOutcomes(sampleValueMoments, sampleIdentity, [], llm);

    expect(result).toHaveLength(3);
  });

  it("propagates LLM errors", async () => {
    const llm = {
      complete: async () => { throw new Error("LLM failed"); },
    } as unknown as LlmProvider;

    await expect(
      generateOutcomes(sampleValueMoments, sampleIdentity, sampleICPProfiles, llm),
    ).rejects.toThrow("LLM failed");
  });
});
