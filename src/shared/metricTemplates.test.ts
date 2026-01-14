import { describe, expect, test, it } from "vitest";
import {
  METRIC_CATEGORIES,
  METRIC_TEMPLATES,
  CATEGORY_INFO,
  getOverviewTemplates,
  getFirstValueTemplates,
  getAllTemplates,
  getTemplateByKey,
  getTemplatesByPhase,
  interpolateTemplate,
  interpolateTemplates,
  type MetricTemplate,
  METRIC_VARIATIONS,
  LIFECYCLE_SLOTS,
  type SlotVariationTemplate,
  SLOT_METRIC_TEMPLATES,
} from "./metricTemplates";

describe("METRIC_CATEGORIES", () => {
  test("has 4 categories matching P&L framework", () => {
    expect(METRIC_CATEGORIES).toHaveLength(4);
    expect(METRIC_CATEGORIES).toContain("reach");
    expect(METRIC_CATEGORIES).toContain("engagement");
    expect(METRIC_CATEGORIES).toContain("value_delivery");
    expect(METRIC_CATEGORIES).toContain("value_capture");
  });
});

describe("METRIC_TEMPLATES structure", () => {
  test("has 8 total templates", () => {
    expect(METRIC_TEMPLATES).toHaveLength(8);
  });

  test("each template has all required fields", () => {
    for (const template of METRIC_TEMPLATES) {
      expect(template.key).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.definition).toBeTruthy();
      expect(template.formula).toBeTruthy();
      expect(template.whyItMatters).toBeTruthy();
      expect(template.howToImprove).toBeTruthy();
      expect(METRIC_CATEGORIES).toContain(template.category);
      expect(["overview", "first_value"]).toContain(template.generatedAfter);
    }
  });

  test("all template keys are unique", () => {
    const keys = METRIC_TEMPLATES.map((t) => t.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test("templates have valid categories from METRIC_CATEGORIES", () => {
    for (const template of METRIC_TEMPLATES) {
      expect(METRIC_CATEGORIES).toContain(template.category);
    }
  });
});

describe("getOverviewTemplates", () => {
  test("returns 6 templates", () => {
    const templates = getOverviewTemplates();
    expect(templates).toHaveLength(6);
  });

  test("all returned templates have generatedAfter = overview", () => {
    const templates = getOverviewTemplates();
    for (const template of templates) {
      expect(template.generatedAfter).toBe("overview");
    }
  });

  test("includes expected metric keys", () => {
    const templates = getOverviewTemplates();
    const keys = templates.map((t) => t.key);
    expect(keys).toContain("new_users");
    expect(keys).toContain("mau");
    expect(keys).toContain("dau");
    expect(keys).toContain("dau_mau_ratio");
    expect(keys).toContain("retention_d7");
    expect(keys).toContain("core_action_frequency");
  });
});

describe("getFirstValueTemplates", () => {
  test("returns 2 templates", () => {
    const templates = getFirstValueTemplates();
    expect(templates).toHaveLength(2);
  });

  test("all returned templates have generatedAfter = first_value", () => {
    const templates = getFirstValueTemplates();
    for (const template of templates) {
      expect(template.generatedAfter).toBe("first_value");
    }
  });

  test("includes expected metric keys", () => {
    const templates = getFirstValueTemplates();
    const keys = templates.map((t) => t.key);
    expect(keys).toContain("activation_rate");
    expect(keys).toContain("time_to_first_value");
  });
});

describe("getAllTemplates", () => {
  test("returns all 8 templates", () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(8);
  });

  test("returns a copy, not the original array", () => {
    const templates = getAllTemplates();
    templates.push({} as MetricTemplate);
    expect(getAllTemplates()).toHaveLength(8);
  });
});

describe("getTemplateByKey", () => {
  test("returns correct template for valid key", () => {
    const template = getTemplateByKey("activation_rate");
    expect(template).toBeDefined();
    expect(template?.name).toBe("Activation Rate");
    expect(template?.category).toBe("value_delivery");
  });

  test("returns undefined for invalid key", () => {
    const template = getTemplateByKey("nonexistent_metric");
    expect(template).toBeUndefined();
  });

  test("finds each template by its key", () => {
    for (const original of METRIC_TEMPLATES) {
      const found = getTemplateByKey(original.key);
      expect(found).toBe(original);
    }
  });
});

describe("getTemplatesByPhase", () => {
  test("returns overview templates for overview phase", () => {
    const templates = getTemplatesByPhase("overview");
    expect(templates).toHaveLength(6);
    for (const t of templates) {
      expect(t.generatedAfter).toBe("overview");
    }
  });

  test("returns first_value templates for first_value phase", () => {
    const templates = getTemplatesByPhase("first_value");
    expect(templates).toHaveLength(2);
    for (const t of templates) {
      expect(t.generatedAfter).toBe("first_value");
    }
  });
});

describe("interpolateTemplate", () => {
  test("replaces {{firstValueActivity}} placeholder", () => {
    const template = getTemplateByKey("activation_rate")!;
    const result = interpolateTemplate(template, {
      productName: "Acme",
      firstValueActivity: "First Project Created",
    });

    expect(result.definition).toContain("First Project Created");
    expect(result.definition).not.toContain("{{firstValueActivity}}");
    expect(result.formula).toContain("First Project Created");
    expect(result.formula).not.toContain("{{firstValueActivity}}");
  });

  test("replaces {{productName}} placeholder", () => {
    const template = getTemplateByKey("new_users")!;
    const result = interpolateTemplate(template, {
      productName: "Basesignal",
    });

    // productName doesn't appear in all templates, but interpolation should work
    expect(result.definition).not.toContain("{{productName}}");
  });

  test("uses fallback for missing optional coreAction", () => {
    const template = getTemplateByKey("core_action_frequency")!;
    const result = interpolateTemplate(template, {
      productName: "Acme",
      // coreAction not provided
    });

    expect(result.definition).toContain("core action");
    expect(result.definition).not.toContain("{{coreAction}}");
  });

  test("uses fallback for missing optional firstValueActivity", () => {
    const template = getTemplateByKey("activation_rate")!;
    const result = interpolateTemplate(template, {
      productName: "Acme",
      // firstValueActivity not provided
    });

    expect(result.definition).toContain("first value action");
    expect(result.definition).not.toContain("{{firstValueActivity}}");
  });

  test("omits generatedAfter from result", () => {
    const template = getTemplateByKey("new_users")!;
    const result = interpolateTemplate(template, { productName: "Test" });

    expect("generatedAfter" in result).toBe(false);
    expect(result.key).toBe("new_users");
    expect(result.category).toBe("reach");
  });

  test("preserves non-placeholder content", () => {
    const template = getTemplateByKey("dau_mau_ratio")!;
    const result = interpolateTemplate(template, { productName: "Test" });

    // DAU/MAU ratio template doesn't use placeholders
    expect(result.name).toBe("DAU/MAU Ratio");
    expect(result.formula).toBe("DAU / MAU × 100%");
  });
});

describe("interpolateTemplates", () => {
  test("interpolates all provided templates", () => {
    const templates = getFirstValueTemplates();
    const results = interpolateTemplates(templates, {
      productName: "MyApp",
      firstValueActivity: "Report Generated",
    });

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.definition).not.toContain("{{");
      expect(result.formula).not.toContain("{{");
    }
  });

  test("returns empty array for empty input", () => {
    const results = interpolateTemplates([], { productName: "Test" });
    expect(results).toHaveLength(0);
  });
});

