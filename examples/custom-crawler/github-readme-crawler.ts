/**
 * GitHub README Crawler
 *
 * Fetches a GitHub repository's README and returns it as a CrawledPage.
 * Demonstrates how to implement the Basesignal Crawler interface.
 *
 * Usage:
 *   npx tsx github-readme-crawler.ts facebook/react
 */
import type {
  Crawler,
  CrawlResult,
  CrawlOptions,
  CrawledPage,
} from "@basesignal/crawlers";

/**
 * Parses a GitHub URL into owner/repo.
 * Accepts: https://github.com/owner/repo or owner/repo
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  // Handle full URLs
  const urlMatch = url.match(
    /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  // Handle owner/repo shorthand
  const shortMatch = url.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };

  return null;
}

export const githubReadmeCrawler: Crawler = {
  name: "github-readme",
  sourceType: "docs",

  canCrawl(url: string): boolean {
    return parseGitHubUrl(url) !== null;
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();
    const parsed = parseGitHubUrl(url);

    if (!parsed) {
      return {
        pages: [],
        timing: {
          startedAt,
          completedAt: Date.now(),
          totalMs: Date.now() - startedAt,
        },
        errors: [{ url, error: `Not a valid GitHub URL: ${url}` }],
      };
    }

    const { owner, repo } = parsed;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;

    try {
      const controller = new AbortController();
      if (options?.signal) {
        options.signal.addEventListener("abort", () => controller.abort());
      }
      if (options?.timeout) {
        setTimeout(() => controller.abort(), options.timeout);
      }

      const response = await fetch(rawUrl, { signal: controller.signal });

      if (!response.ok) {
        return {
          pages: [],
          timing: {
            startedAt,
            completedAt: Date.now(),
            totalMs: Date.now() - startedAt,
          },
          errors: [
            {
              url: rawUrl,
              error: `HTTP ${response.status}: ${response.statusText}`,
            },
          ],
        };
      }

      const content = await response.text();
      const completedAt = Date.now();

      const page: CrawledPage = {
        url: `https://github.com/${owner}/${repo}`,
        pageType: "docs",
        title: `${owner}/${repo} README`,
        content,
        metadata: {
          description: `README from GitHub repository ${owner}/${repo}`,
        },
      };

      return {
        pages: [page],
        timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
        errors: [],
      };
    } catch (error) {
      const completedAt = Date.now();
      return {
        pages: [],
        timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
        errors: [
          {
            url: rawUrl,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  },
};

// --- CLI runner (when executed directly) ---
const repo = process.argv[2];
if (repo) {
  console.log(`Crawling GitHub README for ${repo}...`);
  githubReadmeCrawler.crawl(repo).then((result) => {
    if (result.errors.length > 0) {
      console.error("Errors:", result.errors);
      process.exit(1);
    }
    console.log(
      `Fetched ${result.pages.length} page(s) in ${result.timing.totalMs}ms`
    );
    console.log("---");
    console.log(result.pages[0]?.content.slice(0, 500) + "...");
  });
}
