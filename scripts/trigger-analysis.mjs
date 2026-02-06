import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");

async function main() {
  const productId = "nh7b23pcgf1t3wbbcyre60ww2s80km7q";

  console.log("Checking for existing profile...");
  let profile = await client.query(api.productProfiles.get, { productId });
  
  if (!profile) {
    console.log("Creating profile...");
    await client.mutation(api.productProfiles.create, { productId });
    profile = await client.query(api.productProfiles.get, { productId });
    console.log("Profile created:", profile._id);
  } else {
    console.log("Profile exists:", profile._id);
  }

  console.log("\nProfile definitions:", Object.keys(profile.definitions || {}));
  
  if (profile.definitions?.activation) {
    console.log("\n=== ACTIVATION ALREADY EXISTS ===");
    const act = profile.definitions.activation;
    if (act.levels) {
      console.log("Levels:", act.levels.length);
      console.log("Primary:", act.primaryActivation);
      for (const l of act.levels) {
        console.log("  L" + l.level + ": " + l.name + " (" + l.signalStrength + ")");
      }
    }
  } else {
    console.log("\nNo activation data yet.");
    console.log("The extractActivationLevels action needs to be triggered.");
    console.log("This is typically done via the analysis orchestrator after scan completion.");
  }
}

main().catch(console.error);
