import type { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { resolveInput } from "../lib/resolve-input.js";
import type { StorageAdapter } from "@basesignal/mcp-server";

export function registerExportCommand(
  program: Command,
  getStorage: () => StorageAdapter | Promise<StorageAdapter>,
): void {
  program
    .command("export [id-or-file]")
    .description("Export a product profile as markdown or JSON")
    .option(
      "-f, --format <format>",
      "Output format (markdown|json)",
      "markdown",
    )
    .option("-o, --output <path>", "Write to file instead of stdout")
    .option("-l, --list", "List all stored profiles")
    .action(
      async (
        idOrFile: string | undefined,
        opts: {
          format: string;
          output?: string;
          list?: boolean;
        },
      ) => {
        const storage = await getStorage();

        // --list: show all profiles
        if (opts.list) {
          const profiles = await storage.list();
          if (profiles.length === 0) {
            console.log(
              "No profiles stored. Run `basesignal scan <url>` to create one.",
            );
            return;
          }
          for (const p of profiles) {
            console.log(
              `  ${p.id}  ${p.name}  ${p.url}  (${new Date(p.updatedAt).toISOString().split("T")[0]})`,
            );
          }
          return;
        }

        // Require id-or-file when not listing
        if (!idOrFile) {
          console.error(
            "Error: provide a profile ID or file path. Use --list to see stored profiles.",
          );
          process.exit(1);
        }

        // Resolve input type
        const input = resolveInput(idOrFile);
        let profile;

        if (input.type === "file") {
          try {
            const raw = readFileSync(input.path, "utf-8");
            profile = JSON.parse(raw);
          } catch (err) {
            console.error(
              `Error: could not read file "${input.path}": ${err instanceof Error ? err.message : String(err)}`,
            );
            process.exit(1);
          }
        } else {
          const loaded = await storage.load(input.id);
          if (!loaded) {
            console.error(
              `Error: profile "${input.id}" not found. Use --list to see stored profiles.`,
            );
            process.exit(1);
          }
          profile = loaded;
        }

        // Validate format
        const format = opts.format as "markdown" | "json";
        if (format !== "markdown" && format !== "json") {
          console.error(
            `Error: unsupported format "${opts.format}". Use "markdown" or "json".`,
          );
          process.exit(1);
        }

        // Dynamic import to avoid loading mcp-server deps for other commands
        const { exportProfileAsJson, exportProfileAsMarkdown } = await import(
          "@basesignal/mcp-server"
        );

        // Format the profile
        const output =
          format === "json"
            ? exportProfileAsJson(profile)
            : exportProfileAsMarkdown(profile);

        // Output to file or stdout
        if (opts.output) {
          writeFileSync(opts.output, output, "utf-8");
          console.error(`Written to ${opts.output}`);
        } else {
          process.stdout.write(output);
        }
      },
    );
}
