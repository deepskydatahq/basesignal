/**
 * Pure functions for suggesting metrics based on business model.
 *
 * Two main exports:
 * - classifyArchetype: maps identity + revenue data to a business archetype
 * - selectMetrics: filters METRIC_CATALOG by archetype to produce suggestions
 */

// === Types ===

export type Archetype =
  | "plg"           // Product-led growth (self-serve, freemium/free trial)
  | "sales_led"     // Sales-led (enterprise, demo-driven)
  | "marketplace"   // Two-sided marketplace
  | "ecommerce"     // E-commerce / transactional
  | "usage_based";  // Usage/consumption-based pricing

export type MetricCategory =
  | "reach"
  | "engagement"
  | "retention"
  | "revenue"
  | "value";

export interface SuggestedMetric {
  name: string;
  category: MetricCategory;
  formula?: string;
  linkedTo: string[];
}

export interface ProfileIdentity {
  businessModel: string;
  productName?: string;
  targetCustomer?: string;
  industry?: string;
}

export interface ProfileRevenue {
  model: string;
  hasFreeTier?: boolean;
  billingUnit?: string;
}

// === classifyArchetype ===

const PLG_KEYWORDS = [
  "plg", "product-led", "product led", "self-serve", "self serve",
  "freemium", "free trial", "bottom-up", "bottom up",
];

const SALES_LED_KEYWORDS = [
  "sales-led", "sales led", "enterprise", "demo",
  "contact sales", "custom pricing", "contract",
];

const MARKETPLACE_KEYWORDS = [
  "marketplace", "two-sided", "two sided", "platform",
  "supply and demand", "buyer and seller",
];

const ECOMMERCE_KEYWORDS = [
  "ecommerce", "e-commerce", "retail", "store",
  "shopping", "cart", "checkout",
];

