# Contributing to Basesignal

Thanks for your interest in contributing. Basesignal is a context engine for product growth data models — the more crawlers, storage adapters, and integrations exist, the more useful it becomes.

The easiest way to contribute is to **add a new crawler**. If you can write a function that fetches a URL and returns structured data, you can contribute a crawler.

## Development setup

```bash
git clone https://github.com/deepskydatahq/basesignal.git
cd basesignal
npm install
npm test              # run all tests
npm run build         # build all packages
```

The monorepo uses npm workspaces. Each package in `packages/` can be built and tested independently:

```bash
cd packages/core
npm test
npm run build
```

## Adding a crawler

A crawler fetches data from a source and returns structured pages. Every crawler implements the `Crawler` interface from `@basesignal/crawlers`:

```typescript
import type { Crawler, CrawlResult } from "@basesignal/crawlers";

export const g2ReviewsCrawler: Crawler = {
  name: "g2-reviews",
  sourceType: "reviews",

  canCrawl(url: string): boolean {
    return url.includes("g2.com/products/");
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();

    // Fetch and parse the G2 product page
    const response = await fetch(url, {
      signal: options?.signal,
      headers: { "User-Agent": options?.userAgent ?? "Basesignal/1.0" },
    });
    const html = await response.text();

    // Extract review data into CrawledPage format
    const pages = parseG2Reviews(html, url);

    return {
      pages,
      timing: {
        startedAt,
        completedAt: Date.now(),
        totalMs: Date.now() - startedAt,
      },
      errors: [],
    };
  },
};
```

### Step by step

1. **Create the crawler file** — `packages/crawlers/src/g2/g2-crawler.ts`

2. **Implement the `Crawler` interface** — four members:
   - `name`: unique identifier (e.g., `"g2-reviews"`)
   - `sourceType`: what kind of data this produces (`"reviews"`, `"social"`, `"video"`, etc.)
   - `canCrawl(url)`: return `true` if this crawler handles the given URL
   - `crawl(url, options)`: fetch the data, return `CrawlResult`

3. **Add tests with fixtures** — save example HTML/JSON responses as test fixtures in `packages/crawlers/src/g2/__fixtures__/`. Test against fixtures, not live URLs:

   ```typescript
   import { readFileSync } from "fs";
   import { g2ReviewsCrawler } from "./g2-crawler";

   test("parses G2 product reviews", async () => {
     // Use a fixture instead of hitting the live site
     const fixture = readFileSync("src/g2/__fixtures__/linear-reviews.html", "utf-8");
     // ... test against fixture
   });
   ```

4. **Register the crawler** — add it to the default registry in `packages/crawlers/src/index.ts`:

   ```typescript
   export { g2ReviewsCrawler } from "./g2/g2-crawler";
   ```

5. **Submit a PR** — see [PR process](#pr-process) below.

### Crawler contribution ideas

These are sources the community can add crawlers for:

- **G2 / Capterra** — extract product reviews and sentiment
- **YouTube** — parse product demo videos and tutorials
- **LinkedIn** — company pages and job postings
- **App Store / Play Store** — app descriptions and reviews
- **Crunchbase** — funding, team size, and company data
- **Product Hunt** — launch information and community feedback

## Adding a storage adapter

Storage adapters implement the `StorageAdapter` interface from `@basesignal/storage`:

```typescript
import type { StorageAdapter, ProfileSummary } from "@basesignal/storage";
import type { ProductProfile } from "@basesignal/core";

export class PostgresStorage implements StorageAdapter {
  async save(profile: ProductProfile): Promise<string> { /* ... */ }
  async load(id: string): Promise<ProductProfile | null> { /* ... */ }
  async list(): Promise<ProfileSummary[]> { /* ... */ }
  async delete(id: string): Promise<boolean> { /* ... */ }
  async search(query: string): Promise<ProfileSummary[]> { /* ... */ }
  close(): void { /* ... */ }
}
```

Six methods: `save`, `load`, `list`, `delete`, `search`, `close`. See the [SQLite adapter](./packages/storage/src/sqlite.ts) as a reference implementation.

## Other contributions

- **Bug fixes** — open an issue first to discuss, then submit a PR with a test that reproduces the bug
- **Features** — open an issue to discuss the design before writing code
- **Documentation** — improvements to docs/ or package READMEs are always welcome
- **Tests** — more test coverage is always valuable

## PR process

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Add a changeset describing the change: `npx changeset`
4. Ensure all tests pass: `npm test`
5. Ensure the build succeeds: `npm run build`
6. Submit a pull request with a clear description of what you changed and why

PRs are reviewed within a few days. Small, focused PRs are easier to review and merge.

## Code style

- TypeScript strict mode
- No `any` types — use `unknown` and narrow
- Tests for all new functionality
- Descriptive variable names over comments
- Keep functions small and focused

## Releases and versioning

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and npm publishing. When you submit a PR that changes package behavior, add a changeset:

```bash
npx changeset
```

Follow the prompts to select the affected packages and describe the change. The changeset file will be committed with your PR. When the PR merges, a GitHub Action will either open a "Version Packages" PR or publish directly to npm.

**For maintainers:** The release workflow requires an `NPM_TOKEN` repository secret to publish packages to npm. Add this secret in the repository settings under Settings > Secrets and variables > Actions.

## Getting help

- **GitHub Issues** — for bugs and feature requests
- **GitHub Discussions** — for questions, ideas, and general conversation
