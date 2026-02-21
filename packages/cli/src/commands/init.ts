import * as fs from "node:fs";
import * as path from "node:path";
import type { Command } from "commander";

const TEMPLATE = `# basesignal.toml — project-local configuration
# Precedence: env vars > ./basesignal.toml > ~/.basesignal/config.toml > defaults

[provider]
# name = "anthropic"          # "anthropic" | "openai" | "ollama"
# model = "claude-sonnet-4-5-20250929"
# api_key = ""                # prefer env var: ANTHROPIC_API_KEY

[storage]
# path = "~/.basesignal"
# adapter = "file"            # "file" | "sqlite"

[crawl]
# max_pages = 50
# timeout = 30000

[output]
# format = "json"
`;

export function runInit(dir?: string): string {
  const target = path.resolve(dir ?? ".", "basesignal.toml");

  if (fs.existsSync(target)) {
    console.error(`Already exists: ${target}`);
    return target;
  }

  fs.writeFileSync(target, TEMPLATE, "utf-8");
  console.error(`Created ${target}`);
  return target;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a basesignal.toml config file in the current directory")
    .action(() => {
      runInit();
    });
}
