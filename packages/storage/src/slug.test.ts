import { describe, it, expect } from "vitest";
import { urlToSlug } from "./slug";

describe("urlToSlug", () => {
  it("converts simple domain to slug", () => {
    expect(urlToSlug("https://linear.app")).toBe("linear-app");
  });

  it("strips www prefix", () => {
    expect(urlToSlug("https://www.notion.so")).toBe("notion-so");
  });

  it("ignores path — slug is hostname only", () => {
    expect(urlToSlug("https://linear.app/features/roadmap")).toBe("linear-app");
  });

  it("handles subdomains", () => {
    expect(urlToSlug("https://app.example.com")).toBe("app-example-com");
  });

  it("handles http URLs", () => {
    expect(urlToSlug("http://example.com")).toBe("example-com");
  });

  it("handles bare domain (auto-prepends https)", () => {
    expect(urlToSlug("linear.app")).toBe("linear-app");
  });

  it("lowercases the hostname", () => {
    expect(urlToSlug("https://Linear.App")).toBe("linear-app");
  });

  it("handles multi-part TLD", () => {
    expect(urlToSlug("https://example.co.uk")).toBe("example-co-uk");
  });

  it("strips www even with subdomains after it", () => {
    expect(urlToSlug("https://www.app.example.com")).toBe("app-example-com");
  });

  it("handles URLs with port", () => {
    expect(urlToSlug("https://localhost:3000")).toBe("localhost");
  });
});
