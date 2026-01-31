import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { validateUrl, classifyPageType, filterHighValuePages } from "./lib/urlUtils";

/**
 * Start a scan of a product website.
 *
 * This is a Convex internal action (can make external HTTP calls).
 * Flow: validate URL → create scanJob → Firecrawl map → filter URLs →
 *       Firecrawl batch scrape → poll for results → store pages → complete
 *
 * Called by the MCP server or scheduled from a user-facing mutation.
 */
export const startScan = internalAction({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate URL
    const validation = validateUrl(args.url);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    // Normalize URL
    let normalizedUrl = args.url;
    if (!normalizedUrl.endsWith("/") && !new URL(normalizedUrl).pathname.includes(".")) {
      // Add trailing slash for root domains to normalize
    }

    // Create the scan job
    const jobId = await ctx.runMutation(internal.scanJobs.createInternal, {
      productId: args.productId,
      userId: args.userId,
      url: normalizedUrl,
    });

    try {
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
      if (!firecrawlApiKey) {
        throw new Error("FIRECRAWL_API_KEY environment variable is not set");
      }

      // Step 1: Map the site
      const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!mapResponse.ok) {
        const errorText = await mapResponse.text();
        throw new Error(`Firecrawl map failed (${mapResponse.status}): ${errorText}`);
      }

      const mapResult = await mapResponse.json() as { links?: string[] };
      const discoveredUrls = mapResult.links ?? [];

      // Step 2: Filter to high-value pages
      const { targetUrls, docsUrl } = filterHighValuePages(discoveredUrls, normalizedUrl);

      // If no pages found, at least scrape the root URL
      const urlsToScrape = targetUrls.length > 0 ? targetUrls : [normalizedUrl];

      // Update job: transition to crawling
      await ctx.runMutation(internal.scanJobs.updateProgress, {
        jobId,
        status: "crawling",
        pagesTotal: urlsToScrape.length,
        currentPhase: `Crawling ${urlsToScrape.length} pages`,
        ...(docsUrl ? { discoveredDocs: docsUrl } : {}),
      });

      // Step 3: Batch scrape
      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/batch/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({
          urls: urlsToScrape,
          formats: ["markdown"],
        }),
      });

      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        throw new Error(`Firecrawl batch scrape failed (${scrapeResponse.status}): ${errorText}`);
      }

      const scrapeResult = await scrapeResponse.json() as {
        id?: string;
        success?: boolean;
      };

      if (!scrapeResult.success || !scrapeResult.id) {
        throw new Error("Firecrawl batch scrape did not return a job ID");
      }

      // Step 4: Poll for completion
      const batchId = scrapeResult.id;
      const scrapedPages = await pollBatchScrape(
        batchId,
        firecrawlApiKey,
        async (completed, total) => {
          await ctx.runMutation(internal.scanJobs.updateProgress, {
            jobId,
            pagesCrawled: completed,
            currentPhase: `Crawled ${completed}/${total} pages`,
          });
        }
      );

      // Step 5: Store pages
      let pricingUrl: string | undefined;
      const crawledPageSummaries: Array<{
        url: string;
        pageType: string | undefined;
        title: string | undefined;
      }> = [];

      for (const page of scrapedPages) {
        const pageUrl = page.url ?? page.metadata?.sourceURL ?? "";
        const markdown = page.markdown ?? "";
        if (!pageUrl || !markdown) continue;

        const pageType = classifyPageType(pageUrl);
        const title = page.metadata?.title;

        if (pageType === "pricing") {
          pricingUrl = pageUrl;
        }

        await ctx.runMutation(internal.crawledPages.store, {
          productId: args.productId,
          scanJobId: jobId,
          url: pageUrl,
          pageType,
          title,
          content: markdown,
          metadata: {
            description: page.metadata?.description,
            ogImage: page.metadata?.ogImage,
          },
        });

        crawledPageSummaries.push({ url: pageUrl, pageType, title });
      }

      // Step 6: Complete
      await ctx.runMutation(internal.scanJobs.updateProgress, {
        jobId,
        crawledPages: crawledPageSummaries,
        ...(pricingUrl ? { discoveredPricing: pricingUrl } : {}),
      });
      await ctx.runMutation(internal.scanJobs.complete, { jobId });

      // Persist discovered docs URL on the product
      if (docsUrl) {
        await ctx.runMutation(internal.products.updateDocsUrlInternal, {
          productId: args.productId,
          docsUrl,
        });
      }

      return {
        jobId,
        pagesDiscovered: discoveredUrls.length,
        pagesCrawled: crawledPageSummaries.length,
        docsUrl,
        pricingUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.scanJobs.fail, {
        jobId,
        error: errorMessage,
      });
      throw error;
    }
  },
});

interface ScrapedPage {
  url?: string;
  markdown?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
    sourceURL?: string;
  };
}

/**
 * Poll a Firecrawl batch scrape job until completion.
 * Uses exponential backoff starting at 2s, capping at 15s.
 */
async function pollBatchScrape(
  batchId: string,
  apiKey: string,
  onProgress: (completed: number, total: number) => Promise<void>,
): Promise<ScrapedPage[]> {
  const maxAttempts = 60;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const delay = Math.min(2000 * Math.pow(1.2, attempt), 15000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const response = await fetch(
      `https://api.firecrawl.dev/v1/batch/scrape/${batchId}`,
      {
        headers: { "Authorization": `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      attempt++;
      continue;
    }

    const result = await response.json() as {
      status: string;
      completed?: number;
      total?: number;
      data?: ScrapedPage[];
    };

    if (result.completed !== undefined && result.total !== undefined) {
      await onProgress(result.completed, result.total);
    }

    if (result.status === "completed") {
      return result.data ?? [];
    }

    if (result.status === "failed") {
      throw new Error("Firecrawl batch scrape job failed");
    }

    attempt++;
  }

  throw new Error("Firecrawl batch scrape timed out after polling");
}
