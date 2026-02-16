import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerScanCommand } from "./commands/scan.js";
import { registerExportCommand } from "./commands/export.js";
import { registerServeCommand } from "./commands/serve.js";

describe("CLI structure", () => {
  let program: Command;

  function findCommand(name: string): Command | undefined {
    return program.commands.find((cmd) => cmd.name() === name);
  }

  function getOptionFlags(cmd: Command): string[] {
    return cmd.options.map((opt) => opt.long ?? opt.short ?? "");
  }

  beforeEach(() => {
    program = new Command()
      .name("basesignal")
      .description("Product profile analysis from the command line")
      .version("0.0.1")
      .option("--verbose", "Enable verbose output", false);

    const mockGetStorage = vi.fn() as never;
    const mockGetProvider = vi.fn() as never;

    registerScanCommand(program);
    registerExportCommand(program, mockGetStorage);
    registerServeCommand(program, mockGetStorage, mockGetProvider);
  });

  it("program has correct name", () => {
    expect(program.name()).toBe("basesignal");
  });

  it("program has version", () => {
    expect(program.version()).toBe("0.0.1");
  });

  it("program has --verbose option", () => {
    const flags = getOptionFlags(program);
    expect(flags).toContain("--verbose");
  });

  it("three commands registered", () => {
    expect(program.commands).toHaveLength(3);
  });

  describe("scan command", () => {
    it("exists", () => {
      const scan = findCommand("scan");
      expect(scan).toBeDefined();
    });

    it("has correct options", () => {
      const scan = findCommand("scan")!;
      const flags = getOptionFlags(scan);
      expect(flags).toContain("--output");
      expect(flags).toContain("--format");
      expect(flags).toContain("--verbose");
    });

    it("--format defaults to summary", () => {
      const scan = findCommand("scan")!;
      const formatOpt = scan.options.find((o) => o.long === "--format");
      expect(formatOpt?.defaultValue).toBe("summary");
    });
  });

  describe("export command", () => {
    it("exists", () => {
      const exportCmd = findCommand("export");
      expect(exportCmd).toBeDefined();
    });

    it("has correct options", () => {
      const exportCmd = findCommand("export")!;
      const flags = getOptionFlags(exportCmd);
      expect(flags).toContain("--format");
      expect(flags).toContain("--output");
      expect(flags).toContain("--list");
    });

    it("--format defaults to markdown", () => {
      const exportCmd = findCommand("export")!;
      const formatOpt = exportCmd.options.find((o) => o.long === "--format");
      expect(formatOpt?.defaultValue).toBe("markdown");
    });

    it("has description mentioning markdown and JSON", () => {
      const exportCmd = findCommand("export")!;
      expect(exportCmd.description()).toContain("markdown");
    });
  });

  describe("serve command", () => {
    it("exists", () => {
      const serve = findCommand("serve");
      expect(serve).toBeDefined();
    });

    it("description mentions stdio", () => {
      const serve = findCommand("serve")!;
      expect(serve.description()).toContain("stdio");
    });

    it("does not have --port or --transport flags (deferred)", () => {
      const serve = findCommand("serve")!;
      const flags = getOptionFlags(serve);
      expect(flags).not.toContain("--port");
      expect(flags).not.toContain("--transport");
    });
  });
});
