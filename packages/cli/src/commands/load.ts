import type { Command } from "commander";
import { spawn } from "node:child_process";
import { loadConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_PLATFORMS = ["posthog", "amplitude", "mixpanel", "snowflake"] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

// ---------------------------------------------------------------------------
// Python binary resolution
// ---------------------------------------------------------------------------

/**
 * Find a working Python 3.10+ binary. Tries python3 first, then python.
 * Returns the binary name or throws with a helpful error.
 */
export async function findPythonBinary(): Promise<string> {
  for (const bin of ["python3", "python"]) {
    const version = await getPythonVersion(bin);
    if (version) {
      const [major, minor] = version.split(".").map(Number);
      if (major >= 3 && minor >= 10) return bin;
    }
  }
  throw new Error(
    "Python 3.10+ required. Install Python from https://python.org and ensure it is on your PATH.",
  );
}

async function getPythonVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(bin, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on("error", () => resolve(null));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      // "Python 3.12.1" -> "3.12.1"
      const match = stdout.trim().match(/Python\s+(\d+\.\d+\.\d+)/);
      resolve(match ? match[1] : null);
    });
  });
}

// ---------------------------------------------------------------------------
// Load options
// ---------------------------------------------------------------------------

export interface LoadOptions {
  product: string;
  apiKey?: string;
  projectId?: string;
  host?: string;
  verbose: boolean;
  // Snowflake-specific options
  account?: string;
  user?: string;
  password?: string;
  warehouse?: string;
  database?: string;
  sfSchema?: string;
  table?: string;
  stats?: boolean;
}

// ---------------------------------------------------------------------------
// runLoad -- spawn Python loader
// ---------------------------------------------------------------------------

export async function runLoad(platform: string, options: LoadOptions): Promise<void> {
  // Validate platform
  if (!SUPPORTED_PLATFORMS.includes(platform as Platform)) {
    console.error(
      `Error: Unknown platform "${platform}". Supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`,
    );
    process.exit(1);
  }

  // Resolve output path
  const config = loadConfig({ verbose: options.verbose });
  const slug = options.product;
  const outputPath = `${config.storagePath}/products/${slug}/taxonomy/events.json`;

  // Find Python binary
  let pythonBin: string;
  try {
    pythonBin = await findPythonBinary();
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return; // unreachable, helps TS
  }

  // Build args
  const args = ["-m", "basesignal_loaders", "--platform", platform, "--output", outputPath];

  if (options.apiKey) {
    args.push("--api-key", options.apiKey);
  }
  if (options.projectId) {
    args.push("--project-id", options.projectId);
  }
  if (options.host) {
    args.push("--host", options.host);
  }

  // Snowflake-specific args
  const env = { ...process.env };

  if (options.account) {
    args.push("--account", options.account);
  }
  if (options.user) {
    args.push("--user", options.user);
  }
  if (options.password) {
    // Pass password via environment variable to avoid exposing it in process listings
    env.SNOWFLAKE_PASSWORD = options.password;
  }
  if (options.warehouse) {
    args.push("--warehouse", options.warehouse);
  }
  if (options.database) {
    args.push("--database", options.database);
  }
  if (options.sfSchema) {
    args.push("--sf-schema", options.sfSchema);
  }
  if (options.table) {
    args.push("--table", options.table);
  }
  if (options.stats) {
    args.push("--stats");
  }

  if (options.verbose) {
    console.error(`[Load] Spawning: ${pythonBin} ${args.join(" ")}`);
  }

  // Spawn Python process
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(pythonBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    let stderrOutput = "";

    proc.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderrOutput += text;
      // Forward progress messages to user
      process.stderr.write(text);
    });

    proc.stdout.on("data", (data: Buffer) => {
      // Forward any stdout
      process.stdout.write(data);
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.error(`[Load] Taxonomy saved to ${outputPath}`);
        resolve();
      } else {
        const errMsg = stderrOutput.trim() || `Python process exited with code ${code}`;
        reject(new Error(`Load failed: ${errMsg}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerLoadCommand(program: Command): void {
  program
    .command("load <platform>")
    .description(
      `Load analytics taxonomy from a platform.\nSupported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`,
    )
    .requiredOption("--product <slug>", "Product slug for storage")
    .option("--api-key <key>", "API key for the analytics platform")
    .option("--project-id <id>", "Project/workspace ID on the analytics platform")
    .option("--host <url>", "Custom API host (e.g., for self-hosted PostHog)")
    .option("--account <id>", "Snowflake account identifier")
    .option("--user <name>", "Snowflake username")
    .option("--password <pwd>", "Snowflake password (prefer SNOWFLAKE_PASSWORD env var)")
    .option("--warehouse <name>", "Snowflake warehouse name")
    .option("--database <name>", "Snowflake database name")
    .option("--sf-schema <name>", "Snowflake schema name")
    .option("--table <name>", "Activity schema table name")
    .option("--stats", "Include usage stats (counts, first/last seen)", false)
    .option("-v, --verbose", "Show detailed progress", false)
    .action(async (platform: string, opts: Record<string, unknown>) => {
      try {
        await runLoad(platform, {
          product: opts.product as string,
          apiKey: opts.apiKey as string | undefined,
          projectId: opts.projectId as string | undefined,
          host: opts.host as string | undefined,
          verbose: Boolean(opts.verbose),
          account: opts.account as string | undefined,
          user: opts.user as string | undefined,
          password: opts.password as string | undefined,
          warehouse: opts.warehouse as string | undefined,
          database: opts.database as string | undefined,
          sfSchema: opts.sfSchema as string | undefined,
          table: opts.table as string | undefined,
          stats: Boolean(opts.stats),
        });
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
