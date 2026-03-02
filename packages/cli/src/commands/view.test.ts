import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProductDirectory } from "@basesignal/storage";
import {
  escapeHtml,
  renderPage,
  isValidSlug,
  loadProductList,
  renderProductList,
  renderProductReport,
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
    // Confidence as string
    expect(html).toContain("Confidence: high");
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
    expect(html).toContain("Interaction Perspective");
    expect(html).toContain("User");
    expect(html).toContain("heartbeat");
    expect(html).toContain("user_id");
    expect(html).toContain("signed_up");
    expect(html).toContain("converted");
    expect(html).toContain("When user upgrades");
    expect(html).toContain("PageView");
    expect(html).toContain("viewed_page");
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

  it("renders all six sections as 'Not yet analyzed' for empty profile", () => {
    const { dir, productDir } = createTmpProductDir();
    tmpDir = dir;
    // Create directory with no profile.json or output files
    productDir.writeJson("empty-app", "crawl/metadata.json", {});

    const html = renderProductReport("empty-app", productDir);
    // All six section IDs should be present
    expect(html).toContain('id="identity"');
    expect(html).toContain('id="journey"');
    expect(html).toContain('id="icp-profiles"');
    expect(html).toContain('id="value-moments"');
    expect(html).toContain('id="measurement-spec"');
    expect(html).toContain('id="lifecycle-states"');
    // Count "Not yet analyzed" — should appear 6 times (one per section)
    const matches = html.match(/Not yet analyzed/g);
    expect(matches).toHaveLength(6);
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

  it("close() shuts down the server", async () => {
    handle = await createServerWithProducts([]);
    const url = handle.url;
    await handle.close();
    handle = undefined;

    await expect(fetch(`${url}/`)).rejects.toThrow();
  });
});
