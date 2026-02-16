import type { StorageAdapter, ProductProfile } from "./types.js";

export type ResolveResult =
  | { success: true; profile: ProductProfile; id: string }
  | { success: false; error: string };

export async function resolveProduct(
  storage: StorageAdapter,
  productId?: string
): Promise<ResolveResult> {
  if (productId) {
    const profile = await storage.load(productId);
    if (!profile) {
      return {
        success: false,
        error: `No product found with ID '${productId}'. Use list_products to see available products.`,
      };
    }
    return { success: true, profile, id: productId };
  }

  const summaries = await storage.list();

  if (summaries.length === 0) {
    return {
      success: false,
      error: "No products found. Use scan_product to analyze a website first.",
    };
  }

  if (summaries.length === 1) {
    const profile = await storage.load(summaries[0].id);
    if (!profile) {
      return {
        success: false,
        error: `Failed to load product '${summaries[0].id}'.`,
      };
    }
    return { success: true, profile, id: summaries[0].id };
  }

  const listing = summaries
    .map((s) => `- **${s.name}** (${s.url}) -- ID: ${s.id}`)
    .join("\n");
  return {
    success: false,
    error: `You have ${summaries.length} products. Please specify a productId:\n${listing}`,
  };
}
