import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isPathAllowed, type RobotsTxtRules } from "./robots";

describe("parseRobotsTxt", () => {
  it("parses User-Agent: * section with Disallow paths", () => {
    const robotsTxt = `
User-Agent: *
Disallow: /admin
Disallow: /private
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "AnyBot");
    expect(rules.disallowed).toEqual(["/admin", "/private"]);
    expect(rules.allowed).toEqual([]);
  });

  it("parses specific user agent section", () => {
    const robotsTxt = `
User-Agent: BasesignalBot
Disallow: /secret

User-Agent: *
Disallow: /admin
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "BasesignalBot");
    expect(rules.disallowed).toEqual(["/secret"]);
  });

  it("prefers specific agent over * wildcard", () => {
    const robotsTxt = `
User-Agent: *
Disallow: /everything

User-Agent: BasesignalBot
Disallow: /just-this
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "BasesignalBot");
    expect(rules.disallowed).toEqual(["/just-this"]);
  });

  it("falls back to * when specific agent not found", () => {
    const robotsTxt = `
User-Agent: *
Disallow: /fallback

User-Agent: Googlebot
Disallow: /google-only
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "BasesignalBot");
    expect(rules.disallowed).toEqual(["/fallback"]);
  });

  it("returns empty rules when robots.txt is empty", () => {
    const rules = parseRobotsTxt("", "BasesignalBot");
    expect(rules.disallowed).toEqual([]);
    expect(rules.allowed).toEqual([]);
  });

  it("returns empty rules when robots.txt has no matching sections", () => {
    const robotsTxt = `
User-Agent: Googlebot
Disallow: /google-only
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "BasesignalBot");
    expect(rules.disallowed).toEqual([]);
    expect(rules.allowed).toEqual([]);
  });

  it("handles multiple user-agent lines in one section", () => {
    const robotsTxt = `
User-Agent: BotA
User-Agent: BotB
Disallow: /shared-rule
    `.trim();

    const rulesA = parseRobotsTxt(robotsTxt, "BotA");
    const rulesB = parseRobotsTxt(robotsTxt, "BotB");
    expect(rulesA.disallowed).toEqual(["/shared-rule"]);
    expect(rulesB.disallowed).toEqual(["/shared-rule"]);
  });

  it("handles comments and blank lines correctly", () => {
    const robotsTxt = `
# This is a comment
User-Agent: *
# Another comment
Disallow: /admin
Disallow: /private
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "AnyBot");
    expect(rules.disallowed).toEqual(["/admin", "/private"]);
  });

  it("case-insensitive user-agent matching", () => {
    const robotsTxt = `
User-Agent: BASESIGNALBOT
Disallow: /blocked
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "BasesignalBot");
    expect(rules.disallowed).toEqual(["/blocked"]);
  });

  it("parses Allow directives", () => {
    const robotsTxt = `
User-Agent: *
Disallow: /api
Allow: /api/public
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "AnyBot");
    expect(rules.disallowed).toEqual(["/api"]);
    expect(rules.allowed).toEqual(["/api/public"]);
  });

  it("blank line resets agent group so subsequent rules apply to new group", () => {
    const robotsTxt = [
      "User-Agent: BotA",
      "Disallow: /a-only",
      "",
      "User-Agent: BotB",
      "Disallow: /b-only",
    ].join("\n");

    const rulesA = parseRobotsTxt(robotsTxt, "BotA");
    const rulesB = parseRobotsTxt(robotsTxt, "BotB");
    expect(rulesA.disallowed).toEqual(["/a-only"]);
    expect(rulesB.disallowed).toEqual(["/b-only"]);
  });

  it("ignores Disallow with empty value", () => {
    const robotsTxt = `
User-Agent: *
Disallow:
Disallow: /real-block
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "AnyBot");
    expect(rules.disallowed).toEqual(["/real-block"]);
  });

  it("ignores lines without a colon", () => {
    const robotsTxt = `
User-Agent: *
This line has no colon
Disallow: /blocked
    `.trim();

    const rules = parseRobotsTxt(robotsTxt, "AnyBot");
    expect(rules.disallowed).toEqual(["/blocked"]);
  });
});

describe("isPathAllowed", () => {
  it("returns true when no rules exist", () => {
    const rules: RobotsTxtRules = { disallowed: [], allowed: [] };
    expect(isPathAllowed("/anything", rules)).toBe(true);
  });

  it("returns false when path matches a Disallow prefix", () => {
    const rules: RobotsTxtRules = { disallowed: ["/admin"], allowed: [] };
    expect(isPathAllowed("/admin/dashboard", rules)).toBe(false);
  });

  it("returns true when path does not match any Disallow prefix", () => {
    const rules: RobotsTxtRules = { disallowed: ["/admin"], allowed: [] };
    expect(isPathAllowed("/public/page", rules)).toBe(true);
  });

  it("Allow overrides Disallow at same specificity", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/api"],
      allowed: ["/api"],
    };
    expect(isPathAllowed("/api/endpoint", rules)).toBe(true);
  });

  it("longer prefix match wins (Allow overrides Disallow for more specific path)", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/api"],
      allowed: ["/api/public"],
    };
    expect(isPathAllowed("/api/public/docs", rules)).toBe(true);
    expect(isPathAllowed("/api/private/data", rules)).toBe(false);
  });

  it("exact path match works", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/secret"],
      allowed: [],
    };
    expect(isPathAllowed("/secret", rules)).toBe(false);
  });

  it("Disallow with longer prefix overrides Allow with shorter prefix", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/api/private"],
      allowed: ["/api"],
    };
    expect(isPathAllowed("/api/private/data", rules)).toBe(false);
    expect(isPathAllowed("/api/other", rules)).toBe(true);
  });

  it("root path Disallow blocks everything", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/"],
      allowed: [],
    };
    expect(isPathAllowed("/anything", rules)).toBe(false);
    expect(isPathAllowed("/", rules)).toBe(false);
  });

  it("root Allow with specific Disallow", () => {
    const rules: RobotsTxtRules = {
      disallowed: ["/"],
      allowed: ["/public"],
    };
    expect(isPathAllowed("/public/page", rules)).toBe(true);
    expect(isPathAllowed("/private/page", rules)).toBe(false);
  });
});
