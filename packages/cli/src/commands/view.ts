import type { Command } from "commander";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exec } from "node:child_process";
import type { ProductDirectory, ProductProfile } from "@basesignal/storage";
import { loadConfig } from "../config.js";
import { escapeHtml, renderPage, progressBar } from "./view-html.js";
import { renderProductReport } from "./view-sections.js";
import { renderComparisonReport } from "./compare-sections.js";

// Re-export for tests and consumers
export { escapeHtml, renderPage, progressBar, confidenceBadge } from "./view-html.js";
export { renderProductReport, FootnoteCollector } from "./view-sections.js";
export { renderComparisonReport } from "./compare-sections.js";

// ---------------------------------------------------------------------------
// Product list
// ---------------------------------------------------------------------------

export interface ProductListItem {
  slug: string;
  name: string;
  url: string;
  scannedAt: string;
  completeness: number;
}

export function loadProductList(productDir: ProductDirectory): ProductListItem[] {
  const slugs = productDir.listProducts();
  return slugs.map((slug) => {
    const profile = productDir.readJson<ProductProfile>(slug, "profile.json");
    return {
      slug,
      name: profile?.identity?.productName ?? slug,
      url: profile?.metadata?.url ?? "",
      scannedAt: profile?.metadata?.scannedAt
        ? new Date(profile.metadata.scannedAt).toISOString().split("T")[0]
        : "unknown",
      completeness: profile?.completeness ?? 0,
    };
  });
}

export function renderProductList(products: ProductListItem[]): string {
  if (products.length === 0) {
    return renderPage(
      "Basesignal",
      `<h1>Basesignal</h1>
<div class="empty-state">
  <p>No products scanned yet.</p>
  <p>Run <code>basesignal scan &lt;url&gt;</code> to get started.</p>
</div>`,
    );
  }

  const rows = products
    .map(
      (p) => `      <tr>
        <td><a href="/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a></td>
        <td>${escapeHtml(p.url)}</td>
        <td>${escapeHtml(p.scannedAt)}</td>
        <td>${progressBar(p.completeness, true)} ${Math.round(p.completeness * 100)}%</td>
      </tr>`,
    )
    .join("\n");

  return renderPage(
    "Basesignal",
    `<h1>Basesignal</h1>
<table>
  <thead>
    <tr><th>Product</th><th>URL</th><th>Scanned</th><th>Completeness</th></tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`,
  );
}

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) && slug.length <= 128;
}

// ---------------------------------------------------------------------------
// Browser auto-open
// ---------------------------------------------------------------------------

export function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error("Could not open browser automatically. Visit:", url);
    }
  });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(
  productDir: ProductDirectory,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/") {
    const products = loadProductList(productDir);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderProductList(products));
    return;
  }

  // Compare routing: /compare/{slug1}/{slug2}
  const compareMatch = pathname.match(/^\/compare\/([^/]+)\/([^/]+)$/);
  if (compareMatch) {
    const slug1 = decodeURIComponent(compareMatch[1]);
    const slug2 = decodeURIComponent(compareMatch[2]);

    if (!isValidSlug(slug1) || !productDir.exists(slug1)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        renderPage(
          "Not Found",
          `<h1>Product not found</h1>\n<p>No product with slug &ldquo;${escapeHtml(slug1)}&rdquo; exists.</p>\n<p><a href="/">Back to product list</a></p>`,
        ),
      );
      return;
    }

    if (!isValidSlug(slug2) || !productDir.exists(slug2)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        renderPage(
          "Not Found",
          `<h1>Product not found</h1>\n<p>No product with slug &ldquo;${escapeHtml(slug2)}&rdquo; exists.</p>\n<p><a href="/">Back to product list</a></p>`,
        ),
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderComparisonReport(slug1, slug2, productDir));
    return;
  }

  // Slug routing: /{slug}
  const slug = decodeURIComponent(pathname.slice(1));
  if (isValidSlug(slug) && productDir.exists(slug)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderProductReport(slug, productDir));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    renderPage(
      "Not Found",
      `<h1>Product not found</h1>\n<p>No product with slug &ldquo;${escapeHtml(slug)}&rdquo; exists.</p>\n<p><a href="/">Back to product list</a></p>`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export interface ViewServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export function startViewServer(options: {
  port: number;
  productDir: ProductDirectory;
}): Promise<ViewServerHandle> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      handleRequest(options.productDir, req, res);
    });

    server.on("error", reject);

    server.listen(options.port, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://localhost:${addr.port}`,
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerViewCommand(program: Command): void {
  program
    .command("view [slug]")
    .description("View scan results in the browser")
    .option("-p, --port <number>", "Server port", "3700")
    .option("--no-open", "Don't open browser automatically")
    .action(async (slug: string | undefined, opts: { port: string; open: boolean }) => {
      const port = Number(opts.port);
      if (!Number.isFinite(port) || port < 0 || port > 65535) {
        console.error(`Error: invalid port "${opts.port}"`);
        process.exit(1);
      }

      const config = loadConfig({ verbose: program.opts().verbose });
      const { ProductDirectory } = await import("@basesignal/storage");
      const productDir = new ProductDirectory({
        root: config.storagePath + "/products",
      });

      const handle = await startViewServer({ port, productDir });

      const targetUrl = slug
        ? `${handle.url}/${slug}`
        : handle.url;
      console.error(`Listening on ${handle.url}`);
      if (opts.open) {
        openBrowser(targetUrl);
      }

      const shutdown = () => {
        handle.close().then(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