describe("CATEGORY_INFO", () => {
  test("has entry for each category", () => {
    for (const category of METRIC_CATEGORIES) {
      expect(CATEGORY_INFO[category]).toBeDefined();
    }
  });

  test("each entry has label and color", () => {
    for (const category of METRIC_CATEGORIES) {
      const info = CATEGORY_INFO[category];
      expect(info.label).toBeTruthy();
      expect(info.color).toBeTruthy();
    }
  });

  test("has expected labels", () => {
    expect(CATEGORY_INFO.reach.label).toBe("Reach");
    expect(CATEGORY_INFO.engagement.label).toBe("Engagement");
    expect(CATEGORY_INFO.value_delivery.label).toBe("Value Delivery");
    expect(CATEGORY_INFO.value_capture.label).toBe("Value Capture");
  });

  test("has expected colors", () => {
    expect(CATEGORY_INFO.reach.color).toBe("blue");
    expect(CATEGORY_INFO.engagement.color).toBe("green");
    expect(CATEGORY_INFO.value_delivery.color).toBe("purple");
    expect(CATEGORY_INFO.value_capture.color).toBe("orange");
  });
});

describe("template content quality", () => {
  test("definitions are substantive (not empty or trivial)", () => {
    for (const template of METRIC_TEMPLATES) {
      expect(template.definition.length).toBeGreaterThan(20);
    }
  });

  test("whyItMatters explains business value", () => {
    for (const template of METRIC_TEMPLATES) {
      expect(template.whyItMatters.length).toBeGreaterThan(30);
    }
  });

  test("howToImprove provides actionable advice", () => {
    for (const template of METRIC_TEMPLATES) {
      expect(template.howToImprove.length).toBeGreaterThan(30);
    }
  });

  test("formulas are human-readable (not SQL)", () => {
    for (const template of METRIC_TEMPLATES) {
      // Should not contain complex SQL keywords
      expect(template.formula).not.toMatch(/\bSELECT\b/i);
      expect(template.formula).not.toMatch(/\bJOIN\b/i);
      expect(template.formula).not.toMatch(/\bGROUP BY\b/i);
    }
  });
});

