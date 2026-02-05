/**
 * Activation Level Extraction Accuracy Test Script
 *
 * Tests the extractActivationLevels action against known products and validates
 * the output using a structured rubric.
 *
 * Run with: npx tsx scripts/test-activation-accuracy.ts
 *
 * Prerequisites:
 * - VITE_CONVEX_URL environment variable set
 * - Products must already exist and have been scanned (have crawledPages)
 * - Requires Convex deployment access for internal actions
 *
 * Note: This script cannot call internal actions directly via HTTP client.
 * It's designed to:
 * 1. Display existing activation extraction results
 * 2. Score them against the validation rubric
 * 3. Document improvements needed
 *
 * For actual extraction testing, use the Convex dashboard or run in Convex shell.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// ============================================================================
// Configuration
// ============================================================================

interface TestProduct {
  name: string;
  url: string;
  archetype: "collaboration" | "productivity" | "design" | "developer" | "communication";
  expectedAhaMoment: string;
}

// Target products for validation testing
const TEST_PRODUCTS: TestProduct[] = [
  {
    name: "Miro",
    url: "https://miro.com",
    archetype: "collaboration",
    expectedAhaMoment: "Board shared + collaborator accesses it",
  },
  {
    name: "Linear",
    url: "https://linear.app",
    archetype: "productivity",
    expectedAhaMoment: "First issue tracked through completion",
  },
  {
    name: "Figma",
    url: "https://figma.com",
    archetype: "design",
    expectedAhaMoment: "Design shared + feedback received",
  },
];

// ============================================================================
// Validation Rubric
// ============================================================================

interface RubricScore {
  logicalProgression: number; // 0-3
  measurableCriteria: number; // 0-3
  primaryAlignment: number; // 0-3
  evidenceQuality: number; // 0-3
  total: number; // 0-12
  rating: "Accurate" | "Mostly Accurate" | "Inaccurate";
  observations: string[];
}

interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: string;
  criteria: Array<{ action: string; count: number; timeWindow?: string }>;
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

interface ActivationData {
  criteria?: string[];
  timeWindow?: string;
  reasoning?: string;
  confidence?: number;
  source?: string;
  evidence?: Array<{ url: string; excerpt: string }>;
  levels?: ActivationLevel[];
  primaryActivation?: number;
}

function scoreActivationResult(
  activation: ActivationData | undefined,
  testProduct: TestProduct
): RubricScore {
  const observations: string[] = [];
  let logicalProgression = 0;
  let measurableCriteria = 0;
  let primaryAlignment = 0;
  let evidenceQuality = 0;

  if (!activation || !activation.levels || activation.levels.length === 0) {
    observations.push("No activation levels extracted");
    return {
      logicalProgression: 0,
      measurableCriteria: 0,
      primaryAlignment: 0,
      evidenceQuality: 0,
      total: 0,
      rating: "Inaccurate",
      observations,
    };
  }

  const levels = activation.levels;

  // 1. Logical Progression (0-3)
  const signalOrder = ["weak", "medium", "strong", "very_strong"];
  let isOrdered = true;
  for (let i = 1; i < levels.length; i++) {
    const prevStrength = signalOrder.indexOf(levels[i - 1].signalStrength);
    const currStrength = signalOrder.indexOf(levels[i].signalStrength);
    if (currStrength < prevStrength) {
      isOrdered = false;
      break;
    }
  }

  if (levels.length >= 3 && isOrdered) {
    logicalProgression = 3;
    observations.push("✓ Clear progression from weak → strong signals");
  } else if (levels.length >= 2) {
    logicalProgression = 2;
    observations.push("~ Progression exists but could be clearer");
  } else {
    logicalProgression = 1;
    observations.push("✗ Weak or missing progression");
  }

  // 2. Measurable Criteria (0-3)
  const allCriteriaMeasurable = levels.every((level) =>
    level.criteria.every(
      (c) =>
        typeof c.action === "string" &&
        c.action.length > 0 &&
        typeof c.count === "number" &&
        c.count > 0
    )
  );

  const hasCriteria = levels.every((level) => level.criteria.length > 0);

  if (allCriteriaMeasurable && hasCriteria) {
    measurableCriteria = 3;
    observations.push("✓ All criteria have specific action + count");
  } else if (hasCriteria) {
    measurableCriteria = 2;
    observations.push("~ Most criteria measurable, some vague");
  } else {
    measurableCriteria = 1;
    observations.push("✗ Criteria are vague or missing");
  }

  // 3. Primary Activation Alignment (0-3)
  const primaryLevel = levels.find(
    (l) => l.level === activation.primaryActivation
  );

  if (primaryLevel) {
    // Check if primary aligns with expected aha-moment based on archetype
    const primaryName = primaryLevel.name.toLowerCase();
    const primaryReasoning = primaryLevel.reasoning.toLowerCase();

    const archetypeKeywords: Record<string, string[]> = {
      collaboration: ["share", "collaborat", "team", "together", "access"],
      productivity: ["complete", "workflow", "task", "done", "track"],
      design: ["share", "feedback", "comment", "review", "prototype"],
      developer: ["deploy", "push", "integrate", "ship", "build"],
      communication: ["message", "team", "channel", "conversat", "chat"],
    };

    const keywords = archetypeKeywords[testProduct.archetype] || [];
    const hasRelevantKeywords = keywords.some(
      (kw) => primaryName.includes(kw) || primaryReasoning.includes(kw)
    );

    if (hasRelevantKeywords && primaryLevel.signalStrength === "strong") {
      primaryAlignment = 3;
      observations.push(
        `✓ Primary activation correctly identifies ${testProduct.archetype} aha-moment`
      );
    } else if (hasRelevantKeywords || primaryLevel.signalStrength === "strong") {
      primaryAlignment = 2;
      observations.push("~ Primary activation is close but slightly off");
    } else {
      primaryAlignment = 1;
      observations.push(
        `✗ Primary activation misses ${testProduct.archetype} value prop`
      );
    }
  } else {
    primaryAlignment = 0;
    observations.push("✗ No primary activation identified");
  }

  // 4. Evidence Quality (0-3)
  const totalEvidence = levels.reduce(
    (sum, l) => sum + (l.evidence?.length || 0),
    0
  );
  const avgEvidencePerLevel = totalEvidence / levels.length;

  if (avgEvidencePerLevel >= 1.5) {
    evidenceQuality = 3;
    observations.push("✓ Strong evidence supporting each level");
  } else if (avgEvidencePerLevel >= 0.5) {
    evidenceQuality = 2;
    observations.push("~ Some evidence, could be stronger");
  } else {
    evidenceQuality = 1;
    observations.push("✗ Weak or missing evidence");
  }

  const total =
    logicalProgression + measurableCriteria + primaryAlignment + evidenceQuality;
  const rating: "Accurate" | "Mostly Accurate" | "Inaccurate" =
    total >= 10 ? "Accurate" : total >= 6 ? "Mostly Accurate" : "Inaccurate";

  return {
    logicalProgression,
    measurableCriteria,
    primaryAlignment,
    evidenceQuality,
    total,
    rating,
    observations,
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

function displayActivationLevels(activation: ActivationData | undefined): void {
  if (!activation || !activation.levels) {
    console.log("  No activation levels found");
    return;
  }

  console.log(`  Primary Activation: Level ${activation.primaryActivation}`);
  console.log(`  Overall Confidence: ${activation.confidence?.toFixed(2) || "N/A"}`);
  console.log("");

  for (const level of activation.levels) {
    const isPrimary = level.level === activation.primaryActivation ? " ★" : "";
    console.log(
      `  L${level.level} (${level.signalStrength}): ${level.name}${isPrimary}`
    );
    console.log(`    Criteria:`);
    for (const c of level.criteria) {
      const tw = c.timeWindow ? ` within ${c.timeWindow}` : "";
      console.log(`      - ${c.action} >= ${c.count}${tw}`);
    }
    console.log(`    Reasoning: ${level.reasoning.slice(0, 100)}...`);
    console.log(`    Confidence: ${level.confidence.toFixed(2)}`);
    console.log(`    Evidence: ${level.evidence?.length || 0} items`);
    console.log("");
  }
}

function displayScore(score: RubricScore): void {
  console.log("  Rubric Scores:");
  console.log(`    Logical Progression:    ${score.logicalProgression}/3`);
  console.log(`    Measurable Criteria:    ${score.measurableCriteria}/3`);
  console.log(`    Primary Alignment:      ${score.primaryAlignment}/3`);
  console.log(`    Evidence Quality:       ${score.evidenceQuality}/3`);
  console.log(`    --------------------------`);
  console.log(`    Total:                  ${score.total}/12`);
  console.log(`    Rating:                 ${score.rating}`);
  console.log("");
  console.log("  Observations:");
  for (const obs of score.observations) {
    console.log(`    ${obs}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ VITE_CONVEX_URL environment variable is required");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   Activation Level Extraction Accuracy Test");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Note: This script displays existing extraction results and scores");
  console.log("      them against the validation rubric. To run new extractions,");
  console.log("      use the Convex dashboard or shell.");
  console.log("");

  const client = new ConvexHttpClient(convexUrl);

  const results: Array<{
    product: TestProduct;
    score: RubricScore | null;
    error?: string;
  }> = [];

  // Note: We can't list products without auth, so this is a placeholder
  // In practice, you would:
  // 1. Create products via the UI or with auth
  // 2. Run the scan pipeline
  // 3. Run extractActivationLevels via Convex dashboard
  // 4. Use this script to score the results

  console.log("To run a full validation:");
  console.log("1. Sign in to the app and create products for:", TEST_PRODUCTS.map(p => p.name).join(", "));
  console.log("2. Scan each product URL");
  console.log("3. In Convex dashboard, run extractActivationLevels for each product");
  console.log("4. Run this script again to score the results");
  console.log("");

  // Display expected aha-moments for reference
  console.log("Expected Aha-Moments (Reference):");
  console.log("─────────────────────────────────");
  for (const product of TEST_PRODUCTS) {
    console.log(`  ${product.name} (${product.archetype}): ${product.expectedAhaMoment}`);
  }
  console.log("");

  // Display rubric
  console.log("Validation Rubric:");
  console.log("──────────────────");
  console.log("  Logical Progression (0-3):");
  console.log("    3: Clear progression weak → medium → strong → very_strong");
  console.log("    2: Progression exists but some levels out of order");
  console.log("    1: No clear progression");
  console.log("");
  console.log("  Measurable Criteria (0-3):");
  console.log("    3: Each level has specific action + count criteria");
  console.log("    2: Most criteria measurable");
  console.log("    1: Vague or unmeasurable criteria");
  console.log("");
  console.log("  Primary Alignment (0-3):");
  console.log("    3: Primary activation matches product's known aha-moment");
  console.log("    2: Close but slightly off");
  console.log("    1: Misses core value proposition");
  console.log("");
  console.log("  Evidence Quality (0-3):");
  console.log("    3: Strong evidence (1.5+ per level)");
  console.log("    2: Some evidence (0.5+ per level)");
  console.log("    1: Weak or missing evidence");
  console.log("");
  console.log("  Rating:");
  console.log("    Accurate: 10-12 points");
  console.log("    Mostly Accurate: 6-9 points");
  console.log("    Inaccurate: 0-5 points");
  console.log("");

  // Summary stats (would be populated after actual runs)
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   Summary");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Products Tested: 0");
  console.log("  Accurate: 0 (0%)");
  console.log("  Mostly Accurate: 0 (0%)");
  console.log("  Inaccurate: 0 (0%)");
  console.log("");
  console.log("  Target: 70%+ Accurate or Mostly Accurate");
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

// Export for use as a module
export {
  TEST_PRODUCTS,
  scoreActivationResult,
  displayActivationLevels,
  displayScore,
  type TestProduct,
  type RubricScore,
  type ActivationLevel,
  type ActivationData,
};
