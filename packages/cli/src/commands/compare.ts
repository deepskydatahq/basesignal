import type { Command } from "commander";
import { loadConfig } from "../config.js";
import { startViewServer, openBrowser } from "./view.js";

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerCompareCommand(program: Command): void {
  program
    .command("compare <slug1> <slug2>")
    .description("Compare two scanned products side by side in the browser")
    .option("-p, --port <number>", "Server port", "3700")
    .option("--no-open", "Don't open browser automatically")
    .action(async (slug1: string, slug2: string, opts: { port: string; open: boolean }) => {
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

      // Validate both slugs exist
      if (!productDir.exists(slug1)) {
        console.error(`Error: product "${slug1}" not found`);
        process.exit(1);
      }
      if (!productDir.exists(slug2)) {
        console.error(`Error: product "${slug2}" not found`);
        process.exit(1);
      }

      const handle = await startViewServer({ port, productDir });

      const targetUrl = `${handle.url}/compare/${slug1}/${slug2}`;
      console.error(`Listening on ${handle.url}`);
      console.error(`Comparing: ${slug1} vs ${slug2}`);
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
