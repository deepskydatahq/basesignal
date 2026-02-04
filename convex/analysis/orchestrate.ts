import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import type { Doc } from "../_generated/dataModel";

type CrawledPage = Doc<"crawledPages">;

/**
 * Build a structured context string from crawled pages for Claude prompts.
 */
export function buildPageContext(pages: CrawledPage[]): string {
  if (pages.length === 0) return "No crawled pages available.";

  return pages
    .map(
      (p) =>
        `--- PAGE: ${p.url} ---\nType: ${p.pageType}\nTitle: ${p.title ?? "Untitled"}\n\n${p.content}`
    )
    .join("\n\n");
}

/**
 * Call Claude to extract a specific section from crawled page content.
 * Returns parsed JSON or null on failure.
 */
async function callExtractor(
  client: Anthropic,
  sectionName: string,
  systemPrompt: string,
  pageContext: string,
  dependencyContext?: string
): Promise<Record<string, unknown> | null> {
  const userContent = dependencyContext
    ? `Here is the crawled website content:\n\n${pageContext}\n\nPreviously extracted context:\n${dependencyContext}`
    : `Here is the crawled website content:\n\n${pageContext}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Extract JSON from response (may be wrapped in code fences)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = (jsonMatch[1] ?? text).trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`Extractor ${sectionName} failed:`, error);
    return null;
  }
}

// Extraction prompts for each section
const EXTRACTOR_PROMPTS: Record<string, string> = {
  identity: `You are analyzing a product's website to extract its core identity.
Extract the following as JSON:
{
  "productName": "string - the product name",
  "description": "string - one-sentence description",
  "targetCustomer": "string - who this product is for",
  "businessModel": "string - e.g. B2B SaaS, marketplace, etc.",
  "industry": "string or null - industry vertical",
  "companyStage": "string or null - startup, growth, enterprise",
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,

  revenue: `You are analyzing a product's website to extract its revenue architecture.
Extract the following as JSON:
{
  "model": "string - e.g. subscription, usage-based, freemium",
  "billingUnit": "string or null - per seat, per project, etc.",
  "hasFreeTier": boolean,
  "tiers": [{"name": "string", "price": "string", "features": ["string"]}],
  "expansionPaths": ["string - ways revenue grows"],
  "contractionRisks": ["string - ways revenue shrinks"],
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,

  entities: `You are analyzing a product's website to extract its entity model.
Extract the following as JSON:
{
  "items": [{"name": "string", "type": "string - primary/secondary/derived", "properties": ["string"]}],
  "relationships": [{"from": "string", "to": "string", "type": "string - has_many/belongs_to/etc."}],
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,

  outcomes: `You are analyzing a product's website to extract desired user outcomes.
Extract the following as JSON:
{
  "items": [{"description": "string", "type": "string - business/user/technical", "linkedFeatures": ["string"]}],
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,

  journey: `You are analyzing a product's website to extract user journey stages.
You have the product's identity context to help inform the journey.
Extract the following as JSON:
{
  "stages": [{"name": "string", "description": "string", "order": number}],
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Stages should follow the typical user lifecycle: awareness, signup, activation, engagement, conversion, retention.
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,

  metrics: `You are analyzing a product's website to suggest key metrics.
You have the product's identity and revenue context to help inform metrics.
Extract the following as JSON:
{
  "items": [{"name": "string", "category": "string - reach/engagement/value_delivery/value_capture", "formula": "string or null", "linkedTo": ["string - section names this metric relates to"]}],
  "confidence": number between 0 and 1,
  "evidence": [{"url": "string", "excerpt": "string"}]
}
Return ONLY valid JSON wrapped in \`\`\`json code fences.`,
};

/**
 * Main orchestration action: triggered after scan completes.
 *
 * 1. Creates profile if needed
 * 2. Fetches crawled pages
 * 3. Runs independent extractors in parallel (identity, revenue, entities, outcomes)
 * 4. Runs dependent extractors sequentially (journey needs identity, metrics needs identity+revenue)
 * 5. Stores all results
 * 6. Updates scan job status
 */
export const runAnalysisPipeline = internalAction({
  args: {
    productId: v.id("products"),
    scanJobId: v.id("scanJobs"),
  },
  handler: async (ctx, args) => {
    // Mark scan as analyzing
    await ctx.runMutation(internal.scanJobs.updateStatus, {
      jobId: args.scanJobId,
      status: "analyzing",
      currentPhase: "Running analysis extractors",
    });

    // Create profile if it doesn't exist
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      await ctx.runMutation(internal.scanJobs.updateStatus, {
        jobId: args.scanJobId,
        status: "analyzed",
        currentPhase: "No pages to analyze",
      });
      return { sectionsCompleted: 0, sectionsFailed: 0 };
    }

    const pageContext = buildPageContext(pages);

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    let sectionsCompleted = 0;
    let sectionsFailed = 0;

    // Helper to extract and store a section
    async function extractAndStore(
      sectionName: string,
      dependencyContext?: string
    ): Promise<Record<string, unknown> | null> {
      const prompt = EXTRACTOR_PROMPTS[sectionName];
      if (!prompt) return null;

      const result = await callExtractor(
        client,
        sectionName,
        prompt,
        pageContext,
        dependencyContext
      );

      if (result) {
        try {
          await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
            productId: args.productId,
            section: sectionName,
            data: result,
          });
          sectionsCompleted++;
          return result;
        } catch (error) {
          console.error(`Failed to store ${sectionName}:`, error);
          sectionsFailed++;
          return null;
        }
      } else {
        sectionsFailed++;
        return null;
      }
    }

    // Phase 1: Independent extractors in parallel
    const [identityResult, revenueResult] = await Promise.allSettled([
      extractAndStore("identity"),
      extractAndStore("revenue"),
      extractAndStore("entities"),
      extractAndStore("outcomes"),
    ]).then((results) => [
      results[0].status === "fulfilled" ? results[0].value : null,
      results[1].status === "fulfilled" ? results[1].value : null,
    ]);

    // Phase 2: Dependent extractors (need identity and/or revenue context)
    const identityContext = identityResult
      ? `Identity: ${JSON.stringify(identityResult)}`
      : undefined;
    const revenueContext = revenueResult
      ? `Revenue: ${JSON.stringify(revenueResult)}`
      : undefined;

    const journeyDeps = identityContext;
    const metricsDeps = [identityContext, revenueContext].filter(Boolean).join("\n");

    await Promise.allSettled([
      extractAndStore("journey", journeyDeps || undefined),
      extractAndStore("metrics", metricsDeps || undefined),
    ]);

    // Mark analysis as complete
    await ctx.runMutation(internal.scanJobs.updateStatus, {
      jobId: args.scanJobId,
      status: "analyzed",
      currentPhase: `Analysis complete (${sectionsCompleted} sections extracted)`,
    });

    return { sectionsCompleted, sectionsFailed };
  },
});
