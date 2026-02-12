import { describe, it, expect } from "vitest";
import {
  ICP_SYSTEM_PROMPT,
  buildICPPrompt,
  parseICPProfiles,
} from "./generateICPProfiles";

// --- Test helpers ---

function makeRoleInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Product Manager",
    occurrence_count: 5,
    tier_1_count: 3,
    tier_2_count: 1,
    tier_3_plus_count: 1,
    value_moments: [
      {
        id: "vm-001",
        name: "Track feature adoption",
        description: "Monitor how users adopt new features",
        tier: 1 as const,
      },
      {
        id: "vm-002",
        name: "Prioritize roadmap items",
        description: "Use data to decide what to build next",
        tier: 2 as const,
      },
    ],
    ...overrides,
  };
}

function makeValidProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: "Product-Led PM",
    description:
      "A product manager focused on data-driven decisions and growth metrics",
    value_moment_priorities: [
      {
        moment_id: "vm-001",
        priority: 1,
        relevance_reason: "Core workflow for tracking adoption",
      },
      {
        moment_id: "vm-002",
        priority: 2,
        relevance_reason: "Supports roadmap decisions",
      },
    ],
    activation_triggers: [
      "Sets up first dashboard",
      "Connects analytics source",
    ],
    pain_points: [
      "Difficulty measuring feature impact",
      "No single source of truth for product metrics",
    ],
    success_metrics: [
      "Weekly active dashboard views > 5",
      "Feature adoption rate tracked for 3+ features",
    ],
    confidence: 0.85,
    ...overrides,
  };
}

function makeValidResponse(profiles?: Record<string, unknown>[]): string {
  if (profiles) return JSON.stringify(profiles);
  return JSON.stringify([
    makeValidProfile(),
    makeValidProfile({
      name: "Engineering Team Lead",
      description: "Technical leader focused on team velocity and quality",
      value_moment_priorities: [
        {
          moment_id: "vm-003",
          priority: 1,
          relevance_reason: "Directly impacts team efficiency",
        },
        {
          moment_id: "vm-004",
          priority: 2,
          relevance_reason: "Enables quality tracking",
        },
      ],
      activation_triggers: ["Integrates CI/CD pipeline"],
      pain_points: ["Can't quantify tech debt impact"],
      success_metrics: ["Sprint velocity variance < 10%"],
      confidence: 0.78,
    }),
  ]);
}

// --- ICP_SYSTEM_PROMPT tests ---

describe("ICP_SYSTEM_PROMPT", () => {
  it("contains persona count guidance of 2-3", () => {
    expect(ICP_SYSTEM_PROMPT).toContain("2-3");
  });

  it("contains required field value_moment_priorities", () => {
    expect(ICP_SYSTEM_PROMPT).toContain("value_moment_priorities");
  });

  it("contains role-specific naming guidance", () => {
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("role");
  });

  it("contains distinctness requirement", () => {
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("distinct");
  });
});

// --- buildICPPrompt tests ---

describe("buildICPPrompt", () => {
  it("includes target customer when non-empty", () => {
    const prompt = buildICPPrompt([makeRoleInput()], "B2B SaaS product teams");
    expect(prompt).toContain("B2B SaaS product teams");
  });

  it("includes role names from input", () => {
    const roles = [
      makeRoleInput({ name: "PM" }),
      makeRoleInput({ name: "Engineer" }),
    ];
    const prompt = buildICPPrompt(roles, "");
    expect(prompt).toContain("PM");
    expect(prompt).toContain("Engineer");
  });

  it("includes value moment IDs and names", () => {
    const prompt = buildICPPrompt([makeRoleInput()], "");
    expect(prompt).toContain("vm-001");
    expect(prompt).toContain("Track feature adoption");
  });

  it("includes tier breakdown in roles summary", () => {
    const prompt = buildICPPrompt([makeRoleInput()], "");
    expect(prompt).toContain("3 T1, 1 T2, 1 T3+");
  });

  it("includes tier information for each value moment", () => {
    const prompt = buildICPPrompt([makeRoleInput()], "");
    expect(prompt).toContain("Tier 1");
    expect(prompt).toContain("Tier 2");
  });

  it("handles empty roles array gracefully", () => {
    const prompt = buildICPPrompt([], "B2B SaaS");
    expect(prompt).toContain("B2B SaaS");
    expect(typeof prompt).toBe("string");
  });
});

// --- parseICPProfiles tests ---

