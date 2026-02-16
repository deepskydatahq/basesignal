import { describe, it, expect } from "vitest";
import {
  parseActivationMapResponse,
  buildActivationMapUserPrompt,
} from "../../outputs/activation-map.js";
import type { ActivationLevel } from "@basesignal/core";
import type { ValueMoment } from "../../types.js";

const sampleLevels: ActivationLevel[] = [
  {
    level: 1,
    name: "explorer",
    signalStrength: "weak",
    criteria: [{ action: "create_board", count: 1 }],
    reasoning: "Initial interest",
    confidence: 0.7,
    evidence: [],
  },
  {
    level: 2,
    name: "builder",
    signalStrength: "medium",
    criteria: [{ action: "invite_member", count: 2 }],
    reasoning: "Team adoption",
    confidence: 0.6,
    evidence: [],
  },
];

const sampleMoments: ValueMoment[] = [
  {
    id: "vm-1",
    name: "Sprint planning",
    description: "Plan sprints faster",
    tier: 1,
    lens_count: 4,
    lenses: ["capability_mapping"],
    roles: ["EM"],
    product_surfaces: ["Sprint Planning"],
    contributing_candidates: [],
    is_coherent: true,
  },
];

describe("buildActivationMapUserPrompt", () => {
  it("includes activation levels and value moments", () => {
    const prompt = buildActivationMapUserPrompt(sampleLevels, sampleMoments, 2);
    expect(prompt).toContain("Level 1: explorer");
    expect(prompt).toContain("Level 2: builder");
    expect(prompt).toContain("Sprint planning");
    expect(prompt).toContain("Primary Activation Level: 2");
  });

  it("includes criteria details", () => {
    const prompt = buildActivationMapUserPrompt(sampleLevels, sampleMoments, 1);
    expect(prompt).toContain("create_board");
    expect(prompt).toContain("invite_member");
  });
});

describe("parseActivationMapResponse", () => {
  it("parses valid activation map JSON", () => {
    const input = JSON.stringify({
      stages: [
        {
          level: 1,
          name: "explorer",
          signal_strength: "weak",
          trigger_events: ["create_board"],
          value_moments_unlocked: ["Board creation"],
          drop_off_risk: { level: "medium", reason: "May not invite team" },
        },
        {
          level: 2,
          name: "builder",
          signal_strength: "medium",
          trigger_events: ["invite_member"],
          value_moments_unlocked: ["Sprint planning"],
          drop_off_risk: { level: "high", reason: "Team adoption hurdle" },
        },
      ],
      transitions: [
        { from_level: 1, to_level: 2, trigger_events: ["invite_member"], typical_timeframe: "1-3 days" },
      ],
      primary_activation_level: 2,
      confidence: "medium",
      sources: ["activation_levels"],
    });

    const result = parseActivationMapResponse(input);
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0].level).toBe(1);
    expect(result.stages[1].level).toBe(2);
    expect(result.transitions).toHaveLength(1);
    expect(result.primary_activation_level).toBe(2);
    expect(result.confidence).toBe("medium");
  });

  it("sorts stages by level ascending", () => {
    const input = JSON.stringify({
      stages: [
        {
          level: 2,
          name: "builder",
          signal_strength: "medium",
          trigger_events: ["invite"],
          value_moments_unlocked: [],
          drop_off_risk: { level: "low", reason: "r" },
        },
        {
          level: 1,
          name: "explorer",
          signal_strength: "weak",
          trigger_events: ["create"],
          value_moments_unlocked: [],
          drop_off_risk: { level: "medium", reason: "r" },
        },
      ],
      transitions: [],
      primary_activation_level: 1,
      confidence: "low",
      sources: [],
    });

    const result = parseActivationMapResponse(input);
    expect(result.stages[0].level).toBe(1);
    expect(result.stages[1].level).toBe(2);
  });

  it("rejects missing stages", () => {
    const input = JSON.stringify({
      transitions: [],
      primary_activation_level: 1,
      confidence: "low",
      sources: [],
    });
    expect(() => parseActivationMapResponse(input)).toThrow("Missing required field: stages");
  });

  it("rejects missing transitions", () => {
    const input = JSON.stringify({
      stages: [{
        level: 1, name: "a", signal_strength: "weak",
        trigger_events: ["e"], value_moments_unlocked: [],
        drop_off_risk: { level: "low", reason: "r" },
      }],
      primary_activation_level: 1,
      confidence: "low",
      sources: [],
    });
    expect(() => parseActivationMapResponse(input)).toThrow("Missing required field: transitions");
  });

  it("rejects primary_activation_level not matching any stage", () => {
    const input = JSON.stringify({
      stages: [{
        level: 1, name: "a", signal_strength: "weak",
        trigger_events: ["e"], value_moments_unlocked: [],
        drop_off_risk: { level: "low", reason: "r" },
      }],
      transitions: [],
      primary_activation_level: 99,
      confidence: "low",
      sources: [],
    });
    expect(() => parseActivationMapResponse(input)).toThrow("does not match any stage");
  });

  it("rejects stage with empty trigger_events", () => {
    const input = JSON.stringify({
      stages: [{
        level: 1, name: "a", signal_strength: "weak",
        trigger_events: [], value_moments_unlocked: [],
        drop_off_risk: { level: "low", reason: "r" },
      }],
      transitions: [],
      primary_activation_level: 1,
      confidence: "low",
      sources: [],
    });
    expect(() => parseActivationMapResponse(input)).toThrow("trigger_events");
  });

  it("rejects stage without drop_off_risk", () => {
    const input = JSON.stringify({
      stages: [{
        level: 1, name: "a", signal_strength: "weak",
        trigger_events: ["e"], value_moments_unlocked: [],
      }],
      transitions: [],
      primary_activation_level: 1,
      confidence: "low",
      sources: [],
    });
    expect(() => parseActivationMapResponse(input)).toThrow("drop_off_risk");
  });
});
