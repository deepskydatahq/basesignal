import type { PricingMetadata, PricingTier } from "./types";

/**
 * Parse pricing page content (text/markdown) into structured pricing metadata.
 *
 * Strategy: cascading extraction with confidence scoring.
 *   1. Split content into sections by headings
 *   2. Look for price patterns ($X, X/mo, Free, Custom, Contact Sales)
 *   3. Extract tier names from headings near prices
 *   4. Extract feature lists (bullet items) near tier names
 *   5. Detect billing toggles and billing units
 *   6. Score confidence based on how much structure was found
 */
export function parsePricingContent(content: string): PricingMetadata {
  if (!content.trim()) {
    return {
      tiers: [],
      hasFreeTier: false,
      hasTrialMention: false,
      billingOptions: [],
      hasEnterpriseTier: false,
      parseConfidence: 0,
    };
  }

  const tiers = extractTiers(content);
  const billingOptions = extractBillingOptions(content);
  const billingUnit = extractBillingUnit(content);
  const hasTrialMention = detectTrialMention(content);

  const hasFreeTier = tiers.some(
    (t) => t.price === 0 || /^free$/i.test(t.priceDisplay.trim())
  );
  const hasEnterpriseTier = tiers.some(
    (t) =>
      t.price === null &&
      /enterprise|custom|contact/i.test(t.name + " " + t.priceDisplay)
  );

  const parseConfidence = calculateConfidence(
    tiers,
    billingOptions,
    billingUnit
  );

  return {
    tiers,
    hasFreeTier,
    hasTrialMention,
    billingOptions,
    hasEnterpriseTier,
    billingUnit,
    parseConfidence,
  };
}

// --- Price Pattern Matching ---

/** Matches $X or $X.XX optionally followed by /period or /unit/period */
const DOLLAR_PRICE_PATTERN =
  /\$(\d+(?:\.\d{1,2})?)\s*(?:\/\s*(\w+)(?:\s*\/\s*(\w+))?)?/;

/** Matches standalone "Free" */
const FREE_PATTERN = /\bfree\b/i;

/** Matches "Contact Sales", "Contact Us", "Custom pricing", etc. */
const CONTACT_PATTERN =
  /\b(?:contact\s+(?:sales|us)|custom(?:\s+pricing)?|get\s+(?:a\s+)?quote)\b/i;

/** Matches period indicators */
const PERIOD_MONTH_PATTERN = /\b(?:mo(?:nth)?|monthly)\b/i;
const PERIOD_YEAR_PATTERN = /\b(?:yr|year|yearly|annual(?:ly)?)\b/i;

/** Matches billing unit indicators near prices */
const BILLING_UNIT_PATTERN =
  /(?:\/|\bper\s+)(seat|user|member|editor|agent|project|workspace)\b/i;

/** Matches "per X per month" pattern */
const PER_UNIT_PER_PERIOD_PATTERN =
  /\bper\s+(seat|user|member|editor|agent|project|workspace)\s+per\s+(month|year|mo|yr)\b/i;

// --- Section Splitting ---

interface Section {
  heading: string;
  body: string;
}

/**
 * Split content into sections by markdown headings (## or ###).
 * Each section has a heading and the body text until the next heading.
 */
function splitIntoSections(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Don't forget the last section
  if (currentHeading || currentBody.length > 0) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Extract features from a text block. Features are bullet list items.
 */
function extractFeatures(body: string): string[] {
  const features: string[] = [];
  const lines = body.split("\n");

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const feature = bulletMatch[1].trim();
      if (feature.length > 0 && feature.length < 200) {
        features.push(feature);
      }
    }
  }

  return features;
}

/**
 * Determine the billing period from text near a price.
 */
function detectPeriod(text: string): "month" | "year" | undefined {
  if (PERIOD_MONTH_PATTERN.test(text)) return "month";
  if (PERIOD_YEAR_PATTERN.test(text)) return "year";
  return undefined;
}

/**
 * Parse a price string from a section body.
 * Returns { price, priceDisplay, period } or null if no price found.
 */
