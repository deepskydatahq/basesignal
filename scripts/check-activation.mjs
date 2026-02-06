import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");

async function main() {
  const productId = "nh7b23pcgf1t3wbbcyre60ww2s80km7q";

  console.log("Checking product profile for activation data...\n");

  const profile = await client.query(api.productProfiles.get, { productId });

  if (!profile) {
    console.log("No profile found for product");
    return;
  }

  console.log("Profile ID:", profile._id);
  console.log("Completeness:", profile.completenessPercentage + "%");
  console.log("Overall Confidence:", profile.overallConfidence);

  if (profile.definitions?.activation) {
    console.log("\n=== ACTIVATION DATA ===");
    const activation = profile.definitions.activation;

    if (activation.levels) {
      console.log("Multi-level activation found!");
      console.log("Levels:", activation.levels.length);
      console.log("Primary Activation:", activation.primaryActivation);
      console.log("Overall Confidence:", activation.overallConfidence);

      console.log("\nLevels:");
      for (const level of activation.levels) {
        console.log("  L" + level.level + ": " + level.name + " (" + level.signalStrength + ")");
        console.log("    Confidence: " + level.confidence);
        if (level.criteria) {
          for (const c of level.criteria) {
            const tw = c.timeWindow ? ", window: " + c.timeWindow : "";
            console.log("    - " + c.action + " (count: " + c.count + tw + ")");
          }
        }
      }
    } else {
      console.log("Legacy activation format found:");
      console.log(JSON.stringify(activation, null, 2));
    }
  } else {
    console.log("\nNo activation data in profile yet");
    console.log("Available definitions:", Object.keys(profile.definitions || {}));
  }
}

main().catch(console.error);