describe("parseICPProfiles", () => {
  // Happy paths
  it("parses valid 2-profile response", () => {
    const profiles = parseICPProfiles(makeValidResponse());
    expect(profiles).toHaveLength(2);
  });

  it("parses valid 3-profile response", () => {
    const threeProfiles = [
      makeValidProfile(),
      makeValidProfile({
        name: "Engineering Lead",
        value_moment_priorities: [
          { moment_id: "vm-003", priority: 1, relevance_reason: "Core" },
        ],
      }),
      makeValidProfile({
        name: "VP of Product",
        value_moment_priorities: [
          { moment_id: "vm-005", priority: 1, relevance_reason: "Strategic" },
        ],
      }),
    ];
    const profiles = parseICPProfiles(JSON.stringify(threeProfiles));
    expect(profiles).toHaveLength(3);
  });

  it("assigns unique IDs to each profile", () => {
    const profiles = parseICPProfiles(makeValidResponse());
    expect(profiles[0].id).toBeTruthy();
    expect(profiles[1].id).toBeTruthy();
    expect(profiles[0].id).not.toBe(profiles[1].id);
  });

  it("handles code-fenced JSON", () => {
    const wrapped = "```json\n" + makeValidResponse() + "\n```";
    const profiles = parseICPProfiles(wrapped);
    expect(profiles).toHaveLength(2);
  });

  it("clamps confidence above 1.0 to 1.0", () => {
    const profiles = parseICPProfiles(
      makeValidResponse([
        makeValidProfile({ confidence: 1.5 }),
        makeValidProfile({
          name: "Other",
          confidence: 0.5,
          value_moment_priorities: [
            { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
          ],
        }),
      ])
    );
    expect(profiles[0].confidence).toBe(1.0);
  });

  it("clamps confidence below 0 to 0", () => {
    const profiles = parseICPProfiles(
      makeValidResponse([
        makeValidProfile({ confidence: -0.5 }),
        makeValidProfile({
          name: "Other",
          confidence: 0.5,
          value_moment_priorities: [
            { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
          ],
        }),
      ])
    );
    expect(profiles[0].confidence).toBe(0);
  });

  // Count validation
  it("throws on 1-profile response", () => {
    expect(() =>
      parseICPProfiles(JSON.stringify([makeValidProfile()]))
    ).toThrow(/2-3/);
  });

  it("throws on 4-profile response", () => {
    const fourProfiles = Array.from({ length: 4 }, (_, i) =>
      makeValidProfile({
        name: `Persona ${i}`,
        value_moment_priorities: [
          { moment_id: `vm-${i}`, priority: 1, relevance_reason: "X" },
        ],
      })
    );
    expect(() => parseICPProfiles(JSON.stringify(fourProfiles))).toThrow(/2-3/);
  });

  it("throws on 0-profile (empty array) response", () => {
    expect(() => parseICPProfiles(JSON.stringify([]))).toThrow(/2-3/);
  });

  // Field validation
  it("throws on missing name", () => {
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({ name: "" }),
          makeValidProfile({
            name: "Other",
            value_moment_priorities: [
              { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
            ],
          }),
        ])
      )
    ).toThrow(/name/i);
  });

  it("throws on missing description", () => {
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({ description: "" }),
          makeValidProfile({
            name: "Other",
            value_moment_priorities: [
              { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
            ],
          }),
        ])
      )
    ).toThrow(/description/i);
  });

  it("throws on missing value_moment_priorities", () => {
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({ value_moment_priorities: undefined }),
          makeValidProfile({
            name: "Other",
            value_moment_priorities: [
              { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
            ],
          }),
        ])
      )
    ).toThrow(/value_moment_priorities/i);
  });

  it("throws on empty value_moment_priorities array", () => {
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({ value_moment_priorities: [] }),
          makeValidProfile({
            name: "Other",
            value_moment_priorities: [
              { moment_id: "vm-999", priority: 1, relevance_reason: "X" },
            ],
          }),
        ])
      )
    ).toThrow(/value_moment_priorities/i);
  });

  it("throws on non-array response", () => {
    expect(() =>
      parseICPProfiles(JSON.stringify({ profiles: [] }))
    ).toThrow(/array/i);
  });

  // Distinctness validation
  it("throws when two profiles have identical moment_id sets (same order)", () => {
    const samePriorities = [
      { moment_id: "vm-001", priority: 1, relevance_reason: "A" },
      { moment_id: "vm-002", priority: 2, relevance_reason: "B" },
    ];
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({
            name: "Profile A",
            value_moment_priorities: samePriorities,
          }),
          makeValidProfile({
            name: "Profile B",
            value_moment_priorities: samePriorities,
          }),
        ])
      )
    ).toThrow(/distinct/i);
  });

  it("throws when two profiles have identical moment_id sets (different order)", () => {
    expect(() =>
      parseICPProfiles(
        makeValidResponse([
          makeValidProfile({
            name: "Profile A",
            value_moment_priorities: [
              { moment_id: "vm-001", priority: 1, relevance_reason: "A" },
              { moment_id: "vm-002", priority: 2, relevance_reason: "B" },
            ],
          }),
          makeValidProfile({
            name: "Profile B",
            value_moment_priorities: [
              { moment_id: "vm-002", priority: 1, relevance_reason: "C" },
              { moment_id: "vm-001", priority: 2, relevance_reason: "D" },
            ],
          }),
        ])
      )
    ).toThrow(/distinct/i);
  });

  it("passes when profiles share some but not all moment_ids", () => {
    const profiles = parseICPProfiles(
      makeValidResponse([
        makeValidProfile({
          name: "Profile A",
          value_moment_priorities: [
            { moment_id: "vm-001", priority: 1, relevance_reason: "A" },
            { moment_id: "vm-002", priority: 2, relevance_reason: "B" },
          ],
        }),
        makeValidProfile({
          name: "Profile B",
          value_moment_priorities: [
            { moment_id: "vm-001", priority: 1, relevance_reason: "C" },
            { moment_id: "vm-003", priority: 2, relevance_reason: "D" },
          ],
        }),
      ])
    );
    expect(profiles).toHaveLength(2);
  });
});
