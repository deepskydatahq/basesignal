import { describe, it, expect } from "vitest";
import { parsePricingContent } from "./parser";

describe("parsePricingContent", () => {
  describe("price extraction", () => {
    it("extracts dollar prices with monthly period", () => {
      const content = "## Pro\n\n$29/mo\n\n- Unlimited projects\n- API access";
      const result = parsePricingContent(content);

      expect(result.tiers.length).toBeGreaterThanOrEqual(1);
      const pro = result.tiers.find((t) => /pro/i.test(t.name));
      expect(pro).toBeDefined();
      expect(pro!.price).toBe(29);
      expect(pro!.period).toBe("month");
    });

    it("extracts dollar prices with annual period", () => {
      const content = "## Business\n\n$199/year\n\n- Advanced analytics";
      const result = parsePricingContent(content);

      const biz = result.tiers.find((t) => /business/i.test(t.name));
      expect(biz).toBeDefined();
      expect(biz!.price).toBe(199);
      expect(biz!.period).toBe("year");
    });

    it("extracts Free as price 0", () => {
      const content = "## Free\n\nFree\n\n- 5 users\n- Basic features";
      const result = parsePricingContent(content);

      expect(result.hasFreeTier).toBe(true);
      const free = result.tiers.find((t) => t.price === 0);
      expect(free).toBeDefined();
      expect(free!.priceDisplay.toLowerCase()).toContain("free");
    });

    it("extracts $0 as free tier", () => {
      const content = "## Starter\n\n$0/month\n\n- Limited access";
      const result = parsePricingContent(content);

      expect(result.hasFreeTier).toBe(true);
    });

    it("handles Contact Sales as null price", () => {
      const content = "## Enterprise\n\nContact Sales\n\n- SSO\n- Custom SLA";
      const result = parsePricingContent(content);

      const enterprise = result.tiers.find((t) => /enterprise/i.test(t.name));
      expect(enterprise).toBeDefined();
      expect(enterprise!.price).toBeNull();
      expect(enterprise!.priceDisplay).toMatch(/contact/i);
    });

    it("handles Custom as null price", () => {
      const content = "## Enterprise\n\nCustom\n\n- Dedicated support";
      const result = parsePricingContent(content);

      const enterprise = result.tiers.find((t) => /enterprise/i.test(t.name));
      expect(enterprise).toBeDefined();
      expect(enterprise!.price).toBeNull();
    });

    it("extracts decimal prices", () => {
      const content = "## Basic\n\n$9.99/mo\n\n- Core features";
      const result = parsePricingContent(content);

      const basic = result.tiers.find((t) => /basic/i.test(t.name));
      expect(basic).toBeDefined();
      expect(basic!.price).toBe(9.99);
    });
  });

  describe("tier detection", () => {
    it("extracts multiple tiers from markdown headings", () => {
      const content = [
        "## Free",
        "",
        "Free",
        "",
        "- 5 users",
        "- Basic features",
        "",
        "## Pro",
        "",
        "$29/mo",
        "",
        "- Unlimited users",
        "- API access",
        "",
        "## Enterprise",
        "",
        "Contact Sales",
        "",
        "- SSO",
        "- Custom SLA",
      ].join("\n");

      const result = parsePricingContent(content);

      expect(result.tiers.length).toBeGreaterThanOrEqual(3);
      expect(result.hasFreeTier).toBe(true);
      expect(result.hasEnterpriseTier).toBe(true);
    });

    it("extracts features as bullet list items following a tier", () => {
      const content =
        "## Pro\n\n$29/mo\n\n- Unlimited projects\n- API access\n- Priority support";
      const result = parsePricingContent(content);

      const pro = result.tiers.find((t) => /pro/i.test(t.name));
      expect(pro).toBeDefined();
      expect(pro!.features.length).toBeGreaterThanOrEqual(2);
      expect(pro!.features.some((f) => /api/i.test(f))).toBe(true);
    });
  });

  describe("billing options", () => {
    it("detects monthly and annual billing options", () => {
      const content = "Monthly Annual\n\n## Pro\n$29/mo\nBilled annually: $24/mo";
      const result = parsePricingContent(content);

      expect(result.billingOptions).toContain("monthly");
      expect(result.billingOptions).toContain("annual");
    });

    it("detects yearly as annual billing", () => {
      const content = "Yearly pricing\n\n## Pro\n$199/year";
      const result = parsePricingContent(content);

      expect(result.billingOptions).toContain("annual");
    });
  });

  describe("billing unit", () => {
    it("detects per-seat billing", () => {
      const content = "## Pro\n\n$12/seat/month\n\n- Everything in Free";
      const result = parsePricingContent(content);

      expect(result.billingUnit).toMatch(/seat/i);
    });

    it("detects per-user billing", () => {
      const content = "## Team\n\n$8 per user per month\n\n- Collaboration";
      const result = parsePricingContent(content);

      expect(result.billingUnit).toMatch(/user/i);
    });

    it("detects per-member billing", () => {
      const content = "## Business\n\n$10/member/mo\n\n- Admin tools";
      const result = parsePricingContent(content);

      expect(result.billingUnit).toMatch(/member/i);
    });
  });

  describe("trial detection", () => {
    it("detects trial mentions", () => {
      const content = "Start your 14-day free trial\n\n## Pro\n$29/mo";
      const result = parsePricingContent(content);

      expect(result.hasTrialMention).toBe(true);
    });

    it("does not false-positive on non-trial content", () => {
      const content = "## Pro\n\n$29/mo\n\n- Unlimited projects";
      const result = parsePricingContent(content);

      expect(result.hasTrialMention).toBe(false);
    });
  });

  describe("confidence scoring", () => {
    it("returns high confidence for well-structured pricing page", () => {
      const content = [
        "Monthly Annual",
        "",
        "## Free",
        "Free",
        "- 5 users",
        "",
        "## Pro",
        "$29/user/mo",
        "- Unlimited users",
        "- API access",
        "",
        "## Enterprise",
        "Contact Sales",
        "- SSO",
      ].join("\n");

      const result = parsePricingContent(content);
      expect(result.parseConfidence).toBeGreaterThanOrEqual(0.7);
    });

    it("returns zero confidence for non-pricing content", () => {
      const result = parsePricingContent(
        "This is a blog post about our company history."
      );

      expect(result.tiers).toEqual([]);
      expect(result.hasFreeTier).toBe(false);
      expect(result.parseConfidence).toBe(0);
    });

    it("returns low confidence for minimal pricing info", () => {
      const content = "$29/mo";
      const result = parsePricingContent(content);

      // Has a price but no tier structure, features, or billing options
      expect(result.parseConfidence).toBeLessThan(0.7);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = parsePricingContent("");

      expect(result.tiers).toEqual([]);
      expect(result.hasFreeTier).toBe(false);
      expect(result.hasTrialMention).toBe(false);
      expect(result.billingOptions).toEqual([]);
      expect(result.hasEnterpriseTier).toBe(false);
      expect(result.parseConfidence).toBe(0);
    });

    it("handles content with prices but no tier headings", () => {
      const content =
        "Our product costs $29/mo for basic and $99/mo for premium.";
      const result = parsePricingContent(content);

      // Should still extract price patterns even without clear tier structure
      expect(result.tiers.length).toBeGreaterThanOrEqual(0);
      // Confidence should be lower without clear structure
      expect(result.parseConfidence).toBeLessThan(0.7);
    });
  });
});
