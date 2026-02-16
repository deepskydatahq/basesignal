import * as cheerio from "cheerio";

/**
 * Extract clean text content from HTML.
 *
 * Strategy:
 * 1. Remove noise elements (nav, footer, script, style, header, aside)
 * 2. Prefer <main> or <article> if present
 * 3. Fall back to <body>
 * 4. Extract text preserving heading hierarchy and paragraph structure
 */
export function extractContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, noscript, iframe, svg").remove();
  $("nav, footer, header").remove();
  $("[role='navigation'], [role='banner'], [role='contentinfo']").remove();
  $("[aria-hidden='true']").remove();

  // Find the main content container
  let $content = $("main, [role='main']");
  if ($content.length === 0) $content = $("article");
  if ($content.length === 0) $content = $("body");

  // Extract structured text
  const blocks: string[] = [];

  $content
    .find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption")
    .each((_, el) => {
      const $el = $(el);
      const tag = el.type === "tag" ? el.tagName.toLowerCase() : "";
      const text = $el.text().trim();

      if (!text) return;

      // Format headings with markdown-style markers for LLM readability
      if (tag.startsWith("h")) {
        const level = parseInt(tag[1], 10);
        const prefix = "#".repeat(level);
        blocks.push(`\n${prefix} ${text}\n`);
      } else if (tag === "li") {
        blocks.push(`- ${text}`);
      } else {
        blocks.push(text);
      }
    });

  return blocks
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
    .trim();
}

/**
 * Extract metadata from HTML head.
 */
export function extractMetadata(html: string): {
  title?: string;
  description?: string;
  ogImage?: string;
} {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    undefined;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  const ogImage =
    $('meta[property="og:image"]').attr("content") || undefined;

  return { title, description, ogImage };
}
