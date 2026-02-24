import type { Command } from "commander";
import { computeCompleteness } from "@basesignal/core";
import type { ProductProfile } from "@basesignal/storage";
import { ScanError, handleScanError } from "../errors.js";
import { loadConfig, requireApiKey } from "../config.js";
import { createProgress } from "../progress.js";
import { formatOutput, writeOutputFile } from "../formatters.js";
import type { OutputFormat } from "../formatters.js";

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

export function validateUrl(input: string): URL {
  // Reject inputs that look like non-HTTP protocols before prepending https://
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new ScanError(
      "invalid-url",
      `"${input}" is not a valid URL`,
      "Example: basesignal scan https://linear.app",
    );
  }

  const normalized = input.match(/^https?:\/\//i) ? input : `https://${input}`;
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("bad protocol");
    }
    return parsed;
  } catch {
    throw new ScanError(
      "invalid-url",
      `"${input}" is not a valid URL`,
      "Example: basesignal scan https://linear.app",
    );
  }
}

// ---------------------------------------------------------------------------
// Scan options
// ---------------------------------------------------------------------------

export interface ScanOptions {
  output?: string;
  format: OutputFormat;
  verbose: boolean;
}

// ---------------------------------------------------------------------------
// runScan -- the composition core
// ---------------------------------------------------------------------------

