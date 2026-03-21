import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { registerScanCommand, validateUrl } from "./scan.js";
import { ScanError } from "../errors.js";

/**
 * Tests for the --docs flag wired into the scan command.
 * Validates command registration, option parsing, and error codes.
 */
describe("scan --docs flag", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "basesignal-scan-docs-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("registers --docs option on the scan command", () => {
    const program = new Command();
    registerScanCommand(program);

    const scanCmd = program.commands.find((c) => c.name() === "scan");
    expect(scanCmd).toBeDefined();

    const docsOpt = scanCmd!.options.find((o) => o.long === "--docs");
    expect(docsOpt).toBeDefined();
    expect(docsOpt!.flags).toContain("-d");
    expect(docsOpt!.flags).toContain("--docs <dir>");
  });

  it("has both short -d and long --docs flags", () => {
    const program = new Command();
    registerScanCommand(program);
    const scanCmd = program.commands.find((c) => c.name() === "scan")!;
    const docsOpt = scanCmd.options.find((o) => o.long === "--docs")!;
    expect(docsOpt.short).toBe("-d");
  });

  it("docs-not-found is a valid ScanErrorCode", () => {
    const error = new ScanError(
      "docs-not-found",
      "Directory not found: /nonexistent",
      "Check the path",
    );
    expect(error.code).toBe("docs-not-found");
    expect(error.message).toContain("Directory not found");
    expect(error.suggestion).toBe("Check the path");
  });

  it("validateUrl still works correctly (no regression)", () => {
    const parsed = validateUrl("https://example.com");
    expect(parsed.href).toBe("https://example.com/");
  });

  it("validateUrl rejects non-HTTP protocols (no regression)", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow(ScanError);
  });
});
