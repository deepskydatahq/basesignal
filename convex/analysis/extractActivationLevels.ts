// Types for multi-level activation extraction (M002-E003-S001)

export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}

// Page types relevant for activation extraction
const ACTIVATION_PAGE_TYPES = [
  "onboarding",
  "help",
  "customers",
  "features",
  "homepage",
];

// Priority order: lower index = higher priority
const PRIORITY_ORDER: Record<string, number> = {
  onboarding: 0,
  help: 1,
  customers: 2,
  features: 3,
  homepage: 4,
};

/**
 * Filter crawled pages to those relevant for activation level extraction.
 * Returns pages of activation-relevant types, sorted by priority.
 */
export function filterActivationPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  const relevant = pages.filter((p) => ACTIVATION_PAGE_TYPES.includes(p.pageType));

  relevant.sort(
    (a, b) => (PRIORITY_ORDER[a.pageType] ?? 5) - (PRIORITY_ORDER[b.pageType] ?? 5)
  );

  return relevant;
}

// Maximum characters of page content to send to Claude
const MAX_CONTENT_PER_PAGE = 15_000;
const MAX_TOTAL_CONTENT = 40_000;

/**
 * Truncate content to a maximum character length, preserving whole lines.
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build the context string from filtered activation pages for the LLM prompt.
 * Each page is formatted with its URL, type, and truncated content.
 */
export function buildActivationPageContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}
