import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProductDirectory } from "@basesignal/storage";
import {
  renderComparisonReport,
  startViewServer,
  type ViewServerHandle,
} from "./view.js";
import {
  loadComparisonData,
  renderIdentityComparison,
  renderOutcomesComparison,
  renderJourneyComparison,
  renderIcpComparison,
  renderValueMomentsComparison,
  renderMeasurementSpecComparison,
  renderLifecycleComparison,
  type ComparisonData,
} from "./compare-sections.js";
import { renderPage } from "./view-html.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpProductDir(): { dir: string; productDir: ProductDirectory } {
  const dir = mkdtempSync(join(tmpdir(), "bs-compare-test-"));
  const productDir = new ProductDirectory({ root: dir });
  return { dir, productDir };
}

function bodyContent(html: string): string {
  return html.split("</style>")[1] ?? html;
}

// Minimal profile for a product with identity
function writeMinimalProduct(productDir: ProductDirectory, slug: string, name: string): void {
  productDir.writeJson(slug, "profile.json", {
    identity: {
      productName: name,
      description: `${name} is a product`,
      targetCustomer: "Developers",
      businessModel: "SaaS",
      industry: "DevTools",
      companyStage: "Growth",
      confidence: 0.85,
    },
    metadata: { url: `https://${slug}.app`, scannedAt: Date.now() },
    completeness: 0.75,
    overallConfidence: 0.8,
  });
}

// ---------------------------------------------------------------------------
// renderPage extraCss support
// ---------------------------------------------------------------------------

describe("renderPage extraCss", () => {
  it("includes extraCss in style block when provided", () => {
    const html = renderPage("Test", "<p>hi</p>", { extraCss: ".custom { color: red; }" });
    expect(html).toContain(".custom { color: red; }");
    expect(html).toContain("</style>");
  });

  it("omits extraCss when not provided", () => {
    const html = renderPage("Test", "<p>hi</p>");
    expect(html).not.toContain("undefined");
    expect(html).toContain("</style>");
  });
});

// ---------------------------------------------------------------------------
// loadComparisonData
// ---------------------------------------------------------------------------

describe("loadComparisonData", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("loads all 7 data sections from a product directory", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "test-app", "TestApp");
    productDir.writeJson("test-app", "outputs/activation-map.json", {
      stages: [], transitions: [], primary_activation_level: 1, confidence: "high", sources: [],
    });
    productDir.writeJson("test-app", "outputs/icp-profiles.json", []);
    productDir.writeJson("test-app", "outputs/value-moments.json", []);
    productDir.writeJson("test-app", "outputs/measurement-spec.json", {
      perspectives: { product: { entities: [] }, customer: { entities: [] }, interaction: { entities: [] } },
      jsonSchemas: [], confidence: 0.8, sources: [],
    });
    productDir.writeJson("test-app", "outputs/lifecycle-states.json", {
      states: [], transitions: [], confidence: 0.7, sources: [],
    });
    productDir.writeJson("test-app", "outputs/outcomes.json", []);

    const data = loadComparisonData("test-app", productDir);
    expect(data.slug).toBe("test-app");
    expect(data.name).toBe("TestApp");
    expect(data.profile).not.toBeNull();
    expect(data.activationMap).not.toBeNull();
    expect(data.icpProfiles).not.toBeNull();
    expect(data.valueMoments).not.toBeNull();
    expect(data.measurementSpec).not.toBeNull();
    expect(data.lifecycleStates).not.toBeNull();
    expect(data.outcomes).not.toBeNull();
  });

  it("returns null for missing sections", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "crawl/metadata.json", {});

    const data = loadComparisonData("test-app", productDir);
    expect(data.slug).toBe("test-app");
    expect(data.name).toBe("test-app"); // slug fallback
    expect(data.profile).toBeNull();
    expect(data.activationMap).toBeNull();
    expect(data.icpProfiles).toBeNull();
    expect(data.valueMoments).toBeNull();
    expect(data.measurementSpec).toBeNull();
    expect(data.lifecycleStates).toBeNull();
    expect(data.outcomes).toBeNull();
  });

  it("uses slug as name when profile has no identity", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("mystery-app", "profile.json", { metadata: { url: "https://mystery.com" } });

    const data = loadComparisonData("mystery-app", productDir);
    expect(data.name).toBe("mystery-app");
  });
});

// ---------------------------------------------------------------------------
// renderComparisonReport (full orchestrator)
// ---------------------------------------------------------------------------

