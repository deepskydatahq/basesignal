import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withUser, withUserArgs } from "../lib/withUser.js";
import { getConvexClient } from "../lib/convex.js";
import { api } from "../../convex/_generated/api.js";

export function registerProductTools(server: McpServer) {
  server.registerTool(
    "create_product",
    {
      title: "Create Product",
      description:
        "Create a new product workspace. Provide the product name and website URL.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Product name" },
          url: {
            type: "string",
            description: "Product website URL (e.g. https://acme.io)",
          },
        },
        required: ["name", "url"],
      },
    },
    withUserArgs(async (user, args: { name: string; url: string }) => {
      const client = getConvexClient();
      const result = await client.mutation(api.mcpProducts.create, {
        userId: user._id as any,
        name: args.name,
        url: args.url,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    })
  );

  server.registerTool(
    "list_products",
    {
      title: "List Products",
      description: "List all your product workspaces.",
    },
    withUser(async (user) => {
      const client = getConvexClient();
      const products = await client.query(api.mcpProducts.list, {
        userId: user._id as any,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              products.length === 0
                ? "No products yet. Use create_product to add one."
                : JSON.stringify(products, null, 2),
          },
        ],
      };
    })
  );

  server.registerTool(
    "scan_product",
    {
      title: "Scan Product Website",
      description:
        "Crawl a product's website to extract information about pricing, features, docs, and more. The scan runs asynchronously — use get_scan_status to check progress.",
      inputSchema: {
        type: "object" as const,
        properties: {
          productId: {
            type: "string",
            description: "Product ID (from list_products or create_product)",
          },
        },
        required: ["productId"],
      },
    },
    withUserArgs(async (user, args: { productId: string }) => {
      const client = getConvexClient();
      const result = await client.mutation(api.mcpProducts.scanProduct, {
        userId: user._id as any,
        productId: args.productId as any,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    })
  );

  server.registerTool(
    "get_scan_status",
    {
      title: "Get Scan Status",
      description:
        "Check the status of the latest scan for a product. Returns progress, phase, and results.",
      inputSchema: {
        type: "object" as const,
        properties: {
          productId: {
            type: "string",
            description: "Product ID to check scan status for",
          },
        },
        required: ["productId"],
      },
    },
    withUserArgs(async (user, args: { productId: string }) => {
      const client = getConvexClient();
      const scan = await client.query(api.mcpProducts.getScanStatus, {
        userId: user._id as any,
        productId: args.productId as any,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: scan
              ? JSON.stringify(scan, null, 2)
              : "No scans found for this product.",
          },
        ],
      };
    })
  );
}
