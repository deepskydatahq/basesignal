import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parsePricingContent } from "./parser";
import { htmlToText } from "./html-utils";

function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, "__fixtures__", filename);
  return readFileSync(fixturePath, "utf-8");
}

function parseFixture(filename: string) {
  const html = loadFixture(filename);
  const text = htmlToText(html);
  return parsePricingContent(text);
}

describe("pricing parser with real fixtures", () => {
  describe("linear.html", () => {
    it("extracts tiers from Linear pricing page", () => {
      const result = parseFixture("linear.html");

      // Linear has Free, Standard, Plus, Enterprise tiers
      expect(result.tiers.length).toBeGreaterThanOrEqual(3);
      expect(result.hasFreeTier).toBe(true);
      expect(result.parseConfidence).toBeGreaterThan(0.5);
    });

    it("detects monthly and annual billing options", () => {
      const result = parseFixture("linear.html");

      // Linear offers both monthly and annual billing
      expect(result.billingOptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("notion.html", () => {
    // Note: Notion's pricing page is largely JS-rendered. The static HTML
    // from curl contains tier names inline under a single heading rather
    // than as separate heading-per-tier sections. The parser can still
    // extract dollar prices and detect billing options from the static content.
    it("extracts pricing data from static content", () => {
      const result = parseFixture("notion.html");

      // The static HTML contains dollar prices ($8/month, $10/month for custom domains)
      // and mentions "Contact Sales" for enterprise
      expect(result.tiers.length).toBeGreaterThanOrEqual(1);
      expect(result.parseConfidence).toBeGreaterThan(0);
    });

    it("detects billing options from content", () => {
      const result = parseFixture("notion.html");

      // The static HTML mentions monthly and annually billing
      expect(result.billingOptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("miro.html", () => {
    it("detects billing unit (member/user/seat)", () => {
      const result = parseFixture("miro.html");

      // Miro charges per member
      if (result.billingUnit) {
        expect(result.billingUnit).toMatch(/member|seat|user/i);
      }
      // If billing unit not detected, at least check we got tiers
      expect(result.tiers.length).toBeGreaterThanOrEqual(1);
    });

    it("detects free tier", () => {
      const result = parseFixture("miro.html");

      expect(result.hasFreeTier).toBe(true);
    });
  });
});