describe("renderComparisonReport", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("renders both product names in header", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    const body = bodyContent(html);
    expect(body).toContain("Linear");
    expect(body).toContain("Notion");
    expect(body).toContain("Linear vs Notion");
  });

  it("includes compare-grid CSS class", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain("compare-grid");
  });

  it("includes compare-layout CSS class", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain("compare-layout");
  });

  it("includes section navigation with all 7 sections", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain('href="#identity"');
    expect(html).toContain('href="#outcomes"');
    expect(html).toContain('href="#journey"');
    expect(html).toContain('href="#icp-profiles"');
    expect(html).toContain('href="#value-moments"');
    expect(html).toContain('href="#measurement-spec"');
    expect(html).toContain('href="#performance-model"');
  });

  it("dims nav links for sections without data on either side", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");
    // Only identity has data

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toMatch(/href="#identity" class=""/);
    expect(html).toMatch(/href="#journey" class=" dimmed"/);
  });

  it("renders 'Not yet analyzed' when section missing on one side", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    productDir.writeJson("linear-app", "outputs/icp-profiles.json", [
      {
        id: "icp-1", name: "Dev", description: "Developer",
        pain_points: ["Slow builds"], activation_triggers: ["Sign up"],
        success_metrics: ["Speed"], value_moment_priorities: [], confidence: 0.8, sources: [],
      },
    ]);
    writeMinimalProduct(productDir, "notion-so", "Notion");
    // Notion has no ICP data

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    const body = bodyContent(html);
    // Linear side has ICP data, Notion side shows not analyzed
    expect(body).toContain("Dev");
    expect(body).toContain("Slow builds");
    expect(body).toContain("Not yet analyzed");
  });

  it("includes scroll-spy script", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain("<script>");
    expect(html).toContain("IntersectionObserver");
  });

  it("includes comparison-specific CSS", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain(".compare-layout");
    expect(html).toContain(".compare-grid");
    expect(html).toContain("badge-shared");
    expect(html).toContain("compare-label-left");
    expect(html).toContain("compare-label-right");
  });

  it("includes back link to product list", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    const body = bodyContent(html);
    expect(body).toContain('href="/"');
    expect(body).toContain("Back to product list");
  });

  it("renders all 7 section IDs", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "linear-app", "Linear");
    writeMinimalProduct(productDir, "notion-so", "Notion");

    const html = renderComparisonReport("linear-app", "notion-so", productDir);
    expect(html).toContain('id="identity"');
    expect(html).toContain('id="outcomes"');
    expect(html).toContain('id="journey"');
    expect(html).toContain('id="icp-profiles"');
    expect(html).toContain('id="value-moments"');
    expect(html).toContain('id="measurement-spec"');
    expect(html).toContain('id="lifecycle-states"');
  });
});

// ---------------------------------------------------------------------------
// Individual section comparison renderers
// ---------------------------------------------------------------------------

function emptyComparisonData(slug: string, name: string): ComparisonData {
  return {
    slug, name,
    profile: null,
    activationMap: null,
    icpProfiles: null,
    valueMoments: null,
    measurementSpec: null,
    lifecycleStates: null,
    outcomes: null,
  };
}