export async function runScan(url: string, options: ScanOptions): Promise<void> {
  // 1. Resolve config
  const config = loadConfig({ verbose: options.verbose });
  requireApiKey(config);

  // 2. Create progress display
  const progress = createProgress(options.verbose);

  // 3. Create storage (in try/finally for cleanup)
  const { FileStorage } = await import("@basesignal/storage");
  const storage = new FileStorage({ dir: config.storagePath });

  try {
    // 4. Validate URL
    const parsedUrl = validateUrl(url);

    // 5. PHASE 1 -- CRAWL
    progress.start("Crawling", parsedUrl.hostname);
    const { WebsiteCrawler } = await import("@basesignal/crawlers");
    const crawler = new WebsiteCrawler();
    const crawlResult = await crawler.crawl(parsedUrl.href);

    if (crawlResult.pages.length === 0) {
      progress.fail("Crawling", "no pages found");
      throw new ScanError(
        "crawl-empty",
        `No pages could be crawled from ${parsedUrl.href}`,
        "Check that the URL is correct and publicly accessible",
      );
    }
    progress.done("Crawling", `${crawlResult.pages.length} pages`);

    // 6. PHASE 2 -- ANALYZE
    progress.start("Analyzing", `${crawlResult.pages.length} pages through analysis pipeline`);
    const { createProvider } = await import("@basesignal/core");
    const provider = createProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });

    const { runAnalysisPipeline } = await import("@basesignal/mcp-server/analysis/pipeline");
    const pipelineResult = await runAnalysisPipeline(
      { pages: crawlResult.pages },
      provider,
      (event) => {
        progress.detail(`${event.phase}: ${event.status}`);
      },
    );
    progress.done("Analyzing", "profile generated");

    // Build a ProductProfile from the pipeline result
    const { completeness } = computeCompleteness({
      identity: pipelineResult.identity,
      activation_levels: pipelineResult.activation_levels,
      icp_profiles: pipelineResult.outputs.icp_profiles,
      activation_map: pipelineResult.outputs.activation_map,
      lifecycle_states: pipelineResult.outputs.lifecycle_states,
      measurement_spec: pipelineResult.outputs.measurement_spec,
    });
    const profile: ProductProfile = {
      identity: pipelineResult.identity ?? undefined,
      metadata: { url: parsedUrl.href, scannedAt: Date.now() },
      completeness,
      overallConfidence: pipelineResult.identity?.confidence ?? 0,
    };

    // Attach available sections
    if (pipelineResult.outputs.activation_map) {
      profile.journey = pipelineResult.outputs.activation_map;
    }
    if (pipelineResult.outputs.measurement_spec) {
      profile.measurement_spec = pipelineResult.outputs.measurement_spec;
    }
    if (pipelineResult.outputs.lifecycle_states) {
      profile.lifecycle_states = pipelineResult.outputs.lifecycle_states;
    }
    if (pipelineResult.outputs.icp_profiles && pipelineResult.outputs.icp_profiles.length > 0) {
      profile.outputs = pipelineResult.outputs;
    }
    if (pipelineResult.convergence?.value_moments && pipelineResult.convergence.value_moments.length > 0) {
      profile.value_moments = pipelineResult.convergence.value_moments;
    }

    // 7. PHASE 3 -- SAVE
    progress.start("Saving", "to local storage");
    const profileId = await storage.save(profile);
    profile.id = profileId;

    // Also persist structured artifacts via ProductDirectory
    const { ProductDirectory, urlToSlug } = await import("@basesignal/storage");
    const slug = urlToSlug(parsedUrl.href);
    const productDir = new ProductDirectory({ root: config.storagePath + "/products" });

    // Crawl artifacts
    productDir.writeJson(slug, "crawl/pages.json", crawlResult.pages);
    productDir.writeJson(slug, "crawl/metadata.json", {
      url: parsedUrl.href,
      timestamp: Date.now(),
      pageCount: crawlResult.pages.length,
    });

    // Per-lens results
    for (const lr of pipelineResult.intermediates.lens_results) {
      const lensSlug = lr.lens.replace(/_/g, "-");
      productDir.writeJson(slug, `lenses/${lensSlug}.json`, lr);
    }

    // Convergence artifacts
    if (pipelineResult.intermediates.validated_candidates.length > 0) {
      productDir.writeJson(slug, "convergence/validated-candidates.json", pipelineResult.intermediates.validated_candidates);
    }
    if (pipelineResult.intermediates.clusters) {
      productDir.writeJson(slug, "convergence/clusters.json", pipelineResult.intermediates.clusters);
    }
    if (pipelineResult.convergence?.value_moments) {
      productDir.writeJson(slug, "convergence/value-moments.json", pipelineResult.convergence.value_moments);
    }
    if (pipelineResult.intermediates.quality_report) {
      productDir.writeJson(slug, "convergence/quality-report.json", pipelineResult.intermediates.quality_report);
    }

    // Output artifacts
    if (pipelineResult.outputs.icp_profiles.length > 0) {
      productDir.writeJson(slug, "outputs/icp-profiles.json", pipelineResult.outputs.icp_profiles);
    }
    if (pipelineResult.outputs.activation_map) {
      productDir.writeJson(slug, "outputs/activation-map.json", pipelineResult.outputs.activation_map);
    }
    if (pipelineResult.outputs.measurement_spec) {
      productDir.writeJson(slug, "outputs/measurement-spec.json", pipelineResult.outputs.measurement_spec);
    }
    if (pipelineResult.outputs.lifecycle_states) {
      productDir.writeJson(slug, "outputs/lifecycle-states.json", pipelineResult.outputs.lifecycle_states);
    }

    // Combined profile
    productDir.writeJson(slug, "profile.json", profile);

    progress.done("Saving", profileId);

    // 8. PHASE 4 -- OUTPUT
    const formatted = formatOutput(profile, options.format);
    console.log(formatted);

    if (options.output) {
      writeOutputFile(options.output, profile);
      console.error(`Written to ${options.output}`);
    }
  } finally {
    storage.close();
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerScanCommand(program: Command): void {
  program
    .command("scan <url>")
    .description("Crawl a URL and generate a product profile")
    .option("-o, --output <file>", "Save output to file")
    .option("-f, --format <format>", "Output format: summary, json, markdown", "summary")
    .option("-v, --verbose", "Show detailed progress", false)
    .action(async (url: string, opts: Record<string, unknown>) => {
      try {
        await runScan(url, {
          output: opts.output as string | undefined,
          format: (opts.format as OutputFormat) ?? "summary",
          verbose: Boolean(opts.verbose),
        });
      } catch (error) {
        handleScanError(error);
        process.exit(1);
      }
    });
}
