import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv/dist/2020";

const schema = JSON.parse(
  readFileSync(resolve(__dirname, "../schema.json"), "utf-8"),
);

describe("schema.json", () => {
  it("is a valid JSON Schema", () => {
    const ajv = new Ajv();
    const valid = ajv.validateSchema(schema);
    expect(valid).toBe(true);
  });

  it("validates a minimal valid profile", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0,
      overallConfidence: 0,
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with identity section", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.92,
      identity: {
        productName: "Linear",
        description: "Modern project management tool",
        targetCustomer: "Software development teams",
        businessModel: "Per-seat SaaS subscription",
        confidence: 0.92,
        evidence: [
          {
            url: "https://linear.app/",
            excerpt: "Linear is a better way to build software",
          },
        ],
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with revenue section", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.91,
      revenue: {
        model: "Per-seat SaaS subscription",
        billingUnit: "seat",
        hasFreeTier: true,
        tiers: [
          {
            name: "Free",
            price: "$0/month",
            features: ["Up to 250 issues"],
          },
        ],
        expansionPaths: ["Free to Standard: teams hitting issue limit"],
        contractionRisks: ["Team downsizing reduces seat count"],
        confidence: 0.91,
        evidence: [
          {
            url: "https://linear.app/pricing",
            excerpt: "Free for small teams",
          },
        ],
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with journey section", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.85,
      journey: {
        stages: [
          {
            name: "Discovery",
            description: "User visits website",
            order: 0,
          },
          {
            name: "Signup",
            description: "Creates account",
            order: 1,
          },
        ],
        confidence: 0.85,
        evidence: [
          {
            url: "https://linear.app/docs/getting-started",
            excerpt: "Create your workspace",
          },
        ],
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with legacy activation definition", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.8,
      definitions: {
        activation: {
          criteria: ["Create a project", "Invite a team member"],
          timeWindow: "14d",
          reasoning: "These steps indicate real adoption",
          confidence: 0.8,
          source: "product_analysis",
          evidence: [
            {
              url: "https://linear.app/docs/getting-started",
              excerpt: "Start by creating your workspace",
            },
          ],
        },
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("validates a profile with multi-level activation definition", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.85,
      definitions: {
        activation: {
          levels: [
            {
              level: 1,
              name: "Setup Complete",
              signalStrength: "weak",
              criteria: [{ action: "create_workspace", count: 1 }],
              reasoning: "Workspace setup shows intent",
              confidence: 0.8,
              evidence: [
                {
                  url: "https://linear.app/docs/getting-started",
                  excerpt: "Start by creating your workspace",
                },
              ],
            },
          ],
          overallConfidence: 0.85,
        },
      },
    };
    expect(validate(profile)).toBe(true);
  });

  it("rejects a profile missing basesignal_version", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      completeness: 0,
      overallConfidence: 0,
    };
    expect(validate(profile)).toBe(false);
  });

  it("rejects identity with missing required fields", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.14,
      overallConfidence: 0.5,
      identity: {
        productName: "Linear",
        // missing description, targetCustomer, businessModel, confidence, evidence
      },
    };
    expect(validate(profile)).toBe(false);
  });

  it("rejects a profile missing completeness", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      overallConfidence: 0,
    };
    expect(validate(profile)).toBe(false);
  });

  it("rejects a profile missing overallConfidence", () => {
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    const profile = {
      basesignal_version: "1.0",
      completeness: 0,
    };
    expect(validate(profile)).toBe(false);
  });
});