describe("renderIdentityComparison", () => {
  it("renders two identity cards side by side", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "LeftApp"),
      profile: {
        identity: { productName: "LeftApp", description: "Left product", targetCustomer: "Engineers", confidence: 0.9 },
      } as ComparisonData["profile"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "RightApp"),
      profile: {
        identity: { productName: "RightApp", description: "Right product", targetCustomer: "Designers", confidence: 0.7 },
      } as ComparisonData["profile"],
    };

    const html = renderIdentityComparison(left, right);
    expect(html).toContain("LeftApp");
    expect(html).toContain("RightApp");
    expect(html).toContain("Left product");
    expect(html).toContain("Right product");
    expect(html).toContain("Engineers");
    expect(html).toContain("Designers");
    expect(html).toContain("identity-card");
    expect(html).toContain("compare-grid");
  });

  it("shows 'Not yet analyzed' when one side is missing", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "LeftApp"),
      profile: {
        identity: { productName: "LeftApp", description: "Has data" },
      } as ComparisonData["profile"],
    };
    const right = emptyComparisonData("right", "RightApp");

    const html = renderIdentityComparison(left, right);
    expect(html).toContain("Has data");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderIcpComparison", () => {
  it("marks matching pain points with badge-shared class", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      icpProfiles: [{
        id: "1", name: "Dev", description: "Developer",
        pain_points: ["Slow builds", "Context switching"],
        activation_triggers: [], success_metrics: [],
        value_moment_priorities: [], confidence: 0.8, sources: [],
      }],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      icpProfiles: [{
        id: "2", name: "PM", description: "Product Manager",
        pain_points: ["slow builds", "Feature overload"],
        activation_triggers: [], success_metrics: [],
        value_moment_priorities: [], confidence: 0.7, sources: [],
      }],
    };

    const html = renderIcpComparison(left, right);
    // "Slow builds" matches "slow builds" (case-insensitive)
    expect(html).toContain("badge-shared");
    expect(html).toContain("Shared");
    // Both ICP names present
    expect(html).toContain("Dev");
    expect(html).toContain("PM");
  });

  it("does not mark non-matching pain points as shared", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      icpProfiles: [{
        id: "1", name: "Dev", description: "",
        pain_points: ["Unique pain A"],
        activation_triggers: [], success_metrics: [],
        value_moment_priorities: [], confidence: 0.8, sources: [],
      }],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      icpProfiles: [{
        id: "2", name: "PM", description: "",
        pain_points: ["Unique pain B"],
        activation_triggers: [], success_metrics: [],
        value_moment_priorities: [], confidence: 0.7, sources: [],
      }],
    };

    const html = renderIcpComparison(left, right);
    expect(html).not.toContain("badge-shared");
  });

  it("shows 'Not yet analyzed' when one side has no ICP profiles", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      icpProfiles: [{
        id: "1", name: "Dev", description: "",
        pain_points: [], activation_triggers: [], success_metrics: [],
        value_moment_priorities: [], confidence: 0.8, sources: [],
      }],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderIcpComparison(left, right);
    expect(html).toContain("Dev");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderValueMomentsComparison", () => {
  it("shows tier summary counts for both products", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      valueMoments: [
        { id: "1", name: "Core Feature", description: "", tier: 1, lenses: [], lens_count: 2, roles: [], product_surfaces: [], contributing_candidates: [] },
        { id: "2", name: "Extra", description: "", tier: 2, lenses: [], lens_count: 1, roles: [], product_surfaces: [], contributing_candidates: [] },
      ] as ComparisonData["valueMoments"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      valueMoments: [
        { id: "3", name: "Other Core", description: "", tier: 1, lenses: [], lens_count: 3, roles: [], product_surfaces: [], contributing_candidates: [] },
      ] as ComparisonData["valueMoments"],
    };

    const html = renderValueMomentsComparison(left, right);
    // Left has Core:1, Important:1
    expect(html).toContain("Core: 1");
    expect(html).toContain("Important: 1");
    // Right has Core:1
    expect(html).toContain("Core Feature");
    expect(html).toContain("Other Core");
  });

  it("shows 'Not yet analyzed' when one side has no value moments", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      valueMoments: [
        { id: "1", name: "Moment", description: "", tier: 1, lenses: [], lens_count: 1, roles: [], product_surfaces: [], contributing_candidates: [] },
      ] as ComparisonData["valueMoments"],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderValueMomentsComparison(left, right);
    expect(html).toContain("Moment");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderMeasurementSpecComparison", () => {
  it("shows entity counts and marks shared entity names", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      measurementSpec: {
        perspectives: {
          product: { entities: [{ id: "user", name: "User", description: "", isHeartbeat: false, properties: [], activities: [] }] },
          customer: { entities: [{ name: "Account", properties: [], activities: [] }] },
          interaction: { entities: [] },
        },
        jsonSchemas: [], confidence: 0.8, sources: [],
      } as ComparisonData["measurementSpec"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      measurementSpec: {
        perspectives: {
          product: { entities: [{ id: "user", name: "User", description: "", isHeartbeat: true, properties: [], activities: [] }] },
          customer: { entities: [] },
          interaction: { entities: [] },
        },
        jsonSchemas: [], confidence: 0.7, sources: [],
      } as ComparisonData["measurementSpec"],
    };

    const html = renderMeasurementSpecComparison(left, right);
    // Left: 2 entities (1 product + 1 customer)
    expect(html).toContain("2 entities");
    // Right: 1 entity
    expect(html).toContain("1 entity");
    // "User" is shared
    expect(html).toContain("badge-shared");
    expect(html).toContain("Shared");
  });

  it("shows 'Not yet analyzed' when spec missing on one side", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      measurementSpec: {
        perspectives: {
          product: { entities: [{ id: "x", name: "X", description: "", isHeartbeat: false, properties: [], activities: [] }] },
          customer: { entities: [] },
          interaction: { entities: [] },
        },
        jsonSchemas: [], confidence: 0.8, sources: [],
      } as ComparisonData["measurementSpec"],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderMeasurementSpecComparison(left, right);
    expect(html).toContain("1 entity");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderJourneyComparison", () => {
  it("shows stage count and primary activation level comparison", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      activationMap: {
        stages: [
          { level: 1, name: "Explorer", signal_strength: "weak", trigger_events: ["sign_up"], value_moments_unlocked: [], drop_off_risk: { level: "high", reason: "New" } },
          { level: 2, name: "Adopter", signal_strength: "strong", trigger_events: ["activate"], value_moments_unlocked: [], drop_off_risk: { level: "low", reason: "Engaged" } },
        ],
        transitions: [], primary_activation_level: 2, confidence: "high", sources: [],
      } as ComparisonData["activationMap"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      activationMap: {
        stages: [
          { level: 1, name: "Visitor", signal_strength: "weak", trigger_events: ["visit"], value_moments_unlocked: [], drop_off_risk: { level: "medium", reason: "Browsing" } },
        ],
        transitions: [], primary_activation_level: 1, confidence: "medium", sources: [],
      } as ComparisonData["activationMap"],
    };

    const html = renderJourneyComparison(left, right);
    expect(html).toContain("2 stages");
    expect(html).toContain("1 stage");
    expect(html).toContain("primary activation at level 2");
    expect(html).toContain("primary activation at level 1");
    expect(html).toContain("Explorer");
    expect(html).toContain("Visitor");
  });

  it("shows 'Not yet analyzed' when journey missing on one side", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      activationMap: {
        stages: [{ level: 1, name: "S1", signal_strength: "weak", trigger_events: [], value_moments_unlocked: [], drop_off_risk: { level: "low", reason: "" } }],
        transitions: [], primary_activation_level: 1, confidence: "high", sources: [],
      } as ComparisonData["activationMap"],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderJourneyComparison(left, right);
    expect(html).toContain("1 stage");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderLifecycleComparison", () => {
  it("highlights shared state names", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      lifecycleStates: {
        states: [
          { name: "new", definition: "Just signed up", entry_criteria: [], exit_triggers: [], time_window: "0-7d" },
          { name: "activated", definition: "Has used", entry_criteria: [], exit_triggers: [] },
        ],
        transitions: [], confidence: 0.8, sources: [],
      } as ComparisonData["lifecycleStates"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      lifecycleStates: {
        states: [
          { name: "New", definition: "Fresh user", entry_criteria: [], exit_triggers: [] },
          { name: "churned", definition: "Left", entry_criteria: [], exit_triggers: [] },
        ],
        transitions: [], confidence: 0.6, sources: [],
      } as ComparisonData["lifecycleStates"],
    };

    const html = renderLifecycleComparison(left, right);
    // "new" matches "New" (case-insensitive)
    expect(html).toContain("badge-shared");
    expect(html).toContain("activated");
    expect(html).toContain("churned");
  });

  it("shows state counts for both sides", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      lifecycleStates: {
        states: [
          { name: "new", definition: "Def", entry_criteria: [], exit_triggers: [] },
          { name: "active", definition: "Def", entry_criteria: [], exit_triggers: [] },
          { name: "churned", definition: "Def", entry_criteria: [], exit_triggers: [] },
        ],
        transitions: [], confidence: 0.8, sources: [],
      } as ComparisonData["lifecycleStates"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      lifecycleStates: {
        states: [
          { name: "onboarding", definition: "Def", entry_criteria: [], exit_triggers: [] },
        ],
        transitions: [], confidence: 0.7, sources: [],
      } as ComparisonData["lifecycleStates"],
    };

    const html = renderLifecycleComparison(left, right);
    expect(html).toContain("3 states");
    expect(html).toContain("1 state");
  });

  it("shows 'Not yet analyzed' when lifecycle missing on one side", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      lifecycleStates: {
        states: [{ name: "x", definition: "d", entry_criteria: [], exit_triggers: [] }],
        transitions: [], confidence: 0.8, sources: [],
      } as ComparisonData["lifecycleStates"],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderLifecycleComparison(left, right);
    expect(html).toContain("1 state");
    expect(html).toContain("Not yet analyzed");
  });
});

