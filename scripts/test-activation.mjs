// Test activation extraction with a fresh product scan
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");

async function main() {
  console.log("=== ACTIVATION EXTRACTION TEST ===\n");

  // 1. Get or create test user
  console.log("1. Getting/creating test user...");
  const user = await client.mutation(api.users.getOrCreateByClerkId, {
    clerkId: "user_activation_test",
    email: "activation-test@example.com",
    name: "Activation Test User",
  });
  const userId = user._id;
  console.log("User ID:", userId);

  // 2. Create a new product for Linear (different from Miro)
  console.log("\n2. Creating product for linear.app...");
  const result = await client.mutation(api.mcpProducts.create, {
    userId,
    name: "Linear",
    url: "https://linear.app",
  });
  console.log("Created product:", result.productId);
  const productId = result.productId;

  // 3. Trigger scan
  console.log("\n3. Triggering scan...");
  await client.mutation(api.mcpProducts.scanProduct, {
    userId,
    productId,
  });

  // 4. Poll for completion
  console.log("\n4. Waiting for scan and analysis...");
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const status = await client.query(api.mcpProducts.getScanStatus, {
      userId,
      productId,
    });

    if (!status) {
      console.log("  Poll " + (i + 1) + ": No status yet...");
      continue;
    }

    console.log("  Poll " + (i + 1) + ": status=" + status.status + ", pages=" + (status.pagesCrawled || 0) + "/" + (status.pagesTotal || "?"));

    // Wait for 'analyzed' status (after orchestrator runs)
    if (status.status === "analyzed" || (status.status === "complete" && i > 5)) {
      console.log("\n=== SCAN COMPLETE ===");
      break;
    }

    if (status.status === "failed") {
      console.log("\n=== SCAN FAILED ===");
      console.log("Error:", status.error);
      return;
    }
  }

  // 5. Check activation data
  console.log("\n5. Checking activation extraction results...");

  // Give analysis a moment to complete
  await new Promise(r => setTimeout(r, 10000));

  const profile = await client.query(api.productProfiles.getForTest, { productId });

  if (!profile) {
    console.log("No profile found - analysis may still be running.");
    console.log("Wait a bit and run scripts/run-analysis.mjs with the product ID.");
    return;
  }

  console.log("\n=== PROFILE ===");
  console.log("Sections:", Object.keys(profile.definitions || {}));

  if (profile.definitions?.activation) {
    const act = profile.definitions.activation;
    console.log("\n=== ACTIVATION EXTRACTION SUCCESS! ===");

    if (act.levels) {
      console.log("Multi-level activation detected!");
      console.log("Levels:", act.levels.length);
      console.log("Primary Activation (aha-moment):", act.primaryActivation);
      console.log("Overall Confidence:", act.overallConfidence);

      console.log("\nActivation Levels:");
      for (const level of act.levels) {
        const marker = level.level === act.primaryActivation ? " ⭐" : "";
        console.log("\n  Level " + level.level + ": " + level.name + marker);
        console.log("    Signal: " + level.signalStrength);
        console.log("    Confidence: " + (level.confidence * 100).toFixed(0) + "%");
        if (level.criteria && level.criteria.length > 0) {
          console.log("    Criteria:");
          for (const c of level.criteria) {
            console.log("      • " + c.action + " (x" + c.count + ")");
          }
        }
      }
    } else {
      console.log("Legacy activation format found (not multi-level)");
    }
  } else {
    console.log("\nNo activation data in profile yet.");
    console.log("The extraction may still be running in the background.");
    console.log("Product ID:", productId);
  }
}

main().catch(console.error);
