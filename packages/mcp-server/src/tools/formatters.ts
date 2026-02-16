import type { ProductProfile } from "./types.js";

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (days <= 30) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  return new Date(timestamp).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export function formatEvidence(
  evidence: Array<{ url: string; excerpt: string }>
): string {
  if (!evidence || evidence.length === 0) return "";
  const rows = evidence
    .map((e) => `| ${e.url} | ${e.excerpt} |`)
    .join("\n");
  return `\n| URL | Excerpt |\n| --- | --- |\n${rows}\n`;
}

// ---------------------------------------------------------------------------
// Activation (special case)
// ---------------------------------------------------------------------------

function isMultiLevel(data: unknown): data is { levels: unknown[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "levels" in data &&
    Array.isArray((data as Record<string, unknown>).levels)
  );
}

export function formatActivation(data: unknown): string {
  if (!data || typeof data !== "object") return "*No activation data.*";

  if (isMultiLevel(data)) {
    const d = data as {
      levels: Array<{
        level: number;
        name: string;
        signalStrength: string;
        criteria: Array<{ action: string; count: number; timeWindow?: string }>;
        reasoning: string;
        confidence: number;
        evidence?: Array<{ url: string; excerpt: string }>;
      }>;
      primaryActivation?: number;
      overallConfidence?: number;
    };

    const lines: string[] = ["### Activation (Multi-Level)", ""];
    if (d.overallConfidence !== undefined) {
      lines.push(
        `**Overall Confidence:** ${Math.round(d.overallConfidence * 100)}%`
      );
    }
    if (d.primaryActivation !== undefined) {
      lines.push(`**Primary Activation Level:** ${d.primaryActivation}`);
    }
    lines.push("");
    lines.push(
      "| Level | Name | Signal | Criteria | Confidence |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const lvl of d.levels) {
      const criteria = lvl.criteria
        .map(
          (c) =>
            `${c.action} x${c.count}${c.timeWindow ? ` (${c.timeWindow})` : ""}`
        )
        .join("; ");
      lines.push(
        `| ${lvl.level} | ${lvl.name} | ${lvl.signalStrength} | ${criteria} | ${Math.round(lvl.confidence * 100)}% |`
      );
    }

    for (const lvl of d.levels) {
      if (lvl.reasoning) {
        lines.push("", `**Level ${lvl.level} reasoning:** ${lvl.reasoning}`);
      }
      if (lvl.evidence && lvl.evidence.length > 0) {
        lines.push(formatEvidence(lvl.evidence));
      }
    }

    return lines.join("\n");
  }

  // Legacy flat format
  const legacy = data as {
    criteria?: string[];
    timeWindow?: string;
    reasoning?: string;
    confidence?: number;
    source?: string;
    evidence?: Array<{ url: string; excerpt: string }>;
  };

  const lines: string[] = ["### Activation"];
  if (legacy.confidence !== undefined) {
    lines.push(`**Confidence:** ${Math.round(legacy.confidence * 100)}%`);
  }
  if (legacy.source) {
    lines.push(`**Source:** ${legacy.source}`);
  }
  if (legacy.timeWindow) {
    lines.push(`**Time Window:** ${legacy.timeWindow}`);
  }
  if (legacy.criteria && legacy.criteria.length > 0) {
    lines.push("", "**Criteria:**");
    for (const c of legacy.criteria) {
      lines.push(`- ${c}`);
    }
  }
  if (legacy.reasoning) {
    lines.push("", `**Reasoning:** ${legacy.reasoning}`);
  }
  if (legacy.evidence) {
    lines.push(formatEvidence(legacy.evidence));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Section formatters
// ---------------------------------------------------------------------------

const DEFINITION_TYPES = new Set([
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
]);

function formatLifecycleDefinition(type: string, data: unknown): string {
  if (!data || typeof data !== "object") return `*No ${type} data.*`;

  const d = data as {
    description?: string;
    criteria?: string[];
    timeWindow?: string;
    reasoning?: string;
    confidence?: number;
    source?: string;
    evidence?: Array<{ url: string; excerpt: string }>;
  };

  const lines: string[] = [`### ${capitalise(type)}`];
  if (d.confidence !== undefined) {
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  }
  if (d.source) lines.push(`**Source:** ${d.source}`);
  if (d.timeWindow) lines.push(`**Time Window:** ${d.timeWindow}`);
  if (d.description) lines.push("", d.description);
  if (d.criteria && d.criteria.length > 0) {
    lines.push("", "**Criteria:**");
    for (const c of d.criteria) lines.push(`- ${c}`);
  }
  if (d.reasoning) lines.push("", `**Reasoning:** ${d.reasoning}`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatIdentity(data: unknown): string {
  if (!data || typeof data !== "object") return "*No identity data.*";
  const d = data as {
    productName?: string;
    description?: string;
    targetCustomer?: string;
    businessModel?: string;
    industry?: string;
    companyStage?: string;
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Identity"];
  if (d.productName) lines.push(`**Product:** ${d.productName}`);
  if (d.description) lines.push(`**Description:** ${d.description}`);
  if (d.targetCustomer) lines.push(`**Target Customer:** ${d.targetCustomer}`);
  if (d.businessModel) lines.push(`**Business Model:** ${d.businessModel}`);
  if (d.industry) lines.push(`**Industry:** ${d.industry}`);
  if (d.companyStage) lines.push(`**Company Stage:** ${d.companyStage}`);
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatRevenue(data: unknown): string {
  if (!data || typeof data !== "object") return "*No revenue data.*";
  const d = data as {
    model?: string;
    hasFreeTier?: boolean;
    tiers?: Array<{ name: string; price: string; features: string[] }>;
    billingUnit?: string;
    expansionPaths?: string[];
    contractionRisks?: string[];
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Revenue"];
  if (d.model) lines.push(`**Model:** ${d.model}`);
  if (d.billingUnit) lines.push(`**Billing Unit:** ${d.billingUnit}`);
  if (d.hasFreeTier !== undefined)
    lines.push(`**Free Tier:** ${d.hasFreeTier ? "Yes" : "No"}`);
  if (d.tiers && d.tiers.length > 0) {
    lines.push(
      "",
      `**Tiers:** ${d.tiers.map((t) => t.name).join(", ")}`
    );
  }
  if (d.expansionPaths && d.expansionPaths.length > 0) {
    lines.push("", "**Expansion Paths:**");
    for (const p of d.expansionPaths) lines.push(`- ${p}`);
  }
  if (d.contractionRisks && d.contractionRisks.length > 0) {
    lines.push("", "**Contraction Risks:**");
    for (const r of d.contractionRisks) lines.push(`- ${r}`);
  }
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatEntities(data: unknown): string {
  if (!data || typeof data !== "object") return "*No entities data.*";
  const d = data as {
    items?: Array<{ name: string; type: string; properties: string[] }>;
    relationships?: Array<{ from: string; to: string; type: string }>;
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Entities"];
  if (d.items)
    lines.push(`**Entities:** ${d.items.length} item${d.items.length === 1 ? "" : "s"}`);
  if (d.relationships)
    lines.push(
      `**Relationships:** ${d.relationships.length} relationship${d.relationships.length === 1 ? "" : "s"}`
    );
  if (d.items && d.items.length > 0) {
    lines.push("");
    for (const item of d.items) {
      lines.push(`- **${item.name}** (${item.type}): ${item.properties.join(", ")}`);
    }
  }
  if (d.relationships && d.relationships.length > 0) {
    lines.push("");
    for (const rel of d.relationships) {
      lines.push(`- ${rel.from} -> ${rel.to} (${rel.type})`);
    }
  }
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatJourney(data: unknown): string {
  if (!data || typeof data !== "object") return "*No journey data.*";
  const d = data as {
    stages?: Array<{ name: string; description: string; order: number }>;
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Journey"];
  if (d.stages && d.stages.length > 0) {
    const sorted = [...d.stages].sort((a, b) => a.order - b.order);
    lines.push(`**Stages:** ${sorted.map((s) => s.name).join(" -> ")}`);
  }
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatOutcomes(data: unknown): string {
  if (!data || typeof data !== "object") return "*No outcomes data.*";
  const d = data as {
    items?: Array<{
      description: string;
      type: string;
      linkedFeatures: string[];
    }>;
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Outcomes"];
  if (d.items)
    lines.push(`**Items:** ${d.items.length}`);
  if (d.items && d.items.length > 0) {
    lines.push("");
    for (const item of d.items) {
      lines.push(`- **${item.description}** (${item.type})`);
    }
  }
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

function formatMetrics(data: unknown): string {
  if (!data || typeof data !== "object") return "*No metrics data.*";
  const d = data as {
    items?: Array<{
      name: string;
      category: string;
      formula?: string;
      linkedTo: string[];
    }>;
    confidence?: number;
    evidence?: Array<{ url: string; excerpt: string }>;
  };
  const lines: string[] = ["### Metrics"];
  if (d.items)
    lines.push(`**Items:** ${d.items.length}`);
  if (d.items && d.items.length > 0) {
    lines.push("");
    for (const item of d.items) {
      lines.push(
        `- **${item.name}** (${item.category})${item.formula ? `: ${item.formula}` : ""}`
      );
    }
  }
  if (d.confidence !== undefined)
    lines.push(`**Confidence:** ${Math.round(d.confidence * 100)}%`);
  if (d.evidence) lines.push(formatEvidence(d.evidence));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Section dispatcher
// ---------------------------------------------------------------------------

export function formatSection(type: string, data: unknown): string {
  if (type === "activation") return formatActivation(data);
  if (DEFINITION_TYPES.has(type) && type !== "activation")
    return formatLifecycleDefinition(type, data);

  switch (type) {
    case "identity":
      return formatIdentity(data);
    case "revenue":
      return formatRevenue(data);
    case "entities":
      return formatEntities(data);
    case "journey":
      return formatJourney(data);
    case "outcomes":
      return formatOutcomes(data);
    case "metrics":
      return formatMetrics(data);
    default:
      return `### ${capitalise(type)}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }
}

// ---------------------------------------------------------------------------
// Profile overview
// ---------------------------------------------------------------------------

const ALL_SECTIONS = [
  "identity",
  "revenue",
  "entities",
  "journey",
  "outcomes",
  "metrics",
] as const;

const ALL_DEFINITIONS = [
  "activation",
  "firstValue",
  "active",
  "atRisk",
  "churn",
] as const;

export function formatProfileOverview(profile: ProductProfile): string {
  const name =
    (profile.identity as { productName?: string } | undefined)?.productName ??
    "Unknown Product";
  const completeness = Math.round((profile.completeness ?? 0) * 100);
  const confidence = Math.round((profile.overallConfidence ?? 0) * 100);

  const lines: string[] = [
    `## ${name} -- Product Profile`,
    "",
    `**Completeness:** ${completeness}% | **Confidence:** ${confidence}%`,
    "",
  ];

  // Top-level sections
  for (const section of ALL_SECTIONS) {
    const data = (profile as Record<string, unknown>)[section];
    if (data) {
      lines.push(formatSectionBrief(section, data), "");
    }
  }

  // Definition sections
  const defs = profile.definitions as Record<string, unknown> | undefined;
  if (defs) {
    for (const def of ALL_DEFINITIONS) {
      const data = defs[def];
      if (data) {
        lines.push(formatSectionBrief(def, data), "");
      }
    }
  }

  // Missing sections
  const missing: string[] = [];
  for (const section of ALL_SECTIONS) {
    if (!(profile as Record<string, unknown>)[section]) {
      missing.push(capitalise(section));
    }
  }
  for (const def of ALL_DEFINITIONS) {
    if (!defs || !defs[def]) {
      missing.push(capitalise(def));
    }
  }
  if (missing.length > 0) {
    lines.push("### Missing Sections", "");
    for (const m of missing) lines.push(`- ${m}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Brief section formatter (for overview)
// ---------------------------------------------------------------------------

function formatSectionBrief(type: string, data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;

  switch (type) {
    case "identity": {
      const id = d as {
        productName?: string;
        targetCustomer?: string;
        businessModel?: string;
        confidence?: number;
      };
      return `### Identity\n**Product:** ${id.productName ?? "?"} | **Customer:** ${id.targetCustomer ?? "?"} | **Model:** ${id.businessModel ?? "?"} | **Confidence:** ${Math.round((id.confidence ?? 0) * 100)}%`;
    }
    case "revenue": {
      const rev = d as {
        model?: string;
        hasFreeTier?: boolean;
        tiers?: Array<{ name: string }>;
        confidence?: number;
      };
      const tierNames = rev.tiers?.map((t) => t.name).join(", ") ?? "none";
      return `### Revenue\n**Model:** ${rev.model ?? "?"} | **Free Tier:** ${rev.hasFreeTier ? "Yes" : "No"} | **Tiers:** ${tierNames} | **Confidence:** ${Math.round((rev.confidence ?? 0) * 100)}%`;
    }
    case "entities": {
      const ent = d as {
        items?: unknown[];
        relationships?: unknown[];
        confidence?: number;
      };
      return `### Entities\n**Items:** ${ent.items?.length ?? 0} | **Relationships:** ${ent.relationships?.length ?? 0} | **Confidence:** ${Math.round((ent.confidence ?? 0) * 100)}%`;
    }
    case "journey": {
      const j = d as {
        stages?: Array<{ name: string; order: number }>;
        confidence?: number;
      };
      const stages = j.stages
        ? [...j.stages].sort((a, b) => a.order - b.order).map((s) => s.name).join(" -> ")
        : "none";
      return `### Journey\n**Stages:** ${stages} | **Confidence:** ${Math.round((j.confidence ?? 0) * 100)}%`;
    }
    case "outcomes": {
      const o = d as { items?: unknown[]; confidence?: number };
      return `### Outcomes\n**Items:** ${o.items?.length ?? 0} | **Confidence:** ${Math.round((o.confidence ?? 0) * 100)}%`;
    }
    case "metrics": {
      const m = d as { items?: unknown[]; confidence?: number };
      return `### Metrics\n**Items:** ${m.items?.length ?? 0} | **Confidence:** ${Math.round((m.confidence ?? 0) * 100)}%`;
    }
    case "activation": {
      if (isMultiLevel(d)) {
        const ml = d as {
          levels: unknown[];
          overallConfidence?: number;
        };
        return `### Activation\n**Levels:** ${ml.levels.length} | **Confidence:** ${Math.round((ml.overallConfidence ?? 0) * 100)}%`;
      }
      const leg = d as { criteria?: string[]; confidence?: number };
      return `### Activation\n**Criteria:** ${leg.criteria?.length ?? 0} | **Confidence:** ${Math.round((leg.confidence ?? 0) * 100)}%`;
    }
    default: {
      // firstValue, active, atRisk, churn
      const def = d as { criteria?: string[]; confidence?: number };
      return `### ${capitalise(type)}\n**Criteria:** ${def.criteria?.length ?? 0} | **Confidence:** ${Math.round((def.confidence ?? 0) * 100)}%`;
    }
  }
}

// ---------------------------------------------------------------------------
// Completeness change
// ---------------------------------------------------------------------------

export function formatCompletenessChange(
  before: number,
  after: number
): string {
  const b = Math.round(before * 100);
  const a = Math.round(after * 100);
  if (b === a) return `Completeness: ${a}% (unchanged)`;
  return `Completeness: ${b}% -> ${a}%`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalise(s: string): string {
  if (s === "firstValue") return "First Value";
  if (s === "atRisk") return "At Risk";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
