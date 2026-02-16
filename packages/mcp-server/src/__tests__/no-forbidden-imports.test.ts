import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..");

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...getAllTsFiles(full));
    } else if (full.endsWith(".ts") && !full.includes("__tests__")) {
      files.push(full);
    }
  }
  return files;
}

describe("no forbidden imports", () => {
  const FORBIDDEN = ["@clerk/", "convex/", '"express"', "'express'"];
  const sourceFiles = getAllTsFiles(srcDir);

  it("has source files to check", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  for (const file of sourceFiles) {
    const relative = file.replace(srcDir, "src");
    it(`${relative} has no forbidden imports`, () => {
      const content = readFileSync(file, "utf-8");
      for (const forbidden of FORBIDDEN) {
        expect(content).not.toContain(forbidden);
      }
    });
  }
});
