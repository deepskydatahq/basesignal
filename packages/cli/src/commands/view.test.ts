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

  it("GET /{slug} returns 200 for an existing product", async () => {
    handle = await createServerWithProducts([
      {
        slug: "linear-app",
        profile: {
          identity: { productName: "Linear" },
          metadata: { url: "https://linear.app" },
        },
      },
    ]);
    const res = await fetch(`${handle.url}/linear-app`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Linear");
    expect(body).toContain("Back to product list");
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
