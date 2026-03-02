import type { Command } from "commander";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exec } from "node:child_process";
import type { ProductDirectory } from "@basesignal/storage";
import { loadConfig } from "../config.js";

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1 { font-size: 1.75rem; margin-bottom: 1.5rem; }
    code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
    th { font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; }
    tr:hover { background: #f9fafb; }
    .empty-state { color: #6b7280; margin-top: 2rem; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

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
    const profile = productDir.readJson<Record<string, unknown>>(slug, "profile.json");
    const identity = profile?.identity as { productName?: string } | undefined;
    const metadata = profile?.metadata as { url?: string; scannedAt?: number } | undefined;
    return {
      slug,
      name: identity?.productName ?? slug,
      url: metadata?.url ?? "",
      scannedAt: metadata?.scannedAt
        ? new Date(metadata.scannedAt).toISOString().split("T")[0]
        : "unknown",
      completeness: (profile?.completeness as number) ?? 0,
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
        <td>${Math.round(p.completeness * 100)}%</td>
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

  if (pathname === "/") {
    const products = loadProductList(productDir);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderProductList(products));
    return;
  }

  // Slug routing: /{slug}
  const slug = decodeURIComponent(pathname.slice(1));
  if (isValidSlug(slug) && productDir.exists(slug)) {
    const profile = productDir.readJson<Record<string, unknown>>(slug, "profile.json");
    const name = (profile?.identity as { productName?: string } | undefined)?.productName ?? slug;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      renderPage(
        name,
        `<p><a href="/">&larr; Back to product list</a></p>\n<h1>${escapeHtml(name)}</h1>\n<p>Full report coming soon.</p>`,
      ),
    );
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
