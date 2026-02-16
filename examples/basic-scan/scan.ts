/**
 * Basic Basesignal scan example.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scan.ts https://linear.app
 */
import { execSync } from "node:child_process";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scan.ts <url>");
  process.exit(1);
}

console.log(`Scanning ${url}...`);
const result = execSync(`npx basesignal scan ${url}`, {
  encoding: "utf-8",
  env: { ...process.env },
  stdio: ["pipe", "pipe", "inherit"],
});

console.log(result);
