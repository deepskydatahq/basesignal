/** Source evidence linking a data point to a crawled page. */
export interface Evidence {
  url: string;
  excerpt: string;
}

/** Signal strength for activation levels. */
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

/** Qualitative confidence level for lens candidates. */
export type ConfidenceLevel = "high" | "medium" | "low";
