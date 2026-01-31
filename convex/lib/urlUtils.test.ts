import { describe, it, expect } from "vitest";
import {
  validateUrl,
  classifyPageType,
  shouldCrawl,
  isDocsSite,
  filterHighValuePages,
} from "./urlUtils";

describe("validateUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(validateUrl("https://acme.io")).toEqual({ valid: true });
    expect(validateUrl("https://www.acme.io/pricing")).toEqual({ valid: true });
  });

  it("accepts valid HTTP URLs", () => {
    expect(validateUrl("http://acme.io")).toEqual({ valid: true });
  });

  it("rejects invalid URL format", () => {
    const result = validateUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  it("rejects non-HTTP protocols", () => {
    const result = validateUrl("ftp://acme.io");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP");
  });

  it("rejects localhost", () => {
    const result = validateUrl("http://localhost:3000");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("blocked");
  });

  it("rejects private IP ranges", () => {
    expect(validateUrl("http://127.0.0.1").valid).toBe(false);
    expect(validateUrl("http://10.0.0.1").valid).toBe(false);
    expect(validateUrl("http://192.168.1.1").valid).toBe(false);
    expect(validateUrl("http://172.16.0.1").valid).toBe(false);
  });

  it("rejects cloud metadata endpoints", () => {
    expect(validateUrl("http://169.254.169.254/latest/meta-data/").valid).toBe(false);
    expect(validateUrl("http://metadata.google.internal/").valid).toBe(false);
  });
});

describe("classifyPageType", () => {
  it("classifies homepage", () => {
    expect(classifyPageType("https://acme.io/")).toBe("homepage");
    expect(classifyPageType("https://acme.io")).toBe("homepage");
  });

  it("classifies pricing pages", () => {
    expect(classifyPageType("https://acme.io/pricing")).toBe("pricing");
    expect(classifyPageType("https://acme.io/plans")).toBe("pricing");
  });

  it("classifies features pages", () => {
    expect(classifyPageType("https://acme.io/features")).toBe("features");
    expect(classifyPageType("https://acme.io/product/overview")).toBe("features");
  });

  it("classifies about pages", () => {
    expect(classifyPageType("https://acme.io/about")).toBe("about");
    expect(classifyPageType("https://acme.io/company")).toBe("about");
  });

  it("classifies customer pages", () => {
    expect(classifyPageType("https://acme.io/customers")).toBe("customers");
    expect(classifyPageType("https://acme.io/case-studies/acme")).toBe("customers");
  });

  it("classifies integration pages", () => {
    expect(classifyPageType("https://acme.io/integrations")).toBe("integrations");
  });

  it("classifies security pages", () => {
    expect(classifyPageType("https://acme.io/security")).toBe("security");
    expect(classifyPageType("https://acme.io/compliance")).toBe("security");
  });

  it("classifies solution pages", () => {
    expect(classifyPageType("https://acme.io/solutions/enterprise")).toBe("solutions");
    expect(classifyPageType("https://acme.io/use-cases")).toBe("solutions");
  });

  it("returns other for unknown patterns", () => {
    expect(classifyPageType("https://acme.io/changelog")).toBe("other");
    expect(classifyPageType("https://acme.io/team")).toBe("other");
  });
});

describe("shouldCrawl", () => {
  it("allows high-value pages", () => {
    expect(shouldCrawl("https://acme.io/")).toBe(true);
    expect(shouldCrawl("https://acme.io/pricing")).toBe(true);
    expect(shouldCrawl("https://acme.io/features")).toBe(true);
  });

  it("skips blog posts", () => {
    expect(shouldCrawl("https://acme.io/blog/my-post")).toBe(false);
  });

  it("skips legal pages", () => {
    expect(shouldCrawl("https://acme.io/legal")).toBe(false);
    expect(shouldCrawl("https://acme.io/privacy")).toBe(false);
    expect(shouldCrawl("https://acme.io/terms")).toBe(false);
  });

  it("skips auth pages", () => {
    expect(shouldCrawl("https://acme.io/login")).toBe(false);
    expect(shouldCrawl("https://acme.io/signup")).toBe(false);
  });

  it("skips asset files", () => {
    expect(shouldCrawl("https://acme.io/logo.png")).toBe(false);
    expect(shouldCrawl("https://acme.io/doc.pdf")).toBe(false);
    expect(shouldCrawl("https://acme.io/image.jpg")).toBe(false);
  });

  it("skips careers pages", () => {
    expect(shouldCrawl("https://acme.io/careers/")).toBe(false);
    expect(shouldCrawl("https://acme.io/jobs/")).toBe(false);
  });
});

describe("isDocsSite", () => {
  it("detects docs subdomains", () => {
    expect(isDocsSite("https://docs.acme.io")).toBe(true);
    expect(isDocsSite("https://docs.acme.io/api")).toBe(true);
  });

  it("detects /docs paths", () => {
    expect(isDocsSite("https://acme.io/docs")).toBe(true);
    expect(isDocsSite("https://acme.io/docs/api")).toBe(true);
  });

  it("does not flag non-docs URLs", () => {
    expect(isDocsSite("https://acme.io/pricing")).toBe(false);
    expect(isDocsSite("https://acme.io/features")).toBe(false);
  });
});

describe("filterHighValuePages", () => {
  it("filters to same domain only", () => {
    const urls = [
      "https://acme.io/",
      "https://acme.io/pricing",
      "https://external.com/page",
    ];
    const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
    expect(targetUrls).toContain("https://acme.io/");
    expect(targetUrls).toContain("https://acme.io/pricing");
    expect(targetUrls).not.toContain("https://external.com/page");
  });

  it("removes skip-pattern URLs", () => {
    const urls = [
      "https://acme.io/",
      "https://acme.io/blog/post-1",
      "https://acme.io/pricing",
      "https://acme.io/privacy",
    ];
    const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
    expect(targetUrls).toContain("https://acme.io/");
    expect(targetUrls).toContain("https://acme.io/pricing");
    expect(targetUrls).not.toContain("https://acme.io/blog/post-1");
    expect(targetUrls).not.toContain("https://acme.io/privacy");
  });

  it("prioritizes must-crawl pages first", () => {
    const urls = [
      "https://acme.io/changelog",
      "https://acme.io/pricing",
      "https://acme.io/",
      "https://acme.io/features",
    ];
    const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
    // Must-crawl (homepage, pricing, features) should come before other (changelog)
    const homepageIdx = targetUrls.indexOf("https://acme.io/");
    const changelogIdx = targetUrls.indexOf("https://acme.io/changelog");
    expect(homepageIdx).toBeLessThan(changelogIdx);
  });

  it("limits to 30 pages max", () => {
    const urls = Array.from({ length: 50 }, (_, i) => `https://acme.io/page-${i}`);
    const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
    expect(targetUrls.length).toBeLessThanOrEqual(30);
  });

  it("detects docs site URLs", () => {
    const urls = [
      "https://acme.io/",
      "https://docs.acme.io/",
    ];
    const { docsUrl } = filterHighValuePages(urls, "https://acme.io");
    expect(docsUrl).toBe("https://docs.acme.io/");
  });

  it("detects /docs path as docs URL", () => {
    const urls = [
      "https://acme.io/",
      "https://acme.io/docs/getting-started",
    ];
    const { docsUrl } = filterHighValuePages(urls, "https://acme.io");
    expect(docsUrl).toBe("https://acme.io/docs/getting-started");
  });
});