describe("renderOutcomesComparison", () => {
  it("renders outcomes for both sides", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      outcomes: [
        { description: "Reduce churn", type: "retention", linkedFeatures: ["Re-engagement emails"] },
      ] as ComparisonData["outcomes"],
    };
    const right: ComparisonData = {
      ...emptyComparisonData("right", "Right"),
      outcomes: [
        { description: "Increase revenue", type: "growth", linkedFeatures: ["Upsell flow"] },
      ] as ComparisonData["outcomes"],
    };

    const html = renderOutcomesComparison(left, right);
    expect(html).toContain("Reduce churn");
    expect(html).toContain("Increase revenue");
    expect(html).toContain("retention");
    expect(html).toContain("growth");
  });

  it("shows 'Not yet analyzed' when outcomes missing on one side", () => {
    const left: ComparisonData = {
      ...emptyComparisonData("left", "Left"),
      outcomes: [
        { description: "Some outcome", type: "efficiency", linkedFeatures: [] },
      ] as ComparisonData["outcomes"],
    };
    const right = emptyComparisonData("right", "Right");

    const html = renderOutcomesComparison(left, right);
    expect(html).toContain("Some outcome");
    expect(html).toContain("Not yet analyzed");
  });
});

// ---------------------------------------------------------------------------
// Full comparison with enriched data
// ---------------------------------------------------------------------------