const USAGE_KEYWORDS = [
  "usage-based", "usage based", "consumption", "pay-as-you-go",
  "pay as you go", "metered", "per-unit",
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Classify a product into a business archetype based on identity and revenue data.
 *
 * Priority: explicit keyword matches in businessModel string first,
 * then fallback to revenue model + freeTier signals.
 */
export function classifyArchetype(
  identity: ProfileIdentity,
  revenue?: ProfileRevenue,
): Archetype {
  const bm = identity.businessModel;

  // Check explicit keyword matches (order matters — more specific first)
  if (matchesKeywords(bm, MARKETPLACE_KEYWORDS)) return "marketplace";
  if (matchesKeywords(bm, ECOMMERCE_KEYWORDS)) return "ecommerce";
  if (matchesKeywords(bm, USAGE_KEYWORDS)) return "usage_based";
  if (matchesKeywords(bm, PLG_KEYWORDS)) return "plg";
  if (matchesKeywords(bm, SALES_LED_KEYWORDS)) return "sales_led";

  // Fallback: infer from revenue model
  if (revenue) {
    const rm = revenue.model.toLowerCase();
    if (rm.includes("marketplace") || rm.includes("commission") || rm.includes("take rate")) {
      return "marketplace";
    }
    if (rm.includes("transaction") || rm.includes("ecommerce") || rm.includes("e-commerce")) {
      return "ecommerce";
    }
    if (rm.includes("usage") || rm.includes("consumption") || rm.includes("metered")) {
      return "usage_based";
    }
    // subscription with free tier → PLG
    if (rm.includes("subscription") && revenue.hasFreeTier) {
      return "plg";
    }
    // subscription without free tier → sales-led
    if (rm.includes("subscription") && !revenue.hasFreeTier) {
      return "sales_led";
    }
  }

  // Default: SaaS without strong signals → PLG (most common)
  return "plg";
}

// === METRIC_CATALOG ===

interface CatalogMetric {
  name: string;
  category: MetricCategory;
  formula?: string;
  linkedTo: string[];
  archetypes: Archetype[]; // which archetypes this metric applies to
}

const ALL_ARCHETYPES: Archetype[] = ["plg", "sales_led", "marketplace", "ecommerce", "usage_based"];

export const METRIC_CATALOG: CatalogMetric[] = [
  // === Reach ===
  {
    name: "New Signups",
    category: "reach",
    formula: "count(signups) per period",
    linkedTo: ["acquisition", "signup"],
    archetypes: ALL_ARCHETYPES,
  },
  {
    name: "Activation Rate",
    category: "reach",
    formula: "activated users / signups",
    linkedTo: ["activation", "onboarding"],
    archetypes: ["plg", "marketplace", "usage_based"],
  },
  {
    name: "Qualified Leads",
    category: "reach",
    formula: "count(leads meeting ICP criteria) per period",
    linkedTo: ["acquisition", "lead qualification"],
    archetypes: ["sales_led"],
  },
  {
    name: "SQL-to-Opportunity Rate",
    category: "reach",
    formula: "opportunities created / SQLs",
    linkedTo: ["sales pipeline", "qualification"],
    archetypes: ["sales_led"],
  },

  // === Engagement ===
  {
    name: "DAU/MAU Ratio",
    category: "engagement",
    formula: "daily active users / monthly active users",
    linkedTo: ["active", "usage intensity"],
    archetypes: ["plg", "marketplace", "usage_based"],
  },
  {
    name: "Core Action Frequency",
    category: "engagement",
    formula: "count(core actions) / active users per period",
    linkedTo: ["active", "feature adoption"],
    archetypes: ["plg", "usage_based"],
  },
  {
    name: "Feature Adoption Rate",
    category: "engagement",
    formula: "users using feature / total active users",
    linkedTo: ["feature adoption", "active"],
    archetypes: ALL_ARCHETYPES,
  },
  {
    name: "Liquidity Rate",
    category: "engagement",
    formula: "listings with at least one transaction / total listings",
    linkedTo: ["marketplace health", "supply utilization"],
    archetypes: ["marketplace"],
  },

  // === Retention ===
  {
    name: "Day-7 Retention",
    category: "retention",
    formula: "users active on day 7 / users who signed up",
    linkedTo: ["retention", "activation"],
    archetypes: ["plg", "marketplace", "usage_based"],
  },
  {
    name: "Net Revenue Retention",
    category: "retention",
    formula: "(starting MRR + expansion - contraction - churn) / starting MRR",
    linkedTo: ["retention", "expansion", "churn"],
    archetypes: ["plg", "sales_led", "usage_based"],
  },
  {
    name: "Logo Retention Rate",
    category: "retention",
    formula: "accounts retained / accounts at start of period",
    linkedTo: ["churn", "retention"],
    archetypes: ["sales_led"],
  },
  {
    name: "Repeat Purchase Rate",
    category: "retention",
    formula: "customers with 2+ purchases / total customers",
    linkedTo: ["retention", "purchase"],
    archetypes: ["ecommerce"],
  },

  // === Revenue ===
  {
    name: "MRR Growth Rate",
    category: "revenue",
    formula: "(MRR this month - MRR last month) / MRR last month",
    linkedTo: ["revenue", "growth"],
    archetypes: ["plg", "sales_led", "usage_based"],
  },
  {
    name: "Trial-to-Paid Conversion",
    category: "revenue",
    formula: "paid conversions / trial starts",
    linkedTo: ["conversion", "activation"],
    archetypes: ["plg"],
  },
  {
    name: "Average Deal Size",
    category: "revenue",
    formula: "total contract value / number of deals closed",
    linkedTo: ["revenue", "sales pipeline"],
    archetypes: ["sales_led"],
  },
  {
    name: "Gross Merchandise Value",
    category: "revenue",
    formula: "total value of transactions on platform",
    linkedTo: ["revenue", "marketplace health"],
    archetypes: ["marketplace"],
  },
  {
    name: "Take Rate",
    category: "revenue",
    formula: "platform revenue / GMV",
    linkedTo: ["revenue", "monetization"],
    archetypes: ["marketplace"],
  },
  {
    name: "Average Order Value",
    category: "revenue",
    formula: "total revenue / number of orders",
    linkedTo: ["revenue", "purchase"],
    archetypes: ["ecommerce"],
  },
  {
    name: "Revenue per User",
    category: "revenue",
    formula: "total revenue / active users",
    linkedTo: ["revenue", "monetization"],
    archetypes: ["usage_based"],
  },

  // === Value ===
  {
    name: "Time to First Value",
    category: "value",
    formula: "median(time from signup to first value moment)",
    linkedTo: ["activation", "firstValue"],
    archetypes: ["plg", "usage_based"],
  },
  {
    name: "Time to Deploy",
    category: "value",
    formula: "median(time from contract signed to go-live)",
    linkedTo: ["onboarding", "firstValue"],
    archetypes: ["sales_led"],
  },
  {
    name: "Buyer Satisfaction Score",
    category: "value",
    formula: "survey score or NPS from buyers",
    linkedTo: ["value delivery", "marketplace health"],
    archetypes: ["marketplace"],
  },
  {
    name: "Cart Abandonment Rate",
    category: "value",
    formula: "carts abandoned / carts created",
    linkedTo: ["conversion", "checkout"],
    archetypes: ["ecommerce"],
  },
];

// === selectMetrics ===

/**
 * Select metrics from the catalog that apply to the given archetype.
 * Returns them as SuggestedMetric[] (without the archetypes field).
 */
export function selectMetrics(archetype: Archetype): SuggestedMetric[] {
  return METRIC_CATALOG
    .filter((m) => m.archetypes.includes(archetype))
    .map(({ name, category, formula, linkedTo }) => ({
      name,
      category,
      formula,
      linkedTo,
    }));
}
