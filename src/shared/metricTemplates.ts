// Metric templates for auto-generating the metric catalog
// Templates use placeholders that get replaced with personalized activity names:
// - {{firstValueActivity}} → Activation activity from first_value journey
// - {{coreAction}} → Core usage activity from overview journey
// - {{productName}} → User's product name

export const METRIC_CATEGORIES = [
  "reach",
  "engagement",
  "value_delivery",
  "value_capture",
] as const;

export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

export type MetricTemplate = {
  key: string;
  name: string;
  definition: string;
  formula: string;
  whyItMatters: string;
  howToImprove: string;
  category: MetricCategory;
  generatedAfter: "overview" | "first_value";
};

export const METRIC_TEMPLATES: MetricTemplate[] = [
  // Overview metrics (generated after Overview Interview)
  {
    key: "new_users",
    name: "New Users",
    definition:
      "Count of new accounts created in a given time period. This is the top of your acquisition funnel.",
    formula: "COUNT(accounts WHERE created_at IN period)",
    whyItMatters:
      "New users represent your acquisition health. A declining trend may indicate market saturation, ineffective marketing, or competitive pressure.",
    howToImprove:
      "Increase marketing spend, improve landing page conversion, expand to new channels, or leverage referral programs.",
    category: "reach",
    generatedAfter: "overview",
  },
  {
    key: "mau",
    name: "Monthly Active Users",
    definition:
      "Count of unique users who performed any tracked activity in the last 30 days.",
    formula: "COUNT(DISTINCT user_id WHERE activity_date >= NOW() - 30 days)",
    whyItMatters:
      "MAU shows the size of your engaged user base. It's a key indicator of product stickiness and market penetration.",
    howToImprove:
      "Focus on activation (getting new users to first value), re-engagement campaigns for dormant users, and reducing churn.",
    category: "engagement",
    generatedAfter: "overview",
  },
  {
    key: "dau",
    name: "Daily Active Users",
    definition:
      "Count of unique users who performed any tracked activity on a given day.",
    formula: "COUNT(DISTINCT user_id WHERE activity_date = date)",
    whyItMatters:
      "DAU indicates daily engagement intensity. Products with high daily utility should see strong DAU numbers.",
    howToImprove:
      "Add daily-use features, implement notifications/reminders, create habits through streaks or daily rewards.",
    category: "engagement",
    generatedAfter: "overview",
  },
  {
    key: "dau_mau_ratio",
    name: "DAU/MAU Ratio",
    definition:
      "The percentage of monthly active users who are active on any given day. Also called 'stickiness'.",
    formula: "DAU / MAU × 100%",
    whyItMatters:
      "A higher ratio means users return more frequently. Social apps often see 50%+, while monthly tools might see 10-20%.",
    howToImprove:
      "Identify what brings power users back daily and replicate those features/experiences for other users.",
    category: "engagement",
    generatedAfter: "overview",
  },
  {
    key: "retention_d7",
    name: "7-Day Retention",
    definition:
      "Percentage of users who return to the product within 7 days of their first activity.",
    formula:
      "COUNT(users active on day 7) / COUNT(users who signed up 7 days ago) × 100%",
    whyItMatters:
      "Early retention is critical—users who return in week 1 are much more likely to become long-term users.",
    howToImprove:
      "Improve onboarding, send re-engagement emails, ensure users reach first value quickly.",
    category: "engagement",
    generatedAfter: "overview",
  },
  {
    key: "core_action_frequency",
    name: "Core Action Frequency",
    definition:
      "Average number of times users perform your core action per period. Measures depth of engagement with your primary value.",
    formula:
      "COUNT(core_action events) / COUNT(active users) per period",
    whyItMatters:
      "Users who perform your core action more frequently derive more value and are less likely to churn.",
    howToImprove:
      "Remove friction from the core action, add features that encourage repeated use, surface relevant prompts.",
    category: "engagement",
    generatedAfter: "overview",
  },

  // First Value metrics (generated after first_value interview)
  {
    key: "activation_rate",
    name: "Activation Rate",
    definition:
      "Percentage of new users who complete {{firstValueActivity}}. This is your first value delivery checkpoint.",
    formula:
      "COUNT(users who completed {{firstValueActivity}}) / COUNT(new users) × 100%",
    whyItMatters:
      "Users who reach first value are dramatically more likely to become long-term customers. Low activation = leaky bucket.",
    howToImprove:
      "Simplify onboarding, remove steps before first value, add progress indicators, provide guided walkthroughs.",
    category: "value_delivery",
    generatedAfter: "first_value",
  },
  {
    key: "time_to_first_value",
    name: "Time to First Value",
    definition:
      "Median time from account creation to completing {{firstValueActivity}}. Measures how quickly users experience value.",
    formula: "MEDIAN(time_of_{{firstValueActivity}} - time_of_signup)",
    whyItMatters:
      "Shorter time to value means faster activation and higher conversion. Every extra day loses potential users.",
    howToImprove:
      "Reduce signup friction, pre-populate data, offer templates, provide immediate quick wins.",
    category: "value_delivery",
    generatedAfter: "first_value",
  },
];

// Helper to get templates by generation phase
export function getTemplatesByPhase(
  phase: "overview" | "first_value"
): MetricTemplate[] {
  return METRIC_TEMPLATES.filter((t) => t.generatedAfter === phase);
}

// Helper to get a template by key
export function getTemplateByKey(key: string): MetricTemplate | undefined {
  return METRIC_TEMPLATES.find((t) => t.key === key);
}

// Convenience getters matching the implementation plan naming
export function getOverviewTemplates(): MetricTemplate[] {
  return getTemplatesByPhase("overview");
}

export function getFirstValueTemplates(): MetricTemplate[] {
  return getTemplatesByPhase("first_value");
}

export function getAllTemplates(): MetricTemplate[] {
  return [...METRIC_TEMPLATES];
}

// Template interpolation types and functions
export type TemplateSlots = {
  productName: string;
  coreAction?: string; // from core_usage stage
  firstValueActivity?: string; // from first_value activation stage
};

export type InterpolatedTemplate = Omit<MetricTemplate, "generatedAfter">;

/**
 * Replaces {{slotName}} placeholders in template fields with actual values.
 * Missing optional slots are replaced with a generic fallback.
 */
export function interpolateTemplate(
  template: MetricTemplate,
  slots: TemplateSlots
): InterpolatedTemplate {
  const replacements: Record<string, string> = {
    "{{productName}}": slots.productName,
    "{{coreAction}}": slots.coreAction ?? "core action",
    "{{firstValueActivity}}": slots.firstValueActivity ?? "first value action",
  };

  const interpolate = (text: string): string => {
    let result = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replaceAll(placeholder, value);
    }
    return result;
  };

  return {
    key: template.key,
    name: interpolate(template.name),
    definition: interpolate(template.definition),
    formula: interpolate(template.formula),
    whyItMatters: interpolate(template.whyItMatters),
    howToImprove: interpolate(template.howToImprove),
    category: template.category,
  };
}

/**
 * Interpolates all templates with the given slots.
 */
export function interpolateTemplates(
  templates: MetricTemplate[],
  slots: TemplateSlots
): InterpolatedTemplate[] {
  return templates.map((t) => interpolateTemplate(t, slots));
}

// Category display information for UI
export const CATEGORY_INFO: Record<
  MetricCategory,
  { label: string; color: string }
> = {
  reach: { label: "Reach", color: "blue" },
  engagement: { label: "Engagement", color: "green" },
  value_delivery: { label: "Value Delivery", color: "purple" },
  value_capture: { label: "Value Capture", color: "orange" },
};
