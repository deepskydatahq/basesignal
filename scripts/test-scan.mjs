// Test scanning via Convex directly
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://woozy-kangaroo-701.convex.cloud");

async function main() {
  console.log("=== CONVEX DIRECT SCAN TEST ===\n");

  // 1. Get or create test user
  console.log("1. Getting/creating test user...");
  const user = await client.mutation(api.users.getOrCreateByClerkId, {
    clerkId: "user_dev_test",
    email: "test@example.com",
    name: "Test User",
  });
  const userId = user._id;
  console.log("User ID:", userId);

  // 2. Check existing products
  console.log("\n2. Checking existing products...");
  const products = await client.query(api.mcpProducts.list, { userId });
  console.log(`Found ${products.length} products`);

  // Check if Miro already exists
  let product = products.find(p => p.url === "https://miro.com");

  if (product) {
    console.log("Miro product already exists:", product._id);
  } else {
    // 3. Create product for miro.com
    console.log("\n3. Creating product for miro.com...");
    const result = await client.mutation(api.mcpProducts.create, {
      userId,
      name: "Miro",
      url: "https://miro.com",
    });
    console.log("Created product:", result);
    product = { _id: result.productId, ...result };
  }

  // 4. Check for existing scan jobs
  console.log("\n4. Checking existing scan jobs...");
  const existingScan = await client.query(api.mcpProducts.getScanStatus, {
    userId,
    productId: product._id,
  });

  if (existingScan && existingScan.status === "complete") {
    console.log("\nScan already completed!");
    console.log("Status:", existingScan.status);
    console.log("Pages crawled:", existingScan.crawledPages?.length || 0);
    console.log("Docs URL:", existingScan.discoveredDocs || "none");
    console.log("Pricing URL:", existingScan.discoveredPricing || "none");

    if (existingScan.crawledPages) {
      console.log("\nStored pages:");
      existingScan.crawledPages.slice(0, 15).forEach(p => {
        console.log(`  [${p.pageType}] ${p.title?.slice(0, 50) || p.url}`);
      });
    }
    return;
  }

  if (existingScan && ["mapping", "crawling"].includes(existingScan.status)) {
    console.log("Scan in progress:", existingScan.status);
    console.log("Waiting for completion...");
  } else {
    // 5. Trigger scan
    console.log("\n5. Triggering scan...");
    const scanResult = await client.mutation(api.mcpProducts.scanProduct, {
      userId,
      productId: product._id,
    });
    console.log("Scan triggered:", scanResult);
  }

  // 6. Poll for completion
  console.log("\n6. Polling for scan completion...");
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const status = await client.query(api.mcpProducts.getScanStatus, {
      userId,
      productId: product._id,
    });

    if (!status) {
      console.log(`  Poll ${i + 1}: No status yet...`);
      continue;
    }

    console.log(`  Poll ${i + 1}: status=${status.status}, phase=${status.currentPhase || "n/a"}, pages=${status.pagesCrawled || 0}/${status.pagesTotal || "?"}`);

    if (status.status === "complete") {
      console.log("\n=== SCAN COMPLETE ===");
      console.log("Pages crawled:", status.crawledPages?.length || 0);
      console.log("Docs URL:", status.discoveredDocs || "none");
      console.log("Pricing URL:", status.discoveredPricing || "none");

      if (status.crawledPages) {
        console.log("\nStored pages:");
        status.crawledPages.slice(0, 15).forEach(p => {
          console.log(`  [${p.pageType}] ${p.title?.slice(0, 50) || p.url}`);
        });
        if (status.crawledPages.length > 15) {
          console.log(`  ... and ${status.crawledPages.length - 15} more`);
        }
      }
      return;
    }

    if (status.status === "failed") {
      console.log("\n=== SCAN FAILED ===");
      console.log("Error:", status.error);
      return;
    }
  }

  console.log("Timeout waiting for scan");
}

main().catch(console.error);
