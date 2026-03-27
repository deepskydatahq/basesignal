import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProductDirectory } from "@basesignal/storage";
import {
  escapeHtml,
  renderPage,
  progressBar,
  confidenceBadge,
  isValidSlug,
  loadProductList,
  renderProductList,
  renderProductReport,
  renderSourceMaterial,
  startViewServer,
  type ViewServerHandle,
} from "./view.js";

// ---------------------------------------------------------------------------
// Unit tests: HTML helpers
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes &, <, >, quotes", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("renderPage", () => {
  it("returns valid HTML document", () => {
    const html = renderPage("Test Title", "<p>Hello</p>");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Test Title</title>");
    expect(html).toContain("<p>Hello</p>");
  });

  it("escapes the title", () => {
    const html = renderPage("<script>bad</script>", "body");
    expect(html).toContain("<title>&lt;script&gt;bad&lt;/script&gt;</title>");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: visual indicators
// ---------------------------------------------------------------------------

describe("progressBar", () => {
  it("renders a progress bar with percentage", () => {
    const html = progressBar(0.83);
    expect(html).toContain("progress-bar");
    expect(html).toContain("progress-fill");
    expect(html).toContain('width:83%');
    expect(html).toContain("83%");
  });

  it("renders a mini progress bar without label", () => {
    const html = progressBar(0.5, true);
    expect(html).toContain("progress-bar-mini");
    expect(html).toContain('width:50%');
    expect(html).not.toContain("progress-label");
  });
});

describe("confidenceBadge", () => {
  it("renders high confidence as green badge", () => {
    const html = confidenceBadge(0.85);
    expect(html).toContain("conf-high");
    expect(html).toContain("85%");
  });

  it("renders medium confidence as yellow badge", () => {
    const html = confidenceBadge(0.5);
    expect(html).toContain("conf-med");
    expect(html).toContain("50%");
  });

  it("renders low confidence as gray badge", () => {
    const html = confidenceBadge(0.3);
    expect(html).toContain("conf-low");
    expect(html).toContain("30%");
  });

  it("handles string confidence values", () => {
    expect(confidenceBadge("high")).toContain("conf-high");
    expect(confidenceBadge("medium")).toContain("conf-med");
    expect(confidenceBadge("low")).toContain("conf-low");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: slug validation
// ---------------------------------------------------------------------------

describe("isValidSlug", () => {
  it("accepts lowercase alphanumeric with hyphens", () => {
    expect(isValidSlug("linear-app")).toBe(true);
    expect(isValidSlug("notion-so")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("test123")).toBe(true);
  });

  it("rejects path traversal attempts", () => {
    expect(isValidSlug("../etc/passwd")).toBe(false);
    expect(isValidSlug("..")).toBe(false);
    expect(isValidSlug(".hidden")).toBe(false);
  });

  it("rejects uppercase, spaces, and special characters", () => {
    expect(isValidSlug("Linear-App")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("has/slash")).toBe(false);
    expect(isValidSlug("has.dot")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects slugs starting with hyphen", () => {
    expect(isValidSlug("-leading")).toBe(false);
  });

  it("rejects slugs longer than 128 chars", () => {
    expect(isValidSlug("a".repeat(128))).toBe(true);
    expect(isValidSlug("a".repeat(129))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: product list loading and rendering
// ---------------------------------------------------------------------------

function createTmpProductDir(): { dir: string; productDir: ProductDirectory } {
  const dir = mkdtempSync(join(tmpdir(), "bs-view-test-"));
  const productDir = new ProductDirectory({ root: dir });
  return { dir, productDir };
}

describe("loadProductList", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("returns empty array when no products exist", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    expect(loadProductList(productDir)).toEqual([]);
  });

  it("loads product data from profile.json", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("linear-app", "profile.json", {
      identity: { productName: "Linear" },
      metadata: { url: "https://linear.app", scannedAt: 1709337600000 },
      completeness: 0.83,
    });

    const products = loadProductList(productDir);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Linear");
    expect(products[0].url).toBe("https://linear.app");
    expect(products[0].completeness).toBe(0.83);
    expect(products[0].slug).toBe("linear-app");
  });

  it("uses slug as fallback name when profile.json is missing", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    // Write a non-profile file so the directory exists
    productDir.writeJson("mystery-product", "crawl/metadata.json", { url: "https://mystery.com" });

    const products = loadProductList(productDir);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("mystery-product");
    expect(products[0].url).toBe("");
    expect(products[0].scannedAt).toBe("unknown");
    expect(products[0].completeness).toBe(0);
  });

  it("lists multiple products sorted alphabetically", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("zeta-app", "profile.json", { identity: { productName: "Zeta" } });
    productDir.writeJson("alpha-app", "profile.json", { identity: { productName: "Alpha" } });

    const products = loadProductList(productDir);
    expect(products.map((p) => p.slug)).toEqual(["alpha-app", "zeta-app"]);
  });
});

describe("renderProductList", () => {
  it("renders empty state when no products", () => {
    const html = renderProductList([]);
    expect(html).toContain("No products scanned yet");
    expect(html).toContain("basesignal scan");
  });

  it("renders product rows with links", () => {
    const html = renderProductList([
      { slug: "linear-app", name: "Linear", url: "https://linear.app", scannedAt: "2025-03-01", completeness: 0.83 },
    ]);
    expect(html).toContain('<a href="/linear-app">Linear</a>');
    expect(html).toContain("https://linear.app");
    expect(html).toContain("2025-03-01");
    expect(html).toContain("83%");
  });

  it("renders mini progress bars for completeness", () => {
    const html = renderProductList([
      { slug: "test", name: "Test", url: "", scannedAt: "unknown", completeness: 0.6 },
    ]);
    expect(html).toContain("progress-bar-mini");
    expect(html).toContain("60%");
  });

  it("escapes product names to prevent XSS", () => {
    const html = renderProductList([
      { slug: "evil", name: '<script>alert("xss")</script>', url: "", scannedAt: "unknown", completeness: 0 },
    ]);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: product report
// ---------------------------------------------------------------------------

describe("renderProductReport", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("renders identity fields from profile.json", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: {
        productName: "TestApp",
        description: "A test application",
        targetCustomer: "Developers",
        businessModel: "SaaS",
        industry: "DevTools",
        companyStage: "Growth",
        confidence: 0.9,
      },
      metadata: { url: "https://test.app", scannedAt: 1709337600000 },
      completeness: 0.75,
      overallConfidence: 0.85,
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("TestApp");
    expect(html).toContain("A test application");
    expect(html).toContain("Developers");
    expect(html).toContain("SaaS");
    expect(html).toContain("DevTools");
    expect(html).toContain("Growth");
    expect(html).toContain("90%"); // identity confidence
    expect(html).toContain("https://test.app");
    expect(html).toContain("75%"); // completeness
    expect(html).toContain("85%"); // overall confidence
  });

  it("renders journey stages from activation-map.json", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/activation-map.json", {
      stages: [
        {
          level: 1,
          name: "explorer",
          signal_strength: "weak",
          trigger_events: ["sign_up"],
          value_moments_unlocked: ["First value"],
          drop_off_risk: { level: "high", reason: "New users" },
        },
        {
          level: 2,
          name: "adopter",
          signal_strength: "strong",
          trigger_events: ["complete_onboarding"],
          value_moments_unlocked: ["Core value", "Second value"],
          drop_off_risk: { level: "low", reason: "Committed" },
        },
      ],
      transitions: [
        {
          from_level: 1,
          to_level: 2,
          trigger_events: ["complete_onboarding"],
          typical_timeframe: "3-5 days",
        },
      ],
      primary_activation_level: 2,
      confidence: "high",
      sources: [],
    });

    const html = renderProductReport("test-app", productDir);
    // Stage names
    expect(html).toContain("explorer");
    expect(html).toContain("adopter");
    // Signal strengths
    expect(html).toContain("weak");
    expect(html).toContain("strong");
    // Trigger events
    expect(html).toContain("sign_up");
    expect(html).toContain("complete_onboarding");
    // Value moment counts
    expect(html).toContain("1 moment");
    expect(html).toContain("2 moments");
    // Drop-off risk
    expect(html).toContain("high");
    expect(html).toContain("low");
    // Primary activation level
    expect(html).toContain("primary");
    // Transitions
    expect(html).toContain("Level 1");
    expect(html).toContain("Level 2");
    expect(html).toContain("3-5 days");
    // Confidence as string badge
    expect(html).toContain("conf-high");
    expect(html).toContain(">high</span>");
  });

  it("shows 'Not yet analyzed' when identity is missing", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      metadata: { url: "https://test.app" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("Not yet analyzed");
    expect(html).toContain('id="identity"');
  });

  it("shows 'Not yet analyzed' when activation map is missing", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("Not yet analyzed");
    expect(html).toContain('id="journey"');
  });

  it("handles empty profile gracefully", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    // Only create the directory, no profile.json
    productDir.writeJson("empty-app", "crawl/metadata.json", {});

    const html = renderProductReport("empty-app", productDir);
    expect(html).toContain("Not yet analyzed");
    expect(html).toContain("Back to product list");
    // Should not throw
  });

  it("includes back link to product list", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to product list");
  });

  it("renders ICP profiles with pain points and triggers", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/icp-profiles.json", [
      {
        id: "icp-1",
        name: "Developer",
        description: "A software developer",
        pain_points: ["Typing fatigue", "Context switching"],
        activation_triggers: ["First dictation"],
        success_metrics: ["Faster output"],
        value_moment_priorities: [
          { moment_id: "m1", priority: 1, relevance_reason: "Core workflow" },
        ],
        confidence: 0.85,
        sources: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("ICP Profiles");
    expect(html).toContain("Developer");
    expect(html).toContain("A software developer");
    expect(html).toContain("Typing fatigue");
    expect(html).toContain("Context switching");
    expect(html).toContain("First dictation");
    expect(html).toContain("Faster output");
    expect(html).toContain("Core workflow");
    expect(html).toContain("85%");
  });

  it("shows 'Not yet analyzed' when ICP profiles are missing", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain('id="icp-profiles"');
    // ICP section should show not analyzed (no icp-profiles.json file)
    expect(html).toMatch(/icp-profiles[\s\S]*?Not yet analyzed/);
  });

  it("renders value moments grouped by tier", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "convergence/value-moments.json", [
      {
        id: "m1",
        name: "Core Feature",
        description: "The most important moment",
        tier: 1,
        lenses: ["capability_mapping", "time_compression"],
        lens_count: 2,
        roles: ["developer"],
        product_surfaces: ["editor"],
        contributing_candidates: [],
      },
      {
        id: "m2",
        name: "Nice Extra",
        description: "A supporting moment",
        tier: 3,
        lenses: ["effort_elimination"],
        lens_count: 1,
        roles: ["manager"],
        product_surfaces: ["dashboard"],
        contributing_candidates: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("Value Moments");
    expect(html).toContain("Core Value Moments");
    expect(html).toContain("Supporting");
    expect(html).toContain("Core Feature");
    expect(html).toContain("Nice Extra");
    expect(html).toContain("2 of 7 lenses");
    expect(html).toContain("developer");
    expect(html).toContain("editor");
    // Tier 1 uses details open, Tier 3 collapsed
    expect(html).toMatch(/<details open>\s*<summary>Core Value Moments/);
    expect(html).toMatch(/<details>\s*<summary>Supporting/);
    // Tier 1 card has accent class
    expect(html).toContain("vm-tier-1");
    // Tier 3 card has muted class
    expect(html).toContain("vm-tier-3");
  });

  it("renders measurement spec with perspectives and entities", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/measurement-spec.json", {
      perspectives: {
        product: {
          entities: [
            {
              id: "user",
              name: "User",
              description: "A user of the product",
              isHeartbeat: true,
              properties: [
                { name: "user_id", type: "id", description: "Unique ID", isRequired: true },
              ],
              activities: [
                { name: "signed_up", properties_supported: ["user_id"], activity_properties: [] },
              ],
            },
          ],
        },
        customer: {
          entities: [
            {
              name: "Customer",
              properties: [],
              activities: [
                { name: "converted", derivation_rule: "When user upgrades", properties_used: [] },
              ],
            },
          ],
        },
        interaction: {
          entities: [
            {
              name: "PageView",
              properties: [],
              activities: [
                { name: "viewed_page", properties_supported: ["page_url"] },
              ],
            },
          ],
        },
      },
      jsonSchemas: [],
      confidence: 0.8,
      sources: [],
      warnings: ["Missing event coverage for onboarding"],
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("Measurement Spec");
    expect(html).toContain("Product Perspective");
    expect(html).toContain("Customer Perspective");
    // Interaction perspective is hidden from the view
    expect(html).not.toContain("Interaction Perspective");
    expect(html).not.toContain("PageView");
    expect(html).not.toContain("viewed_page");
    expect(html).toContain("User");
    expect(html).toContain("heartbeat");
    expect(html).toContain("user_id");
    expect(html).toContain("signed_up");
    expect(html).toContain("converted");
    expect(html).toContain("When user upgrades");
    expect(html).toContain("80%");
    expect(html).toContain("Missing event coverage for onboarding");
  });

  it("renders lifecycle states with transitions", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/lifecycle-states.json", {
      states: [
        {
          name: "new",
          definition: "Just signed up",
          entry_criteria: [{ event_name: "signup", condition: "within last 7 days" }],
          exit_triggers: [{ event_name: "activate", condition: "completes setup" }],
          time_window: "0-7 days",
        },
        {
          name: "activated",
          definition: "Completed first action",
          entry_criteria: [{ event_name: "activate", condition: "first use" }],
          exit_triggers: [{ event_name: "engage", condition: "regular use" }],
          time_window: "7-30 days",
        },
      ],
      transitions: [
        {
          from_state: "new",
          to_state: "activated",
          trigger_conditions: ["completes setup"],
          typical_timeframe: "3-5 days",
        },
      ],
      confidence: 0.75,
      sources: [],
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("Lifecycle States");
    expect(html).toContain("new");
    expect(html).toContain("activated");
    expect(html).toContain("Just signed up");
    expect(html).toContain("0-7 days");
    expect(html).toContain("signup");
    expect(html).toContain("within last 7 days");
    expect(html).toContain("activate");
    expect(html).toContain("completes setup");
    // Transitions
    expect(html).toContain("Transitions");
    expect(html).toContain("3-5 days");
    expect(html).toContain("75%");
  });

  it("includes section navigation bar with links to all sections", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("section-nav");
    expect(html).toContain('href="#identity"');
    expect(html).toContain('href="#outcomes"');
    expect(html).toContain('href="#journey"');
    expect(html).toContain('href="#icp-profiles"');
    expect(html).toContain('href="#value-moments"');
    expect(html).toContain('href="#measurement-spec"');
    expect(html).toContain('href="#lifecycle-states"');
  });

  it("dims nav links for sections without data", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    // Only identity has data, all other sections are missing

    const html = renderProductReport("test-app", productDir);
    // Identity link should NOT be dimmed
    expect(html).toMatch(/href="#identity" class=""/);
    // Journey link should be dimmed (no activation-map.json)
    expect(html).toMatch(/href="#journey" class=" dimmed"/);
  });

  it("includes scroll-spy script", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("<script>");
    expect(html).toContain("IntersectionObserver");
  });

  it("uses progress bar for completeness in header", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
      completeness: 0.75,
      overallConfidence: 0.85,
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("progress-bar");
    expect(html).toContain("progress-fill");
    expect(html).toContain("conf-badge");
    expect(html).toContain("conf-high");
  });

  it("marks sections without data with no-data class", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    // Journey section should have no-data class
    expect(html).toContain('id="journey" class="no-data"');
    // Identity section should NOT have no-data class
    expect(html).not.toContain('id="identity" class="no-data"');
  });

  it("renders all six sections as 'Not yet analyzed' for empty profile", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    // Create directory with no profile.json or output files
    productDir.writeJson("empty-app", "crawl/metadata.json", {});

    const html = renderProductReport("empty-app", productDir);
    // All seven section IDs should be present
    expect(html).toContain('id="identity"');
    expect(html).toContain('id="outcomes"');
    expect(html).toContain('id="journey"');
    expect(html).toContain('id="icp-profiles"');
    expect(html).toContain('id="value-moments"');
    expect(html).toContain('id="measurement-spec"');
    expect(html).toContain('id="lifecycle-states"');
    // Count "Not yet analyzed" — should appear 7 times (one per section)
    const matches = html.match(/Not yet analyzed/g);
    expect(matches).toHaveLength(7);
  });

  it("renders identity as card layout with description and context badges", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: {
        productName: "TestApp",
        description: "A test application",
        targetCustomer: "Developers",
        businessModel: "SaaS",
        industry: "DevTools",
        companyStage: "Growth",
        confidence: 0.9,
      },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("identity-card");
    expect(html).toContain("identity-description");
    expect(html).toContain("identity-target");
    expect(html).toContain("identity-context");
    // No <dl> or <dt> — uses card layout
    expect(html).not.toMatch(/<dl>/);
    expect(html).not.toMatch(/<dt>/);
  });

  it("renders value moment cross-references when enrichment data present", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "convergence/value-moments.json", [
      {
        id: "m1",
        name: "Quick setup",
        description: "Set up fast",
        tier: 1,
        lenses: ["jtbd"],
        lens_count: 1,
        roles: ["Developer"],
        product_surfaces: ["Onboarding"],
        contributing_candidates: [],
        measurement_references: [{ entity: "project", activity: "created" }],
        lifecycle_relevance: ["new", "activated"],
        suggested_metrics: ["projects_created_per_user"],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("badge-measurement");
    expect(html).toContain("project.created");
    expect(html).toContain("badge-lifecycle");
    expect(html).toContain("activated");
    expect(html).toContain("projects_created_per_user");
  });

  it("hides cross-reference sections when enrichment fields are absent", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "convergence/value-moments.json", [
      {
        id: "m1",
        name: "Quick setup",
        description: "Set up fast",
        tier: 1,
        lenses: ["jtbd"],
        lens_count: 1,
        roles: [],
        product_surfaces: [],
        contributing_candidates: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    // Extract body content (after </style>) to avoid matching CSS class definitions
    const bodyContent = html.split("</style>")[1] ?? "";
    expect(bodyContent).not.toContain("Tracks:");
    expect(bodyContent).not.toContain("Lifecycle:");
    expect(bodyContent).not.toContain("Metrics:");
  });

  it("hides cross-reference sections when enrichment fields are empty arrays", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/value-moments.json", [
      {
        id: "m1",
        name: "Quick setup",
        description: "Set up fast",
        tier: 1,
        lenses: ["jtbd"],
        lens_count: 1,
        roles: [],
        product_surfaces: [],
        contributing_candidates: [],
        measurement_references: [],
        lifecycle_relevance: [],
        suggested_metrics: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    const bodyContent = html.split("</style>")[1] ?? "";
    expect(bodyContent).not.toContain("Tracks:");
    expect(bodyContent).not.toContain("Lifecycle:");
    expect(bodyContent).not.toContain("Metrics:");
  });

  it("renders measurement spec activities before properties", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/measurement-spec.json", {
      perspectives: {
        product: {
          entities: [{
            id: "board",
            name: "Board",
            description: "A whiteboard",
            isHeartbeat: true,
            properties: [{ name: "board_id", type: "id", description: "Board ID", isRequired: true }],
            activities: [{ name: "created", properties_supported: ["board_id"], activity_properties: [] }],
          }],
        },
        customer: { entities: [] },
        interaction: { entities: [] },
      },
      jsonSchemas: [],
      confidence: 0.8,
      sources: [],
    });

    const html = renderProductReport("test-app", productDir);
    // Activities should appear before properties in the HTML
    const activitiesIdx = html.indexOf("Activities");
    const propertiesIdx = html.indexOf("Property");
    expect(activitiesIdx).toBeGreaterThan(-1);
    expect(propertiesIdx).toBeGreaterThan(-1);
    expect(activitiesIdx).toBeLessThan(propertiesIdx);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: outcomes section
// ---------------------------------------------------------------------------

describe("renderProductReport — outcomes section", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("renders outcomes section with enriched data (measurement_references + suggested_metrics)", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/outcomes.json", [
      {
        description: "Reduce time to first deployment",
        type: "efficiency",
        linkedFeatures: ["One-click deploy", "Auto-config"],
        measurement_references: [
          { entity: "deployment", activity: "completed" },
          { entity: "project", activity: "configured" },
        ],
        suggested_metrics: ["time_to_first_deploy", "deploy_success_rate"],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    const bodyContent = html.split("</style>")[1] ?? "";
    // Section structure
    expect(bodyContent).toContain('id="outcomes"');
    expect(bodyContent).toContain("Outcomes");
    // Description as card heading
    expect(bodyContent).toContain("Reduce time to first deployment");
    // Type badge
    expect(bodyContent).toContain("efficiency");
    // Linked features
    expect(bodyContent).toContain("One-click deploy");
    expect(bodyContent).toContain("Auto-config");
    // Measurement references as badge-measurement spans
    expect(bodyContent).toContain("badge-measurement");
    expect(bodyContent).toContain("deployment.completed");
    expect(bodyContent).toContain("project.configured");
    // Suggested metrics as code elements
    expect(bodyContent).toContain("<code>time_to_first_deploy</code>");
    expect(bodyContent).toContain("<code>deploy_success_rate</code>");
  });

  it("renders outcomes section with raw data (no enrichment fields)", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/outcomes.json", [
      {
        description: "Increase team collaboration",
        type: "engagement",
        linkedFeatures: ["Shared boards", "Real-time editing"],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    const bodyContent = html.split("</style>")[1] ?? "";
    // Section should render without no-data class
    expect(bodyContent).toContain('id="outcomes"');
    expect(bodyContent).not.toContain('id="outcomes" class="no-data"');
    // Description and type
    expect(bodyContent).toContain("Increase team collaboration");
    expect(bodyContent).toContain("engagement");
    // Linked features
    expect(bodyContent).toContain("Shared boards");
    expect(bodyContent).toContain("Real-time editing");
    // No measurement badges or metrics when enrichment fields are absent
    expect(bodyContent).not.toContain("badge-measurement");
    expect(bodyContent).not.toContain("Tracks:");
    expect(bodyContent).not.toContain("Metrics:");
  });

  it("renders empty state when no outcomes exist", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    // Section should exist with no-data class
    expect(html).toContain('id="outcomes" class="no-data"');
    expect(html).toMatch(/id="outcomes"[\s\S]*?Not yet analyzed/);
  });

  it("outcomes section appears in navigation", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/outcomes.json", [
      {
        description: "Some outcome",
        type: "growth",
        linkedFeatures: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    // Nav should include outcomes link
    expect(html).toContain('href="#outcomes"');
    // Outcomes has data, so the nav link should NOT be dimmed
    expect(html).toMatch(/href="#outcomes" class=""/);
  });

  it("dims outcomes nav link when no outcomes data", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    // Outcomes has no data, so nav link should be dimmed
    expect(html).toMatch(/href="#outcomes" class=" dimmed"/);
  });

  it("falls back to profile.outcomes.items when outputs/outcomes.json is missing", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
      outcomes: {
        items: [
          {
            description: "Profile fallback outcome",
            type: "retention",
            linkedFeatures: ["Feature X"],
          },
        ],
        confidence: 0.7,
        evidence: [],
      },
    });

    const html = renderProductReport("test-app", productDir);
    const bodyContent = html.split("</style>")[1] ?? "";
    expect(bodyContent).toContain("Profile fallback outcome");
    expect(bodyContent).toContain("retention");
    expect(bodyContent).toContain("Feature X");
  });

  it("outcomes without measurement_references show no measurement badges (graceful)", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });
    productDir.writeJson("test-app", "outputs/outcomes.json", [
      {
        description: "Outcome without refs",
        type: "acquisition",
        linkedFeatures: ["Landing page"],
        measurement_references: [],
        suggested_metrics: [],
      },
      {
        description: "Outcome without enrichment fields at all",
        type: "revenue",
        linkedFeatures: [],
      },
    ]);

    const html = renderProductReport("test-app", productDir);
    const bodyContent = html.split("</style>")[1] ?? "";
    // Both outcomes should render
    expect(bodyContent).toContain("Outcome without refs");
    expect(bodyContent).toContain("Outcome without enrichment fields at all");
    // No measurement badges
    expect(bodyContent).not.toContain("badge-measurement");
    expect(bodyContent).not.toContain("Tracks:");
    expect(bodyContent).not.toContain("Metrics:");
  });

  it("outcomes section appears between identity and journey in the report", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    const identityIdx = html.indexOf('id="identity"');
    const outcomesIdx = html.indexOf('id="outcomes"');
    const journeyIdx = html.indexOf('id="journey"');
    expect(identityIdx).toBeGreaterThan(-1);
    expect(outcomesIdx).toBeGreaterThan(-1);
    expect(journeyIdx).toBeGreaterThan(-1);
    expect(outcomesIdx).toBeGreaterThan(identityIdx);
    expect(outcomesIdx).toBeLessThan(journeyIdx);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: source material rendering
// ---------------------------------------------------------------------------

describe("renderSourceMaterial", () => {
  it("returns empty string when sourceMaterial is undefined", () => {
    expect(renderSourceMaterial(undefined)).toBe("");
  });

  it("returns empty string when all counts are zero or missing", () => {
    expect(renderSourceMaterial({})).toBe("");
    expect(renderSourceMaterial({ pagesScanned: 0 })).toBe("");
  });

  it("renders page count with timestamp", () => {
    const html = renderSourceMaterial({
      pagesScanned: 12,
      pagesLastUpdated: 1709337600000, // 2024-03-02
    });
    expect(html).toContain("source-material");
    expect(html).toContain("source-card");
    expect(html).toContain("12");
    expect(html).toContain("pages scanned");
    expect(html).toContain("Last updated: 2024-03-02");
  });

  it("renders document count with timestamp", () => {
    const html = renderSourceMaterial({
      documentsRead: 5,
      documentsLastUpdated: 1709337600000,
    });
    expect(html).toContain("5");
    expect(html).toContain("documents read");
    expect(html).toContain("Last updated: 2024-03-02");
  });

  it("renders video count with timestamp", () => {
    const html = renderSourceMaterial({
      videosWatched: 3,
      videosLastUpdated: 1709337600000,
    });
    expect(html).toContain("3");
    expect(html).toContain("videos watched");
    expect(html).toContain("Last updated: 2024-03-02");
  });

  it("omits timestamp line when no timestamp is available", () => {
    const html = renderSourceMaterial({
      pagesScanned: 8,
    });
    expect(html).toContain("8");
    expect(html).toContain("pages scanned");
    expect(html).not.toContain("Last updated");
  });

  it("renders multiple categories as separate cards", () => {
    const html = renderSourceMaterial({
      pagesScanned: 10,
      pagesLastUpdated: 1709337600000,
      documentsRead: 3,
      documentsLastUpdated: 1709337600000,
    });
    const cardCount = (html.match(/source-card"/g) ?? []).length;
    expect(cardCount).toBe(2);
    expect(html).toContain("pages scanned");
    expect(html).toContain("documents read");
  });
});

describe("renderProductReport — source material", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("renders source material cards when profile has sourceMaterial data", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
      sourceMaterial: {
        pagesScanned: 15,
        pagesLastUpdated: 1709337600000,
        documentsRead: 4,
        documentsLastUpdated: 1709337600000,
      },
    });

    const html = renderProductReport("test-app", productDir);
    expect(html).toContain("source-material");
    expect(html).toContain("15");
    expect(html).toContain("pages scanned");
    expect(html).toContain("4");
    expect(html).toContain("documents read");
    expect(html).toContain("Last updated: 2024-03-02");
  });

  it("does not render source material section when profile has no sourceMaterial", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    productDir.writeJson("test-app", "profile.json", {
      identity: { productName: "TestApp" },
    });

    const html = renderProductReport("test-app", productDir);
    // Check body content only (CSS has class definitions)
    const bodyContent = html.split("</style>")[1] ?? "";
    expect(bodyContent).not.toContain("source-material");
    expect(bodyContent).not.toContain("source-card");
  });
});

