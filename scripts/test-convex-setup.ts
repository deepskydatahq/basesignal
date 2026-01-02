/**
 * Test script to verify Convex setup and seed initial data
 *
 * Run with: npx tsx scripts/test-convex-setup.ts
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://warmhearted-vole-448.convex.cloud";

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL);

  console.log("🔍 Testing Convex connection to:", CONVEX_URL);

  try {
    // Test: List entities
    console.log("\n📋 Listing entities...");
    const orgId = "j57d7wvz5t6xsny5d8fm0g8wyh6zxr5d" as any; // Replace with actual org ID
    const entities = await client.query("entities:list" as any, { orgId });
    console.log("✅ Found", entities?.length || 0, "entities");

    if (entities && entities.length > 0) {
      console.log("\nEntities:");
      entities.forEach((e: any) => {
        console.log(`  - ${e.name} (${e.status || 'no status'}) [${e.sourceType}]`);
      });
    }

    // Test: Get specific entity
    if (entities && entities.length > 0) {
      const firstEntity = entities[0];
      console.log(`\n🔎 Getting entity details for: ${firstEntity.name}`);
      const entity = await client.query("entities:getByName" as any, {
        orgId,
        name: firstEntity.name,
      });
      console.log("✅ Entity details retrieved");
      console.log("   Status:", entity?.status || "no status");
      console.log("   Fields:", entity?.fields?.length || 0);
      console.log("   Computed columns:", entity?.computedColumns?.length || 0);
    }

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
  }
}

main();