describe("renderComparisonReport — enriched data", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("renders full comparison with all 7 sections populated", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    writeMinimalProduct(productDir, "app-a", "AppA");
    writeMinimalProduct(productDir, "app-b", "AppB");

    // Outcomes
    productDir.writeJson("app-a", "outputs/outcomes.json", [
      { description: "Faster deploys", type: "efficiency", linkedFeatures: ["CI/CD"] },
    ]);
    productDir.writeJson("app-b", "outputs/outcomes.json", [
      { description: "Better collab", type: "engagement", linkedFeatures: ["Shared docs"] },
    ]);

    // Journey
    productDir.writeJson("app-a", "outputs/activation-map.json", {
      stages: [{ level: 1, name: "setup", signal_strength: "weak", trigger_events: [], value_moments_unlocked: [], drop_off_risk: { level: "high", reason: "" } }],
      transitions: [], primary_activation_level: 1, confidence: "high", sources: [],
    });
    productDir.writeJson("app-b", "outputs/activation-map.json", {
      stages: [
        { level: 1, name: "signup", signal_strength: "weak", trigger_events: [], value_moments_unlocked: [], drop_off_risk: { level: "low", reason: "" } },
        { level: 2, name: "use", signal_strength: "strong", trigger_events: [], value_moments_unlocked: [], drop_off_risk: { level: "medium", reason: "" } },
      ],
      transitions: [], primary_activation_level: 2, confidence: "medium", sources: [],
    });

    // ICP
    productDir.writeJson("app-a", "outputs/icp-profiles.json", [
      { id: "1", name: "DevOps", description: "", pain_points: ["Alert fatigue"], activation_triggers: [], success_metrics: [], value_moment_priorities: [], confidence: 0.9, sources: [] },
    ]);
    productDir.writeJson("app-b", "outputs/icp-profiles.json", [
      { id: "2", name: "Platform Eng", description: "", pain_points: ["Alert fatigue", "Scaling"], activation_triggers: [], success_metrics: [], value_moment_priorities: [], confidence: 0.8, sources: [] },
    ]);

    // Value moments
    productDir.writeJson("app-a", "outputs/value-moments.json", [
      { id: "1", name: "Quick deploy", description: "", tier: 1, lenses: [], lens_count: 2, roles: [], product_surfaces: [], contributing_candidates: [] },
    ]);
    productDir.writeJson("app-b", "outputs/value-moments.json", [
      { id: "2", name: "Team sync", description: "", tier: 2, lenses: [], lens_count: 1, roles: [], product_surfaces: [], contributing_candidates: [] },
    ]);

    // Measurement spec
    productDir.writeJson("app-a", "outputs/measurement-spec.json", {
      perspectives: {
        product: { entities: [{ id: "deploy", name: "Deploy", description: "", isHeartbeat: false, properties: [], activities: [] }] },
        customer: { entities: [] }, interaction: { entities: [] },
      },
      jsonSchemas: [], confidence: 0.85, sources: [],
    });
    productDir.writeJson("app-b", "outputs/measurement-spec.json", {
      perspectives: {
        product: { entities: [{ id: "deploy", name: "Deploy", description: "", isHeartbeat: true, properties: [], activities: [] }] },
        customer: { entities: [{ name: "Org", properties: [], activities: [] }] }, interaction: { entities: [] },
      },
      jsonSchemas: [], confidence: 0.7, sources: [],
    });

    // Lifecycle
    productDir.writeJson("app-a", "outputs/lifecycle-states.json", {
      states: [{ name: "trial", definition: "On trial", entry_criteria: [], exit_triggers: [] }],
      transitions: [], confidence: 0.8, sources: [],
    });
    productDir.writeJson("app-b", "outputs/lifecycle-states.json", {
      states: [
        { name: "trial", definition: "Trial period", entry_criteria: [], exit_triggers: [] },
        { name: "paid", definition: "Paying", entry_criteria: [], exit_triggers: [] },
      ],
      transitions: [], confidence: 0.75, sources: [],
    });

    const html = renderComparisonReport("app-a", "app-b", productDir);
    const body = bodyContent(html);

    // Header
    expect(body).toContain("AppA vs AppB");

    // All 7 section IDs present
    expect(body).toContain('id="identity"');
    expect(body).toContain('id="outcomes"');
    expect(body).toContain('id="journey"');
    expect(body).toContain('id="icp-profiles"');
    expect(body).toContain('id="value-moments"');
    expect(body).toContain('id="measurement-spec"');
    expect(body).toContain('id="lifecycle-states"');

    // Shared entities highlighted
    expect(body).toContain("badge-shared"); // Deploy and trial are shared

    // ICP shared pain point
    expect(body).toContain("Alert fatigue");

    // Journey stage counts
    expect(body).toContain("1 stage");
    expect(body).toContain("2 stages");

    // No "Not yet analyzed" since all sections populated
    expect(body).not.toContain("Not yet analyzed");
  });
});