// ---------------------------------------------------------------------------
// Integration tests: HTTP server
// ---------------------------------------------------------------------------

describe("view server", () => {
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

  it("starts on port 0 and returns a valid URL", async () => {
    handle = await createServerWithProducts([]);
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.url).toBe(`http://localhost:${handle.port}`);
  });

  it("GET / returns product list with scanned products", async () => {
    handle = await createServerWithProducts([
      {
        slug: "linear-app",
        profile: {
          identity: { productName: "Linear" },
          metadata: { url: "https://linear.app", scannedAt: 1709337600000 },
          completeness: 0.83,
        },
      },
    ]);
    const res = await fetch(`${handle.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Linear");
    expect(body).toContain("https://linear.app");
    expect(body).toContain("83%");
    expect(body).toContain('href="/linear-app"');
  });

  it("GET / returns empty state when no products", async () => {
    handle = await createServerWithProducts([]);
    const res = await fetch(`${handle.url}/`);
    const body = await res.text();
    expect(body).toContain("No products scanned yet");
  });

  it("GET /{slug} returns full report for an existing product", async () => {
    handle = await createServerWithProducts([
      {
        slug: "linear-app",
        profile: {
          identity: {
            productName: "Linear",
            description: "Issue tracking tool",
            targetCustomer: "Engineering teams",
            businessModel: "SaaS",
            confidence: 0.88,
          },
          metadata: { url: "https://linear.app" },
          completeness: 0.83,
        },
      },
    ]);
    const res = await fetch(`${handle.url}/linear-app`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Linear");
    expect(body).toContain("Issue tracking tool");
    expect(body).toContain("Engineering teams");
    expect(body).toContain("Back to product list");
    expect(body).toContain('id="identity"');
    expect(body).toContain('id="journey"');
  });

  it("GET /{slug} returns 404 for nonexistent product", async () => {
    handle = await createServerWithProducts([]);
    const res = await fetch(`${handle.url}/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("Product not found");
    expect(body).toContain("Back to product list");
  });

  it("GET /{invalid-slug} returns 404 for path traversal attempts", async () => {
    handle = await createServerWithProducts([]);
    const res = await fetch(`${handle.url}/../etc/passwd`);
    expect(res.status).toBe(404);
  });

  it("escapes slug in 404 responses", async () => {
    handle = await createServerWithProducts([]);
    const res = await fetch(`${handle.url}/a&b`);
    const body = await res.text();
    expect(body).toContain("&amp;");
  });

  it("GET /favicon.ico returns 204 with no body", async () => {
    handle = await createServerWithProducts([]);
    const res = await fetch(`${handle.url}/favicon.ico`);
    expect(res.status).toBe(204);
    const body = await res.text();
    expect(body).toBe("");
  });

  it("close() shuts down the server", async () => {
    handle = await createServerWithProducts([]);
    const url = handle.url;
    await handle.close();
    handle = undefined;

    await expect(fetch(`${url}/`)).rejects.toThrow();
  });
});
