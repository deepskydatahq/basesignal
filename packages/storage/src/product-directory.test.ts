import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProductDirectory } from "./product-directory";
import type { AnalyticsTaxonomy } from "@basesignal/core";

describe("ProductDirectory", () => {
  let root: string;
  let pd: ProductDirectory;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "basesignal-pd-test-"));
    pd = new ProductDirectory({ root });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // --- writeJson / readJson ---

  it("writes and reads JSON artifact", () => {
    pd.writeJson("linear-app", "profile.json", { name: "Linear" });
    const data = pd.readJson("linear-app", "profile.json");
    expect(data).toEqual({ name: "Linear" });
  });

  it("creates nested directories for artifact path", () => {
    pd.writeJson("linear-app", "crawl/pages.json", [{ url: "https://linear.app" }]);
    const data = pd.readJson<Array<{ url: string }>>("linear-app", "crawl/pages.json");
    expect(data).toHaveLength(1);
    expect(data![0].url).toBe("https://linear.app");
  });

  it("writes pretty-printed JSON with trailing newline", () => {
    pd.writeJson("acme", "profile.json", { a: 1 });
    const raw = readFileSync(join(root, "acme", "profile.json"), "utf-8");
    expect(raw).toContain('  "a"');
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("overwrites existing artifact on re-write", () => {
    pd.writeJson("acme", "profile.json", { version: 1 });
    pd.writeJson("acme", "profile.json", { version: 2 });
    const data = pd.readJson<{ version: number }>("acme", "profile.json");
    expect(data!.version).toBe(2);
  });

  it("readJson returns null for non-existent file", () => {
    expect(pd.readJson("nope", "profile.json")).toBeNull();
  });

  it("readJson returns null for invalid JSON", () => {
    // Write raw invalid content directly
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(root, "bad"), { recursive: true });
    writeFileSync(join(root, "bad", "profile.json"), "not json{{{", "utf-8");
    expect(pd.readJson("bad", "profile.json")).toBeNull();
  });

  // --- exists ---

  it("exists returns false for missing product", () => {
    expect(pd.exists("nonexistent")).toBe(false);
  });

  it("exists returns true after writing an artifact", () => {
    pd.writeJson("linear-app", "profile.json", {});
    expect(pd.exists("linear-app")).toBe(true);
  });

  // --- listProducts ---

  it("lists product slugs alphabetically", () => {
    pd.writeJson("notion-so", "profile.json", {});
    pd.writeJson("linear-app", "profile.json", {});
    pd.writeJson("acme-com", "profile.json", {});
    expect(pd.listProducts()).toEqual(["acme-com", "linear-app", "notion-so"]);
  });

  it("returns empty array when no products exist", () => {
    expect(pd.listProducts()).toEqual([]);
  });

  it("ignores dotfiles in product listing", () => {
    const { mkdirSync } = require("node:fs");
    mkdirSync(join(root, ".hidden"), { recursive: true });
    pd.writeJson("visible", "profile.json", {});
    expect(pd.listProducts()).toEqual(["visible"]);
  });

  // --- getPath ---

  it("returns product directory path without artifact", () => {
    expect(pd.getPath("linear-app")).toBe(join(root, "linear-app"));
  });

  it("returns full artifact path", () => {
    expect(pd.getPath("linear-app", "crawl/pages.json")).toBe(
      join(root, "linear-app", "crawl", "pages.json"),
    );
  });

  // --- deeply nested artifacts ---

  it("handles deeply nested artifact paths", () => {
    pd.writeJson("acme", "lenses/capability-mapping.json", { lens: "capability_mapping" });
    pd.writeJson("acme", "convergence/clusters.json", { clusters: [] });
    expect(pd.readJson("acme", "lenses/capability-mapping.json")).toEqual({ lens: "capability_mapping" });
    expect(pd.readJson("acme", "convergence/clusters.json")).toEqual({ clusters: [] });
  });

  // --- taxonomy convenience methods ---

  it("writeTaxonomy and readTaxonomy round-trip", () => {
    const taxonomy: AnalyticsTaxonomy = {
      platform: "amplitude",
      project_id: "proj-123",
      extracted_at: "2026-03-06T00:00:00Z",
      events: [
        {
          name: "signup_completed",
          description: "User completed signup",
          properties: [
            { name: "method", type: "string", description: "Signup method", required: true },
          ],
          category: "onboarding",
          tags: ["core"],
          volume_last_30d: 5000,
        },
      ],
      metadata: { loader_version: "1.0.0", event_count: 1 },
    };

    pd.writeTaxonomy("my-product", taxonomy);
    const result = pd.readTaxonomy("my-product");
    expect(result).toEqual(taxonomy);
  });

  it("readTaxonomy returns null when file does not exist", () => {
    expect(pd.readTaxonomy("nonexistent-product")).toBeNull();
  });

  it("writeTaxonomy stores at taxonomy/events.json path", () => {
    const taxonomy: AnalyticsTaxonomy = {
      platform: "posthog",
      project_id: "proj-456",
      extracted_at: "2026-03-06T00:00:00Z",
      events: [],
    };

    pd.writeTaxonomy("test-slug", taxonomy);

    // Verify it's at the expected artifact path
    const viaReadJson = pd.readJson("test-slug", "taxonomy/events.json");
    expect(viaReadJson).toEqual(taxonomy);
  });
});
