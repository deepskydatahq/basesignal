// Directly test activation extraction
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");
const productId = "nh78n36ve9dt5q0z2pnj9gadnx80mm54"; // Linear

console.log("Testing activation extraction directly for Linear...\n");

try {
  const result = await client.action(api.analysis.extractActivationLevels.testExtractActivation, {
    productId,
  });

  console.log("=== EXTRACTION RESULT ===");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log("=== EXTRACTION ERROR ===");
  console.log(error.message);
  console.log("\nFull error:", error);
}
