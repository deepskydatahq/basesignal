/**
 * Lightweight HTML-to-text converter using regex.
 * No dependencies (no cheerio). Handles common patterns.
 *
 * Converts:
 *   <h1-h4> -> markdown headings (# - ####)
 *   <li> -> markdown bullets (- )
 *   <p>, <br>, <div> -> newlines
 *   Everything else -> stripped tags, preserved text
 *
 * Removes:
 *   <script>, <style>, <nav>, <footer>, <header>, <noscript>, <iframe>
 */
export function htmlToText(html: string): string {
  if (!html) return "";

  let text = html;

  // 1. Remove non-content elements (including their content)
  text = text.replace(
    /<(script|style|nav|footer|header|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );

  // 2. Convert headings to markdown
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");

  // 3. Convert list items to markdown bullets
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

  // 4. Convert block elements to newlines
  text = text.replace(
    /<\/?(p|div|br|tr|section|article|main)[^>]*\/?>/gi,
    "\n"
  );

  // 5. Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // 6. Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

  // 7. Clean up whitespace
  // Collapse multiple spaces on the same line
  text = text.replace(/[ \t]+/g, " ");
  // Collapse multiple newlines (max 2)
  text = text.replace(/\n{3,}/g, "\n\n");
  // Trim each line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  // Trim the whole thing
  text = text.trim();

  return text;
}

/**
 * Extract meta description from HTML.
 */
export function extractMetaDescription(html: string): string | undefined {
  const match =
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i
    );
  return match ? match[1].trim() : undefined;
}

/**
 * Extract page title from HTML.
 */
export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : undefined;
}
