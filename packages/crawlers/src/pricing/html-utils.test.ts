import { describe, it, expect } from "vitest";
import { htmlToText, extractMetaDescription, extractTitle } from "./html-utils";

describe("htmlToText", () => {
  it("strips HTML tags and preserves text", () => {
    const html = "<div><h2>Pro Plan</h2><p>$29/mo</p></div>";
    const text = htmlToText(html);

    expect(text).toContain("Pro Plan");
    expect(text).toContain("$29/mo");
    expect(text).not.toContain("<div>");
    expect(text).not.toContain("<h2>");
  });

  it("converts headings to markdown-style headings", () => {
    const html = "<h2>Enterprise</h2><p>Contact Sales</p>";
    const text = htmlToText(html);

    expect(text).toContain("## Enterprise");
  });

  it("converts list items to markdown bullets", () => {
    const html = "<ul><li>Feature A</li><li>Feature B</li></ul>";
    const text = htmlToText(html);

    expect(text).toContain("- Feature A");
    expect(text).toContain("- Feature B");
  });

  it("removes script and style elements", () => {
    const html =
      '<p>Content</p><script>alert("x")</script><style>.x{color:red}</style>';
    const text = htmlToText(html);

    expect(text).toContain("Content");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  it("removes nav, footer, and header elements", () => {
    const html =
      "<nav>Nav</nav><main><p>Main content</p></main><footer>Footer</footer>";
    const text = htmlToText(html);

    expect(text).toContain("Main content");
    expect(text).not.toContain("Nav");
    expect(text).not.toContain("Footer");
  });

  it("handles empty input", () => {
    expect(htmlToText("")).toBe("");
  });

  it("collapses excessive whitespace", () => {
    const html = "<p>Hello</p>\n\n\n\n\n\n<p>World</p>";
    const text = htmlToText(html);

    // Should not have more than 2 consecutive newlines
    expect(text).not.toMatch(/\n{4,}/);
  });
});

describe("extractMetaDescription", () => {
  it("extracts meta description", () => {
    const html =
      '<html><head><meta name="description" content="Product pricing plans"></head></html>';
    expect(extractMetaDescription(html)).toBe("Product pricing plans");
  });

  it("returns undefined when no meta description exists", () => {
    const html = "<html><head><title>Page</title></head></html>";
    expect(extractMetaDescription(html)).toBeUndefined();
  });
});

describe("extractTitle", () => {
  it("extracts title from title tag", () => {
    const html = "<html><head><title>Pricing - Acme</title></head></html>";
    expect(extractTitle(html)).toBe("Pricing - Acme");
  });

  it("returns undefined when no title exists", () => {
    expect(extractTitle("<html><body>No title</body></html>")).toBeUndefined();
  });
});
