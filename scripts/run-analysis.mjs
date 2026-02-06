// Check analysis results on existing product
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");

async function main() {
  // Use the known product ID from earlier scan
  const productId = "nh78n36ve9dt5q0z2pnj9gadnx80mm54"; // Linear

  console.log("Checking product profile...\n");

  // Check profile using getMcp (doesn't require auth)
  const profile = await client.query(api.productProfiles.getForTest, { productId });

  if (!profile) {
    console.log("No profile found for product");
    console.log("The analysis may not have run yet.");
    return;
  }

  console.log("=== PROFILE ===");
  console.log("ID:", profile._id);
  console.log("Completeness:", profile.completenessPercentage + "%");
  console.log("Overall Confidence:", profile.overallConfidence);
  console.log("Sections:", Object.keys(profile.definitions || {}));

  // Show identity info
  if (profile.definitions?.identity) {
    const id = profile.definitions.identity;
    console.log("\n=== IDENTITY ===");
    console.log("Name:", id.productName);
    console.log("Model:", id.businessModel);
    console.log("Target:", id.targetCustomer);
  }

  // Show activation info
  if (profile.definitions?.activation) {
    const act = profile.definitions.activation;
    console.log("\n=== ACTIVATION ===");

    if (act.levels) {
      console.log("Type: Multi-level (NEW!)");
      console.log("Levels:", act.levels.length);
      console.log("Primary Activation:", act.primaryActivation);
      console.log("Overall Confidence:", act.overallConfidence);

      console.log("\nLevels:");
      for (const level of act.levels) {
        const marker = level.level === act.primaryActivation ? " ⭐ AHA-MOMENT" : "";
        console.log("\n  L" + level.level + ": " + level.name + marker);
        console.log("    Signal Strength: " + level.signalStrength);
        console.log("    Confidence: " + (level.confidence * 100).toFixed(0) + "%");
        console.log("    Reasoning: " + level.reasoning);
        if (level.criteria && level.criteria.length > 0) {
          console.log("    Criteria:");
          for (const c of level.criteria) {
            const tw = c.timeWindow ? " within " + c.timeWindow : "";
            console.log("      • " + c.action + " (x" + c.count + tw + ")");
          }
        }
      }
    } else {
      console.log("Type: Legacy (flat)");
      console.log("Confidence:", act.confidence);
      console.log("Criteria:", act.criteria?.join(", "));
    }
  } else {
    console.log("\n=== ACTIVATION ===");
    console.log("No activation data yet.");
    console.log("The activation extraction may not have run.");
  }
}

main().catch(console.error);
