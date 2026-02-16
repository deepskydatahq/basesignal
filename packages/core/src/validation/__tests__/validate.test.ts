import { describe, it, expect } from "vitest";
import { validateProfile, validateSection } from "../index";

const minimalProfile = {
  basesignal_version: "1.0",
  completeness: 0.5,
  overallConfidence: 0.7,
};

const validIdentity = {
  productName: "Basesignal",
  description: "Product P&L measurement",
  targetCustomer: "Product leaders",
  businessModel: "SaaS",
  confidence: 0.85,
  evidence: [{ url: "https://example.com", excerpt: "Evidence text" }],
};

const validRevenue = {
  model: "Subscription",
  hasFreeTier: true,
  tiers: [],
  expansionPaths: [],
  contractionRisks: [],
  confidence: 0.9,
  evidence: [],
};

const legacyActivation = {
  activation: {
    criteria: ["Created first project"],
    reasoning: "Correlates with retention",
    confidence: 0.8,
    source: "analysis",
    evidence: [],
  },
};

const multiLevelActivation = {
  activation: {
    levels: [
      {
        level: 1,
        name: "Setup",
        signalStrength: "weak",
        criteria: [{ action: "create_account", count: 1 }],
        reasoning: "Basic setup",
        confidence: 0.6,
        evidence: [],
      },
    ],
    overallConfidence: 0.7,
  },
};

const completeProfile = {
  ...minimalProfile,
  identity: validIdentity,
  revenue: validRevenue,
};

// --- validateProfile ---

describe("validateProfile", () => {
  describe("happy path", () => {
    it("validates a complete profile", () => {
      const result = validateProfile(completeProfile);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.basesignal_version).toBe("1.0");
      }
    });

    it("validates a minimal profile", () => {
      const result = validateProfile(minimalProfile);
      expect(result.success).toBe(true);
    });
  });

  describe("error cases", () => {
    it("fails for missing basesignal_version", () => {
      const { basesignal_version, ...rest } = minimalProfile;
      const result = validateProfile(rest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.path.includes("basesignal_version"))).toBe(true);
      }
    });

    it("fails for invalid nested field with correct deep path", () => {
      const data = {
        ...minimalProfile,
        identity: {
          ...validIdentity,
          evidence: [{ url: "", excerpt: "text" }],
        },
      };
      const result = validateProfile(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const urlError = result.errors.find((e) =>
          e.path.includes("identity") && e.path.includes("evidence"),
        );
        expect(urlError).toBeDefined();
      }
    });

    it("fails for completeness out of range", () => {
      const result = validateProfile({ ...minimalProfile, completeness: 1.5 });
      expect(result.success).toBe(false);
    });
  });
});

// --- validateSection ---

describe("validateSection", () => {
  it("validates identity section", () => {
    const result = validateSection("identity", validIdentity);
    expect(result.success).toBe(true);
  });

  it("returns errors for invalid identity", () => {
    const result = validateSection("identity", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("validates revenue section", () => {
    const result = validateSection("revenue", validRevenue);
    expect(result.success).toBe(true);
  });

  it("validates definitions with legacy activation", () => {
    const result = validateSection("definitions", legacyActivation);
    expect(result.success).toBe(true);
  });

  it("validates definitions with multi-level activation", () => {
    const result = validateSection("definitions", multiLevelActivation);
    expect(result.success).toBe(true);
  });
});

// --- Error structure ---

describe("error structure", () => {
  it("errors have path, expected, received, message fields", () => {
    const result = validateProfile({ completeness: "not a number" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.errors[0];
      expect(error).toHaveProperty("path");
      expect(error).toHaveProperty("expected");
      expect(error).toHaveProperty("received");
      expect(error).toHaveProperty("message");
      expect(Array.isArray(error.path)).toBe(true);
    }
  });

  it("returns multiple errors for multiple invalid fields", () => {
    const result = validateProfile({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(1);
    }
  });
});

// --- Edge cases ---

describe("edge cases", () => {
  it("validateProfile(null) fails gracefully", () => {
    const result = validateProfile(null);
    expect(result.success).toBe(false);
  });

  it("validateProfile(undefined) fails gracefully", () => {
    const result = validateProfile(undefined);
    expect(result.success).toBe(false);
  });

  it("validateProfile('string') fails gracefully", () => {
    const result = validateProfile("string");
    expect(result.success).toBe(false);
  });

  it("empty definitions object passes (all sub-fields optional)", () => {
    const result = validateSection("definitions", {});
    expect(result.success).toBe(true);
  });
});
