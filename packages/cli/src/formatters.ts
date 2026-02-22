import { writeFileSync } from "node:fs";
import type { ProductProfile } from "@basesignal/storage";

export type OutputFormat = "summary" | "markdown" | "json";

export function formatOutput(profile: ProductProfile, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(profile, null, 2);
    case "markdown":
      return formatMarkdown(profile);
    case "summary":
    default:
      return formatSummary(profile);
  }
}

export function formatSummary(profile: ProductProfile): string {
  const lines: string[] = [];

  const name = profile.identity?.productName ?? "Unknown Product";
  lines.push(`Product: ${name}`);

  const url = (profile.metadata as { url?: string } | undefined)?.url;
  if (url) {
    lines.push(`URL: ${url}`);
  }

  if (profile.identity?.description) {
    lines.push(`Description: ${profile.identity.description}`);
  }

  if (profile.identity?.targetCustomer) {
    lines.push(`Target Customer: ${profile.identity.targetCustomer}`);
  }

  if (profile.identity?.businessModel) {
    lines.push(`Business Model: ${profile.identity.businessModel}`);
  }

  // Revenue info
  const revenue = profile.revenue as {
    model?: string;
    tiers?: Array<{ name: string; price?: string; features?: string[] }>;
  } | undefined;
  if (revenue?.model) {
    lines.push(`Pricing Model: ${revenue.model}`);
  }
  if (revenue?.tiers && revenue.tiers.length > 0) {
    const tierNames = revenue.tiers.map((t) => t.name).join(", ");
    lines.push(`Plans: ${tierNames}`);
  }

  // Journey stages
  const journey = profile.journey as {
    stages?: Array<{ name: string; order: number; description?: string }>;
  } | undefined;
  if (journey?.stages && journey.stages.length > 0) {
    lines.push("");
    lines.push("Journey Stages:");
    const sorted = [...journey.stages].sort((a, b) => a.order - b.order);
    for (const stage of sorted) {
      lines.push(`  ${stage.order}. ${stage.name}`);
    }
  }

  // Lifecycle States
  const lifecycleStates = profile.lifecycle_states as {
    states?: Array<{ name: string; time_window: string }>;
  } | undefined;
  if (lifecycleStates?.states) {
    lines.push("");
    lines.push("Lifecycle States:");
    for (const state of lifecycleStates.states) {
      lines.push(`  ${state.name} (${state.time_window})`);
    }
  }

  // Metrics count
  const metrics = profile.metrics as {
    items?: Array<{ name: string }>;
  } | undefined;
  if (metrics?.items && metrics.items.length > 0) {
    lines.push("");
    lines.push(`Metrics: ${metrics.items.length} suggested`);
  }

  // Profile ID and completeness
  lines.push("");
  if (profile.id) {
    lines.push(`Profile ID: ${profile.id}`);
  }
  const completeness = profile.completeness ?? 0;
  lines.push(`Completeness: ${Math.round(completeness * 100)}%`);

  return lines.join("\n");
}

export function formatMarkdown(profile: ProductProfile): string {
  const lines: string[] = [];

  const name = profile.identity?.productName ?? "Unknown Product";
  lines.push(`# ${name}`);
  lines.push("");

  // Core Identity
  if (profile.identity) {
    lines.push("## Core Identity");
    lines.push("");
    if (profile.identity.description) {
      lines.push(`**Description:** ${profile.identity.description}`);
    }
    if (profile.identity.targetCustomer) {
      lines.push(`**Target Customer:** ${profile.identity.targetCustomer}`);
    }
    if (profile.identity.businessModel) {
      lines.push(`**Business Model:** ${profile.identity.businessModel}`);
    }
    if (profile.identity.industry) {
      lines.push(`**Industry:** ${profile.identity.industry}`);
    }
    lines.push("");
  }

  // Revenue Architecture
  const revenue = profile.revenue as {
    model?: string;
    tiers?: Array<{ name: string; price?: string; features?: string[] }>;
    confidence?: number;
  } | undefined;
  if (revenue) {
    lines.push("## Revenue Architecture");
    lines.push("");
    if (revenue.model) {
      lines.push(`**Model:** ${revenue.model}`);
    }
    if (revenue.tiers && revenue.tiers.length > 0) {
      lines.push("");
      lines.push("| Tier | Price | Features |");
      lines.push("| --- | --- | --- |");
      for (const tier of revenue.tiers) {
        const price = tier.price ?? "-";
        const features = tier.features?.join(", ") ?? "-";
        lines.push(`| ${tier.name} | ${price} | ${features} |`);
      }
    }
    lines.push("");
  }

  // User Journey
  const journey = profile.journey as {
    stages?: Array<{ name: string; order: number; description?: string }>;
  } | undefined;
  if (journey?.stages && journey.stages.length > 0) {
    lines.push("## User Journey");
    lines.push("");
    const sorted = [...journey.stages].sort((a, b) => a.order - b.order);
    for (const stage of sorted) {
      const desc = stage.description ? ` -- ${stage.description}` : "";
      lines.push(`${stage.order}. **${stage.name}**${desc}`);
    }
    lines.push("");
  }

  // Suggested Metrics
  const metrics = profile.metrics as {
    items?: Array<{ name: string; category: string; formula?: string }>;
  } | undefined;
  if (metrics?.items && metrics.items.length > 0) {
    lines.push("## Suggested Metrics");
    lines.push("");
    lines.push("| Name | Category | Formula |");
    lines.push("| --- | --- | --- |");
    for (const metric of metrics.items) {
      const formula = metric.formula ?? "-";
      lines.push(`| ${metric.name} | ${metric.category} | ${formula} |`);
    }
    lines.push("");
  }

  // Lifecycle States
  const mdLifecycleStates = profile.lifecycle_states as {
    states?: Array<{ name: string; definition: string; time_window: string }>;
  } | undefined;
  if (mdLifecycleStates?.states && mdLifecycleStates.states.length > 0) {
    lines.push("## Lifecycle States");
    lines.push("");
    lines.push("| State | Definition | Time Window |");
    lines.push("| --- | --- | --- |");
    for (const state of mdLifecycleStates.states) {
      lines.push(`| ${state.name} | ${state.definition} | ${state.time_window} |`);
    }
    lines.push("");
  }

  // Footer
  const completeness = profile.completeness ?? 0;
  lines.push("---");
  if (profile.id) {
    lines.push(`Profile ID: ${profile.id}`);
  }
  lines.push(`Completeness: ${Math.round(completeness * 100)}%`);

  return lines.join("\n");
}

export function writeOutputFile(filePath: string, profile: ProductProfile): void {
  const format: OutputFormat = filePath.endsWith(".md") ? "markdown" : "json";
  const content = formatOutput(profile, format);
  writeFileSync(filePath, content, "utf-8");
}