// =============================================================================
// Metric Variation Templates (new slot-specific template system)
// =============================================================================

describe("Metric Variations", () => {
  it("defines four variation types", () => {
    expect(METRIC_VARIATIONS).toEqual(["rate", "time_to", "frequency", "cohort"]);
  });

  it("defines five lifecycle slots", () => {
    expect(LIFECYCLE_SLOTS).toEqual([
      "account_creation",
      "activation",
      "core_usage",
      "revenue",
      "churn",
    ]);
  });
});

describe("SlotVariationTemplate type", () => {
  it("accepts a valid template object", () => {
    const template: SlotVariationTemplate = {
      variation: "rate",
      name: "{{activity}} Rate",
      definition: "Percentage of users who complete {{activity}}",
      formula: "COUNT(completed) / COUNT(eligible) * 100%",
      whyItMatters: "Shows conversion effectiveness",
      howToImprove: "Reduce friction in the flow",
      category: "value_delivery",
      primaryOnly: false,
    };

    expect(template.variation).toBe("rate");
    expect(template.primaryOnly).toBe(false);
  });
});

describe("SLOT_METRIC_TEMPLATES", () => {
  describe("account_creation slot", () => {
    it("has rate, time_to, and cohort variations (no frequency for one-time event)", () => {
      const templates = SLOT_METRIC_TEMPLATES.account_creation;
      const variations = templates.map(t => t.variation);

      expect(variations).toContain("rate");
      expect(variations).toContain("time_to");
      expect(variations).toContain("cohort");
      expect(variations).not.toContain("frequency");
    });

    it("rate template uses {{activity}} placeholder", () => {
      const rateTemplate = SLOT_METRIC_TEMPLATES.account_creation.find(
        t => t.variation === "rate"
      );
      expect(rateTemplate?.name).toContain("{{activity}}");
      expect(rateTemplate?.definition).toContain("{{activity}}");
    });
  });
});
