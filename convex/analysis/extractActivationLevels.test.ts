import { describe, it, expect } from "vitest";
import {
  filterActivationPages,
  buildActivationPageContext,
} from "./extractActivationLevels";

describe("filterActivationPages", () => {
  it("keeps onboarding, help, customers, features, and homepage pages", () => {
    const pages = [
      { pageType: "onboarding", content: "Get started", url: "https://miro.com/onboarding", title: "Onboarding" },
      { pageType: "help", content: "Help center", url: "https://miro.com/help", title: "Help" },
      { pageType: "customers", content: "Case studies", url: "https://miro.com/customers", title: "Customers" },
      { pageType: "features", content: "Features", url: "https://miro.com/features", title: "Features" },
      { pageType: "homepage", content: "Welcome", url: "https://miro.com", title: "Miro" },
      { pageType: "pricing", content: "Plans", url: "https://miro.com/pricing", title: "Pricing" },
      { pageType: "about", content: "About us", url: "https://miro.com/about", title: "About" },
      { pageType: "blog", content: "Blog post", url: "https://miro.com/blog", title: "Blog" },
    ];

    const result = filterActivationPages(pages);
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.pageType)).toEqual([
      "onboarding",
      "help",
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("sorts pages by priority: onboarding > help > customers > features > homepage", () => {
    const pages = [
      { pageType: "homepage", content: "Welcome", url: "https://miro.com", title: "Miro" },
      { pageType: "features", content: "Features", url: "https://miro.com/features", title: "Features" },
      { pageType: "help", content: "Help", url: "https://miro.com/help", title: "Help" },
      { pageType: "onboarding", content: "Get started", url: "https://miro.com/onboarding", title: "Start" },
      { pageType: "customers", content: "Stories", url: "https://miro.com/customers", title: "Customers" },
    ];

    const result = filterActivationPages(pages);
    expect(result.map((p) => p.pageType)).toEqual([
      "onboarding",
      "help",
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("returns empty array when no matching pages", () => {
    const pages = [
      { pageType: "pricing", content: "Plans", url: "https://miro.com/pricing" },
      { pageType: "about", content: "About", url: "https://miro.com/about" },
      { pageType: "blog", content: "Blog", url: "https://miro.com/blog" },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterActivationPages([])).toHaveLength(0);
  });

  it("includes homepage as fallback for value prop context", () => {
    const pages = [
      { pageType: "homepage", content: "Welcome to Miro", url: "https://miro.com", title: "Miro" },
      { pageType: "pricing", content: "Plans", url: "https://miro.com/pricing" },
    ];

    const result = filterActivationPages(pages);
    expect(result).toHaveLength(1);
    expect(result[0].pageType).toBe("homepage");
  });
});

describe("buildActivationPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "onboarding", content: "Step 1: Create your first board", url: "https://miro.com/onboarding", title: "Get Started" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: Get Started (onboarding) ---");
    expect(result).toContain("URL: https://miro.com/onboarding");
    expect(result).toContain("Step 1: Create your first board");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "help", content: "Help content", url: "https://miro.com/help" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: https://miro.com/help (help) ---");
  });

  it("joins multiple pages with spacing", () => {
    const pages = [
      { pageType: "onboarding", content: "Get started", url: "https://miro.com/onboarding", title: "Start" },
      { pageType: "help", content: "Help docs", url: "https://miro.com/help", title: "Help" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: Start (onboarding) ---");
    expect(result).toContain("--- PAGE: Help (help) ---");
  });

  it("truncates individual page content at per-page limit", () => {
    const longContent = "x".repeat(20_000);
    const pages = [
      { pageType: "onboarding", content: longContent, url: "https://miro.com/onboarding", title: "Start" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("[Content truncated]");
    expect(result.length).toBeLessThan(20_000);
  });

  it("respects total content limit across pages", () => {
    const longContent = "x".repeat(30_000);
    const pages = [
      { pageType: "onboarding", content: longContent, url: "https://miro.com/onboarding", title: "Start" },
      { pageType: "help", content: longContent, url: "https://miro.com/help", title: "Help" },
      { pageType: "features", content: longContent, url: "https://miro.com/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    // Should be capped around total limit (40000 chars)
    expect(result.length).toBeLessThan(50_000);
  });

  it("returns empty string for empty input", () => {
    expect(buildActivationPageContext([])).toBe("");
  });
});

describe("integration: Miro-like crawl data", () => {
  const miroCrawlPages = [
    { pageType: "homepage", content: "Miro is the online collaborative whiteboard platform that enables distributed teams to work effectively together.", url: "https://miro.com", title: "Miro | The Visual Workspace for Innovation" },
    { pageType: "features", content: "Infinite canvas. Real-time collaboration. 200+ integrations. Templates for every use case. Create boards, add sticky notes, draw connections.", url: "https://miro.com/features", title: "Features" },
    { pageType: "customers", content: "See how teams like Dell, Cisco, and Deloitte use Miro to transform how they collaborate. Case study: Dell reduced meeting time by 30% using Miro boards for async collaboration.", url: "https://miro.com/customers", title: "Customer Stories" },
    { pageType: "pricing", content: "Free plan: 3 editable boards. Starter: $8/user/mo. Business: $16/user/mo. Enterprise: custom.", url: "https://miro.com/pricing", title: "Pricing" },
    { pageType: "about", content: "Miro was founded in 2011 with a mission to empower teams to create the next big thing.", url: "https://miro.com/about", title: "About Miro" },
    { pageType: "integrations", content: "Connect Miro to Jira, Slack, Confluence, and 200+ other tools.", url: "https://miro.com/integrations", title: "Integrations" },
    { pageType: "security", content: "Enterprise-grade security. SOC2, ISO 27001, GDPR compliant.", url: "https://miro.com/security", title: "Security" },
    { pageType: "other", content: "Blog post about remote work trends.", url: "https://miro.com/blog/remote-work", title: "Blog" },
  ];

  it("filters to activation-relevant pages from a realistic crawl", () => {
    const result = filterActivationPages(miroCrawlPages);

    // Should include customers, features, and homepage (no onboarding/help in this crawl)
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.pageType)).toEqual([
      "customers",
      "features",
      "homepage",
    ]);
  });

  it("builds context from filtered pages with correct priority order", () => {
    const filtered = filterActivationPages(miroCrawlPages);
    const context = buildActivationPageContext(filtered);

    // Customers should appear before features, features before homepage
    const customersIdx = context.indexOf("Customer Stories (customers)");
    const featuresIdx = context.indexOf("Features (features)");
    const homepageIdx = context.indexOf("The Visual Workspace for Innovation (homepage)");

    expect(customersIdx).toBeLessThan(featuresIdx);
    expect(featuresIdx).toBeLessThan(homepageIdx);

    // All relevant content should be present
    expect(context).toContain("Dell reduced meeting time");
    expect(context).toContain("Infinite canvas");
    expect(context).toContain("online collaborative whiteboard");
  });

  it("excludes non-activation pages from context", () => {
    const filtered = filterActivationPages(miroCrawlPages);
    const context = buildActivationPageContext(filtered);

    expect(context).not.toContain("Free plan: 3 editable boards");
    expect(context).not.toContain("founded in 2011");
    expect(context).not.toContain("Jira, Slack");
    expect(context).not.toContain("SOC2");
    expect(context).not.toContain("Blog post about remote work");
  });
});