// ---------------------------------------------------------------------------
// HTTP server integration tests
// ---------------------------------------------------------------------------

describe("compare HTTP route", () => {
  let handle: ViewServerHandle | undefined;
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = undefined;
    }
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  function createServerWithProducts(
    products: Array<{ slug: string; profile: Record<string, unknown> }>,
  ) {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    for (const p of products) {
      productDir.writeJson(p.slug, "profile.json", p.profile);
    }
    return startViewServer({ port: 0, productDir });
  }

  it("GET /compare/{slug1}/{slug2} returns 200 for valid slugs", async () => {
    handle = await createServerWithProducts([
      { slug: "linear-app", profile: { identity: { productName: "Linear" } } },
      { slug: "notion-so", profile: { identity: { productName: "Notion" } } },
    ]);

    const res = await fetch(`${handle.url}/compare/linear-app/notion-so`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Linear");
    expect(body).toContain("Notion");
    expect(body).toContain("compare-grid");
  });

  it("GET /compare/{slug1}/{missing} returns 404", async () => {
    handle = await createServerWithProducts([
      { slug: "linear-app", profile: { identity: { productName: "Linear" } } },
    ]);

    const res = await fetch(`${handle.url}/compare/linear-app/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("Product not found");
  });

  it("GET /compare/{missing}/{slug2} returns 404", async () => {
    handle = await createServerWithProducts([
      { slug: "notion-so", profile: { identity: { productName: "Notion" } } },
    ]);

    const res = await fetch(`${handle.url}/compare/nonexistent/notion-so`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("Product not found");
  });

  it("GET /compare with only one slug does not match compare route", async () => {
    handle = await createServerWithProducts([
      { slug: "linear-app", profile: { identity: { productName: "Linear" } } },
    ]);

    // /compare/linear-app has no second slug — should fall through to normal slug routing
    const res = await fetch(`${handle.url}/compare/linear-app`);
    // "compare" is not a valid slug so should get 404
    expect(res.status).toBe(404);
  });

  it("GET /compare/{slug1}/{slug2} comparison HTML contains both product labels", async () => {
    handle = await createServerWithProducts([
      { slug: "app-a", profile: { identity: { productName: "AppAlpha" } } },
      { slug: "app-b", profile: { identity: { productName: "AppBeta" } } },
    ]);

    const res = await fetch(`${handle.url}/compare/app-a/app-b`);
    const body = await res.text();
    expect(body).toContain("AppAlpha");
    expect(body).toContain("AppBeta");
    expect(body).toContain("compare-label-left");
    expect(body).toContain("compare-label-right");
  });
});
