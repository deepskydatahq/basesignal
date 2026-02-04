import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildOutcomesPrompt,
  parseOutcomesResponse,
  getSystemPrompt,
  type CrawledPageInput,
} from "./lib/extractOutcomesHelpers";

/**
 * Extract product outcomes/jobs-to-be-done from crawled marketing pages.
 *
 * Flow: fetch crawled pages → build prompt → Haiku call → parse → store via updateSectionInternal
 *
 * Called by the scan pipeline after crawling completes, or manually via scheduler.
 */
export const extractOutcomes = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // Step 1: Ensure profile exists
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // Step 2: Get crawled pages
    const pages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId },
    );

    if (pages.length === 0) {
      throw new Error("No crawled pages found for this product");
    }

    // Step 3: Filter to relevant page types and build prompt
    const relevantTypes = new Set([
      "homepage",
      "features",
      "customers",
      "about",
      "solutions",
      "use-cases",
    ]);
    const relevantPages: CrawledPageInput[] = pages
      .filter((p) => relevantTypes.has(p.pageType))
      .map((p) => ({
        url: p.url,
        pageType: p.pageType,
        content: p.content,
      }));

    // Fall back to all pages if no relevant types found
    const pagesToAnalyze =
      relevantPages.length > 0
        ? relevantPages
        : pages.map((p) => ({
            url: p.url,
            pageType: p.pageType,
            content: p.content,
          }));

    const userPrompt = buildOutcomesPrompt(pagesToAnalyze);

    // Step 4: Call Claude Haiku
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: getSystemPrompt(),
      messages: [{ role: "user", content: userPrompt }],
    });

    // Step 5: Parse response
    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const outcomesData = parseOutcomesResponse(responseText);

    // Step 6: Store via updateSectionInternal
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "outcomes",
      data: outcomesData,
    });

    return {
      status: "success",
      outcomesCount: outcomesData.items.length,
      confidence: outcomesData.confidence,
    };
  },
});
