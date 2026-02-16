/**
 * A single pricing tier extracted from a pricing page.
 */
export interface PricingTier {
  /** Tier name (e.g., "Free", "Pro", "Enterprise"). */
  name: string;
  /** Price as a number, or null for "Contact Sales" / custom pricing. */
  price: number | null;
  /** Price as displayed on the page (e.g., "$29/mo", "Custom", "Free"). */
  priceDisplay: string;
  /** Billing period if detectable. */
  period?: "month" | "year";
  /** Features listed under this tier. */
  features: string[];
}

/**
 * Structured pricing metadata extracted from a pricing page.
 * Stored in CrawledPage.metadata.structuredData.pricing.
 */
export interface PricingMetadata {
  /** Extracted pricing tiers. */
  tiers: PricingTier[];
  /** Whether a free tier (price === 0 or "Free") was detected. */
  hasFreeTier: boolean;
  /** Whether a trial is mentioned on the page. */
  hasTrialMention: boolean;
  /** Available billing options detected (e.g., ["monthly", "annual"]). */
  billingOptions: string[];
  /** Whether an enterprise/custom tier exists. */
  hasEnterpriseTier: boolean;
  /** Billing unit if detectable (e.g., "seat", "user", "project"). */
  billingUnit?: string;
  /** Confidence in the structural extraction (0-1). */
  parseConfidence: number;
}