function parsePrice(body: string): {
  price: number | null;
  priceDisplay: string;
  period?: "month" | "year";
} | null {
  // Check for dollar price first (more specific)
  const dollarMatch = body.match(DOLLAR_PRICE_PATTERN);
  if (dollarMatch) {
    const amount = parseFloat(dollarMatch[1]);
    const priceDisplay = dollarMatch[0];

    // Determine period from the captured groups or surrounding text
    const afterPrice = dollarMatch[2] || "";
    const afterUnit = dollarMatch[3] || "";

    // Check captured period parts first, then surrounding text
    const periodText = afterPrice + " " + afterUnit + " " + body;
    const period = detectPeriod(periodText);

    return { price: amount, priceDisplay, period };
  }

  // Check for "Contact Sales" / "Custom"
  const contactMatch = body.match(CONTACT_PATTERN);
  if (contactMatch) {
    return {
      price: null,
      priceDisplay: contactMatch[0],
    };
  }

  // Check for standalone "Free"
  if (FREE_PATTERN.test(body)) {
    // Make sure it's not just "free trial" -- check the immediate context
    const freeTrialPattern = /\bfree\s+trial\b/i;
    const lines = body.split("\n");
    for (const line of lines) {
      if (FREE_PATTERN.test(line) && !freeTrialPattern.test(line)) {
        return { price: 0, priceDisplay: "Free" };
      }
    }
  }

  return null;
}

// --- Tier Extraction ---

/**
 * Extract pricing tiers from content.
 *
 * Primary strategy: Split by headings, look for price in each section.
 * Fallback: Look for price patterns anywhere and create unnamed tiers.
 */
function extractTiers(content: string): PricingTier[] {
  const sections = splitIntoSections(content);
  const tiers: PricingTier[] = [];

  // Strategy 1: Section-based extraction (headings with prices)
  for (const section of sections) {
    if (!section.heading) continue;

    const priceInfo = parsePrice(section.body);
    if (!priceInfo) continue;

    const features = extractFeatures(section.body);

    tiers.push({
      name: section.heading,
      price: priceInfo.price,
      priceDisplay: priceInfo.priceDisplay,
      period: priceInfo.period,
      features,
    });
  }

  // If we found tiers via headings, return them
  if (tiers.length > 0) return tiers;

  // Strategy 2: Fallback -- look for price patterns without heading structure
  // This handles cases where the content is unstructured text
  // We won't create tiers from raw text since we can't reliably name them
  // The confidence score will be low for these cases
  return tiers;
}

// --- Billing Options ---

/**
 * Detect available billing options from content.
 * Looks for toggle text like "Monthly", "Annual", "Billed annually".
 */
function extractBillingOptions(content: string): string[] {
  const options: string[] = [];
  const lower = content.toLowerCase();

  if (/\b(?:monthly|billed?\s+monthly|\/mo(?:nth)?)\b/.test(lower)) {
    options.push("monthly");
  }
  if (
    /\b(?:annual(?:ly)?|yearly|billed?\s+annual(?:ly)?|billed?\s+yearly|\/yr|\/year)\b/.test(
      lower
    )
  ) {
    options.push("annual");
  }

  return options;
}

// --- Billing Unit ---

/**
 * Detect the billing unit from content (e.g., "per seat", "/user").
 */
function extractBillingUnit(content: string): string | undefined {
  // Check "per unit per period" pattern first
  const perUnitMatch = content.match(PER_UNIT_PER_PERIOD_PATTERN);
  if (perUnitMatch) return perUnitMatch[1].toLowerCase();

  // Check "/unit" or "per unit" pattern
  const unitMatch = content.match(BILLING_UNIT_PATTERN);
  if (unitMatch) return unitMatch[1].toLowerCase();

  return undefined;
}

// --- Trial Detection ---

/**
 * Detect if a trial is mentioned in the content.
 */
function detectTrialMention(content: string): boolean {
  return /\b(?:free\s+trial|trial\s+(?:period|available|included)|try\s+(?:it\s+)?(?:free|for\s+free)|start\s+(?:your\s+)?(?:free\s+)?trial|\d+-day\s+(?:free\s+)?trial)\b/i.test(
    content
  );
}

// --- Confidence ---

/**
 * Calculate confidence score based on extraction results.
 * Higher scores when more structure is detected.
 */
function calculateConfidence(
  tiers: PricingTier[],
  billingOptions: string[],
  billingUnit: string | undefined
): number {
  let confidence = 0;

  // Found any tiers at all
  if (tiers.length > 0) confidence += 0.4;
  // Found multiple tiers (typical pricing page has 2-4)
  if (tiers.length >= 2) confidence += 0.1;
  // Tiers have prices
  if (
    tiers.some(
      (t) => t.price !== null || t.priceDisplay.toLowerCase() === "free"
    )
  )
    confidence += 0.15;
  // Tiers have features
  if (tiers.some((t) => t.features.length > 0)) confidence += 0.15;
  // Billing options detected
  if (billingOptions.length > 0) confidence += 0.1;
  // Billing unit detected
  if (billingUnit) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
