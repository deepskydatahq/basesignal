/**
 * Format a ProductProfile into a human-readable markdown summary.
 * Pure function -- no side effects, easy to test independently.
 */

/** Slim interface matching the ProductProfile shape from @basesignal/core */
interface ProfileIdentity {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string | null;
  companyStage?: string | null;
  confidence: number;
}

interface ProfileRevenueTier {
  name: string;
  price: string;
  features: string[];
}

interface ProfileRevenue {
  model: string;
  hasFreeTier: boolean;
  tiers: ProfileRevenueTier[];
  confidence: number;
}

interface ProfileEntityProperty {
  name: string;
  type: string;
  description: string;
  isRequired: boolean;
}

interface ProfileProductActivity {
  name: string;
}

interface ProfileInteractionActivity {
  name: string;
}

interface ProfileProductEntity {
  id: string;
  name: string;
  description: string;
  isHeartbeat: boolean;
  properties: ProfileEntityProperty[];
  activities: ProfileProductActivity[];
}

interface ProfileInteractionEntity {
  name: string;
  properties: ProfileEntityProperty[];
  activities: ProfileInteractionActivity[];
}

interface ProfileMeasurementSpec {
  perspectives: {
    product: { entities: ProfileProductEntity[] };
    interaction: { entities: ProfileInteractionEntity[] };
  };
  confidence: number;
}

interface ProfileJourneyStage {
  name: string;
  description: string;
  order: number;
}

interface ProfileJourney {
  stages: ProfileJourneyStage[];
  confidence: number;
}

interface ProfileOutcome {
  description: string;
  type: string;
  linkedFeatures: string[];
}

interface ProfileOutcomes {
  items: ProfileOutcome[];
  confidence: number;
}

interface ProfileMetric {
  name: string;
  category: string;
  formula?: string | null;
}

interface ProfileMetrics {
  items: ProfileMetric[];
  confidence: number;
}

export interface FormattableProfile {
  url: string;
  identity?: ProfileIdentity | null;
  revenue?: ProfileRevenue | null;
  measurement_spec?: ProfileMeasurementSpec | null;
  journey?: ProfileJourney | null;
  outcomes?: ProfileOutcomes | null;
  metrics?: ProfileMetrics | null;
  completeness: number;
  overallConfidence: number;
}

export function formatProfileSummary(
  profile: FormattableProfile,
  profileId: string,
): string {
  const lines: string[] = [];
  const name = profile.identity?.productName ?? "Product";

  lines.push(`# ${name} Profile`);
  lines.push("");
  lines.push(`**Profile ID:** ${profileId}`);
  lines.push(`**URL:** ${profile.url}`);
  lines.push("");

  // Identity
  if (profile.identity) {
    lines.push("## Identity");
    lines.push(`- **Description:** ${profile.identity.description}`);
    lines.push(`- **Target Customer:** ${profile.identity.targetCustomer}`);
    lines.push(`- **Business Model:** ${profile.identity.businessModel}`);
    if (profile.identity.industry) {
      lines.push(`- **Industry:** ${profile.identity.industry}`);
    }
    if (profile.identity.companyStage) {
      lines.push(`- **Stage:** ${profile.identity.companyStage}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.identity.confidence)}`);
    lines.push("");
  }

  // Revenue
  if (profile.revenue) {
    lines.push("## Revenue");
    lines.push(`- **Model:** ${profile.revenue.model}`);
    lines.push(`- **Free Tier:** ${profile.revenue.hasFreeTier ? "Yes" : "No"}`);
    if (profile.revenue.tiers.length > 0) {
      lines.push(`- **Tiers:** ${profile.revenue.tiers.map((t) => t.name).join(", ")}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.revenue.confidence)}`);
    lines.push("");
  }

  // Measurement Spec
  if (profile.measurement_spec) {
    const spec = profile.measurement_spec;
    const { product, interaction } = spec.perspectives;
    const hasEntities =
      product.entities.length > 0 ||
      interaction.entities.length > 0;

    if (hasEntities) {
      lines.push("## Measurement Spec");
      lines.push("");

      if (product.entities.length > 0) {
        lines.push("### Product Entities");
        for (const entity of product.entities) {
          const heartbeat = entity.isHeartbeat ? " [heartbeat]" : "";
          lines.push(`- **${entity.name}**${heartbeat}: ${entity.description}`);
          if (entity.properties.length > 0) {
            lines.push(`  - Properties: ${entity.properties.map((p) => p.name).join(", ")}`);
          }
          if (entity.activities.length > 0) {
            lines.push(`  - Activities: ${entity.activities.map((a) => a.name).join(", ")}`);
          }
        }
        lines.push("");
      }

      if (interaction.entities.length > 0) {
        lines.push("### Interaction Entities");
        for (const entity of interaction.entities) {
          lines.push(`- **${entity.name}**`);
          if (entity.properties.length > 0) {
            lines.push(`  - Properties: ${entity.properties.map((p) => p.name).join(", ")}`);
          }
          if (entity.activities.length > 0) {
            lines.push(`  - Activities: ${entity.activities.map((a) => a.name).join(", ")}`);
          }
        }
        lines.push("");
      }

      lines.push(`- **Confidence:** ${pct(spec.confidence)}`);
      lines.push("");
    }
  }

  // Journey
  if (profile.journey && profile.journey.stages.length > 0) {
    lines.push("## Journey Stages");
    const sorted = [...profile.journey.stages].sort((a, b) => a.order - b.order);
    for (const stage of sorted) {
      lines.push(`${stage.order}. **${stage.name}** -- ${stage.description}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.journey.confidence)}`);
    lines.push("");
  }

  // Outcomes
  if (profile.outcomes && profile.outcomes.items.length > 0) {
    lines.push("## Outcomes");
    for (const outcome of profile.outcomes.items) {
      lines.push(`- ${outcome.description} (${outcome.type})`);
    }
    lines.push(`- **Confidence:** ${pct(profile.outcomes.confidence)}`);
    lines.push("");
  }

  // Metrics
  if (profile.metrics && profile.metrics.items.length > 0) {
    lines.push("## Key Metrics");
    for (const metric of profile.metrics.items) {
      const formula = metric.formula ? ` = ${metric.formula}` : "";
      lines.push(`- **${metric.name}** (${metric.category})${formula}`);
    }
    lines.push(`- **Confidence:** ${pct(profile.metrics.confidence)}`);
    lines.push("");
  }

  // Completeness
  lines.push("## Completeness");
  lines.push(`- **Score:** ${pct(profile.completeness)}`);
  lines.push(`- **Overall Confidence:** ${pct(profile.overallConfidence)}`);

  return lines.join("\n");
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
