# Custom Crawler Example: GitHub README

This example implements a custom Basesignal crawler that extracts product
information from GitHub repository READMEs.

## What You Will Build

A crawler that:

- Detects GitHub repository URLs (and `owner/repo` shorthand)
- Fetches the README.md via GitHub's raw content URL
- Extracts the content as markdown
- Returns it as a `CrawledPage` for the Basesignal analysis pipeline

## Prerequisites

- Node.js 18+
- Familiarity with TypeScript

## The Crawler Interface

Every Basesignal crawler implements four members:

```typescript
interface Crawler {
  name: string;                  // Unique identifier (e.g., "github-readme")
  sourceType: SourceType;        // What kind of data ("website", "docs", etc.)
  canCrawl(url: string): boolean;                      // "Can you handle this URL?"
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;  // Do the work
}
```

- **`name`** -- A unique string identifying this crawler.
- **`sourceType`** -- The category of data this crawler produces (`"website"`, `"docs"`, `"reviews"`, `"social"`, `"video"`, `"pricing"`).
- **`canCrawl(url)`** -- Returns `true` if this crawler knows how to handle the given URL.
- **`crawl(url, options?)`** -- Fetches the URL, extracts content, and returns a `CrawlResult` with pages, timing, and any errors.

## Step-by-Step

### 1. Set up the project

```bash
npm install
npm run typecheck
```

This installs `@basesignal/crawlers` (which provides the type definitions) and verifies the code compiles.

### 2. Read the implementation

Open [`github-readme-crawler.ts`](./github-readme-crawler.ts) and read through it. Key points:

- **`parseGitHubUrl(url)`** -- A helper that accepts both `https://github.com/owner/repo` and `owner/repo` shorthand, returning `{ owner, repo }` or `null`.
- **`canCrawl(url)`** -- Delegates to `parseGitHubUrl`. If parsing succeeds, this crawler can handle the URL.
- **`crawl(url, options?)`** -- Fetches the README from `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`, handles `AbortSignal` and timeout from options, and wraps the result in a `CrawlResult`.
- **CLI runner** -- When executed directly with a `process.argv[2]` argument, calls `crawl()` and prints a snippet of the content.

### 3. Run the tests

```bash
npm test
```

The tests mock `globalThis.fetch` for deterministic results. No network access needed. The test file covers:

- `canCrawl` -- accepts GitHub URLs and shorthand, rejects non-GitHub URLs and empty strings
- `crawl` -- verifies timing properties, error handling for invalid URLs, page metadata from mocked responses, HTTP error handling, and network error handling
- Interface compliance -- verifies `name`, `sourceType`, `canCrawl`, and `crawl` exist with correct types

### 4. Try it live (optional)

```bash
npx tsx github-readme-crawler.ts facebook/react
```

This fetches the real README from GitHub and prints the first 500 characters. No API key needed for public repositories.

## How to Contribute a Crawler

1. **Fork** the [Basesignal repository](https://github.com/deepskydatahq/basesignal)
2. **Create** `packages/crawlers/src/your-crawler.ts`
3. **Implement** the `Crawler` interface (use this example as a template)
4. **Add fixture-based tests** in `packages/crawlers/src/your-crawler.test.ts`
5. **Register** your crawler in `packages/crawlers/src/index.ts`
6. **Submit a PR** with a description of what URLs your crawler handles and what data it extracts

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full contribution guide.
