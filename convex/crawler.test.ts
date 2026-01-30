import { expect, test, vi, beforeEach, afterEach, describe } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create a test user
async function createTestUser(t: ReturnType<typeof convexTest>, clerkId: string, email: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId,
      email,
      createdAt: Date.now(),
    });
  });
}

test("startProductScan: crawls website and stores pages", async () => {
  const t = convexTest(schema);

  // Mock fetch for Jina API and robots.txt
  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    // robots.txt response
    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\nDisallow: /admin\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Jina API responses
    if (urlStr.includes("r.jina.ai")) {
      const isMainPage = urlStr === "https://r.jina.ai/https://example.com/";
      if (isMainPage) {
        return new Response(
          `<html><head><title>Example Site</title><meta name="description" content="Example description"></head><body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="https://example.com/blog">Blog</a>
            <a href="https://other.com">External</a>
            </body></html>`,
          { status: 200 }
        );
      } else {
        return new Response(
          `<html><head><title>Sub Page</title></head><body>Content</body></html>`,
          { status: 200 }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  });

  try {
    // Create user
    const userId = await createTestUser(t, "test-user", "test@example.com");

    // Start scan
    const result = await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example.com",
    });

    expect(result.scanId).toBeDefined();
    expect(result.pagesScanned).toBeGreaterThan(0);

    // Get scan details
    const scan = await t.query(api.crawler.getScan, {
      scanId: result.scanId,
    });

    expect(scan).toBeDefined();
    expect(scan?.status).toBe("completed");
    expect(scan?.scannedPages).toBeGreaterThan(0);
    expect(scan?.rawHtmlPages.length).toBeGreaterThan(0);

    // Verify page structure
    const firstPage = scan?.rawHtmlPages[0];
    expect(firstPage?.url).toBeDefined();
    expect(firstPage?.html).toBeDefined();
    expect(firstPage?.depth).toBe(0);
    expect(firstPage?.fetchedAt).toBeDefined();
  } finally {
    global.fetch = originalFetch;
  }
});

test("startProductScan: respects robots.txt disallowed paths", async () => {
  const t = convexTest(schema);

  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\nDisallow: /admin\nDisallow: /private\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (urlStr.includes("r.jina.ai")) {
      // Only allow non-disallowed paths
      if (!urlStr.includes("/admin") && !urlStr.includes("/private")) {
        return new Response(
          `<html><head><title>Page</title></head><body>Content</body></html>`,
          { status: 200 }
        );
      }
    }

    return new Response("Forbidden", { status: 403 });
  });

  try {
    const userId = await createTestUser(t, "test-user-2", "test2@example.com");

    const result = await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example.com",
    });

    expect(result.scanId).toBeDefined();
    expect(result.pagesScanned).toBeGreaterThanOrEqual(0);

    const scan = await t.query(api.crawler.getScan, {
      scanId: result.scanId,
    });

    // Verify no disallowed paths were scanned
    const scannedPaths = scan?.rawHtmlPages.map((p) => new URL(p.url).pathname) || [];
    expect(scannedPaths.some((p) => p.startsWith("/admin"))).toBe(false);
    expect(scannedPaths.some((p) => p.startsWith("/private"))).toBe(false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("startProductScan: respects max depth limit", async () => {
  const t = convexTest(schema);

  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\n", { status: 200 });
    }

    if (urlStr.includes("r.jina.ai")) {
      // Every page links to a deeper page
      return new Response(
        `<html><head><title>Page</title></head><body>
          <a href="https://example.com/level1/level2/level3/level4/level5">Deep Link</a>
        </body></html>`,
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  });

  try {
    const userId = await createTestUser(t, "test-user-3", "test3@example.com");

    const result = await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example.com",
    });

    const scan = await t.query(api.crawler.getScan, {
      scanId: result.scanId,
    });

    // Verify max depth is respected (should be <= 3)
    const maxDepth = Math.max(...(scan?.rawHtmlPages.map((p) => p.depth) || [0]));
    expect(maxDepth).toBeLessThanOrEqual(3);
  } finally {
    global.fetch = originalFetch;
  }
});

test("startProductScan: respects max pages limit", async () => {
  const t = convexTest(schema);

  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\n", { status: 200 });
    }

    if (urlStr.includes("r.jina.ai")) {
      // Return page with many links
      let html = `<html><head><title>Page</title></head><body>`;
      for (let i = 0; i < 100; i++) {
        html += `<a href="https://example.com/page${i}">Page ${i}</a>`;
      }
      html += `</body></html>`;
      return new Response(html, { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  });

  try {
    const userId = await createTestUser(t, "test-user-4", "test4@example.com");

    const result = await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example.com",
    });

    const scan = await t.query(api.crawler.getScan, {
      scanId: result.scanId,
    });

    // Verify max pages limit is respected (should be <= 50)
    expect(scan?.scannedPages).toBeLessThanOrEqual(50);
    expect(scan?.rawHtmlPages.length).toBeLessThanOrEqual(50);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getUserScans: returns all user scans", async () => {
  const t = convexTest(schema);

  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\n", { status: 200 });
    }

    if (urlStr.includes("r.jina.ai")) {
      return new Response(
        `<html><head><title>Page</title></head><body>Content</body></html>`,
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  });

  try {
    const userId = await createTestUser(t, "test-user-5", "test5@example.com");

    // Create multiple scans
    await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example1.com",
    });

    await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example2.com",
    });

    // Get user scans
    const scans = await t.query(api.crawler.getUserScans, {
      userId: userId as Id<"users">,
    });

    expect(scans.length).toBe(2);
    expect(scans[0]?.status).toBe("completed");
    expect(scans[1]?.status).toBe("completed");
  } finally {
    global.fetch = originalFetch;
  }
});

test("deleteScan: removes scan from database", async () => {
  const t = convexTest(schema);

  const originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: string | Request) => {
    const urlStr = typeof url === "string" ? url : url.url;

    if (urlStr.includes("robots.txt")) {
      return new Response("User-agent: *\n", { status: 200 });
    }

    if (urlStr.includes("r.jina.ai")) {
      return new Response(
        `<html><head><title>Page</title></head><body>Content</body></html>`,
        { status: 200 }
      );
    }

    return new Response("Not found", { status: 404 });
  });

  try {
    const userId = await createTestUser(t, "test-user-6", "test6@example.com");

    const result = await t.mutation(api.crawler.startProductScan, {
      userId: userId as Id<"users">,
      url: "https://example.com",
    });

    // Delete scan
    await t.mutation(api.crawler.deleteScan, {
      scanId: result.scanId,
    });

    // Verify deletion
    const scan = await t.query(api.crawler.getScan, {
      scanId: result.scanId,
    });

    expect(scan).toBeNull();
  } finally {
    global.fetch = originalFetch;
  }
});
