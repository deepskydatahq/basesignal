import { describe, it, expect } from "vitest";
import {
  validateUrl,
  classifyPageType,
  shouldCrawl,
  shouldCrawlForActivation,
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

  it("classifies help subdomains", () => {
    expect(classifyPageType("https://help.acme.io/", "acme.io")).toBe("help");
    expect(classifyPageType("https://help.acme.io/articles/setup", "acme.io")).toBe("help");
  });

  it("classifies docs subdomains", () => {
    expect(classifyPageType("https://docs.acme.io/", "acme.io")).toBe("docs");
    expect(classifyPageType("https://docs.acme.io/api/reference", "acme.io")).toBe("docs");
  });

  it("classifies support subdomains", () => {
    expect(classifyPageType("https://support.acme.io/", "acme.io")).toBe("support");
    expect(classifyPageType("https://support.acme.io/tickets", "acme.io")).toBe("support");
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

describe("shouldCrawlForActivation", () => {
  it("returns true for help subdomains", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/")).toBe(true);
  });

  it("returns true for docs subdomains", () => {
    expect(shouldCrawlForActivation("https://docs.acme.io/")).toBe(true);
  });

  it("returns true for support subdomains", () => {
    expect(shouldCrawlForActivation("https://support.acme.io/")).toBe(true);
  });

  it("returns false for non-docs subdomains", () => {
    expect(shouldCrawlForActivation("https://acme.io/pricing")).toBe(false);
    expect(shouldCrawlForActivation("https://blog.acme.io/")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(shouldCrawlForActivation("not-a-url")).toBe(false);
  });

  it("allows getting-started and onboarding paths within docs sites", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/getting-started")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/onboarding")).toBe(true);
    expect(shouldCrawlForActivation("https://help.acme.io/first-steps")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/tutorials/basics")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/quick-start")).toBe(true);
  });

  it("filters out deep reference docs paths", () => {
    expect(shouldCrawlForActivation("https://docs.acme.io/api/v2/endpoints/users/list")).toBe(false);
    expect(shouldCrawlForActivation("https://docs.acme.io/reference/sdk/methods")).toBe(false);
  });

  it("allows root paths on docs subdomains", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/")).toBe(true);
  });
});

describe("isDocsSite", () => {
  it("detects docs subdomains", () => {
    expect(isDocsSite("https://docs.acme.io")).toBe(true);
    expect(isDocsSite("https://docs.acme.io/api")).toBe(true);
  });

  it("detects help subdomains", () => {
    expect(isDocsSite("https://help.acme.io")).toBe(true);
    expect(isDocsSite("https://help.acme.io/articles/setup")).toBe(true);
  });

  it("detects support subdomains", () => {
    expect(isDocsSite("https://support.acme.io")).toBe(true);
  });

  it("detects developer subdomains", () => {
    expect(isDocsSite("https://developer.acme.io")).toBe(true);
    expect(isDocsSite("https://developer.acme.io/reference")).toBe(true);
  });

  it("detects learn subdomains", () => {
    expect(isDocsSite("https://learn.acme.io")).toBe(true);
  });

  it("detects wiki subdomains", () => {
    expect(isDocsSite("https://wiki.acme.io")).toBe(true);
  });

  it("detects /docs paths", () => {
    expect(isDocsSite("https://acme.io/docs")).toBe(true);
    expect(isDocsSite("https://acme.io/docs/api")).toBe(true);
  });

  it("detects /help paths", () => {
    expect(isDocsSite("https://acme.io/help")).toBe(true);
    expect(isDocsSite("https://acme.io/help/getting-started")).toBe(true);
  });

  it("detects /support paths", () => {
    expect(isDocsSite("https://acme.io/support")).toBe(true);
  });

  it("detects /knowledge-base paths", () => {
    expect(isDocsSite("https://acme.io/knowledge-base")).toBe(true);
    expect(isDocsSite("https://acme.io/knowledge-base/article/123")).toBe(true);
  });

  it("detects /developer paths", () => {
    expect(isDocsSite("https://acme.io/developer")).toBe(true);
  });

  it("detects /api-docs paths", () => {
    expect(isDocsSite("https://acme.io/api-docs")).toBe(true);
    expect(isDocsSite("https://acme.io/api-docs/v2/endpoints")).toBe(true);
  });

  it("detects /reference paths", () => {
    expect(isDocsSite("https://acme.io/reference")).toBe(true);
  });

  it("detects /guides paths", () => {
    expect(isDocsSite("https://acme.io/guides")).toBe(true);
    expect(isDocsSite("https://acme.io/guides/quickstart")).toBe(true);
  });

  it("detects /learn paths", () => {
    expect(isDocsSite("https://acme.io/learn")).toBe(true);
  });

  it("detects /wiki paths", () => {
    expect(isDocsSite("https://acme.io/wiki")).toBe(true);
  });

  it("does not flag non-docs URLs", () => {
    expect(isDocsSite("https://acme.io/pricing")).toBe(false);
    expect(isDocsSite("https://acme.io/features")).toBe(false);
    expect(isDocsSite("https://acme.io/blog")).toBe(false);
    expect(isDocsSite("https://acme.io/about")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isDocsSite("not-a-url")).toBe(false);
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

  it("collects multiple docs URLs in docsUrls array", () => {
    const urls = [
      "https://acme.io/",
      "https://docs.acme.io/",
      "https://help.acme.io/getting-started",
      "https://acme.io/docs/api",
    ];
    const { docsUrls } = filterHighValuePages(urls, "https://acme.io");
    expect(docsUrls).toContain("https://docs.acme.io/");
    expect(docsUrls).toContain("https://help.acme.io/getting-started");
    expect(docsUrls).toContain("https://acme.io/docs/api");
    expect(docsUrls.length).toBe(3);
  });

  it("returns empty docsUrls when no docs sites found", () => {
    const urls = [
      "https://acme.io/",
      "https://acme.io/pricing",
    ];
    const { docsUrls } = filterHighValuePages(urls, "https://acme.io");
    expect(docsUrls).toEqual([]);
  });

  it("includes help.miro.com in docsUrls when scanning miro.com", () => {
    const urls = [
      "https://miro.com/",
      "https://miro.com/pricing",
      "https://miro.com/features",
      "https://help.miro.com/",
      "https://help.miro.com/hc/en-us/articles/getting-started",
      "https://miro.com/about",
    ];
    const result = filterHighValuePages(urls, "https://miro.com");
    expect(result.docsUrls).toContain("https://help.miro.com/");
    expect(result.docsUrls).toContain("https://help.miro.com/hc/en-us/articles/getting-started");
    // help.miro.com URLs should NOT be in targetUrls (shouldCrawl skips them)
    expect(result.targetUrls).not.toContain("https://help.miro.com/");
    // marketing pages should still be in targetUrls
    expect(result.targetUrls).toContain("https://miro.com/");
    expect(result.targetUrls).toContain("https://miro.com/pricing");
  });
});
