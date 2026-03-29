/**
 * Pure formatting functions for product profile export.
 * No MCP, Convex, or auth dependencies.
 *
 * These produce self-contained documents suitable for sharing or archiving,
 * unlike the overview formatters in formatters.ts which produce brief summaries.
 */

import type { ProductProfile } from "./types.js";

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

/**
 * Export a product profile as a formatted JSON string.
 * Includes basesignal_version for forward compatibility.
 */
export function exportProfileAsJson(profile: ProductProfile): string {
  return JSON.stringify(
    {
      basesignal_version: "1.0",
      ...profile,
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

type Evidence = Array<{ url: string; excerpt: string }>;

function appendEvidence(lines: string[], evidence: Evidence | undefined): void {
  if (!evidence || evidence.length === 0) return;
  lines.push("");
  lines.push("<details><summary>Evidence</summary>");
  lines.push("");
  for (const e of evidence) {
    lines.push(`- [${e.url}](${e.url}): ${e.excerpt}`);
  }
  lines.push("");
  lines.push("</details>");
}

/**
 * Export a product profile as a readable Markdown document.
 * Missing sections show "*Not yet analyzed.*" rather than being omitted.
 */
export function exportProfileAsMarkdown(
  profile: ProductProfile
): string {
  const lines: string[] = [];

  // Header
  const identity = profile.identity as
    | {
        productName?: string;
        description?: string;
        targetCustomer?: string;
        businessModel?: string;
        industry?: string;
        companyStage?: string;
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;
  const name = identity?.productName ?? "Unknown Product";
  lines.push(`# ${name} - Product Profile`);
  lines.push("");
  lines.push(
    `**Completeness:** ${Math.round(((profile.completeness as number) ?? 0) * 100)}%`
  );
  lines.push(
    `**Overall Confidence:** ${Math.round(((profile.overallConfidence as number) ?? 0) * 100)}%`
  );
  lines.push(`**Schema Version:** 1.0`);
  lines.push("");

  // Core Identity
  lines.push("## Core Identity");
  lines.push("");
  if (identity) {
    if (identity.description)
      lines.push(`**Description:** ${identity.description}`);
    if (identity.targetCustomer)
      lines.push(`**Target Customer:** ${identity.targetCustomer}`);
    if (identity.businessModel)
      lines.push(`**Business Model:** ${identity.businessModel}`);
    if (identity.industry) lines.push(`**Industry:** ${identity.industry}`);
    if (identity.companyStage)
      lines.push(`**Company Stage:** ${identity.companyStage}`);
    if (identity.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(identity.confidence * 100)}%`
      );
    appendEvidence(lines, identity.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Revenue Architecture
  lines.push("## Revenue Architecture");
  lines.push("");
  const revenue = profile.revenue as
    | {
        model?: string;
        billingUnit?: string;
        hasFreeTier?: boolean;
        tiers?: Array<{ name: string; price: string; features: string[] }>;
        expansionPaths?: string[];
        contractionRisks?: string[];
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;
  if (revenue) {
    if (revenue.model) lines.push(`**Model:** ${revenue.model}`);
    if (revenue.billingUnit)
      lines.push(`**Billing Unit:** ${revenue.billingUnit}`);
    if (revenue.hasFreeTier !== undefined)
      lines.push(`**Free Tier:** ${revenue.hasFreeTier ? "Yes" : "No"}`);
    if (revenue.tiers && revenue.tiers.length > 0) {
      lines.push("");
      lines.push("| Tier | Price | Features |");
      lines.push("| --- | --- | --- |");
      for (const t of revenue.tiers) {
        lines.push(`| ${t.name} | ${t.price} | ${t.features.join(", ")} |`);
      }
    }
    if (revenue.expansionPaths && revenue.expansionPaths.length > 0) {
      lines.push("");
      lines.push("**Expansion Paths:**");
      for (const p of revenue.expansionPaths) lines.push(`- ${p}`);
    }
    if (revenue.contractionRisks && revenue.contractionRisks.length > 0) {
      lines.push("");
      lines.push("**Contraction Risks:**");
      for (const r of revenue.contractionRisks) lines.push(`- ${r}`);
    }
    if (revenue.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(revenue.confidence * 100)}%`
      );
    appendEvidence(lines, revenue.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Entity Model
  lines.push("## Entity Model");
  lines.push("");

  // New measurement_spec perspectives format
  const measurementSpec = profile.measurement_spec as
    | {
        perspectives?: {
          product?: {
            entities?: Array<{
              id?: string;
              name: string;
              description?: string;
              isHeartbeat?: boolean;
              properties?: Array<{ name: string; type: string; description: string; isRequired?: boolean }>;
              activities?: Array<{ name: string; properties_supported?: string[]; activity_properties?: Array<{ name: string }> }>;
            }>;
          };
          interaction?: {
            entities?: Array<{
              name: string;
              properties?: Array<{ name: string; type: string; description: string; isRequired?: boolean }>;
              activities?: Array<{ name: string; properties_supported?: string[] }>;
            }>;
          };
        };
        confidence?: number;
      }
    | undefined;

  // Legacy entities format
  const entities = profile.entities as
    | {
        items?: Array<{ name: string; type: string; properties: string[] }>;
        relationships?: Array<{ from: string; to: string; type: string }>;
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;

  if (measurementSpec?.perspectives) {
    const persp = measurementSpec.perspectives;
    const hasProduct = (persp.product?.entities?.length ?? 0) > 0;
    const hasInteraction = (persp.interaction?.entities?.length ?? 0) > 0;

    if (!hasProduct && !hasInteraction) {
      lines.push("*Not yet analyzed.*");
    }

    // Product Entities
    if (persp.product?.entities && persp.product.entities.length > 0) {
      lines.push("### Product Entities");
      lines.push("");
      for (const ent of persp.product.entities) {
        const heartbeat = ent.isHeartbeat ? " (heartbeat)" : "";
        const props = ent.properties?.map((p) => p.name).join(", ") ?? "";
        lines.push(`- **${ent.name}**${heartbeat}: ${props}`);
        if (ent.activities && ent.activities.length > 0) {
          for (const act of ent.activities) {
            lines.push(`  - Activity: ${act.name}`);
          }
        }
      }
      lines.push("");
    }



    // Interaction Entities
    if (persp.interaction?.entities && persp.interaction.entities.length > 0) {
      lines.push("### Interaction Entities");
      lines.push("");
      for (const ent of persp.interaction.entities) {
        const props = ent.properties?.map((p) => p.name).join(", ") ?? "";
        lines.push(`- **${ent.name}**: ${props}`);
        if (ent.activities && ent.activities.length > 0) {
          for (const act of ent.activities) {
            lines.push(`  - Activity: ${act.name}`);
          }
        }
      }
      lines.push("");
    }

    if (measurementSpec.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(measurementSpec.confidence * 100)}%`
      );
  } else if (entities) {
    if (entities.items && entities.items.length > 0) {
      lines.push("**Entities:**");
      for (const item of entities.items) {
        lines.push(
          `- **${item.name}** (${item.type}): ${item.properties.join(", ")}`
        );
      }
    }
    if (entities.relationships && entities.relationships.length > 0) {
      lines.push("");
      lines.push("**Relationships:**");
      for (const rel of entities.relationships) {
        lines.push(`- ${rel.from} -> ${rel.to} (${rel.type})`);
      }
    }
    if (entities.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(entities.confidence * 100)}%`
      );
    appendEvidence(lines, entities.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Journey
  lines.push("## Journey");
  lines.push("");
  const journey = profile.journey as
    | {
        stages?: Array<{
          name: string;
          description: string;
          order: number;
        }>;
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;
  if (journey) {
    if (journey.stages && journey.stages.length > 0) {
      const sorted = [...journey.stages].sort((a, b) => a.order - b.order);
      lines.push("| Stage | Description |");
      lines.push("| --- | --- |");
      for (const s of sorted) {
        lines.push(`| ${s.name} | ${s.description} |`);
      }
    }
    if (journey.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(journey.confidence * 100)}%`
      );
    appendEvidence(lines, journey.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Definitions
  lines.push("## Definitions");
  lines.push("");
  const definitions = profile.definitions as
    | Record<string, unknown>
    | undefined;
  if (definitions) {
    // Activation
    const activation = definitions.activation as
      | {
          levels?: Array<{
            level: number;
            name: string;
            signalStrength: string;
            criteria: Array<{
              action: string;
              count: number;
              timeWindow?: string;
            }>;
            reasoning: string;
            confidence: number;
            evidence?: Evidence;
          }>;
          primaryActivation?: number;
          overallConfidence?: number;
          // Legacy flat format
          criteria?: string[];
          timeWindow?: string;
          reasoning?: string;
          confidence?: number;
          source?: string;
          evidence?: Evidence;
        }
      | undefined;
    if (activation) {
      lines.push("### Activation");
      lines.push("");
      if (activation.levels && activation.levels.length > 0) {
        for (const lvl of activation.levels) {
          const criteria = lvl.criteria
            .map(
              (c) =>
                `${c.action} x${c.count}${c.timeWindow ? ` (${c.timeWindow})` : ""}`
            )
            .join("; ");
          lines.push(
            `Level ${lvl.level}: **${lvl.name}** (signal: ${lvl.signalStrength}) -- ${criteria} -- confidence ${Math.round(lvl.confidence * 100)}%`
          );
          if (lvl.reasoning) lines.push(`  Reasoning: ${lvl.reasoning}`);
        }
        if (activation.primaryActivation !== undefined) {
          lines.push(
            `**Primary Activation Level:** ${activation.primaryActivation}`
          );
        }
        if (activation.overallConfidence !== undefined) {
          lines.push(
            `**Overall Confidence:** ${Math.round(activation.overallConfidence * 100)}%`
          );
        }
        appendEvidence(
          lines,
          activation.levels.flatMap((l) => l.evidence ?? [])
        );
      } else if (activation.criteria) {
        for (const c of activation.criteria) lines.push(`- ${c}`);
        if (activation.timeWindow)
          lines.push(`**Time Window:** ${activation.timeWindow}`);
        if (activation.reasoning)
          lines.push(`**Reasoning:** ${activation.reasoning}`);
        if (activation.confidence !== undefined)
          lines.push(
            `**Confidence:** ${Math.round(activation.confidence * 100)}%`
          );
        appendEvidence(lines, activation.evidence);
      }
      lines.push("");
    }

    // Other definitions: firstValue, active, atRisk, churn
    const defTypes = ["firstValue", "active", "atRisk", "churn"] as const;
    const defLabels: Record<string, string> = {
      firstValue: "First Value",
      active: "Active",
      atRisk: "At Risk",
      churn: "Churn",
    };
    for (const defType of defTypes) {
      const def = definitions[defType] as
        | {
            description?: string;
            criteria?: string[];
            timeWindow?: string;
            reasoning?: string;
            confidence?: number;
            source?: string;
            evidence?: Evidence;
          }
        | undefined;
      if (def) {
        lines.push(`### ${defLabels[defType]}`);
        lines.push("");
        if (def.description) lines.push(def.description);
        if (def.criteria && def.criteria.length > 0) {
          lines.push("**Criteria:**");
          for (const c of def.criteria) lines.push(`- ${c}`);
        }
        if (def.timeWindow)
          lines.push(`**Time Window:** ${def.timeWindow}`);
        if (def.reasoning)
          lines.push(`**Reasoning:** ${def.reasoning}`);
        if (def.confidence !== undefined)
          lines.push(
            `**Confidence:** ${Math.round(def.confidence * 100)}%`
          );
        appendEvidence(lines, def.evidence);
        lines.push("");
      }
    }

    // If no definitions at all
    const hasAnyDef =
      activation ||
      defTypes.some((dt) => definitions[dt]);
    if (!hasAnyDef) {
      lines.push("*Not yet analyzed.*");
      lines.push("");
    }
  } else {
    lines.push("*Not yet analyzed.*");
    lines.push("");
  }

  // Outcomes
  lines.push("## Outcomes");
  lines.push("");
  const outcomes = profile.outcomes as
    | {
        items?: Array<{
          description: string;
          type: string;
          linkedFeatures: string[];
        }>;
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;
  if (outcomes) {
    if (outcomes.items && outcomes.items.length > 0) {
      for (const item of outcomes.items) {
        lines.push(
          `- **${item.description}** (${item.type}) -- linked: ${item.linkedFeatures.join(", ")}`
        );
      }
    }
    if (outcomes.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(outcomes.confidence * 100)}%`
      );
    appendEvidence(lines, outcomes.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Metrics
  lines.push("## Metrics");
  lines.push("");
  const metrics = profile.metrics as
    | {
        items?: Array<{
          name: string;
          category: string;
          formula?: string;
          linkedTo: string[];
        }>;
        confidence?: number;
        evidence?: Evidence;
      }
    | undefined;
  if (metrics) {
    if (metrics.items && metrics.items.length > 0) {
      for (const item of metrics.items) {
        lines.push(
          `- **${item.name}** (${item.category})${item.formula ? `: ${item.formula}` : ""}`
        );
      }
    }
    if (metrics.confidence !== undefined)
      lines.push(
        `**Confidence:** ${Math.round(metrics.confidence * 100)}%`
      );
    appendEvidence(lines, metrics.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Footer
  lines.push("---");
  lines.push(
    `*Exported from Basesignal on ${new Date().toISOString().split("T")[0]}*`
  );

  return lines.join("\n");
}
